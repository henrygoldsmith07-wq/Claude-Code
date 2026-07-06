import type { SessionKind, TimeSession } from "./types";

export function totalMsByKind(sessions: TimeSession[], kind: SessionKind): number {
  return sessions.filter((s) => s.kind === kind).reduce((sum, s) => sum + s.durationMs, 0);
}

export function totalMsBySubject(sessions: TimeSession[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.subjectId) continue;
    map[s.subjectId] = (map[s.subjectId] ?? 0) + s.durationMs;
  }
  return map;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// Total study time in the last 7 days versus the 7 days before that, so the
// analytics can encourage honest week-on-week trends rather than punishing
// broken streaks.
export function weeklyTrend(sessions: TimeSession[], now = Date.now()): {
  thisWeekMs: number;
  lastWeekMs: number;
} {
  const day = 86400000;
  const thisWeekStart = now - 7 * day;
  const lastWeekStart = now - 14 * day;
  let thisWeekMs = 0;
  let lastWeekMs = 0;
  for (const s of sessions) {
    const t = new Date(s.startedAt).getTime();
    if (t >= thisWeekStart) thisWeekMs += s.durationMs;
    else if (t >= lastWeekStart) lastWeekMs += s.durationMs;
  }
  return { thisWeekMs, lastWeekMs };
}
