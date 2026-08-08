"use client";

import { useState } from "react";

type Props = {
  onCapture: (text: string) => Promise<void>;
};

export default function CaptureBar({ onCapture }: Props) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setText("");
    await onCapture(trimmed);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did you just notice needs doing?"
        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        maxLength={280}
      />
      <button
        type="submit"
        disabled={!text.trim() || submitting}
        className="rounded-md bg-zinc-900 px-4 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Log it
      </button>
    </form>
  );
}
