// Relationships between stories, and what changed inside one.
//
// A reader arriving at a story mid-way through needs three things the previous
// version could not give them:
//   - how this connects to what came before ("this is the follow-up to X")
//   - what is new since they last looked, at the level of claims not prose
//   - what is still unknown, stated rather than implied by absence
//
// The old "what changed" compared two whole summary strings and emitted
// "Updated: <headline>", which tells a reader nothing they could act on. This
// works at statement level instead, so the answer is "the casualty figure
// changed from 12 to 19 and a correction was issued".

import type { StoryCluster } from "./storyModel";
import { extractEntities, extractNumerics } from "./entities";
import { classifyClaim, type ClaimType } from "./claims";

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export type RelationKind =
  | "follow-up"        // later development of the same situation
  | "precedent"        // earlier event this one echoes or builds on
  | "same-actor"       // shares a principal actor, different event
  | "same-place"       // same location, unrelated subject
  | "counter-narrative" // covers the same event from an opposing account
  | "consequence";     // this story reports an effect of the other

export interface StoryRelation {
  fromId: string;
  toId: string;
  kind: RelationKind;
  strength: number; // 0..1
  reason: string;
}

const CONSEQUENCE_MARKERS = /\b(after|following|in response to|in the wake of|prompted by|as a result of|triggered by)\b/i;
const COUNTER_MARKERS = /\b(denies|denied|disputes|disputed|rejects|rejected|contradicts|contrary to)\b/i;

function timeOf(s: StoryCluster): number {
  const dated = (s.timeline ?? []).map((t) => Date.parse(t.date)).filter(Number.isFinite);
  return dated.length ? Math.min(...dated) : NaN;
}

function entityOverlap(a: StoryCluster, b: StoryCluster): { shared: string[]; ratio: number } {
  const ea = new Set(extractEntities(`${a.headline} ${a.summary}`).known);
  const eb = new Set(extractEntities(`${b.headline} ${b.summary}`).known);
  if (ea.size === 0 || eb.size === 0) return { shared: [], ratio: 0 };
  const shared = [...ea].filter((x) => eb.has(x));
  return { shared, ratio: shared.length / Math.max(ea.size, eb.size) };
}

/**
 * Type the relationship between two stories.
 *
 * Order matters: an explicit textual marker ("after the ruling", "denies")
 * beats an inferred one, because the writer stated the connection and we are
 * only guessing. Returns null when nothing connects them — most story pairs
 * are unrelated and inventing a link is worse than showing none.
 */
export function relate(a: StoryCluster, b: StoryCluster): StoryRelation | null {
  const { shared, ratio } = entityOverlap(a, b);
  const sameTopic = a.topic === b.topic;
  const samePlace =
    Boolean(a.location?.countryCode) && a.location?.countryCode === b.location?.countryCode;
  const ta = timeOf(a), tb = timeOf(b);
  const aIsLater = Number.isFinite(ta) && Number.isFinite(tb) ? ta > tb : false;
  const text = `${a.headline} ${a.summary}`;

  const rel = (kind: RelationKind, strength: number, reason: string): StoryRelation => ({
    fromId: a.id, toId: b.id, kind, strength: Math.round(strength * 100) / 100, reason,
  });

  if (shared.length > 0 && COUNTER_MARKERS.test(text)) {
    return rel("counter-narrative", 0.6 + ratio * 0.3, `Disputes an account involving ${shared[0]}`);
  }
  if (shared.length > 0 && CONSEQUENCE_MARKERS.test(text) && aIsLater) {
    return rel("consequence", 0.55 + ratio * 0.35, `Reported as following the earlier ${shared[0]} development`);
  }
  if (ratio >= 0.4 && sameTopic) {
    return aIsLater
      ? rel("follow-up", 0.5 + ratio * 0.4, `Later development involving ${shared.slice(0, 2).join(", ")}`)
      : rel("precedent", 0.5 + ratio * 0.4, `Earlier event involving ${shared.slice(0, 2).join(", ")}`);
  }
  if (shared.length >= 1 && ratio >= 0.2) {
    return rel("same-actor", 0.3 + ratio * 0.3, `Shares ${shared[0]} but covers a different event`);
  }
  if (samePlace && sameTopic) {
    return rel("same-place", 0.25, `Also ${a.topic} in ${a.location?.label ?? a.location?.countryCode}`);
  }
  return null;
}

