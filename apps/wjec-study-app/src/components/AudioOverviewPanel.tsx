"use client";

import { useState } from "react";
import { SUBJECTS, findSubject, topicsForSubject } from "@/lib/curriculum";
import { useAudioOverview } from "@/lib/useAudioOverview";
import type { SubjectId } from "@/lib/types";

interface Props {
  apiKey: string;
}

export default function AudioOverviewPanel({ apiKey }: Props) {
  const { elevenLabsKey, setElevenLabsKey, overviews, setScript, setAudio } = useAudioOverview();
  const [subjectId, setSubjectId] = useState<SubjectId>(SUBJECTS[0].id);
  const topics = topicsForSubject(subjectId);
  const [topicId, setTopicId] = useState(topics[0].id);
  const [keyDraft, setKeyDraft] = useState(elevenLabsKey);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overview = overviews[topicId];

  async function handleGenerateScript() {
    setError(null);
    setScriptLoading(true);
    try {
      const res = await fetch("/api/generate-audio-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate script");
      setScript(topicId, data.script);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate script");
    } finally {
      setScriptLoading(false);
    }
  }

  async function handleGenerateAudio() {
    if (!overview || !elevenLabsKey) return;
    setError(null);
    setAudioLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: overview.script, elevenLabsKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to synthesize audio");
      setAudio(topicId, `data:audio/mpeg;base64,${data.audioBase64}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to synthesize audio");
    } finally {
      setAudioLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="rounded-xl border border-zinc-300 bg-white p-4 text-xs dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Audio overviews use your own ElevenLabs API key for text-to-speech (stored only in this
          browser). Claude writes the two-host discussion script; ElevenLabs turns it into audio.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="ElevenLabs API key"
            className="flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            onClick={() => setElevenLabsKey(keyDraft)}
            className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
          >
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={subjectId}
          onChange={(e) => {
            const next = e.target.value as SubjectId;
            setSubjectId(next);
            setTopicId(topicsForSubject(next)[0].id);
          }}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="min-w-64 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium">{findSubject(subjectId)?.name} — {topics.find((t) => t.id === topicId)?.title}</p>

        {!overview ? (
          <button
            onClick={handleGenerateScript}
            disabled={scriptLoading}
            className="self-start rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {scriptLoading ? "Writing script…" : "Generate script"}
          </button>
        ) : (
          <>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
              {overview.script.map((line, i) => (
                <p key={i}>
                  <span className="font-medium">{line.speaker}: </span>
                  {line.line}
                </p>
              ))}
            </div>
            {overview.audioDataUrl ? (
              <audio controls src={overview.audioDataUrl} className="w-full" />
            ) : (
              <button
                onClick={handleGenerateAudio}
                disabled={audioLoading || !elevenLabsKey}
                title={!elevenLabsKey ? "Save an ElevenLabs API key first" : undefined}
                className="self-start rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
              >
                {audioLoading ? "Synthesizing…" : "Generate audio"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
