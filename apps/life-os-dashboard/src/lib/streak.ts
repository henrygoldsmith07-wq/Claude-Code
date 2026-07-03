import { isoDaysAgo } from "./date";

/**
 * Given a set of ISO dates something happened on, returns the current streak
 * (consecutive days up to and including today or yesterday) and best streak.
 * A streak is not broken until a full day is missed, so logging today is not
 * required to keep yesterday's streak alive when checked before bed.
 */
export function computeStreak(dates: string[]): { current: number; best: number } {
  const set = new Set(dates);
  if (set.size === 0) return { current: 0, best: 0 };

  let current = 0;
  const startsToday = set.has(isoDaysAgo(0));
  if (startsToday || set.has(isoDaysAgo(1))) {
    let cursor = startsToday ? 0 : 1;
    while (set.has(isoDaysAgo(cursor))) {
      current++;
      cursor++;
    }
  }

  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && daysBetweenSimple(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  return { current, best };
}

function daysBetweenSimple(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00");
  const to = new Date(toIso + "T00:00:00");
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}
