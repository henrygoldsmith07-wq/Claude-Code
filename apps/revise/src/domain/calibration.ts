import { CALIBRATION_MODEL_VERSION, CALIBRATION_PRIOR_V1, type PriorParameter } from "./calibration-priors";
import type {
  Attempt,
  Calibration,
  CalibrationAction,
  CalibrationDataSource,
  CalibrationObservation,
  Id,
  Paper,
  PredictionHistoryRecord,
  Question,
  Subject,
} from "./types";

// ---------------------------------------------------------------------------
// Empirical calibration
//
// The unit of evidence is a pre-revision learner state joined to a later
// unseen-question result. All fitting is as-of: an outcome is eligible only
// when outcomeAt < asOf. This is intentionally stricter than filtering by the
// current UI state, because current mastery is allowed to contain future
// information relative to an old prediction.
// ---------------------------------------------------------------------------

export interface CalibrationEstimate {
  value: number;
  lower: number;
  upper: number;
  standardError: number;
  sampleSize: number;
  source: CalibrationDataSource;
  modelVersion: string;
  priorVersion: string;
  personalWeight: number;
}

export interface QuestionMarkPrediction extends CalibrationEstimate {
  predictedProportion: number;
  baselineMastery: number;
  durationMinutes: number;
  action: CalibrationAction;
}

export interface FittedQuestionMarkModel {
  subjectId?: Id;
  coefficients: number[];
  sampleSize: number;
  residualStandardDeviation: number;
  priorVersion: string;
  modelVersion: string;
  normalMatrix: number[][];
  eligibleObservationIds: Id[];
}

export interface PaperCalibrationModel {
  subjectId?: Id;
  intercept: number;
  slope: number;
  residualStandardDeviation: number;
  sampleSize: number;
  mae: number;
  bias: number;
  biasLower: number;
  biasUpper: number;
  priorVersion: string;
  modelVersion: string;
  source: CalibrationDataSource;
}

export interface TimingCalibrationModel {
  subjectId?: Id;
  secondsPerMark: CalibrationEstimate;
  sampleSize: number;
  priorVersion: string;
  modelVersion: string;
}

export interface CalibrationModel {
  modelVersion: string;
  priorVersion: string;
  asOf: string;
  questionMarks: FittedQuestionMarkModel;
  questionMarksBySubject: Map<Id, FittedQuestionMarkModel>;
  recoverableBySubject: Map<Id, CalibrationEstimate>;
  recoverableByTopic: Map<Id, CalibrationEstimate>;
  marksPerHourBySubject: Map<Id, CalibrationEstimate>;
  marksPerHourByTopic: Map<Id, CalibrationEstimate>;
  paperBySubject: Map<Id, PaperCalibrationModel>;
  timingBySubject: Map<Id, TimingCalibrationModel>;
  /** Number of eligible observed transfer outcomes used by the model. */
  personalSampleSize: number;
}

export interface CalibrationMetricBin {
  bucket: string;
  meanPredicted: number;
  meanActual: number;
  count: number;
}

export interface CalibrationMetrics {
  n: number;
  mae: number;
  rmse: number;
  /** Positive bias means the model under-predicts the observed outcome. */
  bias: number;
  ece: number;
  intervalCoverage: number | null;
  meanIntervalWidth: number | null;
  calibrationSlope: number | null;
  calibrationIntercept: number | null;
  bins: CalibrationMetricBin[];
  biasByGroup: Record<string, { n: number; bias: number }>;
  biasFlags: string[];
}

export interface HeldOutCalibrationReport {
  status: "insufficient-data" | "ok";
  modelVersion: string;
  priorVersion: string;
  asOf: string;
  trainingMinimum: number;
  trainingSize: number;
  holdoutSize: number;
  excludedFutureCount: number;
  noFutureLeakage: boolean;
  metrics: CalibrationMetrics;
  priorBaseline: CalibrationMetrics;
}

export interface PaperCalibrationReport {
  status: "insufficient-data" | "ok";
  sampleSize: number;
  trainingMinimum: number;
  priorFallbackCount: number;
  excludedFutureCount: number;
  metrics: CalibrationMetrics;
  modelVersion: string;
  priorVersion: string;
  noFutureLeakage: boolean;
}

export interface CalibrationBenchmarkReport {
  modelVersion: string;
  priorVersion: string;
  question: HeldOutCalibrationReport;
  paper: PaperCalibrationReport;
}

const ACTIONS: CalibrationAction[] = ["learn", "flashcards", "recall", "practice", "mistakes", "paper"];

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function timeValue(value: string | undefined): number {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function sourceFor(sampleSize: number): CalibrationDataSource {
  if (sampleSize === 0) return "population-prior";
  return sampleSize >= CALIBRATION_PRIOR_V1.minimums.personalOutcomes
    ? "personal-calibrated"
    : "population-plus-personal-shrinkage";
}

function roundBounds(value: number, lower: number, upper: number): { value: number; lower: number; upper: number } {
  return {
    value: clamp(value, lower, upper),
    lower: clamp(lower, lower, upper),
    upper: clamp(upper, lower, upper),
  };
}

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function variance(values: number[], fallback: number): number {
  if (values.length < 2) return fallback ** 2;
  const average = mean(values);
  return Math.max(
    CALIBRATION_PRIOR_V1.interval.minimumStandardDeviation ** 2,
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1),
  );
}

