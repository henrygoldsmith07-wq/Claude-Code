import { daysToExam } from "./recommender";
import type { Attempt, ExamDate, Id, IsoDate, Subject, TopicMastery } from "./types";

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
  /** 0–1: how much to trust this. Low until ~10 marked questions exist. */
  confidence: number;
  /** Percentage points gained (+) or lost (−) over the last 30 days. */
  trend: number;
  /** Marks-per-topic view of where the next grade actually comes from. */
  headroom: { topicId: Id; potentialPercent: number }[];
}

const MIN_ATTEMPTS_FOR_TRUST = 10;

export function gradeForPercent(subject: Subject, percent: number): string {
  const sorted = [...subject.gradeBoundaries].sort((a, b) => b.percent - a.percent);
  for (const row of sorted) {
    if (percent >= row.percent) return row.grade;
  }
  return sorted.length ? sorted[sorted.length - 1].grade : "U";
}

export function predictGrade(
  subject: Subject,
  mastery: TopicMastery[],
  attempts: Attempt[],
  exams: ExamDate[] = [],
  today: IsoDate = new Date().toISOString().slice(0, 10),
): GradePrediction {
  const rows = mastery.filter((m) => m.subjectId === subject.id);
  const subjectAttempts = attempts.filter((a) => a.subjectId === subject.id);

  const coverage = rows.length ? rows.reduce((a, m) => a + m.mastery, 0) / rows.length : 0;
  const marksMax = subjectAttempts.reduce((a, x) => a + x.max, 0);
  const measured = marksMax ? subjectAttempts.reduce((a, x) => a + x.awarded, 0) / marksMax : 0;

  const trust = Math.min(1, subjectAttempts.length / MIN_ATTEMPTS_FOR_TRUST);
  // Exam-question accuracy is the better predictor once there is enough of it.
  const blended = measured * trust + coverage * (1 - trust);

  // Mastery is not a mark: a student at 100% topic mastery does not score
  // 100%. Compress into a realistic attainment range before banding.
  const percent = Math.round(clamp(blended * 92 + 4, 0, 100));

  const spread = 6 + (1 - trust) * 12;
  const grade = gradeForPercent(subject, percent);
  const bestCase = gradeForPercent(subject, clamp(percent + spread, 0, 100));
  const worstCase = gradeForPercent(subject, clamp(percent - spread, 0, 100));

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
    .map((m) => ({ topicId: m.topicId, potentialPercent: Math.round((1 - m.mastery) * perTopic * 92) }))
    .filter((h) => h.potentialPercent > 0)
    .sort((a, b) => b.potentialPercent - a.potentialPercent)
    .slice(0, 5);

  // Confidence also falls when the exam is far away — a lot can change.
  const days = daysToExam(exams, subject.id, today);
  const horizonPenalty = days == null ? 0.85 : clamp(1 - days / 400, 0.6, 1);

  return {
    subjectId: subject.id,
    percent,
    grade,
    bestCase,
    worstCase,
    confidence: clamp(trust * 0.75 * horizonPenalty + Math.min(1, rows.length / 12) * 0.25, 0, 1),
    trend,
    headroom,
  };
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
