// ---------------------------------------------------------------------------
// Diminishing returns detection.
//
// The recommender already has a fatigue factor, but that only looks at how
// *often* a skill was focused. This module looks at whether the practice is
// still *paying*: if the improvement per attempt has collapsed to near zero
// while the user keeps grinding the same skill, the session budget is being
// spent on repetition with no return — which is exactly the behaviour the
// engine exists to stop. It is a pure analysis over the evidence log, so it
// can feed an insight, a recommender note or a weekly review.
// ---------------------------------------------------------------------------

import { getSkill } from "./skills";
import type { Id, Insight, IsoInstant } from "./types";

export interface SkillAttempt {
  skillId: Id;
  /** When the attempt happened; ordering is by this field. */
  at: IsoInstant;
  /** 0-1 how well the behaviour was performed. */
  performance: number;
}

export interface DiminishingReturnReport {
  skillId: Id;
  attempts: number;
  /** Improvement per attempt (regression slope) over the first half of the history. */
  earlySlope: number;
  /** Improvement per attempt over the second half. */
  recentSlope: number;
  /** Mean performance of the last three attempts. */
  recentLevel: number;
  /** True when the history is long enough and gains have collapsed. */
  saturated: boolean;
  message: string;
}

const MIN_ATTEMPTS = 6;
/** Second half must improve no more than 30% of the first half's rate to count as diminishing. */
const SLOPE_RATIO_THRESHOLD = 0.3;

function slope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function detectDiminishingReturns(attempts: SkillAttempt[]): DiminishingReturnReport[] {
  const bySkill = new Map<Id, SkillAttempt[]>();
  for (const attempt of attempts) {
    const list = bySkill.get(attempt.skillId) ?? [];
    list.push(attempt);
    bySkill.set(attempt.skillId, list);
  }

  const reports: DiminishingReturnReport[] = [];
  for (const [skillId, list] of bySkill) {
    const ordered = [...list].sort((a, b) => a.at.localeCompare(b.at));
    if (ordered.length < MIN_ATTEMPTS) continue;
    const half = Math.floor(ordered.length / 2);
    const xs = ordered.map((_, i) => i);
    const ys = ordered.map((a) => a.performance);
    const earlySlope = slope(xs.slice(0, half), ys.slice(0, half));
    const recentSlope = slope(xs.slice(half), ys.slice(half));
    const recentLevel = mean(ys.slice(-3));
    // Saturated: gains collapsed relative to the earlier phase, or the recent
    // phase is flat/negative outright. Requires the recent level to be below
    // ceiling — a long winning streak is consolidation, not grinding.
    const collapsed = earlySlope > 0 ? recentSlope <= earlySlope * SLOPE_RATIO_THRESHOLD : recentSlope <= 0.01;
    const saturated = collapsed && recentLevel < 0.92;

    if (!saturated) continue;
    reports.push({
      skillId,
      attempts: ordered.length,
      earlySlope,
      recentSlope,
      recentLevel,
      saturated,
      message:
        recentSlope < 0
          ? "Performance on this skill has stopped improving and is drifting back down with continued practice."
          : "Each additional attempt is producing almost no improvement — the remaining gap needs a different kind of practice, not more of the same.",
    });
  }
  return reports.sort((a, b) => a.recentSlope - b.recentSlope);
}

/**
 * Render a diminishing-returns report as an insight for the analytics page.
 * Follows the same hedging conventions as analytics.ts: a counted observation
 * with an explicitly alternative explanation.
 */
export function diminishingReturnsInsight(report: DiminishingReturnReport, userId: Id, now: IsoInstant): Insight | null {
  const skill = getSkill(report.skillId);
  return {
    id: `insight.diminishing-returns.${report.skillId}.${now.slice(0, 10)}`,
    userId,
    observation: `Recent practice on ${skill?.name.toLowerCase() ?? report.skillId} is not producing the improvement earlier attempts did.`,
    evidence: [
      `${report.attempts} attempts recorded.`,
      `Improvement per attempt dropped from ${(report.earlySlope * 100).toFixed(1)} pts/attempt in the first half to ${(report.recentSlope * 100).toFixed(1)} pts/attempt in the second.`,
      `Last three attempts averaged ${(report.recentLevel * 100).toFixed(0)}%.`,
    ],
    confidence: report.attempts >= 10 ? 0.62 : 0.45,
    possibleExplanation:
      "One explanation is over-practising: the same exercise in the same setting has stopped stretching the skill. Another is that the remaining gap is situational — it shows in real settings, not in rehearsal — which no amount of simulation practice will close.",
    recommendedAction: `Take ${skill?.name.toLowerCase() ?? "this skill"} into a real conversation instead of another rehearsal, or raise the difficulty one step.`,
    skillIds: [report.skillId],
    kind: "interpretation",
    createdAt: now,
  };
}
