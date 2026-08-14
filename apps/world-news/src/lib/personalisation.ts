// Personalisation with an explicit anti-narrowing mechanism.
//
// The previous version had a diversityGuard that returned `injected: []` — it
// could name the problem and do nothing about it. Detecting a filter bubble
// and then serving it anyway is worse than not measuring, because it produces
// a reassuring panel above an unchanged feed.
//
// So the contract here is: preferences shape the feed, and a reserved share of
// every feed is filled from *outside* those preferences. The reserved share is
// visible, labelled, and adjustable — but not zero. A reader who wants only one
// topic can have mostly that topic; they cannot have a feed that has quietly
// stopped showing them the rest of the world.

import type { StoryCluster } from "./storyModel";
import type { DiversityReport } from "./sourcing";
import { regionOf, type Region } from "./coverageBias";

export interface PersonalisationPrefs {
  regions: string[]; // ISO2
  topics: string[]; // canonical topic names
  /** Minimum distinct perspectives before the feed is considered balanced. */
  minPerspectives: number;
  /** No single country may exceed this share of the feed. */
  maxSameCountryShare: number;
  /** No single topic may exceed this share of the feed. */
  maxSameTopicShare: number;
  /**
   * Share of the feed reserved for stories outside the reader's preferences.
   * Floored at 0.1 — the whole point is that it cannot be switched off.
   */
  discoveryShare: number;
}

export const DEFAULT_PREFS: PersonalisationPrefs = {
  regions: [],
  topics: [],
  minPerspectives: 2,
  maxSameCountryShare: 0.6,
  maxSameTopicShare: 0.5,
  discoveryShare: 0.25,
};

/** Preferences can be relaxed but the discovery floor cannot be removed. */
export const MIN_DISCOVERY_SHARE = 0.1;

export function normalisePrefs(prefs: Partial<PersonalisationPrefs>): PersonalisationPrefs {
  return {
    ...DEFAULT_PREFS,
    ...prefs,
    discoveryShare: Math.max(MIN_DISCOVERY_SHARE, Math.min(1, prefs.discoveryShare ?? DEFAULT_PREFS.discoveryShare)),
  };
}

function countryOf(s: StoryCluster): string {
  return s.location?.countryCode ?? s.sources[0]?.countryCode ?? "unknown";
}

/** Stories matching the reader's stated preferences. */
export function filterByPrefs(stories: StoryCluster[], prefs: PersonalisationPrefs): StoryCluster[] {
  let out = stories;
  if (prefs.regions.length) {
    const set = new Set(prefs.regions.map((s) => s.toUpperCase()));
    out = out.filter((s) => !s.location?.countryCode || set.has(s.location.countryCode));
  }
  if (prefs.topics.length) {
    const set = new Set(prefs.topics);
    out = out.filter((s) => set.has(s.topic));
  }
  return out;
}

export interface FeedComposition {
  stories: StoryCluster[];
  /** Ids of stories included specifically to widen the view. */
  discoveryIds: string[];
  /** Why each discovery story is there — shown next to it, not hidden. */
  discoveryReasons: Record<string, string>;
  issues: string[];
  composition: {
    matched: number;
    discovery: number;
    topics: number;
    countries: number;
    regions: number;
  };
}

/**
 * Build a feed that respects preferences without collapsing into them.
 *
 * Discovery slots are filled by greatest *absence*: the region and topic least
 * represented in what the reader already sees goes first. That makes the
 * mechanism predictable — a reader can look at the labelled slots and see
 * exactly what their preferences were leaving out.
 */
export function composeFeed(
  all: StoryCluster[],
  prefsInput: Partial<PersonalisationPrefs>,
  limit = 20,
): FeedComposition {
  const prefs = normalisePrefs(prefsInput);
  const matched = filterByPrefs(all, prefs);
  const matchedIds = new Set(matched.map((s) => s.id));
  const outside = all.filter((s) => !matchedIds.has(s.id));

  const discoverySlots = Math.max(
    outside.length ? 1 : 0,
    Math.round(limit * prefs.discoveryShare),
  );
  const keepSlots = Math.max(0, limit - discoverySlots);

  const chosen: StoryCluster[] = [];
  const seenTopics = new Map<string, number>();
  const seenCountries = new Map<string, number>();

  // Preference-matched stories first, capped so one topic or country cannot
  // take the whole feed even when every preferred story shares it.
  const topicCap = Math.max(1, Math.floor(limit * prefs.maxSameTopicShare));
  const countryCap = Math.max(1, Math.floor(limit * prefs.maxSameCountryShare));
  const overflow: StoryCluster[] = [];
  for (const s of matched) {
    if (chosen.length >= keepSlots) { overflow.push(s); continue; }
    const t = seenTopics.get(s.topic) ?? 0;
    const c = seenCountries.get(countryOf(s)) ?? 0;
    if (t >= topicCap || c >= countryCap) { overflow.push(s); continue; }
    seenTopics.set(s.topic, t + 1);
    seenCountries.set(countryOf(s), c + 1);
    chosen.push(s);
  }

  // Discovery: rank outside stories by how much they add that is missing.
  const discoveryIds: string[] = [];
  const discoveryReasons: Record<string, string> = {};
  const presentRegions = new Set(chosen.map((s) => regionOf(countryOf(s))));
  const presentTopics = new Set(chosen.map((s) => s.topic));

  const scored = outside
    .map((s) => {
      const region = regionOf(countryOf(s));
      let score = 0;
      const why: string[] = [];
      if (!presentRegions.has(region) && region !== "Unknown") { score += 3; why.push(`first story from ${region}`); }
      if (!presentTopics.has(s.topic)) { score += 2; why.push(`only ${s.topic} story`); }
      if ((s.significance ?? 0) >= 60) { score += 1; why.push("high significance"); }
      return { story: s, score, why };
    })
    .sort((a, b) => b.score - a.score || (b.story.significance ?? 0) - (a.story.significance ?? 0));

  for (const { story, why } of scored) {
    if (discoveryIds.length >= discoverySlots) break;
    const region = regionOf(countryOf(story));
    chosen.push(story);
    discoveryIds.push(story.id);
    discoveryReasons[story.id] = why.length
      ? `Outside your topics — ${why[0]}`
      : "Outside your topics — added to keep the view wide";
    presentRegions.add(region);
    presentTopics.add(story.topic);
  }

  // Backfill from preference overflow if discovery could not fill its slots —
  // still under the caps, or the backfill quietly undoes them.
  for (const s of overflow) {
    if (chosen.length >= limit) break;
    const t = seenTopics.get(s.topic) ?? 0;
    const c = seenCountries.get(countryOf(s)) ?? 0;
    if (t >= topicCap || c >= countryCap) continue;
    seenTopics.set(s.topic, t + 1);
    seenCountries.set(countryOf(s), c + 1);
    chosen.push(s);
  }

  const issues = feedIssues(chosen, prefs);
  return {
    stories: chosen.slice(0, limit),
    discoveryIds,
    discoveryReasons,
    issues,
    composition: {
      matched: chosen.length - discoveryIds.length,
      discovery: discoveryIds.length,
      topics: new Set(chosen.map((s) => s.topic)).size,
      countries: new Set(chosen.map(countryOf)).size,
      regions: new Set(chosen.map((s) => regionOf(countryOf(s)))).size,
    },
  };
}

