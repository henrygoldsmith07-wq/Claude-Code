// ---------------------------------------------------------------------------
// Confidence.
//
// Every score the app shows is an estimate with uncertainty. This module
// converts multidimensional uncertainty into a categorical confidence the UI
// can show without pretending to be precise:
//
//   high | moderate | low | insufficient evidence
//
// Confidence considers five factors, stated in the objective:
//
//  1. amount of evidence       — how many independent observations
//  2. consistency              — agreement across those observations
//  3. transcript quality       — length, judgeability, turn count
//  4. rubric reliability       — inter-rater reliability for that behaviour
//  5. extraction uncertainty   — how sharply the feature extractor could tell
//
// The deterministic evaluator never inflates confidence because a score looks
// good — a short transcript can still read as strong but the confidence stays
// low, because the evidence is thin. The same conservatism applies to human
// validation: a behaviour with weak inter-rater agreement cannot yield "high"
// confidence no matter how agreeable the numbers look.
// ---------------------------------------------------------------------------

import type { BehaviourKey, BehaviourScore, Simulation } from "./types";
import { extractFeatures } from "./evaluation";
import type { BehaviourReliability } from "./agreement";

export type ConfidenceLevel = "high" | "moderate" | "low" | "insufficient evidence";

export interface ConfidenceInput {
  behaviour: BehaviourKey;
  /** Independent observations feeding this behaviour (simulator + human + validated-transfer). */
  amountOfEvidence: number;
  /** Consistency across observations, 0-1 (1 = perfectly consistent). Null when single observation. */
  consistency: number | null;
  /** Transcript quality for the most recent observation, 0-1. */
  transcriptQuality: number | null;
  /** Rubric reliability for this behaviour (e.g. cohenKappa or pearson). Null when unknown. */
  rubricReliability: number | null;
  /** Extraction uncertainty / severity of gaming or ambiguity, 0-1 (0 = certain). */
  extractionUncertainty: number;
  /** Whether the current score was marked reliable by the evaluator. */
  reliable: boolean;
  /** Behaviour reliability table, when available, for per-behaviour calibration. */
  behaviourReliability?: BehaviourReliability | null;
}

export interface ConfidenceResult {
  level: ConfidenceLevel;
  score: number; // 0-1 numeric for sorting/comparison
  reasons: string[];
  factors: Record<string, number | null>;
}

/**
 * Map numeric factors onto a categorical level.
 *
 * Thresholds are deliberately conservative: "high" requires multiple independent
 * observations, good consistency, and a reliable rubric. Most early evidence is
 * "low" or "insufficient evidence" — which is honest and keeps the UI from
 * asserting mastery on two turns.
 */
