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
