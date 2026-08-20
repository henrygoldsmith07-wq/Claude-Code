import type { Attempt, Id, Mistake, Question } from "./types";

export const OVERPRACTICE_MIN_EXPOSURES = 4;

export type ExposureStatus = "unseen" | "balanced" | "overpractised";

export interface QuestionExposureRow {
  questionId: Id;
  subjectId: Id;
  topicIds: Id[];
  exposures: number;
  accuracy: number | null;
  lastAttemptAt: string | null;
  status: ExposureStatus;
}

export interface QuestionExposureReport {
  rows: QuestionExposureRow[];
  unseen: number;
  balanced: number;
  overpractised: number;
  narrative: string;
}

function rowFor(question: Question, attempts: Attempt[]): QuestionExposureRow {
  const marksAvailable = attempts.reduce((sum, attempt) => sum + Math.max(0, attempt.max), 0);
  const marksAwarded = attempts.reduce((sum, attempt) => sum + Math.max(0, Math.min(attempt.max, attempt.awarded)), 0);
  const accuracy = marksAvailable > 0 ? Math.round((marksAwarded / marksAvailable) * 1000) / 1000 : null;
  const status: ExposureStatus = !attempts.length
    ? "unseen"
    : attempts.length >= OVERPRACTICE_MIN_EXPOSURES && (accuracy ?? 0) >= 0.8
      ? "overpractised"
      : "balanced";
  return {
    questionId: question.id,
    subjectId: question.subjectId,
    topicIds: question.topicIds,
    exposures: attempts.length,
    accuracy,
    lastAttemptAt: attempts.length ? attempts.map((attempt) => attempt.createdAt).sort().at(-1) ?? null : null,
    status,
  };
}

export function questionExposureReport(input: { questions: Question[]; attempts: Attempt[] }): QuestionExposureReport {
  const attemptsByQuestion = new Map<Id, Attempt[]>();
  for (const attempt of input.attempts) {
    const rows = attemptsByQuestion.get(attempt.questionId) ?? [];
    rows.push(attempt);
    attemptsByQuestion.set(attempt.questionId, rows);
  }
  const rows = input.questions.map((question) => rowFor(question, attemptsByQuestion.get(question.id) ?? []));
  const unseen = rows.filter((row) => row.status === "unseen").length;
  const overpractised = rows.filter((row) => row.status === "overpractised").length;
  const balanced = rows.length - unseen - overpractised;
  const narrative = overpractised
    ? `${overpractised} secure question${overpractised === 1 ? " is" : "s are"} being practised repeatedly — switch to unseen or mixed questions.`
    : unseen
      ? `${unseen} question${unseen === 1 ? " is" : "s are"} unseen; the practice queue will surface those before repeats.`
      : "Question exposure is balanced across the available bank.";
  return { rows, unseen, balanced, overpractised, narrative };
}

/** Rank unseen and underexposed items ahead of secure repeats without hiding weak work. */
export function rankQuestionsForExposure(input: {
  questions: Question[];
  attempts: Attempt[];
  masteryByTopic?: Map<Id, number>;
  mistakes?: Mistake[];
}): Question[] {
  const report = questionExposureReport(input);
  const byId = new Map(report.rows.map((row) => [row.questionId, row] as const));
  const statusRank: Record<ExposureStatus, number> = { unseen: 0, balanced: 1, overpractised: 2 };
  const mastery = input.masteryByTopic;
  const mistakesByTopic = new Map<Id, Mistake[]>();
  for (const mistake of input.mistakes ?? []) {
    if (mistake.resolved) continue;
    const rows = mistakesByTopic.get(mistake.topicId) ?? [];
    rows.push(mistake);
    mistakesByTopic.set(mistake.topicId, rows);
  }
  const recentAttempts = [...input.attempts]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-8);
  const recentQuestionIds = new Set(recentAttempts.map((attempt) => attempt.questionId));
  const recentTopics = recentAttempts.flatMap((attempt) => attempt.topicIds);
  const specExposure = new Map<Id, number>();
  const questionById = new Map(input.questions.map((question) => [question.id, question] as const));
  for (const attempt of input.attempts) {
    const question = questionById.get(attempt.questionId);
    for (const specPointId of specPointsFor(question)) specExposure.set(specPointId, (specExposure.get(specPointId) ?? 0) + 1);
  }

  // Greedy selection adds diversity after the first choice. A plain sort can
  // put ten near-identical questions from one topic at the front even when
  // the learner has never seen other specification points in the pool.
  const remaining = [...input.questions];
  const ordered: Question[] = [];
  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < remaining.length; index++) {
      const question = remaining[index]!;
      const row = byId.get(question.id)!;
      const topicMastery = question.topicIds.length
        ? Math.min(...question.topicIds.map((topicId) => mastery?.get(topicId) ?? 0.5))
        : 0.5;
      const errorMarks = question.topicIds.reduce(
        (sum, topicId) => sum + (mistakesByTopic.get(topicId) ?? []).reduce((marks, mistake) => marks + mistake.marksLost, 0),
        0,
      );
      const specPoints = specPointsFor(question);
      const specRepetition = specPoints.reduce((sum, id) => sum + (specExposure.get(id) ?? 0), 0);
      const recentTopicPenalty = question.topicIds.some((topicId) => recentTopics.slice(-2).includes(topicId)) ? 9 : 0;
      const repeatedSpecPenalty = Math.min(12, specRepetition * 2);
      const recentQuestionPenalty = recentQuestionIds.has(question.id) ? 36 : 0;
      const difficultyTarget = 1 + topicMastery * 4;
      const difficultyFit = Math.max(0, 7 - Math.abs(question.difficulty - difficultyTarget) * 2);
      const score =
        (2 - statusRank[row.status]) * 42
        + (1 - topicMastery) * 18
        + Math.min(18, errorMarks * 2.5)
        + difficultyFit
        - row.exposures * 3
        - recentTopicPenalty
        - repeatedSpecPenalty
        - recentQuestionPenalty;
      if (score > bestScore || (score === bestScore && question.id.localeCompare(remaining[bestIndex]!.id) < 0)) {
        bestScore = score;
        bestIndex = index;
      }
    }
    const [selected] = remaining.splice(bestIndex, 1);
    if (!selected) break;
    ordered.push(selected);
    for (const specPointId of specPointsFor(selected)) specExposure.set(specPointId, (specExposure.get(specPointId) ?? 0) + 1);
  }
  return ordered;
}

function specPointsFor(question: Question | undefined): Id[] {
  if (!question) return [];
  return [...new Set([
    ...(question.specPointIds ?? []),
    ...question.parts.flatMap((part) => part.specPointIds ?? []),
  ])];
}
