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

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">What happened?</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe the situation and how it made you feel, in as much detail as you can. The AI will
          ask follow-up questions to help you understand what&apos;s actually going on before you decide
          what to do next.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          rows={8}
          placeholder="What happened, and how did it make you feel?"
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!situation.trim()}
          className="self-start rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Start reflecting
        </button>
      </form>
    </div>
  );
}
