"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { lastNDays, todayIso } from "@/lib/date";
import { computeStreak } from "@/lib/streak";
import type { GratitudeEntry, JournalEntry, MoodEntry } from "@/lib/types";

export function useMentalHealth() {
  const [moods, setMoods] = useLocalStorage<MoodEntry[]>("mentalHealth.moods", []);
  const [gratitude, setGratitude] = useLocalStorage<GratitudeEntry[]>("mentalHealth.gratitude", []);
  const [journal, setJournal] = useLocalStorage<JournalEntry[]>("mentalHealth.journal", []);

  function logMood(mood: number, stress: number, notes: string, date = todayIso()) {
    setMoods([...moods.filter((m) => m.date !== date), { id: crypto.randomUUID(), date, mood, stress, notes }]);
  }
  function deleteMood(id: string) {
    setMoods(moods.filter((m) => m.id !== id));
  }

  function addGratitude(items: string[], date = todayIso()) {
    setGratitude([...gratitude, { id: crypto.randomUUID(), date, items }]);
  }
  function deleteGratitude(id: string) {
    setGratitude(gratitude.filter((g) => g.id !== id));
  }

  function addJournalEntry(content: string, date = todayIso()) {
    setJournal([...journal, { id: crypto.randomUUID(), date, content }]);
  }
  function deleteJournalEntry(id: string) {
    setJournal(journal.filter((j) => j.id !== id));
  }

  const last7 = lastNDays(7);
  const moods7d = last7.map((d) => moods.find((m) => m.date === d) ?? null);
  const recordedMoods7d = moods7d.filter((m): m is MoodEntry => m !== null);
  const avgMood7d =
    recordedMoods7d.length > 0 ? recordedMoods7d.reduce((s, m) => s + m.mood, 0) / recordedMoods7d.length : 0;
  const avgStress7d =
    recordedMoods7d.length > 0 ? recordedMoods7d.reduce((s, m) => s + m.stress, 0) / recordedMoods7d.length : 0;
  const gratitudeStreak = computeStreak([...new Set(gratitude.map((g) => g.date))]);
  const todayMood = moods.find((m) => m.date === todayIso()) ?? null;

  return {
    moods,
    gratitude,
    journal,
    logMood,
    deleteMood,
    addGratitude,
    deleteGratitude,
    addJournalEntry,
    deleteJournalEntry,
    stats: { avgMood7d, avgStress7d, gratitudeStreak, todayMood, last7, moods7d },
  };
}
