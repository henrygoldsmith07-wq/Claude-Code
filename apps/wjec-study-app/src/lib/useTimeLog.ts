"use client";

import { useCallback, useState } from "react";
import { logTimeSessionAction } from "./supabase/actions";
import type { SessionKind, SubjectId, TimeSession } from "./types";

export function useTimeLog(initial: TimeSession[]) {
  const [sessions, setSessions] = useState<TimeSession[]>(initial);

  const logSession = useCallback(
    (kind: SessionKind, subjectId: SubjectId | null, durationMs: number) => {
      if (durationMs <= 0) return;
      const session: TimeSession = {
        id: `local-${Date.now()}`,
        kind,
        subjectId,
        startedAt: new Date(Date.now() - durationMs).toISOString(),
        durationMs,
      };
      setSessions((prev) => [...prev, session]);
      void logTimeSessionAction(kind, subjectId, durationMs);
    },
    [],
  );

  return { sessions, logSession };
}
