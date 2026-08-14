import type { Entry, LongitudinalReview } from "./types";
import { withoutDismissed, annotatePatterns, annotateAssumptionGroups } from "./corrections";
import type { Correction, AnnotatedPattern } from "./corrections";
import { norm, tokens, jaccard, simTokens } from "./tokens";

// ── helpers ──────────────────────────────────────────────────────────────

function assumptionSim(a: string, b: string): number {
  const ta = new Set(simTokens(a));
  const tb = new Set(simTokens(b));
  if (ta.size === 0 || tb.size === 0) return jaccard(a, b);
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function parseDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

// ── recurring assumptions ──────────────────────────────────────────────

export interface RecurringAssumption {
  representative: string;
  members: { entryId: string; assumption: string; createdAt: string }[];
  count: number;
}

/** Group similar assumptions (Jaccard ≥ 0.4 or substring) — no diagnostic labels, just descriptive. */
export function detectRecurringAssumptions(entries: Entry[], threshold = 0.4): RecurringAssumption[] {
  const all: { entryId: string; assumption: string; createdAt: string }[] = [];
  for (const e of entries) {
    if (!e.summary) continue;
    for (const a of e.summary.trace.assumptions) {
      if (a.trim()) all.push({ entryId: e.id, assumption: a, createdAt: e.createdAt });
    }
  }
  const groups: RecurringAssumption[] = [];
  const used = new Set<number>();
  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const g: RecurringAssumption = { representative: all[i].assumption, members: [all[i]], count: 1 };
    used.add(i);
    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;
      const sim = assumptionSim(all[i].assumption, all[j].assumption);
      const sub =
        norm(all[i].assumption).includes(norm(all[j].assumption)) ||
        norm(all[j].assumption).includes(norm(all[i].assumption));
      if (sim >= threshold || (sub && Math.min(all[i].assumption.length, all[j].assumption.length) >= 12)) {
        g.members.push(all[j]);
        used.add(j);
      }
    }
    if (g.members.length >= 2) {
      g.count = g.members.length;
      groups.push(g);
    }
  }
  return groups.sort((a, b) => b.count - a.count);
}

// ── recurring behaviour / pattern (without diagnostic labels) ──────────

export interface BehaviourPattern {
  kind: "emotion" | "trigger" | "action" | "bias";
  label: string;
  count: number;
  entryIds: string[];
  contexts: string[];
}

export function detectRecurringPatterns(entries: Entry[]): BehaviourPattern[] {
  const completed = entries.filter((e) => e.summary);
  const out: BehaviourPattern[] = [];

  // emotions
  const emo = new Map<string, { ids: string[]; contexts: string[] }>();
  for (const e of completed) {
    const k = norm(e.summary!.coreEmotion || e.summary!.trace.namedEmotion);
    if (!k) continue;
    const v = emo.get(k) || { ids: [], contexts: [] };
    v.ids.push(e.id);
    v.contexts.push(e.summary!.trace.event.slice(0, 80));
    emo.set(k, v);
  }
  for (const [k, v] of emo) if (v.ids.length >= 2) out.push({ kind: "emotion", label: k, count: v.ids.length, entryIds: v.ids, contexts: v.contexts });

  // triggers
  const trig = new Map<string, { ids: string[]; contexts: string[] }>();
  for (const e of completed) {
    for (const t of e.summary!.underlyingTriggers) {
      const k = norm(t);
      if (!k) continue;
      const v = trig.get(k) || { ids: [], contexts: [] };
      if (!v.ids.includes(e.id)) { v.ids.push(e.id); v.contexts.push(t.slice(0, 80)); }
      trig.set(k, v);
    }
  }
  for (const [k, v] of trig) if (v.ids.length >= 2) out.push({ kind: "trigger", label: k, count: v.ids.length, entryIds: v.ids, contexts: v.contexts });

  // biases as descriptive patterns, not diagnoses
  const bias = new Map<string, { ids: string[]; contexts: string[] }>();
  for (const e of completed) {
    for (const b of e.summary!.possibleBiases) {
      const k = norm(b.type);
      if (!k) continue;
      const v = bias.get(k) || { ids: [], contexts: [] };
      v.ids.push(e.id);
      v.contexts.push(b.description.slice(0, 80));
      bias.set(k, v);
    }
  }
  for (const [k, v] of bias) if (v.ids.length >= 2) out.push({ kind: "bias", label: `pattern: ${k}`, count: v.ids.length, entryIds: v.ids, contexts: v.contexts });

  return out.sort((a, b) => b.count - a.count);
}

