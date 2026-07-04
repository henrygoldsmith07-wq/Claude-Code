import { predictRetrievability } from "./fsrs";
import { dueCount, recentAttemptsForTopic } from "./stats";
import type { Flashcard, QuizAttempt, Topic } from "./types";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysUntil(examDate: string, now = new Date()): number {
  const today = new Date(toDateOnly(now) + "T00:00:00Z").getTime();
  const target = new Date(examDate + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((target - today) / 86400000));
}

// A topic counts as exam-ready once FSRS predicts at least this much
// chance of recall on the exam date itself — the same target retention
// FSRS itself schedules everyday reviews against, so "ready for the exam"
// means exactly the same thing as "not due yet" does day-to-day.
const TARGET_EXAM_RETRIEVABILITY = 0.9;

interface TopicReadiness {
  topic: Topic;
  readiness: number;
  started: boolean;
  dueNow: boolean;
}

// Predicts how likely a topic is to actually be remembered on the exam
// date — not just "was it reviewed recently" but FSRS's forgetting-curve
// extrapolation of each card's current memory state forward to that
// specific future date — blended with recent quiz accuracy where
// available. A topic with no reviewed cards yet reads as fully unready,
// since it hasn't been learned at all.
function assessReadiness(
  topic: Topic,
  cards: Flashcard[],
  quizAttempts: QuizAttempt[],
  examDate: Date,
): TopicReadiness {
  const predictions = cards
    .map((card) => predictRetrievability(card, examDate))
    .filter((r): r is number => r !== null);
  const examRetrievability =
    predictions.length === 0 ? null : predictions.reduce((sum, r) => sum + r, 0) / predictions.length;

  const recentAttempts = recentAttemptsForTopic(quizAttempts, topic.id);
  const quizAccuracy =
    recentAttempts.length === 0
      ? null
      : recentAttempts.reduce((sum, a) => sum + a.score / a.total, 0) / recentAttempts.length;

  const started = cards.length > 0;
  let readiness: number;
  if (examRetrievability === null && quizAccuracy === null) readiness = 0;
  else if (examRetrievability === null) readiness = quizAccuracy!;
  else if (quizAccuracy === null) readiness = examRetrievability;
  else readiness = (examRetrievability + quizAccuracy) / 2;

  return { topic, readiness, started, dueNow: dueCount(cards) > 0 };
}

// Ranks a topic for scheduling: anything needing action right now (never
// started, or FSRS already says a card is due today) always outranks
// everything that merely looks weak for the exam — an overdue card left
// unreviewed for days would be forgotten several times over by the time a
// pure exam-readiness ranking got back around to it. Within each of those
// two groups, lower predicted exam-day recall sorts first.
function schedulingRank(entry: TopicReadiness): number {
  const urgent = !entry.started || entry.dueNow;
  return urgent ? entry.readiness - 1 : entry.readiness;
}

// Builds a full day-by-day plan (today through the exam) rather than just
// picking "as many as fit today": every topic that isn't yet exam-ready is
// ranked by scheduling urgency, then spread evenly across every remaining
// day so the most urgent topics land on the earliest days — maximising
// how many spaced review opportunities they get before the exam — while
// no single day is overloaded.
export function buildStudySchedule(
  topics: Topic[],
  cardsForTopic: (topicId: string) => Flashcard[],
  quizAttempts: QuizAttempt[],
  examDate: string,
  now = new Date(),
): Topic[][] {
  const daysRemaining = Math.max(1, daysUntil(examDate, now));
  const examDateObj = new Date(examDate + "T00:00:00Z");

  const pending = topics
    .map((topic) => assessReadiness(topic, cardsForTopic(topic.id), quizAttempts, examDateObj))
    .filter((entry) => !entry.started || entry.dueNow || entry.readiness < TARGET_EXAM_RETRIEVABILITY)
    .sort((a, b) => schedulingRank(a) - schedulingRank(b));

  const schedule: Topic[][] = Array.from({ length: daysRemaining }, () => []);
  pending.forEach((entry, i) => {
    schedule[i % daysRemaining].push(entry.topic);
  });
  return schedule;
}

export function topicsForToday(
  topics: Topic[],
  cardsForTopic: (topicId: string) => Flashcard[],
  quizAttempts: QuizAttempt[],
  examDate: string,
  now = new Date(),
): Topic[] {
  return buildStudySchedule(topics, cardsForTopic, quizAttempts, examDate, now)[0] ?? [];
}
