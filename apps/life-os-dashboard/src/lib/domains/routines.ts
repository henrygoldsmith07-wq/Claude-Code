"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { todayIso } from "@/lib/date";
import { computeStreak } from "@/lib/streak";
import type { Routine, RoutineLog, RoutineTime } from "@/lib/types";

export function useRoutines() {
  const [routines, setRoutines] = useLocalStorage<Routine[]>("routines.list", []);
  const [logs, setLogs] = useLocalStorage<RoutineLog[]>("routines.logs", []);

  function addRoutine(name: string, timeOfDay: RoutineTime, steps: string[]) {
    setRoutines([...routines, { id: crypto.randomUUID(), name, timeOfDay, steps, createdAt: todayIso() }]);
  }
  function deleteRoutine(id: string) {
    setRoutines(routines.filter((r) => r.id !== id));
    setLogs(logs.filter((l) => l.routineId !== id));
  }

  function toggleStep(routineId: string, stepIndex: number) {
    const today = todayIso();
    const existing = logs.find((l) => l.routineId === routineId && l.date === today);
    if (!existing) {
      setLogs([...logs, { id: crypto.randomUUID(), routineId, date: today, completedStepIndexes: [stepIndex] }]);
      return;
    }
    const has = existing.completedStepIndexes.includes(stepIndex);
    const completedStepIndexes = has
      ? existing.completedStepIndexes.filter((i) => i !== stepIndex)
      : [...existing.completedStepIndexes, stepIndex];
    setLogs(logs.map((l) => (l.id === existing.id ? { ...l, completedStepIndexes } : l)));
  }

  const today = todayIso();
  const perRoutine = routines.map((routine) => {
    const todayLog = logs.find((l) => l.routineId === routine.id && l.date === today);
    const completedCount = todayLog?.completedStepIndexes.length ?? 0;
    const pct = routine.steps.length > 0 ? (completedCount / routine.steps.length) * 100 : 0;
    const fullyCompletedDates = logs
      .filter((l) => l.routineId === routine.id && l.completedStepIndexes.length === routine.steps.length)
      .map((l) => l.date);
    const streak = computeStreak(fullyCompletedDates);
    return { routine, todayLog, pct, streak };
  });

  return {
    routines,
    logs,
    addRoutine,
    deleteRoutine,
    toggleStep,
    stats: { perRoutine },
  };
}
