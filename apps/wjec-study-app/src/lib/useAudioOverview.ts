"use client";

import { useCallback, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { saveAudioOverviewAction } from "./supabase/actions";
import type { AudioOverview, AudioScriptLine } from "./types";

export function useAudioOverview(initial: Record<string, AudioOverview>) {
  // The ElevenLabs key is a device-level secret the visitor pastes in, not
  // synced user data, so it stays in localStorage.
  const [elevenLabsKey, setElevenLabsKey] = useLocalStorage<string>("wjec-elevenlabs-key", "");
  const [overviews, setOverviews] = useState<Record<string, AudioOverview>>(initial);

  const setScript = useCallback((topicId: string, script: AudioScriptLine[]) => {
    setOverviews((prev) => ({ ...prev, [topicId]: { topicId, script, audioDataUrl: null } }));
  }, []);

  const setAudio = useCallback((topicId: string, audioDataUrl: string) => {
    setOverviews((prev) => {
      const existing = prev[topicId];
      if (!existing) return prev;
      return { ...prev, [topicId]: { ...existing, audioDataUrl } };
    });
    void saveAudioOverviewAction(topicId, audioDataUrl);
  }, []);

  return { elevenLabsKey, setElevenLabsKey, overviews, setScript, setAudio };
}
