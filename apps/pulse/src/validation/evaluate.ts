/**
 * Validation scoring.
 *
 * Three questions, each with a number attached:
 *
 *  1. Discovery quality — of the claims a method makes against data with
 *     known ground truth, how many are right (precision) and how much of
 *     what is there did it find (recall)? Scored identically for Pulse and
 *     for every naive baseline.
 *  2. Confidence calibration — when Pulse grades a finding "high", do high
 *     grades survive contact with later outcomes (an experiment, a
 *     replication) more often than low ones? A grade that does not track
 *     outcomes is decoration.
 *  3. Prediction accuracy — how far an experiment's observed effect lands
 *     from what was predicted, whether at least the *sign* was right, and
 *     by how much predictions overshoot (they always overshoot).
 *
 * Every function here takes plain records so it works on synthetic
 * benchmarks today and on human-reviewed real-data labels tomorrow.
 */

import { mean } from "../statistics/descriptive.js";
import type { ConfidenceLevel } from "../statistics/confidence.js";

// --- discovery scoring ----------------------------------------------------

export interface TruthPair {
  outcomeMetricId: string;
  exposureMetricId?: string;
}

/** Pair identity: outcome plus exposure when the claim names one. Direction-free by design — a reversed sign is still the same claim about the same pair. */
export function pairKey(claim: TruthPair): string {
  return [claim.outcomeMetricId, claim.exposureMetricId ?? "-"].join("|");
}

export interface ClaimScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  /** TP / (TP + FP); 1 when nothing was claimed. */
  precision: number;
  /** TP / (TP + FN); 0 when nothing was planted. */
  recall: number;
  f1: number;
  /** The specific false claims, for review rather than just counting. */
  falsePositiveDetails: DiscoveryClaimLike[];
}

export interface DiscoveryClaimLike {
  outcomeMetricId: string;
  exposureMetricId?: string;
  direction?: number;
  pValue?: number;
}

/**
 * Scores claims against planted truth pairs. A claim counts as correct when
 * it names a true pair; `requireDirection` additionally demands the sign
 * matches the planted direction.
 */
export function scoreClaims(
  claims: readonly DiscoveryClaimLike[],
  truth: readonly (TruthPair & { plantedDirection?: number })[],
  options: { requireDirection?: boolean } = {},
): ClaimScore {
  const trueKeys = new Map<string, TruthPair & { plantedDirection?: number }>();
  for (const rel of truth) {
    if (!rel.exposureMetricId) continue; // outcome-only truths are never targets of pair claims
    trueKeys.set(pairKey(rel), rel);
  }

  const seenTrue = new Set<string>();
  const falsePositiveDetails: DiscoveryClaimLike[] = [];

  for (const claim of claims) {
    if (!claim.exposureMetricId) continue; // trend-style claims have no pair target
    const key = pairKey(claim);
    const match = trueKeys.get(key);
    if (
      !match ||
      (options.requireDirection &&
        match.plantedDirection !== undefined &&
        Math.sign(claim.direction ?? 0) !== match.plantedDirection)
    ) {
      falsePositiveDetails.push(claim);
      continue;
    }
    seenTrue.add(key);
  }

  const truePositives = seenTrue.size;
  const falsePositives = falsePositiveDetails.length;
  const falseNegatives = [...trueKeys.keys()].filter((key) => !seenTrue.has(key)).length;

  return {
    truePositives,
    falsePositives,
    falseNegatives,
    precision: truePositives + falsePositives === 0 ? 1 : truePositives / (truePositives + falsePositives),
    recall: trueKeys.size === 0 ? 0 : truePositives / trueKeys.size,
    f1: truePositives === 0 ? 0 : (2 * truePositives) / (2 * truePositives + falsePositives + falseNegatives),
    falsePositiveDetails,
  };
}

// --- confidence-grade calibration -------------------------------------------

export type ConfidenceGrade = ConfidenceLevel;

export interface ConfidenceOutcomeRecord {
  grade: ConfidenceGrade;
  /** What happened later: an experiment or replication settled it, or it did not. */
  outcome: "supported" | "refuted" | "inconclusive";
}

export interface GradeReliability {
  grade: ConfidenceGrade;
  n: number;
  supported: number;
  refuted: number;
  /** supported / (supported + refuted); NaN when unsettled outcomes only. */
  supportRate: number;
}

const GRADE_ORDER: ConfidenceGrade[] = ["very-low", "low", "moderate", "high"];

/**
 * Reliability per grade. For the grades to mean anything, supportRate must
 * rise with the grade — high findings should survive more often than low
 * ones. The table reports; it does not editorialise.
 */
export function calibrateGrades(records: readonly ConfidenceOutcomeRecord[]): GradeReliability[] {
  return GRADE_ORDER.map((grade) => {
    const rows = records.filter((record) => record.grade === grade);
    const supported = rows.filter((row) => row.outcome === "supported").length;
    const refuted = rows.filter((row) => row.outcome === "refuted").length;
    return {
      grade,
      n: rows.length,
      supported,
      refuted,
      supportRate: supported + refuted === 0 ? NaN : supported / (supported + refuted),
    };
  });
}

/** True when support rates rise monotonically across grades that have settled data. */
export function gradesTrackOutcomes(table: readonly GradeReliability[]): boolean {
  const withData = table.filter((row) => !Number.isNaN(row.supportRate));
  if (withData.length < 2) return false;
  for (let i = 1; i < withData.length; i += 1) {
    if (withData[i]!.supportRate < withData[i - 1]!.supportRate) return false;
  }
  return true;
}

// --- predicted vs actual experiment effects ---------------------------------

export interface PredictedActualRecord {
  predictedEffect: number;
  observedEffect: number;
}

export interface PredictionAccuracy {
  n: number;
  /** Mean absolute error between predicted and observed standardised effects. */
  mae: number;
  /** Share of runs where the observed effect pointed the way predicted. */
  signAgreement: number;
  /**
   * Mean |observed| / |predicted|. Below 1 means predictions overshoot —
   * they always do; the number says by how much.
   */
  meanShrinkage: number;
  /** Share of runs whose observed effect reached at least half the prediction. */
  withinHalfPrediction: number;
}

export function comparePredictedToActual(records: readonly PredictedActualRecord[]): PredictionAccuracy {
  if (records.length === 0) {
    return { n: 0, mae: NaN, signAgreement: NaN, meanShrinkage: NaN, withinHalfPrediction: NaN };
  }
  const errors = records.map((record) => Math.abs(record.observedEffect - record.predictedEffect));
  const signs = records.filter((record) => Math.sign(record.observedEffect) === Math.sign(record.predictedEffect));
  const shrinkage = records.map((record) =>
    record.predictedEffect === 0 ? NaN : Math.abs(record.observedEffect) / Math.abs(record.predictedEffect),
  );
  const finiteShrinkage = shrinkage.filter((value) => Number.isFinite(value));
  const halves = records.filter((record) => Math.abs(record.observedEffect) >= 0.5 * Math.abs(record.predictedEffect));
  return {
    n: records.length,
    mae: mean(errors),
    signAgreement: signs.length / records.length,
    meanShrinkage: finiteShrinkage.length ? mean(finiteShrinkage) : NaN,
    withinHalfPrediction: halves.length / records.length,
  };
}
