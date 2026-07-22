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
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-6 p-6 animate-fade-in">
      <div className="text-center sm:text-left">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-2xl">
          🪞
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">What happened?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Describe the situation and how it made you feel. Claude will ask a few
          careful questions to help you see what's actually underneath —
          before you decide what to do next.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          rows={7}
          placeholder="What happened, and how did it make you feel?"
          className="resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/20"
          autoFocus
        />
        <button
          type="submit"
          disabled={!situation.trim()}
          className="self-start rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          Start reflecting →
        </button>
      </form>

      <p className="text-center text-xs text-muted/70 sm:text-left">
        Private · stored only in this browser · no account needed
      </p>
    </div>
  );
}
