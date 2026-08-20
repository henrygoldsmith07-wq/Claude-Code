import type { CalibrationAction } from "./types";

/** A prior parameter is a declared assumption, not an observed learner result. */
export interface PriorParameter {
  mean: number;
  standardDeviation: number;
  /** Equivalent prior observations used by the shrinkage rule. */
  strength: number;
}

export interface VersionedCalibrationPrior {
  version: string;
  source: "population-default";
  description: string;
  minimums: {
    personalOutcomes: number;
    reliableOutcomes: number;
    paperOutcomes: number;
    timingOutcomes: number;
    heldOutOutcomes: number;
    biasGroupOutcomes: number;
  };
  interval: {
    z: number;
    minimumStandardDeviation: number;
    sparseInflation: number;
    calibrationBins: number;
    biasFlagAbsoluteThreshold: number;
  };
  masteryToQuestionMarks: {
    intercept: PriorParameter;
    masterySlope: PriorParameter;
    durationSlope: PriorParameter;
    actionEffects: Record<CalibrationAction, PriorParameter>;
    residualStandardDeviation: number;
    durationReferenceMinutes: number;
    lower: number;
    upper: number;
  };
  recoverableFraction: PriorParameter & { lower: number; upper: number };
  marksPerHour: PriorParameter & { lower: number; upper: number };
  timing: {
    secondsPerMark: PriorParameter;
    lowerSecondsPerMark: number;
    upperSecondsPerMark: number;
    rushedRatio: number;
    slowRatio: number;
    defaultPaperDurationMinutes: number;
  };
  paperCalibration: {
    intercept: PriorParameter;
    slope: PriorParameter;
    residualStandardDeviation: number;
    lower: number;
    upper: number;
  };
  grade: {
    measuredEvidenceStrength: number;
    topicEvidenceStrength: number;
    horizonDays: number;
    horizonFloor: number;
    topicContributionWeight: number;
    measuredConfidenceWeight: number;
    horizonUncertaintyScale: number;
    minimumPercent: number;
    maximumPercent: number;
  };
}

/**
 * Revise's population/default prior. It is intentionally versioned and
 * labelled as a prior: none of these values are presented as a user outcome.
 * A later release can replace this with a fitted cohort prior without
 * invalidating historical predictions because their prior version is stored.
 */
export const CALIBRATION_PRIOR_V1: VersionedCalibrationPrior = {
  version: "revise-calibration-prior-2026-08-20-v1",
  source: "population-default",
  description: "Wide, conservative starting prior used before enough observed transfer outcomes exist.",
  minimums: {
    personalOutcomes: 8,
    reliableOutcomes: 20,
    paperOutcomes: 3,
    timingOutcomes: 3,
    heldOutOutcomes: 5,
    biasGroupOutcomes: 8,
  },
  interval: {
    z: 1.96,
    minimumStandardDeviation: 0.08,
    sparseInflation: 0.75,
    calibrationBins: 5,
    biasFlagAbsoluteThreshold: 0.08,
  },
  masteryToQuestionMarks: {
    intercept: { mean: 0.22, standardDeviation: 0.16, strength: 16 },
    masterySlope: { mean: 0.62, standardDeviation: 0.26, strength: 16 },
    durationSlope: { mean: 0.05, standardDeviation: 0.06, strength: 20 },
    actionEffects: {
      learn: { mean: 0.04, standardDeviation: 0.12, strength: 12 },
      flashcards: { mean: 0.02, standardDeviation: 0.10, strength: 12 },
      recall: { mean: 0.04, standardDeviation: 0.12, strength: 12 },
      practice: { mean: 0.06, standardDeviation: 0.12, strength: 12 },
      mistakes: { mean: 0.08, standardDeviation: 0.12, strength: 12 },
      paper: { mean: 0, standardDeviation: 0.10, strength: 12 },
    },
    residualStandardDeviation: 0.20,
    durationReferenceMinutes: 30,
    lower: 0,
    upper: 1,
  },
  recoverableFraction: {
    mean: 0.50,
    standardDeviation: 0.28,
    strength: 12,
    lower: 0,
    upper: 1,
  },
  marksPerHour: {
    mean: 1.50,
    standardDeviation: 2.50,
    strength: 8,
    lower: 0,
    upper: 12,
  },
  timing: {
    secondsPerMark: {
      mean: 90,
      standardDeviation: 30,
      strength: 8,
    },
    lowerSecondsPerMark: 1,
    upperSecondsPerMark: 600,
    rushedRatio: 0.75,
    slowRatio: 1.35,
    defaultPaperDurationMinutes: 90,
  },
  paperCalibration: {
    intercept: { mean: 0, standardDeviation: 0.10, strength: 6 },
    slope: { mean: 1, standardDeviation: 0.20, strength: 6 },
    residualStandardDeviation: 0.16,
    lower: 0,
    upper: 1,
  },
  grade: {
    measuredEvidenceStrength: 10,
    topicEvidenceStrength: 12,
    horizonDays: 400,
    horizonFloor: 0.60,
    topicContributionWeight: 0.25,
    measuredConfidenceWeight: 0.75,
    horizonUncertaintyScale: 0.20,
    minimumPercent: 0,
    maximumPercent: 100,
  },
};

export const CALIBRATION_MODEL_VERSION = "revise-calibration-model-2026-08-20-v1";
