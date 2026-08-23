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
import { buildPatternEvidences, DEFAULT_EXPIRY_DAYS, type PatternEvidence } from "./patternEvidence";
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
  /** median days from first to last supporting evidence */
  medianLifespanDays: number | null;
  /** user-confirmed vs system-inferred backing */
  userConfirmedBacked: number;
  systemInferredOnly: number;
  userConfirmedShare: number | null;
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

  const lifespans = patternLifespans(entries, now, opts);
  const separation = confirmationSeparation(entries, now, opts);

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
    medianLifespanDays: medianLifespanDays(lifespans),
    userConfirmedBacked: separation.userConfirmedBacked,
    systemInferredOnly: separation.systemInferredOnly,
    userConfirmedShare: separation.userConfirmedShare,
    note: evidences.length
      ? `${remainedSupported}/${reviewedSignals || 0} reviewed patterns stayed supported · ${contraTotal} contradictory instance${contraTotal === 1 ? "" : "s"} across ${supportingTotal} evidence points · median lifespan ${medianLifespanDays(lifespans) ?? "—"}d · ${retiredByUser} rejected by user, ${staleCount} gone stale.`
      : "Not enough longitudinal data yet — patterns appear after several reflections over multiple days.",
  };
}

/** Convenience wrapper so callers can see assumption-group churn directly. */
export function recurringAssumptionGroups(entries: Entry[]) {
  return detectRecurringAssumptions(entries);
}

// ── pattern lifespan ───────────────────────────────────────────────────
// How long a pattern survives: from its first supporting evidence to its last,
// plus how stale it has gone since. A short lifespan with an early contradiction
// is exactly the signal that the detector over-generalised.

export interface PatternLifespan {
  key: string;
  kind: string;
  label: string;
  firstEvidenceAt: string | null;
  lastEvidenceAt: string | null;
  spanDays: number | null; // first → last evidence
  ageSinceLastDays: number | null; // last evidence → now
  status: PatternEvidence["status"];
}

function isoTime(value: string): number | null {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function patternLifespans(entries: Entry[], now = new Date(), opts: { expiryDays?: number } = {}): PatternLifespan[] {
  return buildPatternEvidences(entries, now, opts).map((ev) => {
    const times = ev.evidenceInstances.map((i) => isoTime(i.createdAt)).filter((t): t is number => t !== null).sort((a, b) => a - b);
    const first = times.length ? times[0] : null;
    const last = times.length ? times[times.length - 1] : null;
    return {
      key: ev.key,
      kind: ev.kind,
      label: ev.label,
      firstEvidenceAt: first !== null ? new Date(first).toISOString() : null,
      lastEvidenceAt: last !== null ? new Date(last).toISOString() : null,
      spanDays: first !== null && last !== null ? Math.round((last - first) / 86400000) : null,
      ageSinceLastDays: last !== null ? Math.max(0, Math.round((now.getTime() - last) / 86400000)) : null,
      status: ev.status,
    };
  });
}

export function medianLifespanDays(lifespans: PatternLifespan[]): number | null {
  const spans = lifespans.map((l) => l.spanDays).filter((d): d is number => d != null).sort((a, b) => a - b);
  if (!spans.length) return null;
  const mid = Math.floor(spans.length / 2);
  return spans.length % 2 ? spans[mid] : Math.round(((spans[mid - 1] + spans[mid]) / 2));
}

// ── user-confirmed vs system-inferred separation ───────────────────────
// Patterns backed by entries the user actually followed up and verdicted are a
// different evidence class from patterns inferred purely by the system. They
// are counted separately — never merged into one "supported" number.

export interface ConfirmationSeparation {
  patternsTotal: number;
  /** ≥1 member entry carries a user-recorded follow-up verdict */
  userConfirmedBacked: number;
  systemInferredOnly: number;
  userConfirmedShare: number | null;
  note: string;
}

export function confirmationSeparation(
  entries: Entry[],
  now = new Date(),
  opts: { expiryDays?: number } = {},
): ConfirmationSeparation {
  const verdictIds = new Set(entries.filter((e) => e.longitudinalReview?.assumptionVerdict).map((e) => e.id));
  const evidences = buildPatternEvidences(entries, now, opts);
  const confirmed = evidences.filter((ev) => ev.entryIds.some((id) => verdictIds.has(id)));
  const share = evidences.length ? confirmed.length / evidences.length : null;
  return {
    patternsTotal: evidences.length,
    userConfirmedBacked: confirmed.length,
    systemInferredOnly: evidences.length - confirmed.length,
    userConfirmedShare: share,
    note: evidences.length
      ? `${confirmed.length}/${evidences.length} patterns have at least one user-verified reflection; the rest rest on system inference alone.`
      : "No patterns yet — nothing to separate.",
  };
}
