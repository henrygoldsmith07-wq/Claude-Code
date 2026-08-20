// Assessment depth — the five assessment-specific slices that make revision feel
// like exam prep rather than flashcard completion.
// Pure functions: no React, no I/O.
import type {
  AssessmentInsight,
  Attempt,
  Calibration,
  CalibrationObservation,
  CommandWord,
  Id,
  MisconceptionTag,
  Mistake,
  PaperSimulation,
  Question,
  TopicMastery,
} from "./types";
import {
  applyPaperCalibration,
  buildCalibrationModel,
  estimateMarksPerHour,
  estimateRecoverableMarks,
  legacyCalibrationFromPairs,
  paperCalibrationForSubject,
  predictQuestionMarks,
  questionMarkModelForSubject,
  type CalibrationModel,
} from "./calibration";
import { CALIBRATION_PRIOR_V1 } from "./calibration-priors";
import { gradeForPercent } from "./grades";
import type { Subject } from "./types";
import { measureQuestionBankDiscrimination } from "./question-discrimination";
import { techniqueVsKnowledge } from "./retention-analytics";

export const COMMAND_WORDS: CommandWord[] = [
  "state","describe","explain","calculate","show that","suggest","compare","evaluate","discuss","justify","deduce","predict","outline","other",
];

export const MISCONCEPTIONS: MisconceptionTag[] = [
  "units","significant-figures","rearrangement","substitution-slips","graph-reading","method-skipped","misread-command","terminology","conceptual","other",
];

const COMMAND_RE: Record<CommandWord, RegExp> = {
  "state": /\bstate\b/i,
  "describe": /\bdescribe\b/i,
  "explain": /\bexplain\b/i,
  "calculate": /\bcalculate\b/i,
  "show that": /\bshow that\b/i,
  "suggest": /\bsuggest\b/i,
  "compare": /\bcompare\b/i,
  "evaluate": /\bevaluate\b/i,
  "discuss": /\bdiscuss\b/i,
  "justify": /\bjustify\b/i,
  "deduce": /\bdeduce\b/i,
  "predict": /\bpredict\b/i,
  "outline": /\boutline\b/i,
  "other": /.^/,
};

const MISCONCEPTION_PATTERNS: Array<{ tag: MisconceptionTag; re: RegExp }> = [
  { tag: "units", re: /\bunit|kJ|J\b|m s-1|mol dm/i },
  { tag: "significant-figures", re: /sig fig|significant|decimal place/i },
  { tag: "rearrangement", re: /rearrange|subject of/i },
  { tag: "substitution-slips", re: /substitut|into the equation/i },
  { tag: "graph-reading", re: /\bgraph|gradient|intercept|area under/i },
  { tag: "method-skipped", re: /method|working|step/i },
  { tag: "misread-command", re: /command word|instruction/i },
  { tag: "terminology", re: /term|define|terminolog/i },
  { tag: "conceptual", re: /concept|misconception|principle/i },
];

export function commandOf(text: string): CommandWord {
  for (const c of COMMAND_WORDS) if (c !== "other" && COMMAND_RE[c].test(text)) return c;
  return "other";
}

export function misconceptionOf(missedPoints: string[]): MisconceptionTag {
  const hay = missedPoints.join(" ");
  for (const { tag, re } of MISCONCEPTION_PATTERNS) if (re.test(hay)) return tag;
  return "other";
}

export function timingLabel(secondsSpent: number | undefined, marks: number): Mistake["timing"] {
  if (secondsSpent == null) return "unknown";
  // Timing labels use the versioned prior until enough marked timing outcomes
  // exist to fit a subject-specific timing model. The thresholds are not
  // presented as learner outcomes.
  const budget = marks * CALIBRATION_PRIOR_V1.timing.secondsPerMark.mean;
  if (secondsSpent < budget * CALIBRATION_PRIOR_V1.timing.rushedRatio) return "rushed";
  if (secondsSpent > budget * CALIBRATION_PRIOR_V1.timing.slowRatio) return "slow";
  return "ok";
}

