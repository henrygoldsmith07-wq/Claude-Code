import type { Flashcard, QuizAttempt } from "./types";
import { isDue, isMastered, MASTERED_INTERVAL_DAYS } from "./sm2";

export function dueCount(cards: Flashcard[], now = new Date()): number {
  return cards.filter((c) => isDue(c, now)).length;
}

export function masteredCount(cards: Flashcard[]): number {
  return cards.filter(isMastered).length;
}

// Blends how well cards in this set are retained (interval reached vs. the
// mastery threshold) with recent quiz accuracy, so mastery reflects both
// spaced-repetition progress and active-recall performance.
export function masteryPercent(cards: Flashcard[], recentAttempts: QuizAttempt[]): number {
  if (cards.length === 0 && recentAttempts.length === 0) return 0;

  const cardScore =
    cards.length === 0
      ? null
      : cards.reduce((sum, c) => sum + Math.min(1, c.intervalDays / MASTERED_INTERVAL_DAYS), 0) /
        cards.length;

  const quizScore =
    recentAttempts.length === 0
      ? null
      : recentAttempts.reduce((sum, a) => sum + a.score / a.total, 0) / recentAttempts.length;

  if (cardScore === null) return Math.round((quizScore ?? 0) * 100);
  if (quizScore === null) return Math.round(cardScore * 100);
  return Math.round(((cardScore + quizScore) / 2) * 100);
}

export function recentAttemptsForTopic(
  attempts: QuizAttempt[],
  topicId: string,
  limit = 5,
): QuizAttempt[] {
  return attempts
    .filter((a) => a.topicId === topicId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, limit);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Consecutive-day streak ending today or yesterday (a day's gap doesn't
// reset the streak until the day after, so "did I study today yet" doesn't
// wrongly zero it out first thing in the morning).
export function computeStreak(studyDays: string[], now = new Date()): number {
  const days = new Set(studyDays);
  const today = toDateOnly(now);
  const yesterday = toDateOnly(new Date(now.getTime() - 86400000));

  let cursor: string;
  if (days.has(today)) cursor = today;
  else if (days.has(yesterday)) cursor = yesterday;
  else return 0;

  let streak = 0;
  let cursorDate = new Date(cursor + "T00:00:00Z");
  while (days.has(toDateOnly(cursorDate))) {
    streak += 1;
    cursorDate = new Date(cursorDate.getTime() - 86400000);
  }
  return streak;
}

export interface HeatmapDay {
  date: string;
  studied: boolean;
}

export function studyHeatmap(studyDays: string[], days = 84, now = new Date()): HeatmapDay[] {
  const set = new Set(studyDays);
  const result: HeatmapDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = toDateOnly(new Date(now.getTime() - i * 86400000));
    result.push({ date, studied: set.has(date) });
  }
  return result;
}
