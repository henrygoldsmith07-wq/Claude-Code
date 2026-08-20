import { describe, expect, it } from "vitest";
import {
  applyPaperCalibration,
  benchmarkCalibration,
  buildCalibrationModel,
  calibrationMetrics,
  estimateMarksPerHour,
  evaluateHeldOutCalibration,
  evaluatePaperCalibration,
  fitTimingCalibration,
  fitQuestionMarkModel,
  fitPaperCalibration,
  observationFromRevisionAndOutcome,
  observationsFromAttempts,
  predictQuestionMarks,
} from "@/domain/calibration";
import { CALIBRATION_MODEL_VERSION, CALIBRATION_PRIOR_V1 } from "@/domain/calibration-priors";
import type { Attempt, CalibrationObservation, PredictionHistoryRecord } from "@/domain/types";

const AS_OF = "2026-04-01T00:00:00.000Z";

function iso(day: number, hour = 12): string {
  return new Date(Date.UTC(2026, 0, 1 + day, hour)).toISOString();
}

function observation(index: number, overrides: Partial<CalibrationObservation> = {}): CalibrationObservation {
  const mastery = 0.15 + (index % 8) * 0.1;
  const revisionAt = iso(index);
  const outcomeAt = iso(index + 1);
  return {
    id: `observation-${index}`,
    userId: "user-1",
    subjectId: "subject-1",
    topicId: index % 2 ? "topic-b" : "topic-a",
    laterQuestionId: `later-question-${index}`,
    revisionAction: index % 3 === 0 ? "practice" : "mistakes",
    revisionAt,
    durationMinutes: 20 + (index % 4) * 10,
    baselineMastery: mastery,
    baselineEvidence: 4 + index,
    laterQuestionWasUnseen: true,
    outcomeAt,
    actualMarks: Math.round(Math.max(0, Math.min(10, (0.16 + mastery * 0.72 + (index % 3) * 0.025) * 10)) * 100) / 100,
    maxMarks: 10,
    opportunityMarks: 4,
    improvementMarks: 1 + (index % 4) * 0.5,
    createdAt: outcomeAt,
    updatedAt: outcomeAt,
    source: "observed",
    ...overrides,
  };
}

function attempt(id: string, questionId: string, createdAt: string, context: Attempt["calibrationContext"]): Attempt {
  return {
    id,
    userId: "user-1",
    questionId,
    subjectId: "subject-1",
    topicIds: ["topic-a"],
    answers: {},
    marked: [],
    awarded: 5,
    max: 10,
    feedback: "",
    markedBy: "rubric",
    elapsedMs: 60_000,
    mode: "practice",
    calibrationContext: context,
    createdAt,
  };
}

function paperRecord(index: number, overrides: Partial<PredictionHistoryRecord> = {}): PredictionHistoryRecord {
  const predictedAt = iso(index);
  const outcomeAt = iso(index + 2);
  const predictedPercent = 0.35 + index * 0.08;
  return {
    id: `prediction-${index}`,
    userId: "user-1",
    subjectId: "subject-1",
    paperSpecId: "paper-1",
    paperRunId: `run-${index}`,
    predictedAt,
    modelVersion: CALIBRATION_MODEL_VERSION,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    source: "population-prior",
    personalSampleSize: 0,
    predictedMarks: predictedPercent * 100,
    predictedMarksLower: Math.max(0, predictedPercent * 100 - 15),
    predictedMarksUpper: Math.min(100, predictedPercent * 100 + 15),
    totalMarks: 100,
    predictedPercent,
    predictedPercentLower: Math.max(0, predictedPercent - 0.15),
    predictedPercentUpper: Math.min(1, predictedPercent + 0.15),
    outcomeMarks: Math.min(100, predictedPercent * 100 + 8),
    outcomeTotalMarks: 100,
    outcomeAt,
    createdAt: predictedAt,
    updatedAt: outcomeAt,
    ...overrides,
  };
}

