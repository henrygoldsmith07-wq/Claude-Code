"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { lastNDays, todayIso } from "@/lib/date";
import type { SleepEntry } from "@/lib/types";

function computeDurationHours(bedTime: string, wakeTime: string): number {
  const [bh, bm] = bedTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let minutes = wh * 60 + wm - (bh * 60 + bm);
  if (minutes <= 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 10) / 10;
}

export function useSleep(targetHours = 8) {
  const [entries, setEntries] = useLocalStorage<SleepEntry[]>("sleep.entries", []);

  function addEntry(date: string, bedTime: string, wakeTime: string, quality: number) {
    const durationHours = computeDurationHours(bedTime, wakeTime);
    setEntries([
      ...entries.filter((e) => e.date !== date),
      { id: crypto.randomUUID(), date, bedTime, wakeTime, durationHours, quality },
    ]);
  }
  function deleteEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id));
  }

  const last7 = lastNDays(7);
  const last7Entries = last7.map((d) => entries.find((e) => e.date === d) ?? null);
  const recorded7 = last7Entries.filter((e): e is SleepEntry => e !== null);
  const avgDurationHours7d =
    recorded7.length > 0 ? recorded7.reduce((s, e) => s + e.durationHours, 0) / recorded7.length : 0;
  const sleepDebtHours7d = recorded7.reduce((debt, e) => debt + Math.max(0, targetHours - e.durationHours), 0);
  const avgQuality7d =
    recorded7.length > 0 ? recorded7.reduce((s, e) => s + e.quality, 0) / recorded7.length : 0;
  const lastNight = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const isLastNightToday = lastNight?.date === todayIso();

  return {
    entries,
    addEntry,
    deleteEntry,
    targetHours,
    stats: { avgDurationHours7d, sleepDebtHours7d, avgQuality7d, lastNight, isLastNightToday, last7 },
  };
}
