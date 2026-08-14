// Notification quality.
//
// The previous rule was `shouldNotify = any non-new-story change || >= 2
// changes`, which fires on a timeline gaining two entries and on a story being
// reworded. A news app that pings for those gets muted, and then it cannot
// reach the reader for the correction that actually mattered.
//
// The model here: score each candidate on what a reader would want to be
// interrupted for, then apply the constraints that decide whether interrupting
// is acceptable *right now* — recent volume, quiet hours, and whether we
// already told them this. Both halves are needed; a good score during a
// notification storm is still a bad notification.

import type { CountryNews } from "./gemini";
import type { StoryCluster } from "./storyModel";
import { whatChanged, type ChangeKind, type StoryChange } from "./storyRelations";

export type NotificationKind =
  | "correction"
  | "figure-revised"
  | "dispute"
  | "major-development"
  | "new-significant-story"
  | "followed-topic";

export interface NotificationCandidate {
  kind: NotificationKind;
  storyId: string;
  headline: string;
  /** One line — this is what the reader sees. */
  body: string;
  /** 0..100. Above `URGENT_SCORE` it may break quiet hours. */
  score: number;
  reasons: string[];
}

/** Corrections to something already sent are the only thing worth waking someone for. */
export const URGENT_SCORE = 90;
/** Below this, a change is a feed item rather than an interruption. */
export const NOTIFY_THRESHOLD = 62;

const KIND_BASE: Record<ChangeKind, { kind: NotificationKind; base: number } | null> = {
  correction: { kind: "correction", base: 92 },
  "figure-revised": { kind: "figure-revised", base: 84 },
  "dispute-added": { kind: "dispute", base: 74 },
  "dispute-resolved": { kind: "dispute", base: 66 },
  "new-claim": { kind: "major-development", base: 58 },
  "claim-dropped": null,
  "summary-rewritten": null,
  "status-change": { kind: "major-development", base: 60 },
  "timeline-extended": null,
};

export interface NotificationContext {
  /** Topics the reader explicitly follows. */
  followedTopics?: string[];
  /** Countries the reader explicitly follows. */
  followedRegions?: string[];
  /** Reader's local hour, 0-23. Used for quiet hours only. */
  localHour?: number;
  quietHours?: { from: number; to: number };
  /** Notifications already sent in the last 24h — for volume limits. */
  recentlySent?: { storyId: string; kind: NotificationKind; at: string }[];
  /** Max notifications in a rolling 24h window. */
  dailyCap?: number;
}

export const DEFAULT_QUIET_HOURS = { from: 22, to: 7 };
export const DEFAULT_DAILY_CAP = 4;

function inQuietHours(hour: number, quiet: { from: number; to: number }): boolean {
  // Windows that wrap midnight are the normal case, so handle both.
  return quiet.from <= quiet.to
    ? hour >= quiet.from && hour < quiet.to
    : hour >= quiet.from || hour < quiet.to;
}

/**
 * Turn story changes into scored notification candidates.
 *
 * Significance modulates but does not create: a trivial change to an important
 * story is still trivial. Followed topics add weight because the reader asked
 * for them, capped so that following a topic cannot promote noise into an
 * interruption.
 */
export function candidatesFor(
  story: StoryCluster,
  changes: StoryChange[],
  ctx: NotificationContext = {},
): NotificationCandidate[] {
  const followsTopic = ctx.followedTopics?.includes(story.topic) ?? false;
  const followsRegion = Boolean(story.location?.countryCode && ctx.followedRegions?.includes(story.location.countryCode));
  const significance = story.significance ?? 0;

  const out: NotificationCandidate[] = [];
  for (const change of changes) {
    const mapping = KIND_BASE[change.kind];
    if (!mapping) continue;
    const reasons: string[] = [];
    let score = mapping.base;
    reasons.push(`${change.kind.replace(/-/g, " ")} on a story you can act on`);

    if (significance >= 70) { score += 6; reasons.push(`High significance (${significance})`); }
    else if (significance <= 25) { score -= 10; reasons.push(`Low significance (${significance})`); }

    if (followsTopic) { score += 8; reasons.push(`You follow ${story.topic}`); }
    if (followsRegion) { score += 6; reasons.push(`You follow ${story.location?.countryCode}`); }

    // A change nobody can corroborate is not worth an interruption.
    const independentSources = new Set((story.sources ?? []).map((s) => s.publisher)).size;
    if (independentSources <= 1 && change.kind !== "correction") {
      score -= 12;
      reasons.push("Single source — waiting for corroboration");
    }

    out.push({
      kind: mapping.kind,
      storyId: story.id,
      headline: story.headline,
      body: change.text,
      score: Math.max(0, Math.min(100, score)),
      reasons: reasons.slice(0, 3),
    });
  }
  return out;
}