// ── contradictions ─────────────────────────────────────────────────────

export interface Contradiction {
  entryA: string;
  entryB: string;
  reason: string;
  assumptions: [string, string];
}

export function detectContradictions(entries: Entry[]): Contradiction[] {
  const out: Contradiction[] = [];
  const completed = entries.filter((e) => e.summary);
  for (let i = 0; i < completed.length; i++) {
    for (let j = i + 1; j < completed.length; j++) {
      const a = completed[i];
      const b = completed[j];
      const aAss = a.summary!.trace.assumptions;
      const bAss = b.summary!.trace.assumptions;
      for (const aa of aAss) {
        for (const bb of bAss) {
          const na = norm(aa);
          const nb = norm(bb);
          // simple negation detection
          if (
            (na.includes("not") !== nb.includes("not") && jaccard(aa, bb) >= 0.45) ||
            (na.includes("always") && nb.includes("sometimes") && jaccard(aa, bb) >= 0.35) ||
            (na.includes("never") && nb.includes("sometimes") && jaccard(aa, bb) >= 0.35) ||
            (na.includes("always") && nb.includes("never") && jaccard(aa, bb) >= 0.35) ||
            (na.includes("never") && nb.includes("always") && jaccard(aa, bb) >= 0.35)
          ) {
            out.push({ entryA: a.id, entryB: b.id, reason: "Opposing assumptions about a similar situation", assumptions: [aa, bb] });
          }
        }
      }
      // also: same trigger, opposite emotion (valence-shift wording if the
      // emotion moved between a negative and a positive pole)
      const emoA = norm(a.summary!.coreEmotion);
      const emoB = norm(b.summary!.coreEmotion);
      if (emoA && emoB && emoA !== emoB) {
        const trigA = a.summary!.underlyingTriggers.map(norm);
        const trigB = b.summary!.underlyingTriggers.map(norm);
        if (trigA.some((t) => trigB.includes(t))) {
          const shifted =
            (NEGATIVE_EMOTIONS.has(emoA) && POSITIVE_EMOTIONS.has(emoB)) ||
            (NEGATIVE_EMOTIONS.has(emoB) && POSITIVE_EMOTIONS.has(emoA));
          const reason = shifted
            ? `Same trigger (“${a.summary!.underlyingTriggers[0]}”) but emotion shifted between ${emoA} and ${emoB} — possible change worth noting`
            : `Same trigger (“${a.summary!.underlyingTriggers[0]}”) but different emotion: ${emoA} vs ${emoB}`;
          out.push({ entryA: a.id, entryB: b.id, reason, assumptions: [emoA, emoB] });
        }
      }
    }
  }
  return out;
}

// ── calibration & prediction accuracy ──────────────────────────────────

export interface Calibration {
  totalReviewed: number;
  supported: number;
  unsupported: number;
  partial: number;
  unclear: number;
  accuracy: number | null; // unsupported = miscalibrated assumption — lower is better insight?
  calibrationScore: number | null; // 0..100 — higher = more predictions matched reality
}

export function calibrationFor(entries: Entry[]): Calibration {
  const reviewed = entries.filter((e) => e.longitudinalReview?.assumptionVerdict);
  const totalReviewed = reviewed.length;
  let supported = 0, unsupported = 0, partial = 0, unclear = 0;
  for (const e of reviewed) {
    const v = e.longitudinalReview!.assumptionVerdict;
    if (v === "supported") supported++;
    else if (v === "unsupported") unsupported++;
    else if (v === "partial") partial++;
    else if (v === "unclear") unclear++;
  }
  const denom = totalReviewed || 0;
  // Calibration: unsupported assumptions discovered = learning; but accuracy = supported rate
  const accuracy = denom ? Math.round((supported / denom) * 100) : null;
  // calibrationScore: weighted — unsupported + partial show insight growth
  const calibrationScore = denom ? Math.round(((unsupported + partial * 0.5) / denom) * 100) : null;
  return { totalReviewed, supported, unsupported, partial, unclear, accuracy, calibrationScore };
}

