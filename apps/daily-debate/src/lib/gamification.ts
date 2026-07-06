import type { TurnScores } from "./types";

export const POINTS_PER_LEVEL = 500;

// Each category is scored 0-10 by the judge; summing them gives a 0-50 raw
// point value per debate turn, so a strong 5-round debate nets ~150-250 pts.
export function pointsForTurn(scores: TurnScores): number {
  return scores.depth + scores.evidence + scores.logic + scores.rebuttal + scores.clarity;
}

export function levelForPoints(points: number): number {
  return Math.floor(points / POINTS_PER_LEVEL) + 1;
}

export function pointsIntoLevel(points: number): number {
  return points % POINTS_PER_LEVEL;
}

export interface StreakUpdate {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}

// Called once per day the user completes at least one debate. `today` and
// `lastActivityDate` are ISO date strings (YYYY-MM-DD).
export function updateStreak(
  today: string,
  lastActivityDate: string | null,
  currentStreak: number,
  longestStreak: number,
): StreakUpdate {
  if (lastActivityDate === today) {
    return { current_streak: currentStreak, longest_streak: longestStreak, last_activity_date: today };
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);

  const nextStreak = lastActivityDate === yesterdayIso ? currentStreak + 1 : 1;
  return {
    current_streak: nextStreak,
    longest_streak: Math.max(longestStreak, nextStreak),
    last_activity_date: today,
  };
}
