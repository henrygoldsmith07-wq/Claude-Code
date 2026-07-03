"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { lastNDays, todayIso } from "@/lib/date";
import { computeStreak } from "@/lib/streak";
import type { StudySession } from "@/lib/types";

export function useStudy() {
  const [sessions, setSessions] = useLocalStorage<StudySession[]>("study.sessions", []);

  function addSession(subject: string, durationMin: number, focusRating: number, notes: string, date = todayIso()) {
    setSessions([...sessions, { id: crypto.randomUUID(), date, subject, durationMin, focusRating, notes }]);
  }
  function deleteSession(id: string) {
    setSessions(sessions.filter((s) => s.id !== id));
  }

  const last7 = lastNDays(7);
  const sessions7d = sessions.filter((s) => last7.includes(s.date));
  const minutesBySubject: Record<string, number> = {};
  for (const s of sessions7d) {
    minutesBySubject[s.subject] = (minutesBySubject[s.subject] ?? 0) + s.durationMin;
  }
  const totalMinutes7d = sessions7d.reduce((s, e) => s + e.durationMin, 0);
  const avgFocus7d =
    sessions7d.length > 0 ? sessions7d.reduce((s, e) => s + e.focusRating, 0) / sessions7d.length : 0;
  const streak = computeStreak([...new Set(sessions.map((s) => s.date))]);

  return {
    sessions,
    addSession,
    deleteSession,
    stats: { minutesBySubject, totalMinutes7d, avgFocus7d, streak },
  };
}
