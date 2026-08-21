// outcomeEvidence.ts — study whether insights are confirmed, rejected, stable, useful.
// No clinical benefit is claimed; this measures descriptive stability.

import type { Entry } from "./types";
import type { Correction } from "./corrections";
import { detectRecurringPatterns } from "./longitudinal";
import { buildPatternEvidences } from "./patternEvidence";

export interface OutcomeMetrics {
  totalReflections: number;
  reviewed: number;
  supportedRate: number | null; // supported / reviewed
  rejectedRate: number | null; // corrections / patterns shown
  patternStability: number | null; // 0..1 — do patterns persist across halves?
  recommendationUsefulness: number | null; // heuristic: supported + actionLogged when suggestion followed?
  note: string;
}

function rate(n: number, d: number): number | null {
  return d ? Math.round((n / d) * 100) / 100 : null;
}

function timeSorted(entries: Entry[]): Entry[] {
  return entries.slice().sort((a,b)=> new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function patternStability(entries: Entry[]): number | null {
  const completed = entries.filter(e=>e.summary);
  if (completed.length < 6) return null;
  const sorted = timeSorted(completed);
  const half = Math.ceil(sorted.length/2);
  const first = sorted.slice(0, half);
  const second = sorted.slice(half);
  const p1 = new Set(detectRecurringPatterns(first).map(p=>p.label));
  const p2 = new Set(detectRecurringPatterns(second).map(p=>p.label));
  if (!p1.size && !p2.size) return null;
  if (!p1.size || !p2.size) return 0;
  let inter=0;
  for (const l of p1) if (p2.has(l)) inter++;
  const union = p1.size + p2.size - inter;
  return union? inter/union : null;
}

export function buildOutcomeMetrics(entries: Entry[], corrections: Correction[] = []): OutcomeMetrics {
  const totalReflections = entries.length;
  const reviewed = entries.filter(e=>e.longitudinalReview?.assumptionVerdict).length;
  const supported = entries.filter(e=>e.longitudinalReview?.assumptionVerdict==="supported").length;
  const supportedRate = rate(supported, reviewed);

  // rejected rate: how many shown patterns were corrected
  const patterns = buildPatternEvidences(entries);
  const rejectedRate = patterns.length ? rate(corrections.length, patterns.length + corrections.length) : null;

  const stability = patternStability(entries);

  // usefulness heuristic: among reviewed where suggestedNextSteps existed and action was logged, what's supported rate?
  const withSuggestion = entries.filter(e=> e.summary && e.summary.suggestedNextSteps.length>0 && e.longitudinalReview?.actualActionTaken);
  const usefulSupported = withSuggestion.filter(e=>e.longitudinalReview?.assumptionVerdict==="supported" || e.longitudinalReview?.assumptionVerdict==="partial").length;
  const recommendationUsefulness = withSuggestion.length ? rate(usefulSupported, withSuggestion.length) : null;

  const parts: string[] = [];
  parts.push(`${totalReflections} reflections, ${reviewed} reviewed`);
  if (supportedRate!=null) parts.push(`supported ${Math.round(supportedRate*100)}% of reviewed predictions`);
  if (rejectedRate!=null) parts.push(`rejected ${Math.round(rejectedRate*100)}% of patterns`);
  if (stability!=null) parts.push(`pattern stability ${stability.toFixed(2)} (Jaccard across halves)`);
  if (recommendationUsefulness!=null) parts.push(`usefulness (action-logged supported) ${Math.round(recommendationUsefulness*100)}%`);
  if (reviewed===0) parts.push("No reviews yet — outcome cannot be measured");
  return {
    totalReflections, reviewed, supportedRate, rejectedRate, patternStability: stability, recommendationUsefulness,
    note: parts.join(" · "),
  };
}

export function longitudinalEvidenceNote(metrics: OutcomeMetrics): string {
  if (metrics.reviewed < 4) return "Need 4+ reviewed reflections to assess whether insights remain stable over time.";
  if (metrics.patternStability != null && metrics.patternStability < 0.3) return "Patterns shifted substantially between first and second half — treat single patterns as tentative.";
  if (metrics.patternStability != null && metrics.patternStability > 0.6) return "Patterns remained stable across time — still requires human review to confirm.";
  return metrics.note;
}

// No clinical claims — this module is descriptive only.
// Export for tests: does not invent benefit, only reports counts.

export const CLINICAL_DISCLAIMER = "This is a descriptive evidence summary, not a diagnosis or clinical assessment. Do not claim psychological or clinical benefit without appropriate controlled evidence.";