export interface NotificationDecision {
  send: NotificationCandidate[];
  hold: { candidate: NotificationCandidate; reason: string }[];
  /** Everything held for volume or timing, batched into one digest line. */
  digest: string | null;
}

/**
 * Decide what actually gets sent.
 *
 * Held notifications are not discarded — they roll into a digest, so the
 * quiet-hours and volume rules delay rather than delete. That is the property
 * that makes the caps safe to set aggressively: nothing is lost by not
 * interrupting, only by interrupting badly.
 */
export function decideNotifications(
  candidates: NotificationCandidate[],
  ctx: NotificationContext = {},
): NotificationDecision {
  const quiet = ctx.quietHours ?? DEFAULT_QUIET_HOURS;
  const cap = ctx.dailyCap ?? DEFAULT_DAILY_CAP;
  const recent = ctx.recentlySent ?? [];
  const isQuiet = typeof ctx.localHour === "number" && inQuietHours(ctx.localHour, quiet);

  const send: NotificationCandidate[] = [];
  const hold: NotificationDecision["hold"] = [];
  const alreadySent = new Set(recent.map((r) => `${r.storyId}:${r.kind}`));
  const seenThisRound = new Set<string>();
  let budget = Math.max(0, cap - recent.length);

  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    const key = `${c.storyId}:${c.kind}`;
    if (alreadySent.has(key)) { hold.push({ candidate: c, reason: "Already notified about this change" }); continue; }
    if (seenThisRound.has(c.storyId)) { hold.push({ candidate: c, reason: "One notification per story per round" }); continue; }
    if (c.score < NOTIFY_THRESHOLD) { hold.push({ candidate: c, reason: `Below the interruption threshold (${c.score} < ${NOTIFY_THRESHOLD})` }); continue; }
    if (isQuiet && c.score < URGENT_SCORE) { hold.push({ candidate: c, reason: "Quiet hours — held for the next digest" }); continue; }
    if (budget <= 0) { hold.push({ candidate: c, reason: `Daily cap of ${cap} reached` }); continue; }

    send.push(c);
    seenThisRound.add(c.storyId);
    budget--;
  }

  const digest = hold.length
    ? `${hold.length} other update${hold.length === 1 ? "" : "s"}: ${hold.slice(0, 3).map((h) => h.candidate.headline).join("; ")}`
    : null;

  return { send, hold, digest };
}

/**
 * End-to-end: two snapshots in, notifications out.
 *
 * Kept as one call because the sequencing matters — changes must be computed
 * per story against its own previous version, and a caller doing that by hand
 * is where mismatched pairings creep in.
 */
export function notificationsFor(
  prev: CountryNews | null,
  next: CountryNews,
  ctx: NotificationContext = {},
): NotificationDecision {
  const prevById = new Map((prev?.stories ?? []).map((s) => [s.id, s] as const));
  const candidates: NotificationCandidate[] = [];

  for (const story of next.stories ?? []) {
    const before = prevById.get(story.id) ?? null;
    if (!before) {
      // A genuinely new story is only an interruption when it is significant
      // and in something the reader follows.
      const significance = story.significance ?? 0;
      const follows = ctx.followedTopics?.includes(story.topic) ?? false;
      if (significance >= 70 || (follows && significance >= 50)) {
        candidates.push({
          kind: follows ? "followed-topic" : "new-significant-story",
          storyId: story.id,
          headline: story.headline,
          body: story.summary.slice(0, 160),
          score: Math.min(88, 50 + Math.round(significance * 0.4) + (follows ? 10 : 0)),
          reasons: [`Significance ${significance}`, follows ? `You follow ${story.topic}` : "Major new story"],
        });
      }
      continue;
    }
    candidates.push(...candidatesFor(story, whatChanged(before, story), ctx));
  }

  return decideNotifications(candidates, ctx);
}

/** Back-compatible boolean for callers that only want a yes/no. */
export function shouldNotify(decision: NotificationDecision): boolean {
  return decision.send.length > 0;
}

// ---------------------------------------------------------------------------
// Saved topics (localStorage)
// ---------------------------------------------------------------------------

export const SAVED_TOPICS_KEY = "world-news-saved-topics";

export function loadSavedTopics(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(SAVED_TOPICS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function saveSavedTopics(topics: string[]): void {
  try {
    localStorage.setItem(SAVED_TOPICS_KEY, JSON.stringify(topics.slice(0, 12)));
  } catch {
    // Storage can be unavailable (private mode, quota) — preferences are a
    // convenience, never a precondition for the page working.
  }
}
