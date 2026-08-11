// Personalisation without filter bubbles: explicit diversity guards.
// User-selected regions/topics + perspective entropy enforcement.

import type { StoryCluster, SourceMix } from "./storyModel";

export interface PersonalisationPrefs {
  regions: string[]; // ISO2
  topics: string[]; // canonical topic names
  minPerspectives: number; // e.g. 2 → require at least 2 distinct perspectives
  maxSameCountryShare: number; // 0..1, e.g. 0.6 → no country >60% of feed
}

export const DEFAULT_PREFS: PersonalisationPrefs = { regions: [], topics: [], minPerspectives: 2, maxSameCountryShare: 0.6 };

export function filterByPrefs(stories: StoryCluster[], prefs: PersonalisationPrefs): StoryCluster[] {
  let out = stories;
  if (prefs.regions.length) {
    const set = new Set(prefs.regions.map(s=>s.toUpperCase()));
    out = out.filter(s=> !s.location?.countryCode || set.has(s.location.countryCode));
  }
  if (prefs.topics.length) {
    const set = new Set(prefs.topics);
    out = out.filter(s=> set.has(s.topic));
  }
  return out;
}

export function diversityGuard(stories: StoryCluster[], prefs: PersonalisationPrefs): { passed: boolean; issues: string[]; injected: StoryCluster[] } {
  const issues: string[] = [];
  const byCountry = new Map<string, number>();
  for (const s of stories) {
    const cc = s.location?.countryCode ?? s.sources[0]?.countryCode ?? "unknown";
    byCountry.set(cc, (byCountry.get(cc)??0)+1);
  }
  const total = stories.length || 1;
  for (const [cc, n] of byCountry) if (n/total > prefs.maxSameCountryShare) issues.push(`Country ${cc} is ${Math.round(n/total*100)}% of this view — above ${Math.round(prefs.maxSameCountryShare*100)}% cap`);
  const perspectives = new Set(stories.flatMap(s=> s.sourceMix.byPerspective.map(p=>p.perspective).filter(p=>p!=="unknown")));
  if (perspectives.size < prefs.minPerspectives && stories.length >= 3) issues.push(`Only ${perspectives.size} perspective(s) — below minimum ${prefs.minPerspectives}`);
  return { passed: issues.length===0, issues, injected: [] };
}

export function explicitDiversityNote(mix: SourceMix): string {
  const n = mix.byPerspective.filter(p=> p.perspective !== "unknown").length;
  if (n >= 3) return "Good viewpoint diversity: 3+ perspectives represented.";
  if (n === 2) return "Two perspectives represented — search for a third view where available.";
  if (n === 1) return "Single perspective in this cluster — compare with another outlet where possible.";
  return "Perspective mix unavailable for this cluster.";
}

export function isFilterBubble(stories: StoryCluster[]): { bubble: boolean; reason: string | null } {
  if (stories.length < 5) return { bubble: false, reason: null };
  const topics = new Set(stories.map(s=>s.topic));
  if (topics.size === 1) return { bubble: true, reason: `All ${stories.length} stories are ${[...topics][0]} — broaden topics to avoid narrowing` };
  const ccs = new Set(stories.map(s=> s.location?.countryCode ?? s.sources[0]?.countryCode).filter(Boolean));
  if (ccs.size === 1) return { bubble: true, reason: `All stories from ${[...ccs][0]} — add another region` };
  return { bubble: false, reason: null };
}