describe("versioned empirical calibration", () => {
  it("exposes a population prior with a wide interval before personal evidence", () => {
    const model = buildCalibrationModel({ observations: [], asOf: AS_OF });
    const estimate = predictQuestionMarks({
      model: model.questionMarks,
      baselineMastery: 0.5,
      durationMinutes: 30,
      action: "practice",
    });

    expect(model.modelVersion).toBe(CALIBRATION_MODEL_VERSION);
    expect(model.priorVersion).toBe(CALIBRATION_PRIOR_V1.version);
    expect(estimate.source).toBe("population-prior");
    expect(estimate.sampleSize).toBe(0);
    expect(estimate.lower).toBeLessThan(estimate.value);
    expect(estimate.upper).toBeGreaterThan(estimate.value);
    expect(estimate.upper - estimate.lower).toBeGreaterThan(0.4);
  });

  it("does not create an observation without captured pre-revision state or unseen outcome", () => {
    const revision = attempt("revision", "q-old", iso(1), {
      action: "practice",
      startedAt: iso(1, 10),
      durationMinutes: 30,
      baselineMastery: 0.3,
      baselineEvidence: 4,
    });
    const seenOutcome = attempt("outcome", "q-seen", iso(2), {
      action: "practice",
      questionWasUnseen: false,
    });
    const unseenOutcome = attempt("outcome-2", "q-new", iso(2), {
      action: "practice",
      questionWasUnseen: true,
    });

    expect(observationFromRevisionAndOutcome({ id: "x", revision, outcome: seenOutcome, topicId: "topic-a" })).toBeNull();
    expect(observationFromRevisionAndOutcome({ id: "y", revision, outcome: unseenOutcome, topicId: "topic-a" })).not.toBeNull();
    expect(observationFromRevisionAndOutcome({
      id: "z",
      revision: { ...revision, calibrationContext: undefined },
      outcome: unseenOutcome,
      topicId: "topic-a",
    })).toBeNull();
  });

  it("shrinks sparse personal data toward the prior and keeps uncertainty wide", () => {
    const sparse = fitQuestionMarkModel([observation(0, { actualMarks: 10 })], "subject-1", AS_OF);
    const estimate = predictQuestionMarks({ model: sparse, baselineMastery: 0.15, durationMinutes: 20, action: "practice" });
    const prior = predictQuestionMarks({ baselineMastery: 0.15, durationMinutes: 20, action: "practice" });

    expect(estimate.source).toBe("population-plus-personal-shrinkage");
    expect(estimate.sampleSize).toBe(1);
    expect(estimate.value).toBeLessThan(1);
    expect(estimate.value).toBeGreaterThanOrEqual(Math.min(prior.value, 1));
    expect(estimate.upper - estimate.lower).toBeGreaterThan(0.2);
  });

  it("excludes future outcomes and evaluates a chronological held-out set", () => {
    const rows = Array.from({ length: 28 }, (_, index) => observation(index));
    rows.push(observation(40, { id: "future", laterQuestionId: "future-question", outcomeAt: "2026-06-01T00:00:00.000Z" }));
    const report = evaluateHeldOutCalibration({ observations: rows, asOf: AS_OF });

    expect(report.trainingSize).toBe(28);
    expect(report.holdoutSize).toBeGreaterThanOrEqual(CALIBRATION_PRIOR_V1.minimums.heldOutOutcomes);
    expect(report.noFutureLeakage).toBe(true);
    expect(report.metrics.n).toBe(report.holdoutSize);
    expect(report.metrics.mae).toBeGreaterThanOrEqual(0);
    expect(report.metrics.ece).toBeGreaterThanOrEqual(0);
    expect(report.metrics.intervalCoverage).not.toBeNull();
    expect(report.excludedFutureCount).toBe(1);
  });

  it("flags group bias and reports MAE, calibration and interval coverage", () => {
    const metrics = calibrationMetrics(Array.from({ length: 8 }, () => ({
      predicted: 0.5,
      actual: 0.7,
      lower: 0.35,
      upper: 0.65,
      group: "practice",
    })));
    expect(metrics.mae).toBeCloseTo(0.2);
    expect(metrics.bias).toBeCloseTo(0.2);
    expect(metrics.intervalCoverage).toBe(0);
    expect(metrics.biasFlags).toContain("practice");
    expect(metrics.biasByGroup.practice.n).toBe(8);
  });

  it("estimates marks/hour from improvement outcomes, not marks lost alone", () => {
    const priorModel = buildCalibrationModel({ observations: [observation(0, { improvementMarks: undefined, opportunityMarks: undefined })], asOf: AS_OF });
    const priorEstimate = estimateMarksPerHour(priorModel, "topic-a", "subject-1");
    expect(priorEstimate.source).toBe("population-prior");
    expect(priorEstimate.sampleSize).toBe(0);

    const personalModel = buildCalibrationModel({
      observations: Array.from({ length: 4 }, (_, index) => observation(index, { improvementMarks: 4, durationMinutes: 30, opportunityMarks: 5 })),
      asOf: AS_OF,
    });
    const estimate = estimateMarksPerHour(personalModel, "topic-a", "subject-1");
    expect(estimate.sampleSize).toBeGreaterThan(0);
    expect(estimate.source).toBe("population-plus-personal-shrinkage");
    expect(estimate.value).toBeGreaterThan(CALIBRATION_PRIOR_V1.marksPerHour.mean);
    expect(estimate.lower).toBeLessThanOrEqual(estimate.value);
    expect(estimate.upper).toBeGreaterThanOrEqual(estimate.value);
  });

  it("calibrates paper predictions only from completed pre-sitting records", () => {
    const records = Array.from({ length: 6 }, (_, index) => paperRecord(index));
    records.push(paperRecord(50, { id: "future-paper", outcomeAt: "2026-06-01T00:00:00.000Z" }));
    const model = fitPaperCalibration(records, "subject-1", AS_OF);
    const estimate = applyPaperCalibration({ model, predictedMarks: 60, totalMarks: 100 });
    const report = evaluatePaperCalibration({ records, asOf: AS_OF });

    expect(model.sampleSize).toBe(6);
    expect(model.source).toBe("population-plus-personal-shrinkage");
    expect(estimate.lower).toBeLessThanOrEqual(estimate.value);
    expect(estimate.upper).toBeGreaterThanOrEqual(estimate.value);
    expect(report.sampleSize).toBe(6);
    expect(report.noFutureLeakage).toBe(true);
    expect(report.priorFallbackCount).toBe(3);
    expect(report.excludedFutureCount).toBe(1);
  });

  it("derives recall actions only from captured chronological attempts", () => {
    const revision = attempt("revision", "q-old", iso(1), {
      action: "recall",
      startedAt: iso(1, 10),
      durationMinutes: 15,
      baselineMastery: 0.25,
      baselineEvidence: 3,
    });
    const outcome = attempt("outcome", "q-new", iso(2), { action: "paper", questionWasUnseen: true });
    const rows = observationsFromAttempts({ attempts: [revision, outcome], asOf: AS_OF });
    expect(rows).toHaveLength(1);
    expect(rows[0].revisionAction).toBe("recall");
    expect(rows[0].durationMinutes).toBe(15);
  });

  it("narrows a valid interval only as observed evidence accumulates", () => {
    const sparse = predictQuestionMarks({
      model: fitQuestionMarkModel([observation(0)], "subject-1", AS_OF),
      baselineMastery: 0.5,
      durationMinutes: 30,
      action: "practice",
    });
    const dense = predictQuestionMarks({
      model: fitQuestionMarkModel(Array.from({ length: 28 }, (_, index) => observation(index)), "subject-1", AS_OF),
      baselineMastery: 0.5,
      durationMinutes: 30,
      action: "practice",
    });
    expect(dense.upper - dense.lower).toBeLessThan(sparse.upper - sparse.lower);
    expect(dense.personalWeight).toBeGreaterThan(sparse.personalWeight);
  });

  it("keeps timing defaults versioned and excludes future attempts", () => {
    const timing = fitTimingCalibration({
      attempts: [
        { ...attempt("timing-1", "q-1", iso(1), undefined), elapsedMs: 90_000 },
        { ...attempt("timing-2", "q-2", iso(2), undefined), elapsedMs: 60_000 },
        { ...attempt("timing-future", "q-3", "2026-06-01T00:00:00.000Z", undefined), elapsedMs: 1_000 },
      ],
      questions: [],
      papers: [],
      subjects: [],
      asOf: AS_OF,
    });
    expect(timing.sampleSize).toBe(2);
    expect(timing.secondsPerMark.priorVersion).toBe(CALIBRATION_PRIOR_V1.version);
    expect(timing.secondsPerMark.source).toBe("population-plus-personal-shrinkage");
  });

  it("produces a reproducible benchmark report for synthetic machinery tests", () => {
    const report = benchmarkCalibration({
      observations: Array.from({ length: 28 }, (_, index) => observation(index)),
      predictionHistory: Array.from({ length: 6 }, (_, index) => paperRecord(index)),
      asOf: AS_OF,
    });

    expect(report.modelVersion).toBe(CALIBRATION_MODEL_VERSION);
    expect(report.priorVersion).toBe(CALIBRATION_PRIOR_V1.version);
    expect(report.question.noFutureLeakage).toBe(true);
    expect(report.question.metrics.n).toBeGreaterThanOrEqual(CALIBRATION_PRIOR_V1.minimums.heldOutOutcomes);
    expect(report.paper.sampleSize).toBe(6);
  });
});
