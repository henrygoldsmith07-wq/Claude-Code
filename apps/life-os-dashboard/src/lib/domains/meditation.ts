"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { lastNDays, todayIso } from "@/lib/date";
import { computeStreak } from "@/lib/streak";
import type { MeditationSession } from "@/lib/types";

export function useMeditation() {
  const [sessions, setSessions] = useLocalStorage<MeditationSession[]>("meditation.sessions", []);

  function addSession(type: string, durationMin: number, notes: string, date = todayIso()) {
    setSessions([...sessions, { id: crypto.randomUUID(), date, type, durationMin, notes }]);
  }
  function deleteSession(id: string) {
    setSessions(sessions.filter((s) => s.id !== id));
  }

  const last7 = lastNDays(7);
  const sessions7d = sessions.filter((s) => last7.includes(s.date));
  const totalMinutes7d = sessions7d.reduce((s, e) => s + e.durationMin, 0);
  const streak = computeStreak([...new Set(sessions.map((s) => s.date))]);
  const totalMinutesAllTime = sessions.reduce((s, e) => s + e.durationMin, 0);

  return {
    sessions,
    addSession,
    deleteSession,
    stats: { totalMinutes7d, streak, totalMinutesAllTime, sessionCount7d: sessions7d.length },
  };
}
