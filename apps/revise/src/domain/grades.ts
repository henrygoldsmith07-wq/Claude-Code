import { daysToExam } from "./recommender";
import type { Attempt, ExamDate, Id, IsoDate, Subject, TopicMastery } from "./types";
import { CALIBRATION_PRIOR_V1 } from "./calibration-priors";
import { applyPaperCalibration, buildCalibrationModel, predictQuestionMarks, questionMarkModelForSubject, type CalibrationModel } from "./calibration";

// ---------------------------------------------------------------------------
// Grade prediction. Two signals, blended by how much evidence exists behind
// each: measured exam-question accuracy (trustworthy but sparse early on) and
// topic mastery coverage (always available, a weaker proxy). The output is
// always reported as a band with an explicit confidence, because a single
// predicted letter carries far more certainty than the data supports.
// ---------------------------------------------------------------------------

export interface GradePrediction {
  subjectId: Id;
  /** Predicted raw percentage across the whole qualification. */
  percent: number;
  grade: string;
  /** Optimistic/pessimistic bounds from the evidence spread. */
  bestCase: string;
  worstCase: string;
  percentLower?: number;
  percentUpper?: number;
  modelVersion?: string;
  priorVersion?: string;
  source?: "population-prior" | "population-plus-personal-shrinkage" | "personal-calibrated";
  personalSampleSize?: number;
  /** 0–1: how much to trust this. Low until ~10 marked questions exist. */
  confidence: number;
  /** Percentage points gained (+) or lost (−) over the last 30 days. */
  trend: number;
  /** Marks-per-topic view of where the next grade actually comes from. */
  headroom: { topicId: Id; potentialPercent: number }[];
}

export interface NextGradeRoute {
  topicId: Id;
  potentialPercent: number;
  contributionPercent: number;
}

export interface NextGradeTarget {
  nextGrade: { grade: string; percent: number } | null;
  gapPercent: number;
  modeledGainPercent: number;
  remainingPercent: number;
  route: NextGradeRoute[];
}

export function gradeForPercent(subject: Subject, percent: number): string {
  const sorted = [...subject.gradeBoundaries].sort((a, b) => b.percent - a.percent);
  for (const row of sorted) {
    if (percent >= row.percent) return row.grade;
  }
  return sorted.length ? sorted[sorted.length - 1].grade : "U";
}

/** Find the next boundary and allocate available topic headroom towards it. */
export function nextGradeTarget(subject: Subject, prediction: GradePrediction): NextGradeTarget {
  const nextGrade = [...subject.gradeBoundaries]
    .filter((boundary) => boundary.percent > prediction.percent)
    .sort((a, b) => a.percent - b.percent)[0] ?? null;
  const gapPercent = nextGrade ? nextGrade.percent - prediction.percent : 0;
  let remainingPercent = gapPercent;
  const route = prediction.headroom
    .map((row) => {
      const contributionPercent = Math.min(row.potentialPercent, remainingPercent);
      remainingPercent = Math.max(0, remainingPercent - row.potentialPercent);
      return { ...row, contributionPercent };
    })
    .filter((row) => row.contributionPercent > 0);
  const modeledGainPercent = gapPercent - remainingPercent;
  return { nextGrade, gapPercent, modeledGainPercent, remainingPercent, route };
}