/** Concrete problems with a composed feed, in reader-facing wording. */
export function feedIssues(stories: StoryCluster[], prefs: PersonalisationPrefs): string[] {
  const issues: string[] = [];
  const total = stories.length || 1;
  const byCountry = new Map<string, number>();
  const byTopic = new Map<string, number>();
  for (const s of stories) {
    byCountry.set(countryOf(s), (byCountry.get(countryOf(s)) ?? 0) + 1);
    byTopic.set(s.topic, (byTopic.get(s.topic) ?? 0) + 1);
  }
  for (const [cc, n] of byCountry) {
    if (cc !== "unknown" && n / total > prefs.maxSameCountryShare) {
      issues.push(`${Math.round((n / total) * 100)}% of this feed is ${cc} — above the ${Math.round(prefs.maxSameCountryShare * 100)}% cap.`);
    }
  }
  for (const [t, n] of byTopic) {
    if (n / total > prefs.maxSameTopicShare) {
      issues.push(`${Math.round((n / total) * 100)}% of this feed is ${t} — above the ${Math.round(prefs.maxSameTopicShare * 100)}% cap.`);
    }
  }
  const perspectives = new Set(
    stories.flatMap((s) => s.sourceMix.byPerspective.map((p) => p.perspective).filter((p) => p !== "unknown")),
  );
  if (perspectives.size < prefs.minPerspectives && stories.length >= 3) {
    issues.push(`Only ${perspectives.size} perspective(s) represented — below the minimum of ${prefs.minPerspectives}.`);
  }
  const regions = new Set(stories.map((s) => regionOf(countryOf(s))).filter((r) => r !== "Unknown"));
  if (regions.size <= 1 && stories.length >= 5) {
    issues.push(`Every story is from ${[...regions][0] ?? "one region"} — the view has narrowed to a single region.`);
  }
  return issues;
}

/** Back-compatible guard for callers that only want the diagnosis. */
export function diversityGuard(
  stories: StoryCluster[],
  prefs: PersonalisationPrefs,
): { passed: boolean; issues: string[]; injected: StoryCluster[] } {
  const issues = feedIssues(stories, prefs);
  return { passed: issues.length === 0, issues, injected: [] };
}

/** One line on how independent a story's sourcing actually is. */
export function explicitDiversityNote(report: DiversityReport): string {
  if (report.totalSources === 0) return "No sources attached to this story yet.";
  if (report.independentGroups === 1) {
    return "Every source here traces to one owner — read this as a single account.";
  }
  if (report.independentGroups >= 4) {
    return `${report.independentGroups} independent owners, ${Math.round(report.nonEnglishShare * 100)}% non-English — well corroborated.`;
  }
  return `${report.independentGroups} independent owners — worth finding a third unrelated account.`;
}

export function isFilterBubble(stories: StoryCluster[]): { bubble: boolean; reason: string | null } {
  if (stories.length < 5) return { bubble: false, reason: null };
  const topics = new Set(stories.map((s) => s.topic));
  if (topics.size === 1) return { bubble: true, reason: `All ${stories.length} stories are ${[...topics][0]} — broaden topics to avoid narrowing.` };
  const regions = new Set(stories.map((s) => regionOf(countryOf(s))).filter((r): r is Region => r !== "Unknown"));
  if (regions.size === 1) return { bubble: true, reason: `All stories are from ${[...regions][0]} — add another region.` };
  const ccs = new Set(stories.map(countryOf).filter((c) => c !== "unknown"));
  if (ccs.size === 1) return { bubble: true, reason: `All stories are from ${[...ccs][0]} — add another country.` };
  return { bubble: false, reason: null };
}