export interface PredictionPoint {
  date: string;
  verdict: NonNullable<LongitudinalReview["assumptionVerdict"]>;
  predicted: string;
  actual: string;
}

export function predictionAccuracySeries(entries: Entry[]): PredictionPoint[] {
  return entries
    .filter((e) => e.longitudinalReview?.assumptionVerdict && e.summary?.trace.predictedOutcome)
    .map((e) => ({
      date: e.longitudinalReview!.reviewedAt || e.createdAt,
      verdict: e.longitudinalReview!.assumptionVerdict!,
      predicted: e.summary!.trace.predictedOutcome,
      actual: e.longitudinalReview!.actualOutcome || "",
    }))
    .sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
}

// ── unresolved / due / overdue ─────────────────────────────────────────

export function unresolvedEntries(entries: Entry[], now = new Date()): Entry[] {
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  return entries.filter((e) => {
    if (!e.summary || e.longitudinalReview?.assumptionVerdict) return false;
    const d = parseDate(e.summary.trace.followUpAt);
    if (d === null) return e.status === "complete"; // no date but complete = still open
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    return dd.getTime() <= t.getTime();
  });
}

export function dueFollowUps(entries: Entry[], now = new Date()): Entry[] {
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  return entries.filter((e) => {
    if (!e.summary || e.longitudinalReview?.assumptionVerdict) return false;
    const d = parseDate(e.summary.trace.followUpAt);
    if (d === null) return false;
    const dd = new Date(d); dd.setHours(0, 0, 0, 0);
    return dd.getTime() <= t.getTime();
  });
}

// ── evidence-linked observations ───────────────────────────────────────

export interface EvidenceLink {
  observation: string;
  linkedAssumptions: string[];
  linkedAlternatives: string[];
}

export function evidenceLinksFor(entry: Entry): EvidenceLink[] {
  if (!entry.summary) return [];
  const { observations, assumptions, alternativeInterpretations } = entry.summary.trace;
  return observations.map((obs) => {
    const obsTokens = tokens(obs);
    const linkedAssumptions = assumptions.filter((a) => {
      const at = tokens(a);
      let inter = 0;
      for (const t of obsTokens) if (at.has(t)) inter++;
      return inter >= 2 || jaccard(obs, a) >= 0.35;
    });
    const linkedAlternatives = alternativeInterpretations.filter((alt) => {
      const at = tokens(alt);
      let inter = 0;
      for (const t of obsTokens) if (at.has(t)) inter++;
      return inter >= 1 || jaccard(obs, alt) >= 0.25;
    });
    return { observation: obs, linkedAssumptions, linkedAlternatives };
  });
}

// ── weekly / monthly review ────────────────────────────────────────────

export interface PeriodReview {
  period: string; // YYYY-WW or YYYY-MM
  entries: Entry[];
  emotions: string[];
  topAssumption: string | null;
  calibration: Calibration;
  unresolved: number;
  // review-quality extras: the patterns, contradictions and actions surfaced
  // in this period, each linked to its supporting entries
  patterns?: AnnotatedPattern[];
  contradictions?: Contradiction[];
  actionsOutstanding?: number;
}

