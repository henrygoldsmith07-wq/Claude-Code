"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { lastNDays, todayIso } from "@/lib/date";
import { computeStreak } from "@/lib/streak";
import type { Habit, HabitLog } from "@/lib/types";

export function useHabits() {
  const [habits, setHabits] = useLocalStorage<Habit[]>("habits.list", []);
  const [logs, setLogs] = useLocalStorage<HabitLog[]>("habits.logs", []);

  function addHabit(name: string, frequency: Habit["frequency"], targetPerWeek: number) {
    setHabits([
      ...habits,
      { id: crypto.randomUUID(), name, frequency, targetPerWeek, archived: false, createdAt: todayIso() },
    ]);
  }
  function archiveHabit(id: string) {
    setHabits(habits.map((h) => (h.id === id ? { ...h, archived: true } : h)));
  }
  function deleteHabit(id: string) {
    setHabits(habits.filter((h) => h.id !== id));
    setLogs(logs.filter((l) => l.habitId !== id));
  }

  function toggleToday(habitId: string) {
    const today = todayIso();
    const existing = logs.find((l) => l.habitId === habitId && l.date === today);
    if (existing) {
      setLogs(logs.filter((l) => l.id !== existing.id));
    } else {
      setLogs([...logs, { id: crypto.randomUUID(), habitId, date: today }]);
    }
  }

  const today = todayIso();
  const active = habits.filter((h) => !h.archived);
  const last7 = lastNDays(7);

  const perHabit = active.map((habit) => {
    const habitDates = logs.filter((l) => l.habitId === habit.id).map((l) => l.date);
    const doneToday = habitDates.includes(today);
    const completions7d = last7.filter((d) => habitDates.includes(d)).length;
    const streak = computeStreak(habitDates);
    return { habit, doneToday, completions7d, streak };
  });

  const doneTodayCount = perHabit.filter((p) => p.doneToday).length;
  const completionRate7d =
    active.length > 0
      ? (perHabit.reduce((sum, p) => sum + p.completions7d, 0) / (active.length * 7)) * 100
      : 0;

  return {
    habits: active,
    archivedHabits: habits.filter((h) => h.archived),
    logs,
    addHabit,
    archiveHabit,
    deleteHabit,
    toggleToday,
    stats: { perHabit, doneTodayCount, totalActive: active.length, completionRate7d },
  };
}