/** All relations for one story against a pool, strongest first. */
export function relationsFor(story: StoryCluster, pool: StoryCluster[], limit = 5): StoryRelation[] {
  return pool
    .filter((s) => s.id !== story.id)
    .map((s) => relate(story, s))
    .filter((r): r is StoryRelation => r !== null)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

export const RELATION_LABEL: Record<RelationKind, string> = {
  "follow-up": "Follow-up to",
  precedent: "Builds on",
  "same-actor": "Same actor",
  "same-place": "Same place",
  "counter-narrative": "Disputes",
  consequence: "Consequence of",
};

// ---------------------------------------------------------------------------
// What changed
// ---------------------------------------------------------------------------

export type ChangeKind =
  | "summary-rewritten"
  | "new-claim"
  | "figure-revised"
  | "claim-dropped"
  | "correction"
  | "dispute-added"
  | "dispute-resolved"
  | "status-change"
  | "timeline-extended";

export interface StoryChange {
  kind: ChangeKind;
  text: string;
  /** Present when a figure moved. */
  from?: string;
  to?: string;
  /** How much a reader should care: 0..100. */
  weight: number;
}

function figuresIn(statements: string[]): Map<string, string> {
  // Keyed by the numeric *kind* ("pct", "bps", "n"), so a revision of the same
  // sort of figure is detectable even when the value changed.
  const out = new Map<string, string>();
  for (const s of statements) {
    for (const n of extractNumerics(s)) {
      const kind = n.replace(/[\d.:]+/g, "") || "n";
      if (!out.has(kind)) out.set(kind, n);
    }
  }
  return out;
}

function statementsOf(s: StoryCluster): string[] {
  return [...(s.keyPoints ?? []), ...(s.widelyAgreedFacts ?? [])];
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/**
 * Diff two versions of a story at statement level.
 *
 * Weighting is the useful part: a correction or a revised casualty figure is
 * what a returning reader needs, and a reworded sentence is not. Sorting by
 * weight means the notification layer can take the top item and be right.
 */
export function whatChanged(prev: StoryCluster | null, next: StoryCluster): StoryChange[] {
  if (!prev) {
    return [{ kind: "new-claim", text: `New story: ${next.headline}`, weight: 60 }];
  }
  const changes: StoryChange[] = [];

  const prevStatements = statementsOf(prev);
  const nextStatements = statementsOf(next);
  const prevSet = new Set(prevStatements.map(normalise));
  const nextSet = new Set(nextStatements.map(normalise));

  // Figures first — a revised number is the highest-value change there is.
  const pf = figuresIn(prevStatements), nf = figuresIn(nextStatements);
  for (const [kind, value] of nf) {
    const before = pf.get(kind);
    if (before && before !== value) {
      changes.push({
        kind: "figure-revised",
        text: `A reported figure was revised (${before.replace(/^[a-z]+/, "")} → ${value.replace(/^[a-z]+/, "")}).`,
        from: before, to: value, weight: 90,
      });
    }
  }

  const newCorrections = (next.corrections ?? []).length - (prev.corrections ?? []).length;
  if (newCorrections > 0) {
    const latest = next.corrections[next.corrections.length - 1];
    changes.push({ kind: "correction", text: latest?.note ?? "A correction was issued.", weight: 95 });
  }

  const prevDisputes = (prev.conflictingClaims ?? []).length;
  const nextDisputes = (next.conflictingClaims ?? []).length;
  if (nextDisputes > prevDisputes) {
    const latest = next.conflictingClaims[nextDisputes - 1];
    changes.push({
      kind: "dispute-added",
      text: `Accounts now differ on ${latest?.disagreementDimension ?? "part of this story"}.`,
      weight: 80,
    });
  } else if (nextDisputes < prevDisputes) {
    changes.push({ kind: "dispute-resolved", text: "A previously contested point is no longer contested.", weight: 70 });
  }

  for (const s of nextStatements) {
    if (!prevSet.has(normalise(s))) {
      const type = classifyClaim(s, next.sources ?? []).type;
      changes.push({ kind: "new-claim", text: s, weight: weightForClaim(type) });
    }
  }
  for (const s of prevStatements) {
    if (!nextSet.has(normalise(s))) {
      changes.push({ kind: "claim-dropped", text: `No longer reported: ${s}`, weight: 55 });
    }
  }

  // A rewritten summary with identical claims is a rewording. Worth detecting
  // so callers asking "did anything change" get a truthful answer, weighted low
  // so it never becomes a notification.
  if (normalise(prev.summary ?? "") !== normalise(next.summary ?? "")) {
    changes.push({ kind: "summary-rewritten", text: "The summary was rewritten; the underlying claims are unchanged.", weight: 20 });
  }

  const timelineGrowth = (next.timeline ?? []).length - (prev.timeline ?? []).length;
  if (timelineGrowth > 0) {
    changes.push({
      kind: "timeline-extended",
      text: `${timelineGrowth} new dated event${timelineGrowth === 1 ? "" : "s"} on the timeline.`,
      weight: 45,
    });
  }

  return changes.sort((a, b) => b.weight - a.weight).slice(0, 8);
}

function weightForClaim(type: ClaimType): number {
  switch (type) {
    case "confirmed": return 75;
    case "allegation": return 60;
    case "analysis": return 35;
    case "prediction": return 30;
  }
}

/** One line summarising a change list, for a headline or notification. */
export function changeSummary(changes: StoryChange[]): string | null {
  if (changes.length === 0) return null;
  const top = changes[0];
  const rest = changes.length - 1;
  return rest > 0 ? `${top.text} (+${rest} other change${rest === 1 ? "" : "s"})` : top.text;
}

// ---------------------------------------------------------------------------
// What remains unknown
// ---------------------------------------------------------------------------

export interface OpenQuestion {
  question: string;
  /** Why we think this is open — evidence, not assertion. */
  basis: string;
  category: "figures" | "cause" | "attribution" | "consequence" | "verification" | "stated";
}

/** Question templates keyed on what the story is about but does not settle. */
const QUESTION_RULES: { test: RegExp; question: string; category: OpenQuestion["category"] }[] = [
  { test: /\b(killed|dead|casualt|injur|wounded|missing)\b/i, question: "How many people were affected, and who has verified the count?", category: "figures" },
  { test: /\b(cause|caused|blamed|responsible|behind the)\b/i, question: "What caused this, and has any investigation confirmed it?", category: "cause" },
  { test: /\b(attack|strike|explosion|blast|fire)\b/i, question: "Who carried this out, and has anyone claimed or confirmed responsibility?", category: "attribution" },
  { test: /\b(deal|agreement|treaty|accord|talks)\b/i, question: "What exactly was agreed, and when does it take effect?", category: "stated" },
  { test: /\b(resign|resigned|step(?:ped)? down|dismissed|sacked)\b/i, question: "Who succeeds them, and when?", category: "consequence" },
  { test: /\b(rates?|inflation|growth|deficit|budget)\b/i, question: "What effect is expected, and over what period?", category: "consequence" },
  { test: /\b(evacuat|displaced|refugee|shelter)\b/i, question: "Where have people gone, and what support has reached them?", category: "consequence" },
  { test: /\b(charged|arrested|detained|indicted|trial)\b/i, question: "What are the specific charges, and what happens next procedurally?", category: "stated" },
];

/**
 * Derive what the story does not answer.
 *
 * Two sources: what the story itself flagged as uncertain, and questions its
 * subject matter raises that its text does not address. The second is the
 * useful half — "the story does not say who is responsible" is information a
 * reader cannot get from reading it, only from noticing an absence.
 */
export function whatRemainsUnknown(story: StoryCluster): OpenQuestion[] {
  const out: OpenQuestion[] = [];

  for (const u of story.uncertainty ?? []) {
    out.push({ question: u, basis: "Flagged as uncertain in the story itself.", category: "stated" });
  }

  const body = `${story.headline} ${story.summary} ${statementsOf(story).join(" ")}`;
  const answered = normalise(body);
  for (const rule of QUESTION_RULES) {
    if (!rule.test.test(body)) continue;
    // Only ask when nothing in the text looks like an answer.
    const alreadyAnswered =
      (rule.category === "attribution" && /\b(claimed responsibility|said it carried out|admitted)\b/i.test(body)) ||
      (rule.category === "cause" && /\b(investigation (?:found|concluded)|caused by|attributed to)\b/i.test(body)) ||
      (rule.category === "figures" && /\b(confirmed|verified)\b/i.test(answered));
    if (alreadyAnswered) continue;
    if (out.some((o) => o.question === rule.question)) continue;
    out.push({
      question: rule.question,
      basis: "Raised by what this story covers; not answered in the text available here.",
      category: rule.category,
    });
  }

  // Corroboration gaps are their own kind of unknown.
  const unverified = (story.keyPoints ?? [])
    .map((k) => classifyClaim(k, story.sources ?? []))
    .filter((c) => c.type === "allegation" && c.corroboration.independent <= 1);
  if (unverified.length > 0) {
    out.push({
      question: `Can ${unverified.length} unverified statement${unverified.length === 1 ? "" : "s"} in this story be independently confirmed?`,
      basis: `Rests on a single account: "${unverified[0].text.slice(0, 80)}".`,
      category: "verification",
    });
  }

  return out.slice(0, 6);
}
