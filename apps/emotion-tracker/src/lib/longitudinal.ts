import type { Entry, LongitudinalReview } from "./types";

// ── helpers ──────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string): Set<string> {
  return new Set(norm(s).split(" ").filter((t) => t.length >= 3));
}
function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
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
      const sim = jaccard(all[i].assumption, all[j].assumption);
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
            (na.includes("never") && nb.includes("sometimes") && jaccard(aa, bb) >= 0.35)
          ) {
            out.push({ entryA: a.id, entryB: b.id, reason: "Opposing assumptions about a similar situation", assumptions: [aa, bb] });
          }
        }
      }
      // also: same trigger, opposite emotion
      const emoA = norm(a.summary!.coreEmotion);
      const emoB = norm(b.summary!.coreEmotion);
      if (emoA && emoB && emoA !== emoB) {
        const trigA = a.summary!.underlyingTriggers.map(norm);
        const trigB = b.summary!.underlyingTriggers.map(norm);
        if (trigA.some((t) => trigB.includes(t))) {
          out.push({ entryA: a.id, entryB: b.id, reason: `Same trigger (“${a.summary!.underlyingTriggers[0]}”) but different emotion: ${emoA} vs ${emoB}`, assumptions: [emoA, emoB] });
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
  return [...byWeek.entries()].map(([period, list]) => {
    const assumptions = list.flatMap((e) => e.summary!.trace.assumptions);
    const topAssumption = assumptions.length ? assumptions.sort((a, b) => b.length - a.length)[0] : null;
    return {
      period,
      entries: list,
      emotions: [...new Set(list.map((e) => e.summary!.coreEmotion))],
      topAssumption,
      calibration: calibrationFor(list),
      unresolved: unresolvedEntries(list).length,
    };
  }).sort((a, b) => a.period.localeCompare(b.period));
}

export function monthlyReviews(entries: Entry[]): PeriodReview[] {
  const byMonth = new Map<string, Entry[]>();
  for (const e of entries.filter((x) => x.summary)) {
    const key = monthKey(e.createdAt);
    const arr = byMonth.get(key) || [];
    arr.push(e);
    byMonth.set(key, arr);
  }
  return [...byMonth.entries()].map(([period, list]) => {
    const assumptions = list.flatMap((e) => e.summary!.trace.assumptions);
    const topAssumption = assumptions.length ? assumptions.sort((a, b) => b.length - a.length)[0] : null;
    return {
      period,
      entries: list,
      emotions: [...new Set(list.map((e) => e.summary!.coreEmotion))],
      topAssumption,
      calibration: calibrationFor(list),
      unresolved: unresolvedEntries(list).length,
    };
  }).sort((a, b) => a.period.localeCompare(b.period));
}

export function longitudinalSummary(entries: Entry[]): string {
  const total = entries.filter((e) => e.summary).length;
  if (total === 0) return "No completed reflections yet — complete a few to see longitudinal patterns.";
  const cal = calibrationFor(entries);
  const recurring = detectRecurringAssumptions(entries);
  const patterns = detectRecurringPatterns(entries);
  const unresolved = unresolvedEntries(entries);
  const contras = detectContradictions(entries);
  const parts: string[] = [];
  parts.push(`${total} reflection${total === 1 ? "" : "s"} · ${cal.totalReviewed} reviewed.`);
  if (cal.totalReviewed > 0) parts.push(`Calibration: ${cal.unsupported} unsupported / ${cal.supported} supported${cal.calibrationScore !== null ? ` · insight score ${cal.calibrationScore}%` : ""}.`);
  if (recurring.length) parts.push(`Recurring assumption: “${recurring[0].representative.slice(0, 60)}” ×${recurring[0].count}.`);
  if (patterns.length) parts.push(`Common pattern: ${patterns[0].label} ×${patterns[0].count}.`);
  if (contras.length) parts.push(`${contras.length} possible contradiction${contras.length === 1 ? "" : "s"} detected.`);
  if (unresolved.length) parts.push(`${unresolved.length} unresolved follow-up${unresolved.length === 1 ? "" : "s"} due.`);
  return parts.join(" ");
}
