"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { lastNDays, todayIso } from "@/lib/date";
import { computeStreak } from "@/lib/streak";
import type { HormesisEntry, HormesisType } from "@/lib/types";

export const HORMESIS_LABELS: Record<HormesisType, string> = {
  cold_shower: "Cold shower",
  ice_bath: "Ice bath",
  sauna: "Sauna",
  fasting: "Fasting",
  exercise: "Exercise",
  sun_exposure: "Sun exposure",
  breathwork: "Breathwork",
};

export function useHormesis() {
  const [entries, setEntries] = useLocalStorage<HormesisEntry[]>("hormesis.entries", []);

  function addEntry(type: HormesisType, durationMin: number, intensity: number, notes: string, date = todayIso()) {
    setEntries([...entries, { id: crypto.randomUUID(), date, type, durationMin, intensity, notes }]);
  }
  function deleteEntry(id: string) {
    setEntries(entries.filter((e) => e.id !== id));
  }

  const last7 = lastNDays(7);
  const entries7d = entries.filter((e) => last7.includes(e.date));
  const minutesByType: Record<string, number> = {};
  for (const e of entries7d) {
    minutesByType[HORMESIS_LABELS[e.type]] = (minutesByType[HORMESIS_LABELS[e.type]] ?? 0) + e.durationMin;
  }
  const anyStressDates = [...new Set(entries.map((e) => e.date))];
  const streak = computeStreak(anyStressDates);
  const totalMinutes7d = entries7d.reduce((s, e) => s + e.durationMin, 0);

  return {
    entries,
    addEntry,
    deleteEntry,
    stats: { minutesByType, streak, totalMinutes7d, sessionCount7d: entries7d.length },
  };
}
