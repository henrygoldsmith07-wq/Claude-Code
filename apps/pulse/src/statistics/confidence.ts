/**
 * Confidence grading.
 *
 * "Confidence: moderate" has to mean something specific and reproducible, or
 * it is decoration. This module is the single definition: a transparent
 * rubric over evidence strength, sample size, data quality, study design and
 * how large the search was that produced the result. The reasons are returned
 * alongside the grade so the UI can always show its working.
 */

import { clamp } from "./descriptive.js";

export type ConfidenceLevel = "very-low" | "low" | "moderate" | "high";

/** What kind of evidence produced the claim — the strongest single input to the grade. */
export type EvidenceClass = "observation" | "correlation" | "hypothesis" | "experiment";

export interface ConfidenceInput {
  evidenceClass: EvidenceClass;
  /** Total observations behind the claim. */
  sampleSize: number;
  /** Absolute standardised effect (|g|, |r|, |rank-biserial|). */
  effectMagnitude: number;
  /** After multiple-testing correction, when a family of tests was run. */
  adjustedP?: number;
  /** 0..1 from the data-quality scorer for the sources involved. */
  dataQuality: number;
  /** Number of comparisons in the family this result came from. */
  familySize?: number;
  /** Known confounders that could not be controlled or matched away. */
  uncontrolledConfounders?: number;
  /** True when the effect held in an independent time-split of the same data. */
  replicatedOutOfSample?: boolean;
  /** True when the direction of causation cannot be separated from reverse causation. */
  reverseCausationPlausible?: boolean;
  /** Effective n after accounting for serial correlation. */
  effectiveSampleSize?: number;
  /** Whether the estimated effect survives temporal block splitting. */
  effectStable?: boolean;
  /** Whether the estimated effect survives robust outlier removal. */
  outlierStable?: boolean;
  /** Minimum reliability of the observations behind the claim. */
  reliability?: number;
  /** Whether any contributing timestamps carry explicit uncertainty. */
  timestampUncertain?: boolean;
}

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  /** 0..1 continuous score behind the level, for ranking. */
  score: number;
  reasons: string[];
  /** Things that actively held the grade down — shown verbatim in the UI. */
  limitations: string[];
}

const BASE_BY_CLASS: Record<EvidenceClass, number> = {
  observation: 0.2,
  correlation: 0.35,
  hypothesis: 0.3,
  experiment: 0.6,
};

