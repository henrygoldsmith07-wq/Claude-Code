// patternEvidence.ts — every pattern carries its evidence so UIs never present
// a pattern without showing where it came from and what contradicts it.

import type { Entry } from "./types";
import { detectContradictions, detectRecurringAssumptions, detectRecurringPatterns } from "./longitudinal";
import { norm } from "./tokens";

export interface EvidenceInstance {
  entryId: string;
  createdAt: string;
  excerpt: string; // first 80 chars of relevant context, never full verbatim message
  kind: "supporting" | "contradictory";
}

export interface PatternEvidence {
  key: string;
  kind: string;
  label: string;
  count: number;
  observations: number; // number of distinct entries supporting
  timespanDays: number | null; // days between first and last evidence
  recencyDays: number | null; // days since most recent evidence
  strength: number; // 0..1 heuristic: frequency + recency + consistency (undecayed)
  confidence: number; // 0..1 heuristic: strength penalised for contradictions
  // Temporal decay: evidence ages. `decay` = 0.5^(recencyDays / HALF_LIFE),
  // so a pattern that hasn't recurred recently weighs less than its raw
  // frequency suggests. effectiveStrength = strength * decay.
  decay: number; // 0..1 (1 = evidence is brand new)
  effectiveStrength: number;
  // Evidence-status tier, meant to be displayed prominently:
  // - "insufficient" — below the minimum evidence bar; shown as such, never as a pattern
  // - "expired" — no fresh evidence within expiryDays; stale, not necessarily current
  // - "emerging" — meets the floor but thin/contradicted so far
  // - "established" — repeated across a real timespan with no contradictions
  status: "insufficient" | "expired" | "emerging" | "established";
  evidenceInstances: EvidenceInstance[];
  contradictoryInstances: EvidenceInstance[];
  entryIds: string[];
}

function daysBetween(a: string, b: string): number {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return 0;
  return Math.round(Math.abs(t2 - t1) / 86400000);
}
function daysSince(date: string, now = new Date()): number | null {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now.getTime() - t) / 86400000));
}

function patternKey(kind: string, label: string): string {
  return `pattern:${kind}:${norm(label).slice(0, 80)}`;
}

const MIN_EVIDENCE = 3; // do not generate patterns from minimal data
const MIN_TIMESPAN_DAYS = 2; // at least spread across days, not same-session
// Temporal decay: evidence older than the half-life counts half as much.
export const DECAY_HALF_LIFE_DAYS = 60;
// Patterns with no fresh evidence within this window are marked expired —
// stale, not necessarily current. They are surfaced with that label rather
// than silently hidden.
export const DEFAULT_EXPIRY_DAYS = 90;

/** Evidence-weight decay for one instance: 0.5^(ageDays / halfLife). */
export function evidenceDecay(ageDays: number | null, halfLifeDays = DECAY_HALF_LIFE_DAYS): number {
  if (ageDays == null) return 1;
  return Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays);
}

function statusFor(opts: { observations: number; timespanDays: number | null; recencyDays: number | null; contradictions: number; expiryDays: number; minEvidence: number }): PatternEvidence["status"] {
  const { observations, timespanDays, recencyDays, contradictions, expiryDays, minEvidence } = opts;
  if (observations < minEvidence || (timespanDays ?? 0) < MIN_TIMESPAN_DAYS) return "insufficient";
  if (recencyDays != null && recencyDays > expiryDays) return "expired";
  if (observations >= 4 && (timespanDays ?? 0) >= 14 && contradictions === 0) return "established";
  return "emerging";
}

function strengthFor(count: number, timespanDays: number | null, contradictions: number, total: number): number {
  // base on count (capped at 6), timespan diversity, contradiction penalty
  const countScore = Math.min(1, count / 6);
  const spanScore = timespanDays == null ? 0.3 : Math.min(1, timespanDays / 30);
  const consistency = total > 0 ? 1 - contradictions / total : 1;
  return Math.max(0, Math.min(1, countScore * 0.6 + spanScore * 0.2 + consistency * 0.2));
}

