"use client";

import { useState } from "react";
import { SUBJECTS, topicsForSubject } from "@/lib/curriculum";
import { recordChainFlashcardCompletionAction } from "@/lib/supabase/actions";
import type { ChainFlashcard, SubjectId } from "@/lib/types";
import ChainFlashcardSession from "./ChainFlashcardSession";

interface Props {
  apiKey: string;
}

export default function ChainFlashcardPanel({ apiKey }: Props) {
  const [subjectId, setSubjectId] = useState<SubjectId>(SUBJECTS[0].id);
  const topics = topicsForSubject(subjectId);
  const [topicId, setTopicId] = useState(topics[0].id);
  const [chain, setChain] = useState<ChainFlashcard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-chain-flashcard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate chain flashcard");
      setChain(data.chain);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate chain flashcard");
    } finally {
      setLoading(false);
    }
  }

  if (chain) {
    return (
      <ChainFlashcardSession
        chain={chain}
        onComplete={() => void recordChainFlashcardCompletionAction(chain.id)}
        onFinish={() => setChain(null)}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div>
        <p className="text-sm font-medium">Chained flashcards</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          For extended-response (6-mark style) questions: each answer leads into the next question, so
          you build the full answer yourself instead of reading it as one block.
        </p>
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

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="self-start rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
      >
        {loading ? "Generating…" : "Start a chained flashcard"}
      </button>
    </div>
  );
}
