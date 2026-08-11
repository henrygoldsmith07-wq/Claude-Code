// Event identity persistence: stable Event ids across days, merge/split corrections,
// lifecycle states (developing/ongoing/resolved/contested), and correction history.
// Persisted to Supabase when configured; in-memory fallback otherwise.
// Pure helpers are testable without Supabase.

import type { Event, EventStatus } from "./eventModel";

export type CorrectionKind = "merge" | "split" | "status" | "headline";

export interface EventCorrection {
  at: string; // ISO
  kind: CorrectionKind;
  fromIds?: string[];
  toId?: string;
  note: string;
}

export interface StoredEvent extends Event {
  corrections: EventCorrection[];
  supersededBy?: string; // when merged away
}

function headlineKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function jaccard(a: string, b: string): number {
  const A = new Set(headlineKey(a).split(" ").filter(w=>w.length>=3));
  const B = new Set(headlineKey(b).split(" ").filter(w=>w.length>=3));
  if (A.size===0||B.size===0) return 0;
  let inter=0; for (const x of A) if (B.has(x)) inter++;
  return inter/(A.size+B.size-inter);
}

/** Link today's headlines to yesterday's events: same event if Jaccard ≥ threshold + same topic. */
export function linkEvents(previous: StoredEvent[], todayHeadlines: { headline: string; topic: string; id: string }[], threshold = 0.42): Map<string,string> {
  const map = new Map<string,string>(); // todayId -> previousEventId
  for (const cur of todayHeadlines) {
    let best: StoredEvent | null = null, bestScore = 0;
    for (const prev of previous) {
      if (prev.supersededBy) continue;
      const topicMatch = prev.topic === cur.topic ? 0.08 : 0;
      const score = jaccard(prev.headline, cur.headline) + topicMatch;
      if (score > bestScore) { bestScore = score; best = prev; }
    }
    if (best && bestScore >= threshold) map.set(cur.id, best.id);
  }
  return map;
}

export function nextStatus(prev: EventStatus, signals: { hasCorrection: boolean; daysSinceFirstSeen: number; isContested: boolean; isResolvedKeyword: boolean }): EventStatus {
  if (signals.isContested || signals.hasCorrection) return "contested";
  if (signals.isResolvedKeyword) return "resolved";
  if (signals.daysSinceFirstSeen >= 7) return "ongoing";
  return "developing";
}

export function mergeEvents(a: StoredEvent, b: StoredEvent, note = "Merged duplicate events"): { merged: StoredEvent; corrections: EventCorrection[] } {
  const at = new Date().toISOString();
  const merged: StoredEvent = {
    ...a,
    headline: a.headline,
    summary: `${a.summary} ${b.summary}`.slice(0, 900),
    articleIds: Array.from(new Set([...a.articleIds, ...b.articleIds])),
    timeline: [...a.timeline, ...b.timeline].sort((x,y)=> x.date.localeCompare(y.date)).slice(0, 12),
    corrections: [...a.corrections, { at, kind: "merge", fromIds: [a.id, b.id], toId: a.id, note }],
    supersededBy: undefined,
  };
  const corrB: EventCorrection = { at, kind: "merge", fromIds: [a.id, b.id], toId: a.id, note: `Superseded by ${a.id}` };
  void corrB;
  return { merged, corrections: [{ at, kind: "merge", fromIds: [a.id, b.id], toId: a.id, note }] };
}

export function splitEvent(ev: StoredEvent, keepHeadline: string, newHeadline: string): { a: StoredEvent; b: StoredEvent; corrections: EventCorrection[] } {
  const at = new Date().toISOString();
  const half = Math.ceil(ev.articleIds.length/2);
  const a: StoredEvent = { ...ev, id: ev.id, headline: keepHeadline, articleIds: ev.articleIds.slice(0, half), corrections: [...ev.corrections, { at, kind: "split", fromIds: [ev.id], toId: ev.id, note: `Split: retained ${keepHeadline}` }] };
  const b: StoredEvent = { ...ev, id: `${ev.id}-split-${Date.now().toString(36)}`, headline: newHeadline, articleIds: ev.articleIds.slice(half), firstSeen: at, lastUpdated: at, status: "developing" as EventStatus, corrections: [{ at, kind: "split", fromIds: [ev.id], toId: `${ev.id}-split`, note: `Split from ${ev.id}` }] };
  return { a, b, corrections: [{ at, kind: "split", fromIds: [ev.id], note: `Split ${ev.id} into ${a.id} + ${b.id}` }] };
}