export function buildPatternEvidences(
  entries: Entry[],
  now = new Date(),
  opts: { expiryDays?: number; minEvidence?: number } = {},
): PatternEvidence[] {
  const expiryDays = opts.expiryDays ?? DEFAULT_EXPIRY_DAYS;
  // Callers may lower the floor (e.g. to inspect emerging signals); they can
  // never raise it above the default — thin data stays non-generable.
  const minEvidence = Math.min(Math.max(1, opts.minEvidence ?? MIN_EVIDENCE), MIN_EVIDENCE);
  const completed = entries.filter((e) => e.summary);
  if (completed.length < minEvidence) return [];
  const patterns = detectRecurringPatterns(completed);
  const assumptions = detectRecurringAssumptions(completed);
  const contradictions = detectContradictions(completed);

  // Map entryId -> date for quick timespan
  const dateById = new Map<string, string>();
  for (const e of completed) dateById.set(e.id, e.createdAt);

  const out: PatternEvidence[] = [];

  for (const p of patterns) {
    if (p.count < minEvidence) continue;
    const dates = p.entryIds.map((id) => dateById.get(id) ?? "").filter(Boolean).sort();
    const timespanDays = dates.length >= 2 ? daysBetween(dates[0], dates[dates.length - 1]) : 0;
    if (timespanDays < MIN_TIMESPAN_DAYS && p.count < 4) continue; // minimal temporal spread -> need more count
    const recencyDays = dates.length ? daysSince(dates[dates.length - 1], now) : null;

    // contradictory instances: contradictions that involve one of its entryIds
    const contraIds = new Set<string>();
    for (const c of contradictions) {
      if (p.entryIds.includes(c.entryA) || p.entryIds.includes(c.entryB)) {
        // the *other* side of the contradiction is contradictory evidence
        const other = p.entryIds.includes(c.entryA) ? c.entryB : c.entryA;
        contraIds.add(other);
      }
    }
    const contradictoryInstances: EvidenceInstance[] = [...contraIds].slice(0, 4).map((id) => ({
      entryId: id,
      createdAt: dateById.get(id) ?? "",
      excerpt: completed.find((e) => e.id === id)?.summary?.trace.event.slice(0, 80) ?? "",
      kind: "contradictory" as const,
    }));
    const evidenceInstances: EvidenceInstance[] = p.entryIds.slice(0, 8).map((id) => ({
      entryId: id,
      createdAt: dateById.get(id) ?? "",
      excerpt: p.contexts[p.entryIds.indexOf(id)] ?? completed.find((e) => e.id === id)?.summary?.trace.event.slice(0, 80) ?? "",
      kind: "supporting" as const,
    }));

    const strength = strengthFor(p.count, timespanDays, contradictoryInstances.length, p.count + contradictoryInstances.length);
    const confidence = Math.max(0, strength * (1 - Math.min(0.5, contradictoryInstances.length * 0.15)));
    const decay = evidenceDecay(recencyDays);
    const status = statusFor({ observations: p.entryIds.length, timespanDays, recencyDays, contradictions: contradictoryInstances.length, expiryDays, minEvidence });

    out.push({
      key: patternKey(p.kind, p.label),
      kind: p.kind,
      label: p.label,
      count: p.count,
      observations: p.entryIds.length,
      timespanDays,
      recencyDays,
      strength,
      confidence,
      decay,
      effectiveStrength: strength * decay,
      status,
      evidenceInstances,
      contradictoryInstances,
      entryIds: p.entryIds.slice(),
    });
  }

  // Also assumption groups as evidences
  for (const g of assumptions) {
    if (g.count < minEvidence) continue;
    const dates = g.members.map((m) => m.createdAt).sort();
    const timespanDays = dates.length >= 2 ? daysBetween(dates[0], dates[dates.length - 1]) : 0;
    if (timespanDays < MIN_TIMESPAN_DAYS && g.count < 4) continue;
    const recencyDays = dates.length ? daysSince(dates[dates.length - 1], now) : null;
    const contraIds = new Set<string>();
    for (const c of contradictions) {
      const gIds = g.members.map((m) => m.entryId);
      if (gIds.includes(c.entryA) || gIds.includes(c.entryB)) {
        const other = gIds.includes(c.entryA) ? c.entryB : c.entryA;
        if (!gIds.includes(other)) contraIds.add(other);
      }
    }
    const contradictoryInstances: EvidenceInstance[] = [...contraIds].slice(0, 4).map((id) => ({
      entryId: id,
      createdAt: dateById.get(id) ?? "",
      excerpt: completed.find((e) => e.id === id)?.summary?.trace.event.slice(0, 80) ?? "",
      kind: "contradictory" as const,
    }));
    const evidenceInstances: EvidenceInstance[] = g.members.slice(0, 8).map((m) => ({
      entryId: m.entryId,
      createdAt: m.createdAt,
      excerpt: m.assumption.slice(0, 80),
      kind: "supporting" as const,
    }));
    const strength = strengthFor(g.count, timespanDays, contradictoryInstances.length, g.count + contradictoryInstances.length);
    const confidence = Math.max(0, strength * (1 - Math.min(0.5, contradictoryInstances.length * 0.15)));
    const decay = evidenceDecay(recencyDays);
    const status = statusFor({ observations: g.members.length, timespanDays, recencyDays, contradictions: contradictoryInstances.length, expiryDays, minEvidence });
    out.push({
      key: `assumption:${norm(g.representative).slice(0, 80)}`,
      kind: "assumption",
      label: g.representative.slice(0, 80),
      count: g.count,
      observations: g.members.length,
      timespanDays,
      recencyDays,
      strength,
      confidence,
      decay,
      effectiveStrength: strength * decay,
      status,
      evidenceInstances,
      contradictoryInstances,
      entryIds: g.members.map((m) => m.entryId),
    });
  }

  return out.sort((a, b) => b.effectiveStrength - a.effectiveStrength);
}

export function patternEvidencesWithThreshold(entries: Entry[], opts: { minEvidence?: number; minTimespanDays?: number; expiryDays?: number } = {}, now = new Date()): PatternEvidence[] {
  const evs = buildPatternEvidences(entries, now, opts);
  const minEv = opts.minEvidence ?? MIN_EVIDENCE;
  const minSpan = opts.minTimespanDays ?? 0;
  return evs.filter((e) => e.observations >= minEv && (e.timespanDays ?? 0) >= minSpan);
}
