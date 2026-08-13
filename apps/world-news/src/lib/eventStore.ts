// Persistent event identity: keeping the same event the same event across days.
//
// Identity is what makes "what changed since yesterday" possible at all. The
// previous version linked days by headline Jaccard alone, which fails in both
// directions: a rewritten headline breaks the link and drops the history, and
// two similar headlines from unrelated events merge and corrupt it. Neither
// failure is visible to a reader — they just see a story that lost its past or
// acquired someone else's.
//
// So linking here uses entities and time as well as wording, records *why* it
// linked, and refuses to link when the evidence is weak — an unlinked event is
// recoverable, a wrongly merged one is not.
//
// Merges and splits are audited: every correction is appended with its reason,
// and superseded ids keep pointing at their successor so old links resolve.

import type { Event, EventStatus } from "./eventModel";
import { extractEntities, foldDiacritics, transliterate } from "./entities";

export type CorrectionKind = "merge" | "split" | "status" | "headline" | "link";

export interface EventCorrection {
  at: string; // ISO
  kind: CorrectionKind;
  fromIds?: string[];
  toId?: string;
  note: string;
}

export interface StoredEvent extends Event {
  corrections: EventCorrection[];
  /** Set when this event was merged into another; points at the survivor. */
  supersededBy?: string;
  /** ISO timestamp of the last substantive change, for lifecycle dwell. */
  lastSubstantiveChange?: string;
}

// ---------------------------------------------------------------------------
// Linking
// ---------------------------------------------------------------------------