function isoWeekKey(dateInput: string | Date): string {
  const d = new Date(dateInput);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - dayNum + 3);
  const isoYear = utc.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round((utc.getTime() - firstThursday.getTime()) / 604800000);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function monthKey(dateInput: string): string {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return dateInput.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function weeklyReviews(entries: Entry[]): PeriodReview[] {
  const byWeek = new Map<string, Entry[]>();
  for (const e of entries.filter((x) => x.summary)) {
    const key = isoWeekKey(e.createdAt);
    const arr = byWeek.get(key) || [];
    arr.push(e);
    byWeek.set(key, arr);
  }
  return [...byWeek.entries()].map(([period, list]) => enrichPeriodReview(period, list)).sort((a, b) => a.period.localeCompare(b.period));
}

export function monthlyReviews(entries: Entry[]): PeriodReview[] {
  const byMonth = new Map<string, Entry[]>();
  for (const e of entries.filter((x) => x.summary)) {
    const key = monthKey(e.createdAt);
    const arr = byMonth.get(key) || [];
    arr.push(e);
    byMonth.set(key, arr);
  }
  return [...byMonth.entries()].map(([period, list]) => enrichPeriodReview(period, list)).sort((a, b) => a.period.localeCompare(b.period));
}

// Shared period-review enrichment: patterns + contradictions + outstanding
// actions, each insight still linked to the entries that produced it.
function enrichPeriodReview(period: string, list: Entry[]): PeriodReview {
  const assumptions = list.flatMap((e) => e.summary!.trace.assumptions);
  const topAssumption = assumptions.length ? assumptions.sort((a, b) => b.length - a.length)[0] : null;
  return {
    period,
    entries: list,
    emotions: [...new Set(list.map((e) => e.summary!.coreEmotion))],
    topAssumption,
    calibration: calibrationFor(list),
    unresolved: unresolvedEntries(list).length,
    patterns: annotatePatterns(detectRecurringPatterns(list)),
    contradictions: detectContradictions(list),
    actionsOutstanding: list.filter((e) => !e.longitudinalReview?.actualActionTaken && e.status === "complete").length,
  };
}

const NEGATIVE_EMOTIONS = new Set(["anger","frustration","shame","anxiety","fear","sadness","guilt","jealousy","hurt","embarrassment","disappointment","overwhelmed","insecure","resentment"]);
const POSITIVE_EMOTIONS = new Set(["joy","calm","pride","gratitude","hope","relief","contentment","satisfaction","excitement","peace","confidence"]);

// ── quantified prediction accuracy ────────────────────────────────────

export interface PredictionAccuracy {
  n: number;
  supportedPct: number | null;
  unsupportedPct: number | null;
  partialPct: number | null;
  unclearPct: number | null;
  note: string;
}

export function predictionAccuracy(entries: Entry[]): PredictionAccuracy {
  const c = calibrationFor(entries);
  if (c.totalReviewed === 0) {
    return { n: 0, supportedPct: null, unsupportedPct: null, partialPct: null, unclearPct: null, note: "No reviewed predictions yet — complete a few follow-ups to quantify accuracy." };
  }
  const pct = (n: number) => Math.round((n / c.totalReviewed) * 100);
  return {
    n: c.totalReviewed,
    supportedPct: pct(c.supported),
    unsupportedPct: pct(c.unsupported),
    partialPct: pct(c.partial),
    unclearPct: pct(c.unclear),
    note: `Supported ${pct(c.supported)}% of reviewed predictions (unsupported ${pct(c.unsupported)}%, partial ${pct(c.partial)}%).`,
  };
}

// ── unresolved resurfacing (prioritised) ───────────────────────────────

export interface ResurfaceItem {
  entry: Entry;
  daysOverdue: number;
  score: number;
  reason: string;
}

// Rank open follow-ups: oldest overdue first, then those where no action was
// ever logged, then ones with no follow-up date at all (sitting in limbo).
export function resurfacingQueue(entries: Entry[], now = new Date(), topK = 8): ResurfaceItem[] {
  const open = unresolvedEntries(entries, now);
  const t = new Date(now); t.setHours(0, 0, 0, 0);
  return open
    .map((e) => {
      const d = parseDate(e.summary!.trace.followUpAt);
      const daysOverdue = d !== null ? Math.max(0, Math.round((t.getTime() - new Date(d).getTime()) / 86400000)) : 0;
      const parts: string[] = [];
      let score = daysOverdue;
      if (d !== null) parts.push(`${daysOverdue}d overdue`);
      else { score += 3; parts.push("no follow-up date set"); }
      if (!e.longitudinalReview?.actualActionTaken) { score += 5; parts.push("action never logged"); }
      if (e.longitudinalReview?.assumptionVerdict === "unclear") { score += 2; parts.push("reviewed unclear"); }
      return { entry: e, daysOverdue, score, reason: parts.join(" · ") };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── follow-up timing (verdict-aware) ───────────────────────────────────

export interface FollowUpSuggestion {
  dueInDays: number;
  followUpAt: string; // ISO date
  reason: string;
}

// Better follow-up timing: unsupported assumptions need a short re-check (3d),
// supported ones can wait (14d); if the intended action was never logged, check
// back sooner — the loop hasn't closed.
export function suggestFollowUp(entry: Entry, now = new Date()): FollowUpSuggestion {
  const verdict = entry.longitudinalReview?.assumptionVerdict ?? null;
  let dueInDays = 7;
  let reason: string;
  if (verdict === "unsupported") { dueInDays = 3; reason = "Assumption was unsupported — check in 3 days to see if the new reading holds."; }
  else if (verdict === "partial") { dueInDays = 7; reason = "Partially supported — a week lets the pattern clarify."; }
  else if (verdict === "supported") { dueInDays = 14; reason = "Supported — a fortnight before re-checking keeps review cost low."; }
  else if (verdict === "unclear") { dueInDays = 7; reason = "Outcome unclear — check in a week with a sharper question."; }
  else if (entry.longitudinalReview) { dueInDays = 7; reason = "Reviewed but unresolved — check back in a week."; }
  else { dueInDays = 5; reason = "Fresh reflection — a 5-day check-in keeps momentum."; }
  if (!entry.longitudinalReview?.actualActionTaken) {
    dueInDays = Math.min(dueInDays, 5);
    reason += " Action wasn't logged — checking sooner closes the loop.";
  }
  const date = new Date(now);
  date.setDate(date.getDate() + dueInDays);
  return { dueInDays, followUpAt: date.toISOString().slice(0, 10), reason };
}

// ── action tracking ────────────────────────────────────────────────────

export interface ActionFollowThrough {
  tracked: number;
  actionLogged: number;
  completed: number;
  actionLoggedPct: number | null;
  completedPct: number | null;
}

export function actionFollowThrough(entries: Entry[]): ActionFollowThrough {
  const reviewed = entries.filter((e) => e.longitudinalReview);
  const actionLogged = reviewed.filter((e) => e.longitudinalReview?.actualActionTaken && String(e.longitudinalReview.actualActionTaken).trim());
  const completed = actionLogged.filter((e) => e.longitudinalReview?.assumptionVerdict && e.longitudinalReview.assumptionVerdict !== "unclear");
  return {
    tracked: reviewed.length,
    actionLogged: actionLogged.length,
    completed: completed.length,
    actionLoggedPct: reviewed.length ? Math.round((actionLogged.length / reviewed.length) * 100) : null,
    completedPct: reviewed.length ? Math.round((completed.length / reviewed.length) * 100) : null,
  };
}

// ── does reflection improve later decisions? ───────────────────────────
// Split reviewed reflections chronologically; if the unsupported-assumption
// rate drops in the second half, the loop is working (predictions track
// reality better over time).
export function decisionImprovement(entries: Entry[]): {
  n: number;
  before: number | null;
  after: number | null;
  improved: boolean;
  note: string;
} {
  const withReview = entries.filter((e) => e.summary && e.longitudinalReview?.assumptionVerdict);
  if (withReview.length < 4) {
    return { n: withReview.length, before: null, after: null, improved: false, note: "Need 4+ reviewed reflections to compare before/after calibration." };
  }
  const sorted = withReview.slice().sort((a, b) => (parseDate(a.createdAt) || 0) - (parseDate(b.createdAt) || 0));
  const half = Math.ceil(sorted.length / 2);
  const unsupportedRate = (list: Entry[]) => {
    const u = list.filter((e) => e.longitudinalReview!.assumptionVerdict === "unsupported").length;
    return list.length ? Math.round((u / list.length) * 100) : null;
  };
  const before = unsupportedRate(sorted.slice(0, half));
  const after = unsupportedRate(sorted.slice(half));
  const improved = before !== null && after !== null && after < before;
  return {
    n: sorted.length,
    before,
    after,
    improved,
    note: improved
      ? `Unsupported assumptions dropped from ${before}% → ${after}% — reflection is tracking reality better over time.`
      : `Unsupported-rate ${before}% → ${after}% — no clear improvement yet.`,
  };
}

// ── structured insights, every one linked to its supporting entries ────

export interface Insight {
  kind: "pattern" | "contradiction" | "calibration" | "unresolved";
  key: string;
  title: string;
  detail: string;
  entryIds: string[]; // every insight must cite the entries it came from
}

export function summaryInsights(entries: Entry[], corrections: Correction[] = []): Insight[] {
  const out: Insight[] = [];
  for (const p of withoutDismissed(annotatePatterns(detectRecurringPatterns(entries)), corrections)) {
    out.push({ kind: "pattern", key: p.key, title: p.label, detail: `${p.kind} recurring across ${p.count} reflections`, entryIds: p.entryIds });
  }
  for (const g of withoutDismissed(annotateAssumptionGroups(detectRecurringAssumptions(entries).slice(0, 3)), corrections)) {
    out.push({ kind: "pattern", key: g.key, title: g.representative.slice(0, 64), detail: `Recurring assumption ×${g.count}`, entryIds: g.members.map((m) => m.entryId) });
  }
  for (const c of detectContradictions(entries).slice(0, 3)) {
    out.push({ kind: "contradiction", key: `contradiction:${c.entryA}:${c.entryB}`, title: c.reason, detail: c.reason, entryIds: [c.entryA, c.entryB] });
  }
  const cal = calibrationFor(entries);
  if (cal.totalReviewed >= 1) {
    out.push({
      kind: "calibration", key: "calibration",
      title: `${cal.supported} supported / ${cal.unsupported} unsupported predictions`,
      detail: `Insight score ${cal.calibrationScore}% — unsupported readings are where the model learned.`,
      entryIds: entries.filter((e) => e.longitudinalReview?.assumptionVerdict).map((e) => e.id),
    });
  }
  for (const r of resurfacingQueue(entries).slice(0, 3)) {
    out.push({ kind: "unresolved", key: `unresolved:${r.entry.id}`, title: r.reason, detail: `Follow-up overdue — ${r.entry.title}`, entryIds: [r.entry.id] });
  }
  return out;
}

export function longitudinalSummary(entries: Entry[], corrections: Correction[] = []): string {
  const total = entries.filter((e) => e.summary).length;
  if (total === 0) return "No completed reflections yet — complete a few to see longitudinal patterns.";
  const cal = calibrationFor(entries);
  const recurring = withoutDismissed(annotateAssumptionGroups(detectRecurringAssumptions(entries)), corrections);
  const patterns = withoutDismissed(annotatePatterns(detectRecurringPatterns(entries)), corrections);
  const unresolved = unresolvedEntries(entries);
  const contras = detectContradictions(entries);
  const improvement = decisionImprovement(entries);
  const actions = actionFollowThrough(entries);
  const parts: string[] = [];
  parts.push(`${total} reflection${total === 1 ? "" : "s"} · ${cal.totalReviewed} reviewed.`);
  if (cal.totalReviewed > 0) parts.push(`Calibration: ${cal.unsupported} unsupported / ${cal.supported} supported${cal.calibrationScore !== null ? ` · insight score ${cal.calibrationScore}%` : ""}.`);
  if (recurring.length) parts.push(`Recurring assumption: “${recurring[0].representative.slice(0, 60)}” ×${recurring[0].count}.`);
  if (patterns.length) parts.push(`Common pattern: ${patterns[0].label} ×${patterns[0].count}.`);
  if (contras.length) parts.push(`${contras.length} possible contradiction${contras.length === 1 ? "" : "s"} detected.`);
  if (unresolved.length) parts.push(`${unresolved.length} unresolved follow-up${unresolved.length === 1 ? "" : "s"} due.`);
  if (improvement.improved) parts.push(`Calibration improving over time (unsupported ${improvement.before}% → ${improvement.after}%).`);
  if (actions.actionLoggedPct != null && actions.actionLoggedPct < 50) parts.push(`Only ${actions.actionLoggedPct}% of reviewed reflections logged an action — tracking actions closes the loop.`);
  return parts.join(" ");
}