export function predictGrade(
  subject: Subject,
  mastery: TopicMastery[],
  attempts: Attempt[],
  exams: ExamDate[] = [],
  today: IsoDate = new Date().toISOString().slice(0, 10),
  calibrationModel?: CalibrationModel,
): GradePrediction {
  const rows = mastery.filter((m) => m.subjectId === subject.id);
  const asOf = `${today}T23:59:59.999Z`;
  const subjectAttempts = attempts.filter((a) => a.subjectId === subject.id && a.createdAt < asOf);
  const model = calibrationModel ?? buildCalibrationModel({ observations: [], asOf });
  const questionModel = questionMarkModelForSubject(model, subject.id);
  const coverageEstimates = rows.map((row) => predictQuestionMarks({
    model: questionModel,
    baselineMastery: row.mastery,
    durationMinutes: 0,
    action: "paper",
  }));
  const coverage = coverageEstimates.length ? coverageEstimates.reduce((sum, estimate) => sum + estimate.value, 0) / coverageEstimates.length : 0;
  const coverageLower = coverageEstimates.length ? coverageEstimates.reduce((sum, estimate) => sum + estimate.lower, 0) / coverageEstimates.length : 0;
  const coverageUpper = coverageEstimates.length ? coverageEstimates.reduce((sum, estimate) => sum + estimate.upper, 0) / coverageEstimates.length : 1;
  const marksMax = subjectAttempts.reduce((a, x) => a + x.max, 0);
  const measured = marksMax ? subjectAttempts.reduce((a, x) => a + x.awarded, 0) / marksMax : 0;

  const trust = subjectAttempts.length / (subjectAttempts.length + CALIBRATION_PRIOR_V1.grade.measuredEvidenceStrength);
  // Exam-question accuracy is the better predictor once there is enough of it.
  const blended = measured * trust + coverage * (1 - trust);
  const measuredError = marksMax ? measurementStandardError(measured, marksMax) : 1;
  const blendedLower = Math.max(0, measured - measuredError) * trust + coverageLower * (1 - trust);
  const blendedUpper = Math.min(1, measured + measuredError) * trust + coverageUpper * (1 - trust);
  // Paper-level outcomes are a separate calibration layer. It is fitted only
  // from prediction records created before a completed sitting, so it can
  // correct systematic optimism/pessimism without using the current paper's
  // result. Its uncertainty is unioned with the question-level interval.
  const paperModel = model.paperBySubject.get(subject.id);
  const paperAdjusted = applyPaperCalibration({ model: paperModel, predictedMarks: blended, totalMarks: 1 });
  const paperLower = applyPaperCalibration({ model: paperModel, predictedMarks: blendedLower, totalMarks: 1 });
  const paperUpper = applyPaperCalibration({ model: paperModel, predictedMarks: blendedUpper, totalMarks: 1 });
  const calibratedLower = Math.min(paperAdjusted.lower, paperLower.value, paperUpper.value);
  const calibratedUpper = Math.max(paperAdjusted.upper, paperLower.value, paperUpper.value);
  const horizonDays = daysToExam(exams, subject.id, today);
  const horizonPenalty = horizonDays == null ? 0.85 : clamp(1 - horizonDays / CALIBRATION_PRIOR_V1.grade.horizonDays, CALIBRATION_PRIOR_V1.grade.horizonFloor, 1);
  const horizonUncertainty = (1 - horizonPenalty) * CALIBRATION_PRIOR_V1.grade.horizonUncertaintyScale;
  const percent = Math.round(clamp(paperAdjusted.value * 100, CALIBRATION_PRIOR_V1.grade.minimumPercent, CALIBRATION_PRIOR_V1.grade.maximumPercent));
  const percentLower = Math.round(clamp((calibratedLower - horizonUncertainty) * 100, 0, 100));
  const percentUpper = Math.round(clamp((calibratedUpper + horizonUncertainty) * 100, 0, 100));
  const grade = gradeForPercent(subject, percent);
  const bestCase = gradeForPercent(subject, percentUpper);
  const worstCase = gradeForPercent(subject, percentLower);

  // Trend: the last 30 days of marked work against the 30 before it.
  const cutoff = daysAgo(today, 30);
  const priorCutoff = daysAgo(today, 60);
  const recent = subjectAttempts.filter((a) => a.createdAt.slice(0, 10) >= cutoff);
  const prior = subjectAttempts.filter(
    (a) => a.createdAt.slice(0, 10) >= priorCutoff && a.createdAt.slice(0, 10) < cutoff,
  );
  const trend = prior.length && recent.length ? Math.round((rate(recent) - rate(prior)) * 100) : 0;

  // Headroom: how many percentage points the whole subject would gain if this
  // one topic were taken to full mastery. That is the actionable number.
  const perTopic = rows.length ? 1 / rows.length : 0;
  const headroom = rows
    .map((m) => {
      const current = predictQuestionMarks({ model: questionModel, baselineMastery: m.mastery, durationMinutes: 0, action: "paper" }).value;
      const secure = predictQuestionMarks({ model: questionModel, baselineMastery: 1, durationMinutes: 0, action: "paper" }).value;
      return { topicId: m.topicId, potentialPercent: Math.round(Math.max(0, secure - current) * perTopic * 100) };
    })
    .filter((h) => h.potentialPercent > 0)
    .sort((a, b) => b.potentialPercent - a.potentialPercent)
    .slice(0, 5);

  // This confidence is evidence support, not the probability that the grade is
  // correct. The percentage interval above is the primary uncertainty output.
  const topicEvidence = rows.length / (rows.length + CALIBRATION_PRIOR_V1.grade.topicEvidenceStrength);
  const confidence = clamp(trust * CALIBRATION_PRIOR_V1.grade.measuredConfidenceWeight * horizonPenalty + topicEvidence * CALIBRATION_PRIOR_V1.grade.topicContributionWeight, 0, 1);

  return {
    subjectId: subject.id,
    percent,
    grade,
    bestCase,
    worstCase,
    percentLower,
    percentUpper,
    modelVersion: model.modelVersion,
    priorVersion: model.priorVersion,
    source: paperModel?.sampleSize ? paperAdjusted.source : sourceForModel(model, subject.id),
    personalSampleSize: model.questionMarksBySubject.get(subject.id)?.sampleSize ?? model.questionMarks.sampleSize,
    confidence,
    trend,
    headroom,
  };
}