export function buildAssessmentInsight(input: {
  attempts: Attempt[];
  mistakes: Mistake[];
  mastery: TopicMastery[];
  questionsById: Map<Id, Question>;
  calibrationModel?: CalibrationModel;
  calibrationObservations?: CalibrationObservation[];
  asOf?: string;
}): AssessmentInsight {
  const byCommand = Object.fromEntries(COMMAND_WORDS.map((c) => [c, 0])) as Record<CommandWord, number>;
  const byMisconception = Object.fromEntries(MISCONCEPTIONS.map((m) => [m, 0])) as Record<MisconceptionTag, number>;
  const byAo: Record<string, number> = { AO1: 0, AO2: 0, AO3: 0 };
  const lostByTopic = new Map<string, { subjectId: Id; lost: number }>();
  for (const m of input.mistakes) {
    if (m.command) byCommand[m.command] = (byCommand[m.command] ?? 0) + m.marksLost;
    if (m.misconception) byMisconception[m.misconception] = (byMisconception[m.misconception] ?? 0) + m.marksLost;
    if (m.ao) byAo[m.ao] = (byAo[m.ao] ?? 0) + m.marksLost;
    const k = m.topicId;
    const cur = lostByTopic.get(k) ?? { subjectId: m.subjectId, lost: 0 };
    cur.lost += m.marksLost;
    lostByTopic.set(k, cur);
  }
  const asOf = input.asOf ?? new Date().toISOString();
  const model = input.calibrationModel ?? buildCalibrationModel({
    observations: input.calibrationObservations ?? [],
    asOf,
  });
  const masteryById = new Map(input.mastery.map((m) => [m.topicId, m]));
  const marksLostByTopic = [...lostByTopic.entries()].map(([topicId, v]) => {
    const estimate = estimateRecoverableMarks(model, topicId, v.subjectId);
    const recoverable = Math.round(v.lost * estimate.value);
    return {
      topicId,
      subjectId: v.subjectId,
      lost: v.lost,
      recoverable: Math.max(0, recoverable),
      recoverableLower: Math.max(0, Math.floor(v.lost * estimate.lower)),
      recoverableUpper: Math.max(0, Math.ceil(v.lost * estimate.upper)),
      recoverableSampleSize: estimate.sampleSize,
      recoverableSource: estimate.source,
      modelVersion: estimate.modelVersion,
    };
  }).sort((a, b) => b.lost - a.lost);

  const marksLostByAo = byAo;
  // Repeated weak: topic appears 3+ times and is still weak.
  const countByTopic = new Map<string, number>();
  for (const m of input.mistakes) countByTopic.set(m.topicId, (countByTopic.get(m.topicId) ?? 0) + 1);
  const repeatedWeakSubtopics = [...countByTopic.entries()].filter(([, n]) => n >= 3).map(([id]) => id)
    .filter((id) => (masteryById.get(id)?.mastery ?? 1) < 0.65);

  // Marks/hour is an expected improvement estimate, not recoverable marks
  // divided by a guessed cost. With no observed improvement outcomes it stays
  // explicitly on the wide population prior.
  const expectedMarksPerHour = marksLostByTopic.slice(0, 8).map((row) => {
    const estimate = estimateMarksPerHour(model, row.topicId, row.subjectId);
    return {
      topicId: row.topicId,
      value: Math.round(estimate.value * 10) / 10,
      lower: Math.round(estimate.lower * 10) / 10,
      upper: Math.round(estimate.upper * 10) / 10,
      sampleSize: estimate.sampleSize,
      source: estimate.source,
      modelVersion: estimate.modelVersion,
    };
  });
  expectedMarksPerHour.sort((a, b) => b.value - a.value);

  const questionDiscrimination = measureQuestionBankDiscrimination({
    questions: [...input.questionsById.values()],
    attempts: input.attempts,
  });

  return {
    byCommand,
    byMisconception,
    marksLostByTopic,
    marksLostByAo,
    repeatedWeakSubtopics,
    expectedMarksPerHour,
    techniqueVsKnowledge: techniqueVsKnowledge(input.mistakes),
    questionDiscrimination,
  };
}