export function gradeConfidence(input: ConfidenceInput): ConfidenceAssessment {
  const reasons: string[] = [];
  const limitations: string[] = [];
  let score = BASE_BY_CLASS[input.evidenceClass];

  reasons.push(
    input.evidenceClass === "experiment"
      ? "Result comes from a controlled personal experiment"
      : `Result is ${input.evidenceClass === "correlation" ? "an observed association" : `an ${input.evidenceClass}`}, not an experiment`,
  );

  // Sample size — saturating, because the 200th session adds less than the 20th.
  const n = Math.max(0, input.sampleSize);
  const sampleScore = clamp(Math.log10(n + 1) / 2.3, 0, 1); // ~1.0 at n = 200
  score += 0.2 * sampleScore;
  if (n < 20) limitations.push(`Small sample (n = ${n}); the estimate will move as more data arrives`);
  else reasons.push(`Based on ${n} observations`);

  const effectiveN = input.effectiveSampleSize;
  if (effectiveN !== undefined && Number.isFinite(effectiveN) && effectiveN < n * 0.8) {
    score -= 0.05;
    limitations.push(`Serial correlation reduces the effective sample to about ${Math.max(1, Math.round(effectiveN))} observations`);
  }

  // Effect magnitude.
  const effect = Math.abs(input.effectMagnitude);
  score += 0.15 * clamp(effect / 0.8, 0, 1);
  if (effect < 0.2) limitations.push("Effect is small enough that it may not be worth acting on");

  // Statistical strength after correction.
  if (input.adjustedP !== undefined && Number.isFinite(input.adjustedP)) {
    if (input.adjustedP <= 0.01) {
      score += 0.15;
      reasons.push(`Survives multiple-testing correction (adjusted p = ${input.adjustedP.toFixed(3)})`);
    } else if (input.adjustedP <= 0.05) {
      score += 0.1;
      reasons.push(`Survives multiple-testing correction (adjusted p = ${input.adjustedP.toFixed(3)})`);
    } else {
      score -= 0.1;
      limitations.push(`Does not survive multiple-testing correction (adjusted p = ${input.adjustedP.toFixed(3)})`);
    }
  }

  // Data quality of the underlying sources.
  score += 0.1 * clamp(input.dataQuality, 0, 1);
  if (input.dataQuality < 0.6) {
    limitations.push("Underlying data quality is mixed (gaps, duplicates or stale syncs)");
  }

  // Search size: a result found among many comparisons deserves more scepticism.
  const family = input.familySize ?? 1;
  if (family > 20) {
    score -= 0.05;
    limitations.push(`Found while scanning ${family} comparisons`);
  }

  const confounders = input.uncontrolledConfounders ?? 0;
  if (confounders > 0) {
    score -= 0.05 * Math.min(3, confounders);
    limitations.push(`${confounders} plausible confounder${confounders === 1 ? "" : "s"} could not be controlled`);
  }

  if (input.replicatedOutOfSample) {
    score += 0.1;
    reasons.push("Held up in an independent time-split of the same data");
  }

  if (input.reverseCausationPlausible) {
    score -= 0.05;
    limitations.push("The effect could plausibly run in the opposite direction");
  }

  if (input.effectStable === false) {
    score -= 0.08;
    limitations.push("The effect is not stable across independent time blocks");
  }

  if (input.outlierStable === false) {
    score -= 0.06;
    limitations.push("The effect is sensitive to outlier handling");
  }

  if (input.reliability !== undefined && input.reliability < 0.6) {
    score -= 0.05;
    limitations.push("Some evidence comes from low-reliability sources or measurements");
  }

  if (input.timestampUncertain) {
    score -= 0.05;
    limitations.push("Timestamp uncertainty weakens temporal ordering");
  }

  score = clamp(score, 0, 1);

  // Observational evidence is capped: no amount of data turns a correlation
  // into a high-confidence causal claim.
  if (input.evidenceClass !== "experiment") score = Math.min(score, 0.74);

  return { level: levelFor(score), score, reasons, limitations };
}

export function levelFor(score: number): ConfidenceLevel {
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "moderate";
  if (score >= 0.35) return "low";
  return "very-low";
}

export function confidenceWeight(level: ConfidenceLevel): number {
  switch (level) {
    case "high":
      return 1;
    case "moderate":
      return 0.7;
    case "low":
      return 0.4;
    default:
      return 0.15;
  }
}

export interface UncertaintySummary {
  /** Short, honest label for the grade. */
  label: string;
  tone: "confident" | "provisional" | "unsure";
  /** One sentence that makes the uncertainty legible rather than frustrating. */
  sentence: string;
}

/**
 * "We don't know yet" is a feature, not a bug. This turns a confidence grade
 * into the plain sentence the UI shows next to it, so low confidence reads as
 * "more data will settle this" instead of "we failed to measure".
 */
export function uncertaintySummary(assessment: ConfidenceAssessment): UncertaintySummary {
  switch (assessment.level) {
    case "high":
      return {
        label: "We are fairly confident",
        tone: "confident",
        sentence: "The evidence is strong enough that this is unlikely to move much as more data arrives.",
      };
    case "moderate":
      return {
        label: "We are moderately confident",
        tone: "provisional",
        sentence: "This is worth acting on, but expect the estimate to move as more data arrives.",
      };
    case "low":
      return {
        label: "We are not sure yet",
        tone: "unsure",
        sentence: "The signal is real enough to notice but too thin to rely on — collect more data first.",
      };
    default:
      return {
        label: "We do not know yet",
        tone: "unsure",
        sentence: "There is not enough evidence to separate a real effect from noise. That is an honest answer, not a failure.",
      };
  }
}

/**
 * The causality disclaimer that must accompany any non-experimental claim.
 * Centralised so it cannot be forgotten in one surface and present in another.
 */
export function causalityCaveat(evidenceClass: EvidenceClass): string | null {
  switch (evidenceClass) {
    case "experiment":
      return "Measured under controlled conditions you assigned, so a causal reading is defensible for you specifically.";
    case "correlation":
      return "This is an association, not a cause. Something else may drive both.";
    case "hypothesis":
      return "This is an untested proposal. No causal claim is being made.";
    default:
      return "This is a description of what happened, not an explanation of why.";
  }
}
