"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type { AudioOverview, AudioScriptLine } from "./types";

export function useAudioOverview() {
  const [elevenLabsKey, setElevenLabsKey] = useLocalStorage<string>("wjec-elevenlabs-key", "");
  const [overviews, setOverviews] = useLocalStorage<Record<string, AudioOverview>>(
    "wjec-audio-overviews",
    {},
  );

  const setScript = useCallback(
    (topicId: string, script: AudioScriptLine[]) => {
      setOverviews((prev) => ({ ...prev, [topicId]: { topicId, script, audioDataUrl: null } }));
    },
    [setOverviews],
  );

  const setAudio = useCallback(
    (topicId: string, audioDataUrl: string) => {
      setOverviews((prev) => {
        const existing = prev[topicId];
        if (!existing) return prev;
        return { ...prev, [topicId]: { ...existing, audioDataUrl } };
      });
    },
    [setOverviews],
  );

  return { elevenLabsKey, setElevenLabsKey, overviews, setScript, setAudio };
}
