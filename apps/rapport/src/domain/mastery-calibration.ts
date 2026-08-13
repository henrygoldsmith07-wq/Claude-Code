// ---------------------------------------------------------------------------
// Mastery calibration.
//
// The mastery number is a prediction: "how likely is this person to perform
// the behaviour now". Calibration asks whether that prediction is honest —
// when the app says 0.7, does the user actually perform at ~0.7 next time?
// This module scores the estimate against realised future performance (ECE,
// Brier, uncertainty coverage) and validates the one modelling choice the
// product stakes its claim on: real-world evidence outweighing simulation
// evidence.
//
// The weighting validation folds the same synthetic history twice — once with
// the shipped kind weights and once with equal weights — and compares how
// closely each recovers a planted ground-truth skill. Pure, deterministic, no
// I/O; the "reference fold" below mirrors the Kalman update in mastery.ts so
// the comparison measures the weights, not a second model.
// ---------------------------------------------------------------------------

import { decay, initialSkillState } from "./mastery";
import type { Evidence } from "./mastery";
import type { Id, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// Calibration of predicted mastery vs realised performance
// ---------------------------------------------------------------------------

export interface CalibrationObservation {
  /** Predicted mastery at the time the forecast was made. */
  predicted: number;
  /** Predicted uncertainty (standard-deviation-like). */
  uncertainty: number;
  /** Realised performance on the next attempt. */
  actual: number;
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  count: number;
  meanPredicted: number;
  meanActual: number;
}

export interface CalibrationResult {
  observations: number;
  /** Expected calibration error over equal-width bins. 0 = perfectly calibrated. */
  ece: number;
  /** Brier score over (predicted, actual) pairs. */
  brier: number;
  /** Fraction of observations where |actual − predicted| ≤ uncertainty. ~0.68 for well-calibrated 1-σ. */
  oneSigmaCoverage: number;
  bins: CalibrationBin[];
}

export function calibrateMastery(observations: CalibrationObservation[], bins = 5): CalibrationResult {
  const n = observations.length;
  if (n === 0) return { observations: 0, ece: 0, brier: 0, oneSigmaCoverage: 0, bins: [] };

  const width = 1 / bins;
  const buckets = Array.from({ length: bins }, () => ({ predicted: 0, actual: 0, count: 0 } as { predicted: number; actual: number; count: number }));
  for (const obs of observations) {
    const p = Math.min(0.999, Math.max(0.001, obs.predicted));
    const b = Math.min(bins - 1, Math.floor(p / width));
    const bucket = buckets[b]!;
    bucket.predicted += obs.predicted;
    bucket.actual += obs.actual;
    bucket.count++;
  }

  let ece = 0;
  let brier = 0;
  let covered = 0;
  for (const obs of observations) {
    brier += (obs.predicted - obs.actual) ** 2;
    if (Math.abs(obs.actual - obs.predicted) <= obs.uncertainty) covered++;
  }
  brier /= n;

  const binRows: CalibrationBin[] = [];
  for (let b = 0; b < bins; b++) {
    const bucket = buckets[b];
    if (!bucket || bucket.count === 0) continue;
    const meanPredicted = bucket.predicted / bucket.count;
    const meanActual = bucket.actual / bucket.count;
    ece += (bucket.count / n) * Math.abs(meanPredicted - meanActual);
    binRows.push({ lo: b * width, hi: (b + 1) * width, count: bucket.count, meanPredicted, meanActual });
  }

  return { observations: n, ece, brier, oneSigmaCoverage: covered / n, bins: binRows };
}

// ---------------------------------------------------------------------------
// Reference fold with injectable kind weights (mirrors mastery.applyEvidence)
// ---------------------------------------------------------------------------

export type KindWeights = Partial<Record<Evidence["kind"], number>>;

const SHIPPED_WEIGHTS: Record<Evidence["kind"], number> = {
  challenge: 1,
  simulation: 0.6,
  exercise: 0.35,
  "self-report": 0.3,
};

/** Copy of the Kalman update in mastery.ts with the kind weights injectable. */
function foldWithWeights(state: UserSkillState, evidence: Evidence, kindWeights: Record<Evidence["kind"], number>): UserSkillState {
  const weight = kindWeights[evidence.kind] * Math.min(1, Math.max(0, evidence.reliability));
  if (weight <= 0) return state;

  const decayed = decay(state, evidence.at);
  const d = Math.min(5, Math.max(1, evidence.difficulty));
  const ceiling = 0.45 + d * 0.11;
  const floor = (d - 1) * 0.1125;
  const target = Math.min(1, Math.max(0, floor + evidence.performance * (ceiling - floor)));

  const observationNoise = 0.35 / weight;
  const variance = decayed.masteryUncertainty ** 2;
  const gain = variance / (variance + observationNoise ** 2);
  const mastery = Math.min(1, Math.max(0, decayed.mastery + gain * (target - decayed.mastery)));
  const masteryUncertainty = Math.max(0.06, Math.sqrt(variance * (1 - gain)));

  return {
    ...decayed,
    mastery,
    masteryUncertainty,
    attemptCount: decayed.attemptCount + 1,
    lastPractisedAt: evidence.at,
    retentionEstimate: 1,
    updatedAt: evidence.at,
  };
}

// ---------------------------------------------------------------------------
// Real-world vs simulation weighting validation
// ---------------------------------------------------------------------------

export interface WeightingValidation {
  /** Mean absolute error over the last third of the history, shipped weights. */
  shippedMAE: number;
  /** Same, equal weights (all kinds weighted 1.0). */
  equalMAE: number;
  /** Final |mastery − true skill|, shipped weights. */
  shippedFinalError: number;
  /** Final |mastery − true skill|, equal weights. */
  equalFinalError: number;
  /** True when the shipped weights recover the planted skill more closely. */
  shippedWins: boolean;
  events: number;
}

const EQUAL_WEIGHTS: Record<Evidence["kind"], number> = { challenge: 1, simulation: 1, exercise: 1, "self-report": 1 };

/**
 * Generate a synthetic evidence log where real-world (challenge) observations
 * track a planted true skill with small noise, and simulations carry a
 * systematic bias plus larger noise — rehearsals run easier (or harder) than
 * real life, which is the realistic failure mode. A weighting that trusts real
 * evidence should recover the truth more closely than one that treats every
 * observation alike.
 */
export function syntheticEvidenceLog(opts: { skillId: Id; trueSkill: number; events: number; seed?: number; simBias?: number }): Evidence[] {
  const { skillId, trueSkill, events, seed = 11, simBias = 0.2 } = opts;
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const out: Evidence[] = [];
  for (let i = 0; i < events; i++) {
    const isChallenge = i % 3 === 0;
    // Real-world: small noise. Simulation: systematic bias + large noise
    // (rehearsals overstate or understate the real behaviour).
    const noise = isChallenge ? (rng() - 0.5) * 0.16 : simBias + (rng() - 0.5) * 0.5;
    const performance = Math.min(1, Math.max(0, trueSkill + noise));
    out.push({
      skillId,
      performance,
      difficulty: 3,
      kind: isChallenge ? "challenge" : "simulation",
      reliability: 0.9,
      at: new Date(Date.UTC(2026, 0, 1, 10 + i)).toISOString(),
    });
  }
  return out;
}

/**
 * Fold the same log under the shipped weights and under equal weights.
 * Comparison is on the steady state — the last third of the history and the
 * final estimate — not the whole run: the early phase is dominated by
 * convergence speed, which is a property of any filter, while the question
 * here is which weighting keeps the belief honest once it has settled.
 * `shippedWins` is the headline: it should be true whenever the product's
 * real-world-over-simulation claim is sound.
 */
export function validateEvidenceWeighting(opts: { skillId: Id; trueSkill: number; events: number; seed?: number; simBias?: number }): WeightingValidation {
  const { skillId, trueSkill, events, seed, simBias = 0.2 } = opts;
  const log = syntheticEvidenceLog({ skillId, trueSkill, events, seed, simBias });
  const lateStart = Math.floor(log.length * (2 / 3));

  // The belief converges to the model's own fixed point for the planted
  // performance, not to the raw performance number: difficulty 3 maps a 0.75
  // performance onto a ~0.64 target. Truth for the fold is that fixed point.
  const truth = evidenceTargetFixedPoint(trueSkill, 3);

  const firstEvent = log[0]!;
  const fold = (kindWeights: Record<Evidence["kind"], number>) => {
    let state = initialSkillState("bench-user", skillId, firstEvent.at);
    let lateError = 0;
    let lateCount = 0;
    for (let i = 0; i < log.length; i++) {
      state = foldWithWeights(state, log[i]!, kindWeights);
      if (i >= lateStart) {
        lateError += Math.abs(state.mastery - truth);
        lateCount++;
      }
    }
    return { lateMAE: lateCount ? lateError / lateCount : 0, finalError: Math.abs(state.mastery - truth) };
  };

  const shipped = fold(SHIPPED_WEIGHTS);
  const equal = fold(EQUAL_WEIGHTS);
  const shippedWins = shipped.lateMAE < equal.lateMAE && shipped.finalError <= equal.finalError + 1e-9;
  return {
    shippedMAE: shipped.lateMAE,
    equalMAE: equal.lateMAE,
    shippedFinalError: shipped.finalError,
    equalFinalError: equal.finalError,
    shippedWins,
    events: log.length,
  };
}

/** The mastery value a performance of `performance` at `difficulty` maps onto. */
function evidenceTargetFixedPoint(performance: number, difficulty: number): number {
  const d = Math.min(5, Math.max(1, difficulty));
  const ceiling = 0.45 + d * 0.11;
  const floor = (d - 1) * 0.1125;
  return Math.min(1, Math.max(0, floor + performance * (ceiling - floor)));
}