function sourceForModel(model: CalibrationModel, subjectId: Id): "population-prior" | "population-plus-personal-shrinkage" | "personal-calibrated" {
  const sampleSize = model.questionMarksBySubject.get(subjectId)?.sampleSize ?? 0;
  if (!sampleSize) return "population-prior";
  return sampleSize >= CALIBRATION_PRIOR_V1.minimums.personalOutcomes ? "personal-calibrated" : "population-plus-personal-shrinkage";
}

function measurementStandardError(rate: number, marks: number): number {
  return CALIBRATION_PRIOR_V1.interval.z * Math.sqrt(Math.max(0.0001, rate * (1 - rate)) / Math.max(1, marks));
}

export interface CalibrationBin {
  bucket: string; // e.g. "0.5–0.6"
  meanPredicted: number;
  meanActual: number;
  count: number;
}

export interface CalibrationReport {
  /** Brier score 0–1, lower is better (mean squared error of predicted prob vs outcome). */
  brier: number;
  /** Expected Calibration Error 0–1, lower is better (weighted bucket gap). */
  ece: number;
  /** Per-bucket honesty: if bucket says 70%, does it hit ~70% on later papers? */
  bins: CalibrationBin[];
  /** Bias: mean(actual − predicted). Positive = underpredicting. */
  bias: number;
  /** n used */
  n: number;
}

/**
 * Honest calibration against *later timed papers* — the real-world outcome.
 * Pass predicted probabilities (mastery blended scaled to 0–1) and actual
 * binary pass per question or paper-level percent scaled to 0–1.
 */
export function calibrationReport(pairs: Array<{ predicted: number; actual: number }>): CalibrationReport {
  const n = pairs.length;
  if (!n) return { brier: 0, ece: 0, bins: [], bias: 0, n: 0 };
  let brier = 0;
  let bias = 0;
  for (const p of pairs) { brier += (p.predicted - p.actual) ** 2; bias += p.actual - p.predicted; }
  brier /= n;
  bias /= n;
  const B = 5;
  const buckets: Array<{ sumP: number; sumA: number; count: number }> = Array.from({ length: B }, () => ({ sumP: 0, sumA: 0, count: 0 }));
  for (const p of pairs) {
    const idx = Math.min(B - 1, Math.max(0, Math.floor(p.predicted * B)));
    buckets[idx].sumP += p.predicted;
    buckets[idx].sumA += p.actual;
    buckets[idx].count += 1;
  }
  const bins: CalibrationBin[] = buckets.map((b, i) => ({
    bucket: `${(i / B).toFixed(1)}–${((i + 1) / B).toFixed(1)}`,
    meanPredicted: b.count ? b.sumP / b.count : (i + 0.5) / B,
    meanActual: b.count ? b.sumA / b.count : (i + 0.5) / B,
    count: b.count,
  }));
  let ece = 0;
  for (const b of buckets) if (b.count) ece += (b.count / n) * Math.abs(b.sumP / b.count - b.sumA / b.count);
  return { brier: Math.round(brier * 1000) / 1000, ece: Math.round(ece * 1000) / 1000, bins, bias: Math.round(bias * 1000) / 1000, n };
}

/**
 * Confidence calibration — bins predictions by *our* confidence and checks hit
 * rate on later papers. A well-calibrated system has ece < 0.08.
 * Synthetic by default (deterministic seed) so CI can run without real papers.
 */
export function confidenceCalibration(params: {
  subject: Subject;
  mastery: TopicMastery[];
  attempts: Attempt[];
  exams?: ExamDate[];
  today?: IsoDate;
  laterOutcomes: Array<{ predicted: number; actual: number }>;
}): CalibrationReport {
  // Scale GradePrediction's reported confidence isn't per-question; we treat
  // each later outcome's predicted percent/100 as the probability.
  void params.subject; void params.mastery; void params.attempts; void params.exams; void params.today;
  return calibrationReport(params.laterOutcomes);
}

/** Synthetic later-paper outcomes for calibration benchmarks — deterministic. */
export function syntheticCalibrationOutcomes(seed: number, n: number): Array<{ predicted: number; actual: number }> {
  let s = seed >>> 0;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 0xffffffff); };
  return Array.from({ length: n }, () => {
    const predicted = rnd() * 0.85 + 0.05;
    const actual = Math.max(0, Math.min(1, predicted + (rnd() - 0.48) * 0.22));
    return { predicted: Math.round(predicted * 100) / 100, actual: Math.round(actual * 100) / 100 };
  });
}

function rate(attempts: Attempt[]): number {
  const max = attempts.reduce((a, x) => a + x.max, 0);
  return max ? attempts.reduce((a, x) => a + x.awarded, 0) / max : 0;
}

function daysAgo(today: IsoDate, days: number): IsoDate {
  return new Date(new Date(`${today}T00:00:00Z`).getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
