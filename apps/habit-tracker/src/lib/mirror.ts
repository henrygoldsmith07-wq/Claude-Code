/**
 * The local Pulse mirror and its opt-in flag.
 *
 * Habit keeps its rows in Supabase, so unlike the other first-party apps there
 * is no native localStorage state for Pulse to read. Instead the hook mirrors
 * every loaded habit and check-in under a shared key (`habit-tracker-state-v1`),
 * and Pulse's same-origin connector reads that key — same as Forq, just
 * written rather than intrinsic. The `day` field is this device's local today
 * at mirror time; Pulse uses it to stop synthesising before the day is over.
 *
 * The mirror is gated by an opt-in flag under its own key, so revoking it
 * stops the data flow at the source: the flag is what Pulse's connector
 * checks before reading anything, and revoking also deletes the mirror
 * outright. Consent lives in the app and is read by Pulse — one source of
 * truth, never two that can disagree.
 *
 * This file owns both shapes. Keep the keys and the field names in step with
 * `createHabitSameOriginConnector` in apps/pulse/src/connectors/habit.ts.
 */

import type { DbCheckin, DbHabit } from "./types";

/** Shared with Pulse's `HABIT_STORAGE_KEY`. Change both or neither. */
export const HABIT_STORAGE_KEY = "habit-tracker-state-v1";

/** Shared with Pulse's `HABIT_PULSE_OPT_IN_KEY`. Change both or neither. */
export const PULSE_OPT_IN_KEY = "habit-tracker-pulse-opt-in";

/** The slice of storage this module needs, so tests can pass a fake. */
export interface MirrorStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(explicit?: MirrorStorageLike): MirrorStorageLike | null {
  if (explicit !== undefined) return explicit;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

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
export function writeLocalMirror(mirror: HabitLocalMirror, explicit?: MirrorStorageLike): void {
  const storage = resolveStorage(explicit);
  if (!storage) return;
  try {
    storage.setItem(HABIT_STORAGE_KEY, JSON.stringify(mirror));
  } catch {
    // Storage can be blocked (Safari private mode) or full; the app keeps
    // working, Pulse just has no mirror to read.
  }
}

/** Delete the mirror — what revoking consent means for the data itself. */
export function clearLocalMirror(explicit?: MirrorStorageLike): void {
  const storage = resolveStorage(explicit);
  if (!storage) return;
  try {
    storage.removeItem(HABIT_STORAGE_KEY);
  } catch {
    // Nothing sensible to do if removal is blocked; the flag gate still holds.
  }
}

/** Read the opt-in flag. Anything other than the explicit on-value is off. */
export function readPulseOptIn(explicit?: MirrorStorageLike): boolean {
  const storage = resolveStorage(explicit);
  if (!storage) return false;
  try {
    return storage.getItem(PULSE_OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Set the flag. Revoking also removes the mirror, so the flow stops now. */
export function writePulseOptIn(enabled: boolean, explicit?: MirrorStorageLike): void {
  const storage = resolveStorage(explicit);
  if (!storage) return;
  try {
    storage.setItem(PULSE_OPT_IN_KEY, enabled ? "1" : "0");
    if (!enabled) storage.removeItem(HABIT_STORAGE_KEY);
  } catch {
    // Blocked storage cannot hold the flag; the reader treats absence as off.
  }
}