export function simulatePaper(input: {
  subject: Subject;
  paperSpecId: Id;
  questions: Question[];
  topicMastery: Map<Id, number>;
  calibration?: Calibration;
  calibrationModel?: CalibrationModel;
  asOf?: string;
}): PaperSimulation {
  const totalMarks = input.questions.reduce((a, q) => a + q.totalMarks, 0);
  const timeMinutes = input.subject.papers.find((p) => p.id === input.paperSpecId)?.durationMinutes ?? CALIBRATION_PRIOR_V1.timing.defaultPaperDurationMinutes;
  const model = input.calibrationModel ?? buildCalibrationModel({ observations: [], asOf: input.asOf ?? new Date().toISOString() });
  const subjectModel = questionMarkModelForSubject(model, input.subject.id);
  // The mark model is fitted on later unseen questions and includes the
  // captured pre-revision mastery, action and duration features.
  let raw = 0;
  let rawLower = 0;
  let rawUpper = 0;
  const byTopic = new Map<string, { expected: number; available: number }>();
  for (const q of input.questions) {
    const masteryAvg = q.topicIds.length ? q.topicIds.reduce((a, id) => a + (input.topicMastery.get(id) ?? 0), 0) / q.topicIds.length : 0;
    const estimate = predictQuestionMarks({ model: subjectModel, baselineMastery: masteryAvg, durationMinutes: 0, action: "paper" });
    const expected = q.totalMarks * estimate.value;
    raw += expected;
    rawLower += q.totalMarks * estimate.lower;
    rawUpper += q.totalMarks * estimate.upper;
    for (const tid of q.topicIds) {
      const cur = byTopic.get(tid) ?? { expected: 0, available: 0 };
      cur.expected += expected / q.topicIds.length;
      cur.available += q.totalMarks / q.topicIds.length;
      byTopic.set(tid, cur);
    }
  }
  const paperModel = paperCalibrationForSubject(model, input.subject.id);
  const calibrated = input.calibration
    ? { value: (raw * input.calibration.slope + input.calibration.bias) / Math.max(1, totalMarks), lower: 0, upper: 1, sampleSize: input.calibration.sampleSize, source: input.calibration.source ?? "population-plus-personal-shrinkage", modelVersion: input.calibration.modelVersion ?? model.modelVersion, priorVersion: input.calibration.priorVersion ?? model.priorVersion, standardError: 0, personalWeight: 1 }
    : applyPaperCalibration({ model: paperModel, predictedMarks: raw, totalMarks });
  const rawLowerCalibration = applyPaperCalibration({ model: paperModel, predictedMarks: rawLower, totalMarks });
  const rawUpperCalibration = applyPaperCalibration({ model: paperModel, predictedMarks: rawUpper, totalMarks });
  const calibratedWithQuestionRange = {
    ...calibrated,
    lower: Math.min(calibrated.lower, rawLowerCalibration.value, rawUpperCalibration.value),
    upper: Math.max(calibrated.upper, rawLowerCalibration.value, rawUpperCalibration.value),
  };
  const predictedMarks = Math.round(Math.max(0, Math.min(totalMarks, calibratedWithQuestionRange.value * totalMarks)));
  const predictedMarksLower = Math.round(Math.max(0, Math.min(totalMarks, calibratedWithQuestionRange.lower * totalMarks)));
  const predictedMarksUpper = Math.round(Math.max(0, Math.min(totalMarks, calibratedWithQuestionRange.upper * totalMarks)));
  const grade = gradeForPercent(input.subject, totalMarks ? (predictedMarks / totalMarks) * 100 : 0);
  const gradeLower = gradeForPercent(input.subject, totalMarks ? (predictedMarksLower / totalMarks) * 100 : 0);
  const gradeUpper = gradeForPercent(input.subject, totalMarks ? (predictedMarksUpper / totalMarks) * 100 : 0);
  const recoverableRate = averageRecoverableRate(model, input.subject.id, input.questions);
  const recoverableMarks = Math.round(Math.max(0, (totalMarks - predictedMarks) * recoverableRate.value));
  const recoverableMarksLower = Math.max(0, Math.floor((totalMarks - predictedMarksUpper) * recoverableRate.lower));
  const recoverableMarksUpper = Math.max(0, Math.ceil((totalMarks - predictedMarksLower) * recoverableRate.upper));
  return {
    paperSpecId: input.paperSpecId,
    subjectId: input.subject.id,
    questionIds: input.questions.map((q) => q.id),
    totalMarks,
    timeMinutes,
    predictedMarks,
    predictedGrade: grade,
    predictedMarksLower,
    predictedMarksUpper,
    predictedGradeLower: gradeLower,
    predictedGradeUpper: gradeUpper,
    predictionConfidence: 1 - Math.min(1, calibratedWithQuestionRange.upper - calibratedWithQuestionRange.lower),
    predictionSource: calibratedWithQuestionRange.source,
    modelVersion: calibratedWithQuestionRange.modelVersion,
    personalSampleSize: calibratedWithQuestionRange.sampleSize,
    recoverableMarks,
    recoverableMarksLower,
    recoverableMarksUpper,
    marksByTopic: [...byTopic.entries()].map(([topicId, v]) => ({ topicId, expected: Math.round(v.expected), available: Math.round(v.available) })),
  };
}

export function calibrateFromHistory(input: {
  subjectId: Id;
  pairs: Array<{ predicted: number; actual: number }>;
}): Calibration {
  return legacyCalibrationFromPairs(input.subjectId, input.pairs);
}

function averageRecoverableRate(model: CalibrationModel | undefined, subjectId: Id, questions: Question[]) {
  const estimates = questions.flatMap((question) => question.topicIds.map((topicId) => estimateRecoverableMarks(model, topicId, subjectId)));
  if (!estimates.length) return estimateRecoverableMarks(model, "", subjectId);
  return {
    value: estimates.reduce((sum, estimate) => sum + estimate.value, 0) / estimates.length,
    lower: estimates.reduce((sum, estimate) => sum + estimate.lower, 0) / estimates.length,
    upper: estimates.reduce((sum, estimate) => sum + estimate.upper, 0) / estimates.length,
  };
}