/** Normal-normal shrinkage with a variance term for between-outcome noise. */
function shrinkNumeric(values: number[], prior: PriorParameter, lower: number, upper: number): CalibrationEstimate {
  const clean = values.filter(finite).map((value) => clamp(value, lower, upper));
  const n = clean.length;
  const sampleMean = n ? mean(clean) : prior.mean;
  const weight = n / (n + Math.max(1, prior.strength));
  const value = (1 - weight) * prior.mean + weight * sampleMean;
  const sampleVariance = variance(clean, prior.standardDeviation);
  // Include prior uncertainty and the sampling error. The extra mixture term
  // prevents a sparse, surprising sample from reporting a narrow range.
  const standardError = Math.max(
    CALIBRATION_PRIOR_V1.interval.minimumStandardDeviation,
    Math.sqrt(
      (1 - weight) * prior.standardDeviation ** 2 +
        (weight * Math.sqrt(sampleVariance) / Math.sqrt(Math.max(1, n))) ** 2 +
        weight * (1 - weight) * (sampleMean - prior.mean) ** 2,
    ),
  );
  const interval = CALIBRATION_PRIOR_V1.interval.z * standardError;
  const bounded = roundBounds(value, lower, upper);
  return {
    ...bounded,
    lower: clamp(value - interval, lower, upper),
    upper: clamp(value + interval, lower, upper),
    standardError,
    sampleSize: n,
    source: sourceFor(n),
    modelVersion: CALIBRATION_MODEL_VERSION,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    personalWeight: weight,
  };
}

function featureVector(input: { baselineMastery: number; durationMinutes: number; action: CalibrationAction }): number[] {
  return [
    1,
    clamp(input.baselineMastery, 0, 1),
    Math.log1p(Math.max(0, input.durationMinutes) / CALIBRATION_PRIOR_V1.masteryToQuestionMarks.durationReferenceMinutes),
    ...ACTIONS.map((action) => (action === input.action ? 1 : 0)),
  ];
}

function priorCoefficients(): { values: number[]; strengths: number[] } {
  const prior = CALIBRATION_PRIOR_V1.masteryToQuestionMarks;
  return {
    values: [
      prior.intercept.mean,
      prior.masterySlope.mean,
      prior.durationSlope.mean,
      ...ACTIONS.map((action) => prior.actionEffects[action].mean),
    ],
    strengths: [
      prior.intercept.strength,
      prior.masterySlope.strength,
      prior.durationSlope.strength,
      ...ACTIONS.map((action) => prior.actionEffects[action].strength),
    ],
  };
}

function solveLinear(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let j = column; j <= n; j++) augmented[column][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      if (!factor) continue;
      for (let j = column; j <= n; j++) augmented[row][j] -= factor * augmented[column][j];
    }
  }
  return augmented.map((row) => row[n]);
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function eligibleObservation(observation: CalibrationObservation, asOf: string): boolean {
  const revisionAt = timeValue(observation.revisionAt);
  const outcomeAt = timeValue(observation.outcomeAt);
  const cutoff = timeValue(asOf);
  return (
    observation.source === "observed" &&
    Number.isFinite(revisionAt) &&
    Number.isFinite(outcomeAt) &&
    Number.isFinite(cutoff) &&
    revisionAt < outcomeAt &&
    outcomeAt < cutoff &&
    observation.laterQuestionWasUnseen === true &&
    finite(observation.durationMinutes) &&
    observation.durationMinutes > 0 &&
    finite(observation.baselineMastery) &&
    observation.baselineMastery >= 0 &&
    observation.baselineMastery <= 1 &&
    finite(observation.baselineEvidence) &&
    observation.baselineEvidence >= 0 &&
    finite(observation.actualMarks) &&
    finite(observation.maxMarks) &&
    observation.maxMarks > 0 &&
    observation.actualMarks >= 0 &&
    observation.actualMarks <= observation.maxMarks
  );
}

