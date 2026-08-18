/**
 * Streak and progress maths — the only interesting logic in the app, and the
 * only part that gets its own tests.
 *
 * A day is completed or it is not; the check-in log is a set of completed
 * days per habit. Everything else (current streak, best streak, completion
 * rate, weekly progress) is derived from that set.
 */

import { addDays, startOfWeekISO } from "./date";

function sortedSet(days: readonly string[]): Set<string> {
  return new Set(days);
}

/**
 * Consecutive completed days ending today — or ending yesterday, if today is
 * not done yet. A habit not yet done today should not break its streak until
 * the day is actually over.
 */
export function currentStreak(completedDays: readonly string[], today: string): number {
  const done = sortedSet(completedDays);
  if (done.has(today)) return runBackwards(done, today);
  const yesterday = addDays(today, -1);
  if (done.has(yesterday)) return runBackwards(done, yesterday);
  return 0;
}

/** The longest consecutive completed run in the whole log. */
export function bestStreak(completedDays: readonly string[]): number {
  const done = sortedSet(completedDays);
  const days = [...done].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    if (run > best) best = run;
    previous = day;
  }
  return best;
}

/** Share of days completed in the `windowDays` ending at `endISO` (inclusive). */
export function completionRate(completedDays: readonly string[], windowDays: number, endISO: string): number {
  const done = sortedSet(completedDays);
  let completed = 0;
  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    if (done.has(addDays(endISO, -offset))) completed += 1;
  }
  return completed / windowDays;
}

/**
 * Completed days per Sunday-start week, for the `weeks` most recent weeks
 * ending at `endISO`, oldest first. Weeks with nothing are included — a
 * zero is information.
 */
export function weekCounts(
  completedDays: readonly string[],
  endISO: string,
  weeks: number,
): { weekStart: string; count: number }[] {
  const done = sortedSet(completedDays);
  const endWeek = startOfWeekISO(endISO);
  const counts = new Map<string, number>();
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    counts.set(addDays(endWeek, -offset * 7), 0);
  }
  for (const day of done) {
    const weekStart = startOfWeekISO(day);
    if (counts.has(weekStart)) counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
  }
  return [...counts.entries()].map(([weekStart, count]) => ({ weekStart, count }));
}

function runBackwards(done: Set<string>, end: string): number {
  let run = 0;
  let cursor = end;
  while (done.has(cursor)) {
    run += 1;
    cursor = addDays(cursor, -1);
  }
  return run;
}
