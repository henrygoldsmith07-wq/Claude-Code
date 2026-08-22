// retention.ts — data-retention settings: how long reflections stay on device.
// Retention is opt-in and applied explicitly: nothing is deleted silently on
// load. `applyRetention` is pure so the UI can show exactly what would be
// removed before the user confirms.

import type { Entry } from "./types";

export const RETENTION_KEY = "reflectRetentionDays";
/** 0 = keep forever (default). Otherwise days. */
export const RETENTION_CHOICES = [0, 30, 90, 180, 365] as const;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getRetentionDays(): number {
  if (!canUseStorage()) return 0;
  try {
    const raw = window.localStorage.getItem(RETENTION_KEY);
    if (raw === null) return 0;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || !Number.isFinite(n)) return 0;
    return n;
  } catch {
    return 0;
  }
}

export function setRetentionDays(days: number): void {
  if (!canUseStorage()) return;
  try {
    if (!Number.isInteger(days) || days < 0 || !Number.isFinite(days)) return;
    window.localStorage.setItem(RETENTION_KEY, String(days));
  } catch {
    console.warn("Could not save retention setting.");
  }
}

export function clearRetentionSetting(): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(RETENTION_KEY);
  } catch {
    // blocked storage — nothing to clean up
  }
}

export interface RetentionOutcome {
  kept: Entry[];
  purged: Entry[];
}

/** Split entries into kept vs older-than-retention-window, by createdAt. */
export function applyRetention(entries: Entry[], now = new Date(), retentionDays = getRetentionDays()): RetentionOutcome {
  if (!retentionDays || retentionDays <= 0) return { kept: entries.slice(), purged: [] };
  const cutoff = now.getTime() - retentionDays * 86400000;
  const kept: Entry[] = [];
  const purged: Entry[] = [];
  for (const e of entries) {
    const t = new Date(e.createdAt).getTime();
    if (!Number.isNaN(t) && t < cutoff) purged.push(e);
    else kept.push(e);
  }
  return { kept, purged };
}