function eligibleObservations(observations: CalibrationObservation[], asOf: string, subjectId?: Id): CalibrationObservation[] {
  const seen = new Set<string>();
  return observations
    .filter((observation) => (!subjectId || observation.subjectId === subjectId) && eligibleObservation(observation, asOf))
    .sort((a, b) => timeValue(a.outcomeAt) - timeValue(b.outcomeAt) || a.id.localeCompare(b.id))
    .filter((observation) => {
      const key = `${observation.userId}:${observation.laterQuestionId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function fitQuestionMarkModel(
  observations: CalibrationObservation[],
  subjectId: Id | undefined,
  asOf: string,
): FittedQuestionMarkModel {
  const rows = eligibleObservations(observations, asOf, subjectId);
  const { values: priorValues, strengths } = priorCoefficients();
  const dimension = priorValues.length;
  const normalMatrix = Array.from({ length: dimension }, (_, row) =>
    Array.from({ length: dimension }, (_, column) => (row === column ? strengths[row] : 0)),
  );
  const normalVector = priorValues.map((value, index) => value * strengths[index]);
  for (const row of rows) {
    const x = featureVector({ baselineMastery: row.baselineMastery, durationMinutes: row.durationMinutes, action: row.revisionAction });
    const y = row.actualMarks / row.maxMarks;
    for (let i = 0; i < dimension; i++) {
      normalVector[i] += x[i] * y;
      for (let j = 0; j < dimension; j++) normalMatrix[i][j] += x[i] * x[j];
    }
  }
  const coefficients = solveLinear(normalMatrix, normalVector) ?? priorValues;
  const residuals = rows.map((row) => (row.actualMarks / row.maxMarks) - dot(featureVector({ baselineMastery: row.baselineMastery, durationMinutes: row.durationMinutes, action: row.revisionAction }), coefficients));
  const residualStandardDeviation = rows.length > dimension
    ? Math.max(CALIBRATION_PRIOR_V1.interval.minimumStandardDeviation, Math.sqrt(mean(residuals.map((value) => value ** 2))))
    : CALIBRATION_PRIOR_V1.masteryToQuestionMarks.residualStandardDeviation;
  return {
    subjectId,
    coefficients,
    sampleSize: rows.length,
    residualStandardDeviation,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    modelVersion: CALIBRATION_MODEL_VERSION,
    normalMatrix,
    eligibleObservationIds: rows.map((row) => row.id),
  };
}

function uncertaintyForQuestion(model: FittedQuestionMarkModel, x: number[]): number {
  const solved = solveLinear(model.normalMatrix, x);
  const leverage = solved ? Math.max(0, dot(x, solved)) : 1;
  const weight = model.sampleSize / (model.sampleSize + CALIBRATION_PRIOR_V1.minimums.personalOutcomes);
  return Math.max(
    CALIBRATION_PRIOR_V1.interval.minimumStandardDeviation,
    model.residualStandardDeviation * Math.sqrt(1 + leverage) * (1 + CALIBRATION_PRIOR_V1.interval.sparseInflation * (1 - weight)),
  );
}

export function predictQuestionMarks(input: {
  model?: FittedQuestionMarkModel;
  baselineMastery: number;
  durationMinutes: number;
  action: CalibrationAction;
}): QuestionMarkPrediction {
  const model = input.model ?? fitQuestionMarkModel([], undefined, new Date().toISOString());
  const x = featureVector(input);
  const predictedProportion = dot(x, model.coefficients);
  const standardError = uncertaintyForQuestion(model, x);
  const point = clamp(predictedProportion, CALIBRATION_PRIOR_V1.masteryToQuestionMarks.lower, CALIBRATION_PRIOR_V1.masteryToQuestionMarks.upper);
  const bounded = roundBounds(point, CALIBRATION_PRIOR_V1.masteryToQuestionMarks.lower, CALIBRATION_PRIOR_V1.masteryToQuestionMarks.upper);
  return {
    ...bounded,
    lower: clamp(point - CALIBRATION_PRIOR_V1.interval.z * standardError, 0, 1),
    upper: clamp(point + CALIBRATION_PRIOR_V1.interval.z * standardError, 0, 1),
    standardError,
    sampleSize: model.sampleSize,
    source: sourceFor(model.sampleSize),
    modelVersion: model.modelVersion,
    priorVersion: model.priorVersion,
    personalWeight: model.sampleSize / (model.sampleSize + CALIBRATION_PRIOR_V1.minimums.personalOutcomes),
    predictedProportion: point,
    baselineMastery: clamp(input.baselineMastery, 0, 1),
    durationMinutes: Math.max(0, input.durationMinutes),
    action: input.action,
  };
}

function estimateRecoverable(values: number[]): CalibrationEstimate {
  const prior = CALIBRATION_PRIOR_V1.recoverableFraction;
  return shrinkNumeric(values, prior, prior.lower, prior.upper);
}

function estimateMarksPerHourRate(values: number[]): CalibrationEstimate {
  const prior = CALIBRATION_PRIOR_V1.marksPerHour;
  return shrinkNumeric(values, prior, prior.lower, prior.upper);
}

function subjectIdsFromInput(input: {
  observations?: CalibrationObservation[];
  predictionHistory?: PredictionHistoryRecord[];
  attempts?: Attempt[];
}): Set<Id> {
  const ids = new Set<Id>();
  for (const row of input.observations ?? []) ids.add(row.subjectId);
  for (const row of input.predictionHistory ?? []) ids.add(row.subjectId);
  for (const row of input.attempts ?? []) ids.add(row.subjectId);
  return ids;
}

function paperRows(records: PredictionHistoryRecord[], asOf: string, subjectId?: Id): PredictionHistoryRecord[] {
  return records
    .filter((record) => {
      const predictedAt = timeValue(record.predictedAt);
      const outcomeAt = timeValue(record.outcomeAt);
      const cutoff = timeValue(asOf);
      const total = record.outcomeTotalMarks ?? record.totalMarks;
      return (
        (!subjectId || record.subjectId === subjectId) &&
        Number.isFinite(predictedAt) &&
        Number.isFinite(outcomeAt) &&
        Number.isFinite(cutoff) &&
        predictedAt < outcomeAt &&
        outcomeAt < cutoff &&
        finite(record.outcomeMarks) &&
        finite(total) &&
        total > 0 &&
        record.outcomeMarks >= 0 &&
        record.outcomeMarks <= total &&
        record.totalMarks > 0
      );
    })
    .sort((a, b) => timeValue(a.outcomeAt) - timeValue(b.outcomeAt) || a.id.localeCompare(b.id));
}

export function fitPaperCalibration(
  records: PredictionHistoryRecord[],
  subjectId: Id | undefined,
  asOf: string,
): PaperCalibrationModel {
  const rows = paperRows(records, asOf, subjectId);
  const prior = CALIBRATION_PRIOR_V1.paperCalibration;
  const matrix = [
    [prior.intercept.strength, 0],
    [0, prior.slope.strength],
  ];
  const vector = [prior.intercept.mean * prior.intercept.strength, prior.slope.mean * prior.slope.strength];
  for (const row of rows) {
    const predicted = clamp(row.predictedPercent, 0, 1);
    const actual = clamp((row.outcomeMarks ?? 0) / (row.outcomeTotalMarks ?? row.totalMarks), 0, 1);
    const x = [1, predicted];
    for (let i = 0; i < 2; i++) {
      vector[i] += x[i] * actual;
      for (let j = 0; j < 2; j++) matrix[i][j] += x[i] * x[j];
    }
  }
  const beta = solveLinear(matrix, vector) ?? [prior.intercept.mean, prior.slope.mean];
  const residuals = rows.map((row) => {
    const predicted = clamp(row.predictedPercent, 0, 1);
    const actual = clamp((row.outcomeMarks ?? 0) / (row.outcomeTotalMarks ?? row.totalMarks), 0, 1);
    return actual - (beta[0] + beta[1] * predicted);
  });
  const residualStandardDeviation = rows.length > 2
    ? Math.max(CALIBRATION_PRIOR_V1.interval.minimumStandardDeviation, Math.sqrt(mean(residuals.map((value) => value ** 2))))
    : prior.residualStandardDeviation;
  const bias = rows.length ? mean(rows.map((row) => (row.outcomeMarks! / (row.outcomeTotalMarks ?? row.totalMarks)) - row.predictedPercent)) : 0;
  const biasEstimate = shrinkNumeric(
    rows.map((row) => (row.outcomeMarks! / (row.outcomeTotalMarks ?? row.totalMarks)) - row.predictedPercent),
    { mean: 0, standardDeviation: prior.residualStandardDeviation, strength: prior.intercept.strength },
    -1,
    1,
  );
  return {
    subjectId,
    intercept: beta[0],
    slope: beta[1],
    residualStandardDeviation,
    sampleSize: rows.length,
    mae: rows.length ? mean(residuals.map((value) => Math.abs(value))) : 0,
    bias,
    biasLower: biasEstimate.lower,
    biasUpper: biasEstimate.upper,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    modelVersion: CALIBRATION_MODEL_VERSION,
    source: sourceFor(rows.length),
  };
}

export function applyPaperCalibration(input: {
  model?: PaperCalibrationModel;
  predictedMarks: number;
  totalMarks: number;
}): CalibrationEstimate {
  const totalMarks = Math.max(0, input.totalMarks);
  const model = input.model ?? fitPaperCalibration([], undefined, new Date().toISOString());
  const raw = totalMarks ? clamp(input.predictedMarks / totalMarks, 0, 1) : 0;
  const point = clamp(model.intercept + model.slope * raw, 0, 1);
  const standardError = Math.max(
    CALIBRATION_PRIOR_V1.interval.minimumStandardDeviation,
    model.residualStandardDeviation * (1 + CALIBRATION_PRIOR_V1.interval.sparseInflation * (1 - model.sampleSize / (model.sampleSize + CALIBRATION_PRIOR_V1.minimums.paperOutcomes))),
  );
  return {
    value: point,
    lower: clamp(point - CALIBRATION_PRIOR_V1.interval.z * standardError, 0, 1),
    upper: clamp(point + CALIBRATION_PRIOR_V1.interval.z * standardError, 0, 1),
    standardError,
    sampleSize: model.sampleSize,
    source: model.source,
    modelVersion: model.modelVersion,
    priorVersion: model.priorVersion,
    personalWeight: model.sampleSize / (model.sampleSize + CALIBRATION_PRIOR_V1.minimums.paperOutcomes),
  };
}

function paperForQuestion(question: Question, papers: Map<Id, Paper>, subjects: Map<Id, Subject>): number {
  const paper = question.paperId ? papers.get(question.paperId) : undefined;
  const subject = subjects.get(question.subjectId);
  const paperSpec = subject?.papers.find((candidate) => candidate.id === paper?.paperSpecId) ?? subject?.papers[0];
  if (!paper || !paper.totalMarks || !paperSpec?.durationMinutes) return CALIBRATION_PRIOR_V1.timing.secondsPerMark.mean;
  return (paperSpec.durationMinutes * 60) / paper.totalMarks;
}

export function fitTimingCalibration(input: {
  attempts: Attempt[];
  questions: Question[];
  papers: Paper[];
  subjects: Subject[];
  subjectId?: Id;
  asOf: string;
}): TimingCalibrationModel {
  const questions = new Map(input.questions.map((question) => [question.id, question] as const));
  const papers = new Map(input.papers.map((paper) => [paper.id, paper] as const));
  const subjects = new Map(input.subjects.map((subject) => [subject.id, subject] as const));
  const observations = input.attempts
    .filter((attempt) => !input.subjectId || attempt.subjectId === input.subjectId)
    .filter((attempt) => {
      const createdAt = timeValue(attempt.createdAt);
      return Number.isFinite(createdAt) && createdAt < timeValue(input.asOf) && finite(attempt.elapsedMs) && attempt.elapsedMs > 0 && finite(attempt.max) && attempt.max > 0;
    })
    .map((attempt) => {
      const question = questions.get(attempt.questionId);
      const target = question ? paperForQuestion(question, papers, subjects) : CALIBRATION_PRIOR_V1.timing.secondsPerMark.mean;
      return { subjectId: attempt.subjectId, secondsPerMark: attempt.elapsedMs / 1000 / attempt.max, target };
    });
  const estimate = shrinkNumeric(
    observations.map((observation) => observation.secondsPerMark),
    CALIBRATION_PRIOR_V1.timing.secondsPerMark,
    CALIBRATION_PRIOR_V1.timing.lowerSecondsPerMark,
    CALIBRATION_PRIOR_V1.timing.upperSecondsPerMark,
  );
  return {
    subjectId: input.subjectId,
    secondsPerMark: estimate,
    sampleSize: observations.length,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    modelVersion: CALIBRATION_MODEL_VERSION,
  };
}

export function estimateRecoverableMarks(model: CalibrationModel | undefined, topicId: Id, subjectId?: Id): CalibrationEstimate {
  const topicEstimate = model?.recoverableByTopic.get(topicId);
  const subjectEstimate = subjectId ? model?.recoverableBySubject.get(subjectId) : undefined;
  return (topicEstimate?.sampleSize ? topicEstimate : undefined) ??
    (subjectEstimate?.sampleSize ? subjectEstimate : undefined) ??
    topicEstimate ??
    subjectEstimate ??
    shrinkNumeric([], CALIBRATION_PRIOR_V1.recoverableFraction, 0, 1);
}

export function estimateMarksPerHour(model: CalibrationModel | undefined, topicId: Id, subjectId?: Id): CalibrationEstimate {
  const topicEstimate = model?.marksPerHourByTopic.get(topicId);
  const subjectEstimate = subjectId ? model?.marksPerHourBySubject.get(subjectId) : undefined;
  return (topicEstimate?.sampleSize ? topicEstimate : undefined) ??
    (subjectEstimate?.sampleSize ? subjectEstimate : undefined) ??
    topicEstimate ??
    subjectEstimate ??
    shrinkNumeric([], CALIBRATION_PRIOR_V1.marksPerHour, 0, CALIBRATION_PRIOR_V1.marksPerHour.upper);
}

export function buildCalibrationModel(input: {
  observations: CalibrationObservation[];
  predictionHistory?: PredictionHistoryRecord[];
  attempts?: Attempt[];
  questions?: Question[];
  papers?: Paper[];
  subjects?: Subject[];
  asOf: string;
}): CalibrationModel {
  const subjectIdsFromInputRows = subjectIdsFromInput(input);
  const valid = eligibleObservations(input.observations, input.asOf);
  const questionMarksBySubject = new Map<Id, FittedQuestionMarkModel>();
  const recoverableBySubject = new Map<Id, CalibrationEstimate>();
  const recoverableByTopic = new Map<Id, CalibrationEstimate>();
  const marksPerHourBySubject = new Map<Id, CalibrationEstimate>();
  const marksPerHourByTopic = new Map<Id, CalibrationEstimate>();
  const paperBySubject = new Map<Id, PaperCalibrationModel>();
  const timingBySubject = new Map<Id, TimingCalibrationModel>();

  const subjectIds = new Set<Id>(subjectIdsFromInputRows);
  for (const row of valid) subjectIds.add(row.subjectId);
  for (const row of input.predictionHistory ?? []) subjectIds.add(row.subjectId);

  for (const subjectId of subjectIds) {
    const subjectRows = valid.filter((row) => row.subjectId === subjectId);
    const fitted = fitQuestionMarkModel(subjectRows, subjectId, input.asOf);
    questionMarksBySubject.set(subjectId, fitted);
    const recoverableRows = subjectRows.filter((row) => finite(row.opportunityMarks) && row.opportunityMarks > 0 && finite(row.improvementMarks));
    const recoverableValues = recoverableRows.map((row) => clamp(row.improvementMarks! / row.opportunityMarks!, 0, 1));
    recoverableBySubject.set(subjectId, estimateRecoverable(recoverableValues));
    const hourRows = subjectRows.filter((row) => finite(row.improvementMarks) && row.improvementMarks! >= 0 && row.durationMinutes > 0);
    marksPerHourBySubject.set(subjectId, estimateMarksPerHourRate(hourRows.map((row) => row.improvementMarks! / (row.durationMinutes / 60))));
    paperBySubject.set(subjectId, fitPaperCalibration(input.predictionHistory ?? [], subjectId, input.asOf));
    if (input.attempts && input.questions && input.papers && input.subjects) {
      timingBySubject.set(subjectId, fitTimingCalibration({
        attempts: input.attempts,
        questions: input.questions,
        papers: input.papers,
        subjects: input.subjects,
        subjectId,
        asOf: input.asOf,
      }));
    }
  }

  const topicIds = new Set<Id>(valid.map((row) => row.topicId));
  for (const topicId of topicIds) {
    const topicRows = valid.filter((row) => row.topicId === topicId);
    const subjectId = topicRows[0]?.subjectId;
    const recoverableRows = topicRows.filter((row) => finite(row.opportunityMarks) && row.opportunityMarks! > 0 && finite(row.improvementMarks));
    const hourRows = topicRows.filter((row) => finite(row.improvementMarks) && row.improvementMarks! >= 0 && row.durationMinutes > 0);
    recoverableByTopic.set(topicId, estimateRecoverable(recoverableRows.map((row) => clamp(row.improvementMarks! / row.opportunityMarks!, 0, 1))));
    marksPerHourByTopic.set(topicId, estimateMarksPerHourRate(hourRows.map((row) => row.improvementMarks! / (row.durationMinutes / 60))));
    // Preserve the subject association for callers that only have a topic id.
    if (subjectId && !recoverableBySubject.has(subjectId)) recoverableBySubject.set(subjectId, estimateRecoverable([]));
  }

  const globalQuestionMarks = fitQuestionMarkModel(input.observations, undefined, input.asOf);
  return {
    modelVersion: CALIBRATION_MODEL_VERSION,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    asOf: input.asOf,
    questionMarks: globalQuestionMarks,
    questionMarksBySubject,
    recoverableBySubject,
    recoverableByTopic,
    marksPerHourBySubject,
    marksPerHourByTopic,
    paperBySubject,
    timingBySubject,
    personalSampleSize: valid.length,
  };
}

export function questionMarkModelForSubject(model: CalibrationModel | undefined, subjectId: Id): FittedQuestionMarkModel | undefined {
  return model?.questionMarksBySubject.get(subjectId) ?? model?.questionMarks;
}

export function paperCalibrationForSubject(model: CalibrationModel | undefined, subjectId: Id): PaperCalibrationModel | undefined {
  return model?.paperBySubject.get(subjectId);
}

/** Build one observation only when the pre-revision context was captured. */
export function observationFromRevisionAndOutcome(input: {
  id: Id;
  revision: Attempt;
  outcome: Attempt;
  topicId: Id;
}): CalibrationObservation | null {
  const context = input.revision.calibrationContext;
  const outcomeContext = input.outcome.calibrationContext;
  if (!context || !outcomeContext?.questionWasUnseen) return null;
  if (input.revision.subjectId !== input.outcome.subjectId || input.revision.createdAt >= input.outcome.createdAt) return null;
  if (!context.startedAt || !finite(context.durationMinutes) || context.durationMinutes <= 0) return null;
  if (!finite(context.baselineMastery) || !finite(context.baselineEvidence)) return null;
  return {
    id: input.id,
    userId: input.outcome.userId,
    subjectId: input.outcome.subjectId,
    topicId: input.topicId,
    laterQuestionId: input.outcome.questionId,
    revisionAction: context.action,
    revisionAt: context.startedAt,
    durationMinutes: context.durationMinutes,
    baselineMastery: context.baselineMastery,
    baselineEvidence: context.baselineEvidence,
    laterQuestionWasUnseen: true,
    outcomeAt: input.outcome.createdAt,
    actualMarks: input.outcome.awarded,
    maxMarks: input.outcome.max,
    createdAt: input.outcome.createdAt,
    updatedAt: input.outcome.createdAt,
    source: "observed",
  };
}

/** Derive only fully observed joins; missing context is intentionally dropped. */
export function observationsFromAttempts(input: { attempts: Attempt[]; asOf: string }): CalibrationObservation[] {
  const ordered = [...input.attempts].sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt) || a.id.localeCompare(b.id));
  const observations: CalibrationObservation[] = [];
  for (const [index, outcome] of ordered.entries()) {
    if (!outcome.calibrationContext?.questionWasUnseen) continue;
    const candidate = [...ordered.slice(0, index)]
      .reverse()
      .find((revision) => revision.subjectId === outcome.subjectId && revision.calibrationContext && revision.topicIds.some((id) => outcome.topicIds.includes(id)));
    if (!candidate) continue;
    const topicId = candidate.topicIds.find((id) => outcome.topicIds.includes(id)) ?? outcome.topicIds[0];
    if (!topicId) continue;
    const observation = observationFromRevisionAndOutcome({ id: `${candidate.id}:${outcome.id}:${topicId}`, revision: candidate, outcome, topicId });
    if (observation && timeValue(observation.outcomeAt) < timeValue(input.asOf)) observations.push(observation);
  }
  return observations;
}

function metricsFromPairs(
  pairs: Array<{ predicted: number; actual: number; lower?: number; upper?: number; group?: string }>,
): CalibrationMetrics {
  const n = pairs.length;
  if (!n) {
    return {
      n: 0,
      mae: 0,
      rmse: 0,
      bias: 0,
      ece: 0,
      intervalCoverage: null,
      meanIntervalWidth: null,
      calibrationSlope: null,
      calibrationIntercept: null,
      bins: [],
      biasByGroup: {},
      biasFlags: [],
    };
  }
  const errors = pairs.map((pair) => pair.actual - pair.predicted);
  const mae = mean(errors.map((error) => Math.abs(error)));
  const rmse = Math.sqrt(mean(errors.map((error) => error ** 2)));
  const bias = mean(errors);
  const bucketCount = CALIBRATION_PRIOR_V1.interval.calibrationBins;
  const buckets = Array.from({ length: bucketCount }, () => ({ predicted: [] as number[], actual: [] as number[] }));
  for (const pair of pairs) {
    const bucket = buckets[Math.min(bucketCount - 1, Math.max(0, Math.floor(clamp(pair.predicted, 0, 0.999999) * bucketCount)))];
    bucket.predicted.push(pair.predicted);
    bucket.actual.push(pair.actual);
  }
  const bins = buckets.map((bucket, index) => ({
    bucket: `${(index / bucketCount).toFixed(1)}–${((index + 1) / bucketCount).toFixed(1)}`,
    meanPredicted: bucket.predicted.length ? mean(bucket.predicted) : (index + 0.5) / bucketCount,
    meanActual: bucket.actual.length ? mean(bucket.actual) : (index + 0.5) / bucketCount,
    count: bucket.predicted.length,
  }));
  const ece = buckets.reduce((sum, bucket) => sum + (bucket.predicted.length / n) * Math.abs(mean(bucket.predicted) - mean(bucket.actual)), 0);
  const withIntervals = pairs.filter((pair) => finite(pair.lower) && finite(pair.upper));
  const intervalCoverage = withIntervals.length ? withIntervals.filter((pair) => pair.actual >= pair.lower! && pair.actual <= pair.upper!).length / withIntervals.length : null;
  const meanIntervalWidth = withIntervals.length ? mean(withIntervals.map((pair) => pair.upper! - pair.lower!)) : null;
  let calibrationSlope: number | null = null;
  let calibrationIntercept: number | null = null;
  const centeredPredicted = pairs.reduce((sum, pair) => sum + (pair.predicted - mean(pairs.map((item) => item.predicted))) ** 2, 0);
  if (pairs.length >= 2 && centeredPredicted > 1e-12) {
    const predictedMean = mean(pairs.map((pair) => pair.predicted));
    const actualMean = mean(pairs.map((pair) => pair.actual));
    const covariance = pairs.reduce((sum, pair) => sum + (pair.predicted - predictedMean) * (pair.actual - actualMean), 0);
    calibrationSlope = covariance / centeredPredicted;
    calibrationIntercept = actualMean - calibrationSlope * predictedMean;
  }
  const grouped = new Map<string, number[]>();
  for (const [index, pair] of pairs.entries()) {
    const group = pair.group ?? "all";
    const list = grouped.get(group) ?? [];
    list.push(errors[index]);
    grouped.set(group, list);
  }
  const biasByGroup: Record<string, { n: number; bias: number }> = {};
  const biasFlags: string[] = [];
  for (const [group, values] of grouped) {
    biasByGroup[group] = { n: values.length, bias: mean(values) };
    if (values.length >= CALIBRATION_PRIOR_V1.minimums.biasGroupOutcomes && Math.abs(mean(values)) > CALIBRATION_PRIOR_V1.interval.biasFlagAbsoluteThreshold) biasFlags.push(group);
  }
  return {
    n,
    mae,
    rmse,
    bias,
    ece,
    intervalCoverage,
    meanIntervalWidth,
    calibrationSlope,
    calibrationIntercept,
    bins,
    biasByGroup,
    biasFlags,
  };
}

export function calibrationMetrics(pairs: Array<{ predicted: number; actual: number; lower?: number; upper?: number; group?: string }>): CalibrationMetrics {
  return metricsFromPairs(pairs);
}

export function evaluateHeldOutCalibration(input: {
  observations: CalibrationObservation[];
  asOf: string;
  subjectId?: Id;
  trainingMinimum?: number;
}): HeldOutCalibrationReport {
  const trainingMinimum = input.trainingMinimum ?? CALIBRATION_PRIOR_V1.minimums.personalOutcomes;
  const rows = eligibleObservations(input.observations, input.asOf, input.subjectId);
  const predictions: Array<{ predicted: number; actual: number; lower: number; upper: number; group: string }> = [];
  const priorPredictions: Array<{ predicted: number; actual: number; lower: number; upper: number; group: string }> = [];
  const cutoff = timeValue(input.asOf);
  const excludedFutureCount = input.observations.filter((row) => {
    const outcomeAt = timeValue(row.outcomeAt);
    return Number.isFinite(cutoff) && Number.isFinite(outcomeAt) && outcomeAt >= cutoff;
  }).length;
  let noFutureLeakage = true;
  for (let index = 0; index < rows.length; index++) {
    const test = rows[index];
    const train = rows.filter((row) => timeValue(row.outcomeAt) < timeValue(test.outcomeAt));
    if (train.length < trainingMinimum) continue;
    const model = fitQuestionMarkModel(train, test.subjectId, test.outcomeAt);
    const prediction = predictQuestionMarks({ model, baselineMastery: test.baselineMastery, durationMinutes: test.durationMinutes, action: test.revisionAction });
    const prior = predictQuestionMarks({ model: fitQuestionMarkModel([], test.subjectId, test.outcomeAt), baselineMastery: test.baselineMastery, durationMinutes: test.durationMinutes, action: test.revisionAction });
    const actual = test.actualMarks / test.maxMarks;
    predictions.push({ predicted: prediction.value, actual, lower: prediction.lower, upper: prediction.upper, group: test.revisionAction });
    priorPredictions.push({ predicted: prior.value, actual, lower: prior.lower, upper: prior.upper, group: test.revisionAction });
    if (train.some((row) => timeValue(row.outcomeAt) >= timeValue(test.outcomeAt))) noFutureLeakage = false;
  }
  const status = predictions.length >= CALIBRATION_PRIOR_V1.minimums.heldOutOutcomes ? "ok" : "insufficient-data";
  return {
    status,
    modelVersion: CALIBRATION_MODEL_VERSION,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    asOf: input.asOf,
    trainingMinimum,
    trainingSize: rows.length,
    holdoutSize: predictions.length,
    excludedFutureCount,
    noFutureLeakage,
    metrics: metricsFromPairs(predictions),
    priorBaseline: metricsFromPairs(priorPredictions),
  };
}

export function evaluatePaperCalibration(input: {
  records: PredictionHistoryRecord[];
  asOf: string;
  subjectId?: Id;
}): PaperCalibrationReport {
  const rows = paperRows(input.records, input.asOf, input.subjectId);
  const trainingMinimum = CALIBRATION_PRIOR_V1.minimums.paperOutcomes;
  let priorFallbackCount = 0;
  let noFutureLeakage = true;
  const pairs = rows.map((row) => {
    const earlier = paperRows(input.records, row.outcomeAt!, row.subjectId);
    if (earlier.length < trainingMinimum) priorFallbackCount += 1;
    if (earlier.some((candidate) => timeValue(candidate.outcomeAt) >= timeValue(row.outcomeAt))) noFutureLeakage = false;
    const model = fitPaperCalibration(input.records, row.subjectId, row.outcomeAt!);
    const raw = clamp(row.predictedPercent, 0, 1);
    const estimate = applyPaperCalibration({ model, predictedMarks: raw, totalMarks: 1 });
    const actual = clamp((row.outcomeMarks ?? 0) / (row.outcomeTotalMarks ?? row.totalMarks), 0, 1);
    return { predicted: estimate.value, actual, lower: estimate.lower, upper: estimate.upper, group: row.subjectId };
  });
  const cutoff = timeValue(input.asOf);
  const excludedFutureCount = input.records.filter((record) => {
    const outcomeAt = timeValue(record.outcomeAt);
    return Number.isFinite(cutoff) && Number.isFinite(outcomeAt) && outcomeAt >= cutoff;
  }).length;
  return {
    status: pairs.length >= CALIBRATION_PRIOR_V1.minimums.heldOutOutcomes ? "ok" : "insufficient-data",
    sampleSize: pairs.length,
    trainingMinimum,
    priorFallbackCount,
    excludedFutureCount,
    metrics: metricsFromPairs(pairs),
    modelVersion: CALIBRATION_MODEL_VERSION,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    noFutureLeakage,
  };
}

export function benchmarkCalibration(input: {
  observations: CalibrationObservation[];
  predictionHistory?: PredictionHistoryRecord[];
  asOf: string;
}): CalibrationBenchmarkReport {
  return {
    modelVersion: CALIBRATION_MODEL_VERSION,
    priorVersion: CALIBRATION_PRIOR_V1.version,
    question: evaluateHeldOutCalibration({ observations: input.observations, asOf: input.asOf }),
    paper: evaluatePaperCalibration({ records: input.predictionHistory ?? [], asOf: input.asOf }),
  };
}

/** Compatibility adapter for the previous paper-pair API. New code should use
 * fitPaperCalibration with timestamped PredictionHistoryRecord rows. */
export function legacyCalibrationFromPairs(subjectId: Id, pairs: Array<{ predicted: number; actual: number }>): Calibration {
  if (pairs.length < 3) {
    return {
      subjectId,
      bias: 0,
      slope: 1,
      sampleSize: pairs.length,
      mae: 0,
      modelVersion: "legacy-calibration-adapter",
      priorVersion: CALIBRATION_PRIOR_V1.version,
      source: pairs.length ? "population-plus-personal-shrinkage" : "population-prior",
    };
  }
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const pair of pairs) {
    sx += pair.predicted;
    sy += pair.actual;
    sxx += pair.predicted * pair.predicted;
    sxy += pair.predicted * pair.actual;
  }
  const denominator = pairs.length * sxx - sx * sx;
  const slope = denominator === 0 ? 1 : (pairs.length * sxy - sx * sy) / denominator;
  const bias = (sy - slope * sx) / pairs.length;
  const mae = mean(pairs.map((pair) => Math.abs(pair.actual - (pair.predicted * slope + bias))));
  return {
    subjectId,
    bias,
    slope: Number.isFinite(slope) ? slope : 1,
    sampleSize: pairs.length,
    mae,
    modelVersion: "legacy-calibration-adapter",
    priorVersion: CALIBRATION_PRIOR_V1.version,
    source: "personal-calibrated",
  };
}
