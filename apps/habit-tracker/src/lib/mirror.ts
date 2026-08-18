/**
 * The local Pulse mirror.
 *
 * Habit keeps its rows in Supabase, so unlike the other first-party apps there
 * is no native localStorage state for Pulse to read. Instead the hook mirrors
 * every loaded habit and check-in under a shared key (`habit-tracker-state-v1`),
 * and Pulse's same-origin connector reads that key — same as Forq, just
 * written rather than intrinsic. The `day` field is this device's local today
 * at mirror time; Pulse uses it to stop synthesising before the day is over.
 *
 * This file owns the mirror's shape. Keep the key and the field names in step
 * with `createHabitSameOriginConnector` in apps/pulse/src/connectors/habit.ts.
 */

import type { DbCheckin, DbHabit } from "./types";

/** Shared with Pulse's `HABIT_STORAGE_KEY`. Change both or neither. */
export const HABIT_STORAGE_KEY = "habit-tracker-state-v1";

export interface HabitLocalMirror {
  habits: DbHabit[];
  checkins: DbCheckin[];
  /** The app's local calendar day at mirror time, YYYY-MM-DD. */
  day: string;
  /** When this snapshot was written, for freshness probes. */
  mirroredAt: string;
}

export function buildLocalMirror(
  habits: readonly DbHabit[],
  checkins: readonly DbCheckin[],
  day: string,
  mirroredAt?: string,
): HabitLocalMirror {
  return {
    habits: [...habits],
    checkins: [...checkins],
    day,
    mirroredAt: mirroredAt ?? new Date().toISOString(),
  };
}

/** Best-effort write; a blocked or full storage must never break the app. */
export function writeLocalMirror(mirror: HabitLocalMirror): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(mirror));
  } catch {
    // Storage can be blocked (Safari private mode) or full; the app keeps
    // working, Pulse just has no mirror to read.
  }
}
