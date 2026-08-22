// validationMetrics.ts — longitudinal validation of Reflect's own outputs.
// Answers, descriptively and from local data only:
//   1. Does a pattern remain supported later?            → patternPersistence
//   2. How often is a pattern contradicted?              → patternContradictionRate
//   3. How often are incorrect patterns retired?         → patternRetirement
//   4. Does a user correction permanently alter output?  → correctionPersistence
//   5. Does confidence correspond to later human support?→ buildCalibrationReport
// No clinical claims: every number here describes usage of this tool on this
// device, not efficacy.

import type { Entry } from "./types";
import type { Correction } from "./corrections";
import { norm, simTokens } from "./tokens";
import { buildPatternEvidences, DEFAULT_EXPIRY_DAYS } from "./patternEvidence";
import { detectRecurringAssumptions } from "./longitudinal";

// ── 4. does a correction permanently stop the rejected interpretation? ──

interface AssumptionOccurrence {
  text: string;
  createdAt: string;
}

function occurrences(entries: Entry[]): AssumptionOccurrence[] {
  const out: AssumptionOccurrence[] = [];
  for (const e of entries) {
    for (const a of e.summary?.trace.assumptions ?? []) {
      if (norm(a)) out.push({ text: a, createdAt: e.createdAt });
    }
  }
  return out;
}

function sameAssumption(candidate: string, rejected: string): boolean {
  const nc = norm(candidate);
  const nr = norm(rejected);
  if (!nc || !nr) return false;
  if (nc.includes(nr) || nr.includes(nc)) {
    return Math.min(nc.length, nr.length) >= 12;
  }
  const tc = new Set(simTokens(candidate));
  const tr = new Set(simTokens(rejected));
  if (!tc.size || !tr.size) return false;
  let inter = 0;
  for (const t of tc) if (tr.has(t)) inter++;
  return inter / Math.min(tc.size, tr.size) >= 0.6;
}

export interface CorrectionPersistenceItem {
  key: string;
  rejectedAt: string;
  recurrencesBefore: number;
  recurrencesAfter: number;
}

export interface CorrectionPersistence {
  tracked: number;
  fullyStopped: number;
  recurred: number;
  /** share of corrections with zero recurrences after rejection */
  persistenceRate: number | null;
  note: string;
  items: CorrectionPersistenceItem[];
}

/** Measures whether rejecting an interpretation actually stopped it from
 *  resurfacing in later reflections. Lexical matching — paraphrases with
 *  different wording can still slip through (documented limitation). */
export function correctionPersistence(entries: Entry[], corrections: Correction[]): CorrectionPersistence {
  const occ = occurrences(entries);
  const items: CorrectionPersistenceItem[] = [];
  for (const c of corrections) {
    const rejected = c.rejectedInterpretation ?? (c.key.startsWith("assumption:") ? c.key.slice("assumption:".length) : "");
    if (!rejected.trim()) continue;
    const t = new Date(c.rejectedAt).getTime();
    if (Number.isNaN(t)) continue;
    let before = 0;
    let after = 0;
    for (const o of occ) {
      if (!sameAssumption(o.text, rejected)) continue;
      const ot = new Date(o.createdAt).getTime();
      if (Number.isNaN(ot)) continue;
      if (ot > t) after++;
      else before++;
    }
    items.push({ key: c.key, rejectedAt: c.rejectedAt, recurrencesBefore: before, recurrencesAfter: after });
  }
  const fullyStopped = items.filter((i) => i.recurrencesAfter === 0).length;
  const recurred = items.length - fullyStopped;
  return {
    tracked: items.length,
    fullyStopped,
    recurred,
    persistenceRate: items.length ? fullyStopped / items.length : null,
    note: items.length
      ? `${fullyStopped}/${items.length} corrections permanently stopped the interpretation${recurred ? ` — ${recurred} resurfaced at least once after rejection.` : "."}`
      : "No trackable corrections yet — reject an interpretation to measure persistence.",
    items,
  };
}

// ── 1–3. pattern-level validation ─────────────────────────────────────

export interface LongitudinalValidation {
  patternsTracked: number;
  /** pattern remains supported later: ≥1 supporting member's review came back "supported" */
  remainedSupported: number;
  /** pattern contradicted: ≥1 member's review came back unsupported, or contradictory evidence exists */
  contradicted: number;
  unreviewed: number;
  /** how often patterns are contradicted, of those with any review signal */
  contradictionRate: number | null;
  /** incorrect-pattern retirement: user rejections + staleness expiry */
  retiredByUser: number;
  retiredStale: number;
  active: number;
  retirementShare: number | null;
  note: string;
}

export function longitudinalValidation(
  entries: Entry[],
  corrections: Correction[],
  now = new Date(),
  opts: { expiryDays?: number } = {},
): LongitudinalValidation {
  const evidences = buildPatternEvidences(entries, now, opts);
  const verdictById = new Map<string, NonNullable<Entry["longitudinalReview"]>["assumptionVerdict"]>();
  for (const e of entries) {
    const v = e.longitudinalReview?.assumptionVerdict;
    if (v) verdictById.set(e.id, v);
  }

  let remainedSupported = 0;
  let contradicted = 0;
  let unreviewed = 0;
  let staleCount = 0;
  for (const ev of evidences) {
    const verdicts = ev.entryIds.map((id) => verdictById.get(id)).filter(Boolean);
    const hasSupported = verdicts.includes("supported");
    const hasUnsupported = verdicts.includes("unsupported") || ev.contradictoryInstances.length > 0;
    if (hasSupported && !hasUnsupported) remainedSupported++;
    else if (hasUnsupported || (hasSupported && verdicts.includes("partial"))) contradicted++;
    else unreviewed++;
    if (ev.status === "expired" || (ev.recencyDays != null && ev.recencyDays > (opts.expiryDays ?? DEFAULT_EXPIRY_DAYS))) staleCount++;
  }

  // contradictions observed across all evidence instances
  const supportingTotal = evidences.reduce((s, e) => s + e.evidenceInstances.length, 0);
  const contraTotal = evidences.reduce((s, e) => s + e.contradictoryInstances.length, 0);

  const retiredKeys = new Set(corrections.filter((c) => c.kind === "pattern" || c.kind === "assumption").map((c) => c.key));
  const retiredByUser = [...retiredKeys].filter((k) => k.startsWith("pattern:") || k.startsWith("assumption:")).length;
  const active = evidences.filter((e) => e.status !== "expired").length;

  const reviewedSignals = remainedSupported + contradicted;
  const totalEver = active + staleCount + retiredByUser;

  return {
    patternsTracked: evidences.length,
    remainedSupported,
    contradicted,
    unreviewed,
    contradictionRate: supportingTotal + contraTotal ? contraTotal / (supportingTotal + contraTotal) : null,
    retiredByUser,
    retiredStale: staleCount,
    active,
    retirementShare: totalEver ? (staleCount + retiredByUser) / totalEver : null,
    note: evidences.length
      ? `${remainedSupported}/${reviewedSignals || 0} reviewed patterns stayed supported · ${contraTotal} contradictory instance${contraTotal === 1 ? "" : "s"} across ${supportingTotal} evidence points · ${retiredByUser} rejected by user, ${staleCount} gone stale.`
      : "Not enough longitudinal data yet — patterns appear after several reflections over multiple days.",
  };
}

/** Convenience wrapper so callers can see assumption-group churn directly. */
export function recurringAssumptionGroups(entries: Entry[]) {
  return detectRecurringAssumptions(entries);
}