export function confidenceFor(input: ConfidenceInput): ConfidenceResult {
  const reasons: string[] = [];
  const factors: Record<string, number | null> = {
    amountOfEvidence: input.amountOfEvidence,
    consistency: input.consistency,
    transcriptQuality: input.transcriptQuality,
    rubricReliability: input.rubricReliability,
    extractionUncertainty: input.extractionUncertainty,
  };

  // Insufficient evidence is a hard gate — before any weighting, too little data is too little data.
  if (!input.reliable) {
    return {
      level: "insufficient evidence",
      score: 0.15,
      reasons: ["Latest transcript was too short to judge this behaviour reliably."],
      factors,
    };
  }

  if (input.amountOfEvidence === 0) {
    return { level: "insufficient evidence", score: 0.1, reasons: ["No independent observations yet."], factors };
  }

  if (input.amountOfEvidence === 1) {
    reasons.push("Only one independent observation — not enough to be sure yet.");
  }

  // Component scores 0-1
  const amountScore = Math.min(1, input.amountOfEvidence / 6); // 6 observations = full
  const consistencyScore = input.consistency === null ? 0.6 : input.consistency;
  const transcriptScore = input.transcriptQuality === null ? 0.6 : input.transcriptQuality;
  const rubricScore = input.rubricReliability === null ? 0.6 : clamp01(input.rubricReliability);
  const extractionScore = 1 - clamp01(input.extractionUncertainty);

  if (input.consistency !== null && input.consistency < 0.5) reasons.push(`Recent observations disagree (consistency ${input.consistency.toFixed(2)}).`);
  if (input.transcriptQuality !== null && input.transcriptQuality < 0.5) reasons.push("Recent transcript was short or had little judgeable material.");
  if (input.rubricReliability !== null && input.rubricReliability < 0.4) reasons.push("Human raters disagree about this behaviour, so even agreed scores are tentative.");
  if (input.extractionUncertainty > 0.4) reasons.push("Extraction was uncertain — the transcript was ambiguous or contained gaming patterns.");

  // Per-behaviour reliability can downgrade confidence even when other signals look good
  if (input.behaviourReliability) {
    const r = input.behaviourReliability;
    const unreliable = (r.cohenKappa !== null && r.cohenKappa < 0.4) || (r.meanAbsDisagreement !== null && r.meanAbsDisagreement > 0.25);
    if (unreliable) reasons.push(`Human agreement on ${input.behaviour} is weak — treat scores as tentative.`);
  }

  // Weighted blend; amount and rubric weigh most — a shaky rubric cannot be outvoted by volume.
  const blended = amountScore * 0.3 + consistencyScore * 0.2 + transcriptScore * 0.15 + rubricScore * 0.25 + extractionScore * 0.1;

  let level: ConfidenceLevel;
  if (input.amountOfEvidence < 2 || blended < 0.32) level = "low";
  else if (amountScore < 0.5 || blended < 0.58) level = "moderate";
  else if (blended >= 0.72 && input.amountOfEvidence >= 4) level = "high";
  else level = "moderate";

  // Downgrade to "insufficient evidence" if any hard floor fails, regardless of blend
  if (input.amountOfEvidence === 1 && (input.transcriptQuality !== null && input.transcriptQuality < 0.4)) {
    level = "insufficient evidence";
    reasons.unshift("Single short transcript — not enough to confirm the behaviour.");
  }

  // Enforce that rubric-unreliable behaviours can never be "high"
  if (level === "high" && input.rubricReliability !== null && input.rubricReliability < 0.55) {
    level = "moderate";
    reasons.push("Capped at moderate because human raters are not yet reliably consistent on this behaviour.");
  }

  if (reasons.length === 0) {
    if (level === "high") reasons.push("Multiple consistent observations with a reliable rubric.");
    else if (level === "moderate") reasons.push("Some evidence, broadly consistent.");
    else if (level === "low") reasons.push("Limited or mixed evidence — more observations would clarify.");
  }

  return { level, score: Number(blended.toFixed(3)), reasons, factors };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

// ---------------------------------------------------------------------------
// Helpers to compute inputs from live data
// ---------------------------------------------------------------------------

export function transcriptQualityFromSimulation(simulation: Simulation): number {
  const features = extractFeatures(simulation);
  const turns = features.userTurns.length;
  const judgeable = features.judgeableReplies;
  // Quality: 1.0 when turns >=6 and most replies judgeable, falls sharply below
  const turnScore = Math.min(1, turns / 6);
  const judgeableScore = turns === 0 ? 0 : judgeable / Math.max(1, turns);
  const wordScore = Math.min(1, (features.userWords + features.characterWords) / 80);
  const quality = turnScore * 0.5 + judgeableScore * 0.3 + wordScore * 0.2;
  return Number(quality.toFixed(3));
}

export function consistencyFromScores(scores: number[]): number | null {
  if (scores.length < 2) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, v) => sum + (v - mean) ** 2, 0) / scores.length;
  const sd = Math.sqrt(variance);
  // Consistency = 1 - sd (scaled). sd 0 = 1.0, sd 0.5 = 0
  return Number(Math.max(0, 1 - sd * 2).toFixed(3));
}

export function extractionUncertaintyFromEvaluation(scores: BehaviourScore[]): number {
  // Unreliable scores raise extraction uncertainty; gaming-penalised scores also raise it
  const unreliableShare = scores.length === 0 ? 0.5 : scores.filter((s) => !s.reliable).length / scores.length;
  const gamingFlagged = scores.some((s) => s.evidence.includes("score-gaming")) ? 0.25 : 0;
  const lowSpanCoverage = scores.some((s) => (s.evidenceSpans?.length ?? 0) === 0 && s.reliable) ? 0.15 : 0;
  return Number(Math.min(1, unreliableShare * 0.6 + gamingFlagged + lowSpanCoverage).toFixed(3));
}

// Behaviour-level confidence for evidence ledger profiles
export function ledgerConfidence(input: {
  amountOfEvidence: number;
  recentScores: number[];
  simulation?: Simulation;
  rubricReliability?: number | null;
  behaviourReliability?: BehaviourReliability | null;
  reliable: boolean;
  behaviour: BehaviourKey;
}): ConfidenceResult {
  return confidenceFor({
    behaviour: input.behaviour,
    amountOfEvidence: input.amountOfEvidence,
    consistency: consistencyFromScores(input.recentScores),
    transcriptQuality: input.simulation ? transcriptQualityFromSimulation(input.simulation) : null,
    rubricReliability: input.rubricReliability ?? null,
    extractionUncertainty: input.simulation ? extractionUncertaintyFromEvaluation([]) : 0.1,
    reliable: input.reliable,
    behaviourReliability: input.behaviourReliability ?? null,
  });
}
