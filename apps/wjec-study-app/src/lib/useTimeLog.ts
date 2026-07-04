"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { SessionKind, SubjectId, TimeSession } from "./types";

export function useTimeLog() {
  const [sessions, setSessions] = useLocalStorage<TimeSession[]>("wjec-time-sessions", []);

  const logSession = useCallback(
    (kind: SessionKind, subjectId: SubjectId | null, durationMs: number) => {
      if (durationMs <= 0) return;
      const session: TimeSession = {
        id: `session-${Date.now()}`,
        kind,
        subjectId,
        startedAt: new Date(Date.now() - durationMs).toISOString(),
        durationMs,
      };
      setSessions((prev) => [...prev, session]);
    },
    [setSessions],
  );

  return { sessions, logSession };
}
