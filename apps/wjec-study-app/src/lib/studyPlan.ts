import type { Flashcard, QuizAttempt, Topic } from "./types";
import { dueCount, masteryPercent, recentAttemptsForTopic } from "./stats";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysUntil(examDate: string, now = new Date()): number {
  const today = new Date(toDateOnly(now) + "T00:00:00Z").getTime();
  const target = new Date(examDate + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((target - today) / 86400000));
}

// Ranks a topic by how urgently it needs attention: topics with no cards yet
// need a first pass, topics with due reviews need spaced-repetition upkeep,
// and low-mastery topics need more revision. Higher score = more urgent.
function priorityScore(cards: Flashcard[], mastery: number): number {
  if (cards.length === 0) return 1000;
  return dueCount(cards) * 20 + (100 - mastery);
}

// Picks which topics to focus on today so that, spread evenly over the days
// remaining until the exam, every not-yet-mastered topic gets covered before
// the exam date — front-loaded onto the most urgent topics first.
export function topicsForToday(
  topics: Topic[],
  cardsForTopic: (topicId: string) => Flashcard[],
  quizAttempts: QuizAttempt[],
  daysRemaining: number,
): Topic[] {
  const scored = topics.map((topic) => {
    const cards = cardsForTopic(topic.id);
    const mastery = masteryPercent(cards, recentAttemptsForTopic(quizAttempts, topic.id));
    return { topic, cards, mastery };
  });

  const unfinished = scored
    .filter((s) => s.cards.length === 0 || s.mastery < 100)
    .sort((a, b) => priorityScore(b.cards, b.mastery) - priorityScore(a.cards, a.mastery));

  if (unfinished.length === 0) return [];

  const perDay = Math.max(1, Math.ceil(unfinished.length / Math.max(1, daysRemaining)));
  return unfinished.slice(0, perDay).map((s) => s.topic);
}
