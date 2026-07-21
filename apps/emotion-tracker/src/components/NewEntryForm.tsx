"use client";

import { useState } from "react";

interface Props {
  onSubmit: (situation: string) => void;
}

export default function NewEntryForm({ onSubmit }: Props) {
  const [situation, setSituation] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!situation.trim()) return;
    onSubmit(situation.trim());
    setSituation("");
  }

  const canSubmit = situation.trim().length >= 20;

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">What happened?</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe the situation and how it made you feel, in as much detail as you can. The AI will
          ask follow-up questions to help you understand what's actually going on before you decide
          what to do next.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          rows={8}
          autoFocus
          placeholder="e.g. My colleague took credit for my idea in the meeting and I felt furious. I keep replaying it and want to confront them tomorrow…"
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-500"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            {situation.length} characters
            {!canSubmit && situation.length > 0 && " · aim for at least a couple of sentences"}
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Start reflecting
          </button>
        </div>
      </form>
    </div>
  );
}