function words(s: string): Set<string> {
  return new Set(
    foldDiacritics(transliterate(s))
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface LinkCandidate {
  todayId: string;
  eventId: string;
  score: number;
  reasons: string[];
}

/** Days beyond which a new report is a new event, not a continuation. */
export const MAX_LINK_AGE_DAYS = 21;

export interface LinkInput {
  id: string;
  headline: string;
  topic: string;
  /** ISO timestamp of the new report, when known. */
  at?: string;
  countryCode?: string;
}

/**
 * Link today's stories to existing events.
 *
 * Three signals, and at least two must agree: shared named entities, headline
 * wording, and same topic within the linking window. Entities carry the most
 * weight because they survive rewriting — a story about the same ceasefire
 * still says "Gaza" whatever the subeditor did to the verb.
 *
 * Returns the reasons alongside the mapping so a merge can be explained and,
 * when it turns out wrong, unpicked.
 */
export function linkEvents(
  previous: StoredEvent[],
  today: LinkInput[],
  threshold = 0.42,
): { map: Map<string, string>; candidates: LinkCandidate[] } {
  const map = new Map<string, string>();
  const candidates: LinkCandidate[] = [];
  const live = previous.filter((p) => !p.supersededBy);

  const prevPrepared = live.map((p) => ({
    event: p,
    words: words(p.headline),
    entities: new Set(extractEntities(`${p.headline} ${p.summary ?? ""}`).known),
    lastMs: Date.parse(p.lastUpdated ?? p.firstSeen ?? ""),
  }));

  for (const cur of today) {
    const curWords = words(cur.headline);
    const curEntities = new Set(extractEntities(cur.headline).known);
    const curMs = cur.at ? Date.parse(cur.at) : NaN;

    let best: { event: StoredEvent; score: number; reasons: string[] } | null = null;

    for (const prev of prevPrepared) {
      const reasons: string[] = [];
      let signals = 0;
      let score = 0;

      // Age gate — an event that stopped moving three weeks ago is finished.
      if (Number.isFinite(curMs) && Number.isFinite(prev.lastMs)) {
        const ageDays = (curMs - prev.lastMs) / 86_400_000;
        if (ageDays > MAX_LINK_AGE_DAYS) continue;
      }

      const ent = curEntities.size && prev.entities.size
        ? [...curEntities].filter((e) => prev.entities.has(e))
        : [];
      if (ent.length > 0) {
        const ratio = ent.length / Math.max(curEntities.size, prev.entities.size);
        score += 0.45 * Math.min(1, ratio * 1.5);
        signals++;
        reasons.push(`Shared actors: ${ent.slice(0, 3).join(", ")}`);
      }

      const wordSim = jaccard(curWords, prev.words);
      if (wordSim >= 0.25) {
        score += 0.4 * wordSim;
        signals++;
        reasons.push(`Headline overlap ${Math.round(wordSim * 100)}%`);
      }

      if (prev.event.topic === cur.topic) {
        score += 0.12;
        signals++;
        reasons.push(`Same topic: ${cur.topic}`);
      }

      if (cur.countryCode && prev.event.location?.countryCodes?.includes(cur.countryCode)) {
        score += 0.1;
        reasons.push(`Same country: ${cur.countryCode}`);
      }

      // Topic alone is not evidence of identity — every economy story shares it.
      if (signals < 2 || (ent.length === 0 && wordSim < 0.4)) continue;

      if (!best || score > best.score) best = { event: prev.event, score, reasons };
    }

    if (best) {
      candidates.push({ todayId: cur.id, eventId: best.event.id, score: Math.round(best.score * 100) / 100, reasons: best.reasons });
      if (best.score >= threshold) map.set(cur.id, best.event.id);
    }
  }

  return { map, candidates };
}

/** Follow supersession chains so an old id still resolves to the live event. */
export function resolveEventId(events: StoredEvent[], id: string): string {
  const byId = new Map(events.map((e) => [e.id, e] as const));
  const seen = new Set<string>();
  let cur = id;
  while (true) {
    const e = byId.get(cur);
    if (!e?.supersededBy || seen.has(cur)) return cur;
    seen.add(cur);
    cur = e.supersededBy;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export interface LifecycleSignals {
  hasCorrection: boolean;
  daysSinceFirstSeen: number;
  /** Days since anything substantive changed. */
  daysSinceLastChange: number;
  isContested: boolean;
  isResolvedKeyword: boolean;
  newSourcesToday: number;
}

export interface LifecycleVerdict {
  status: EventStatus;
  reason: string;
  /** True when the event has gone quiet and should drop out of live views. */
  dormant: boolean;
}

/**
 * Decide an event's lifecycle state.
 *
 * The important addition over a flat status is dwell: an event with no new
 * sources for days is not "ongoing", it is over, and continuing to present it
 * as live is how a front page fills with stale conflict. Contested outranks
 * everything because an unresolved factual dispute is the state a reader most
 * needs flagged.
 */
export function lifecycleFor(signals: LifecycleSignals): LifecycleVerdict {
  const dormant = signals.daysSinceLastChange >= 5 && signals.newSourcesToday === 0;

  if (signals.isContested) {
    return { status: "contested", reason: "Accounts of this event still conflict.", dormant };
  }
  if (signals.hasCorrection && signals.daysSinceLastChange <= 2) {
    return { status: "contested", reason: "A correction was issued recently — treat details as unsettled.", dormant };
  }
  if (signals.isResolvedKeyword) {
    return { status: "resolved", reason: "Reporting indicates this reached a conclusion.", dormant };
  }
  if (dormant) {
    return { status: "resolved", reason: `No new reporting for ${signals.daysSinceLastChange} days.`, dormant: true };
  }
  if (signals.daysSinceFirstSeen >= 7) {
    return { status: "ongoing", reason: "Running for over a week with continuing coverage.", dormant };
  }
  return { status: "developing", reason: "Recent and still attracting new reporting.", dormant };
}

/** Back-compatible thin wrapper. */
export function nextStatus(
  prev: EventStatus,
  signals: { hasCorrection: boolean; daysSinceFirstSeen: number; isContested: boolean; isResolvedKeyword: boolean },
): EventStatus {
  void prev;
  return lifecycleFor({ ...signals, daysSinceLastChange: 0, newSourcesToday: 1 }).status;
}

// ---------------------------------------------------------------------------
// Merge and split
// ---------------------------------------------------------------------------

export interface MergeResult {
  merged: StoredEvent;
  /** The absorbed event, kept with a supersededBy pointer so old links resolve. */
  superseded: StoredEvent;
}

/**
 * Merge two events that turned out to be one.
 *
 * The survivor is the one with the earlier firstSeen — that is the identity a
 * reader may already have bookmarked. Both sides keep an audit entry, and the
 * absorbed event is never deleted, only pointed forward.
 */
export function mergeEvents(a: StoredEvent, b: StoredEvent, note = "Merged duplicate events"): MergeResult {
  const at = new Date().toISOString();
  const [keep, drop] = (a.firstSeen ?? "") <= (b.firstSeen ?? "") ? [a, b] : [b, a];

  const merged: StoredEvent = {
    ...keep,
    summary: keep.summary.length >= drop.summary.length ? keep.summary : drop.summary,
    articleIds: Array.from(new Set([...keep.articleIds, ...drop.articleIds])),
    timeline: [...keep.timeline, ...drop.timeline]
      .filter((t, i, arr) => arr.findIndex((x) => x.date === t.date && x.label === t.label) === i)
      .sort((x, y) => x.date.localeCompare(y.date))
      .slice(0, 16),
    contradictions: [...keep.contradictions, ...drop.contradictions],
    widelyAgreedFacts: [...keep.widelyAgreedFacts, ...drop.widelyAgreedFacts],
    uncertainty: Array.from(new Set([...keep.uncertainty, ...drop.uncertainty])),
    lastUpdated: at,
    lastSubstantiveChange: at,
    corrections: [
      ...keep.corrections,
      { at, kind: "merge", fromIds: [keep.id, drop.id], toId: keep.id, note: `${note} (absorbed ${drop.id})` },
    ],
    supersededBy: undefined,
  };

  const superseded: StoredEvent = {
    ...drop,
    supersededBy: keep.id,
    corrections: [
      ...drop.corrections,
      { at, kind: "merge", fromIds: [drop.id], toId: keep.id, note: `Merged into ${keep.id}: ${note}` },
    ],
  };

  return { merged, superseded };
}

export interface SplitResult {
  kept: StoredEvent;
  created: StoredEvent;
}

/**
 * Split an event that turned out to be two.
 *
 * The caller supplies which article ids belong to the new event, because only
 * the caller knows why the split is happening. Anything not named stays with
 * the original — the safe direction, since a reader following the original id
 * keeps seeing something rather than an emptied page.
 */
export function splitEvent(
  ev: StoredEvent,
  newHeadline: string,
  articleIdsForNew: string[],
  note = "Split: distinct events were grouped together",
): SplitResult {
  const at = new Date().toISOString();
  const moving = new Set(articleIdsForNew.filter((id) => ev.articleIds.includes(id)));
  const newId = `${ev.id}-split-${Date.now().toString(36)}`;

  const kept: StoredEvent = {
    ...ev,
    articleIds: ev.articleIds.filter((id) => !moving.has(id)),
    lastUpdated: at,
    lastSubstantiveChange: at,
    corrections: [
      ...ev.corrections,
      { at, kind: "split", fromIds: [ev.id], toId: newId, note: `${note} — ${moving.size} article(s) moved to ${newId}` },
    ],
  };

  const created: StoredEvent = {
    ...ev,
    id: newId,
    headline: newHeadline,
    articleIds: [...moving],
    firstSeen: at,
    lastUpdated: at,
    lastSubstantiveChange: at,
    status: "developing",
    supersededBy: undefined,
    corrections: [{ at, kind: "split", fromIds: [ev.id], toId: newId, note: `Split out of ${ev.id}: ${note}` }],
  };

  return { kept, created };
}

/** Every correction across a set of events, newest first — the audit view. */
export function correctionLog(events: StoredEvent[]): (EventCorrection & { eventId: string })[] {
  return events
    .flatMap((e) => e.corrections.map((c) => ({ ...c, eventId: e.id })))
    .sort((a, b) => b.at.localeCompare(a.at));
}
