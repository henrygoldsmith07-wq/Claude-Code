"use client";

import { useState } from "react";

interface Props {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export default function ApiKeyBar({ apiKey, onApiKeyChange }: Props) {
  const [draft, setDraft] = useState(apiKey);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-end text-xs text-zinc-500 hover:underline dark:text-zinc-400"
      >
        {apiKey ? "Anthropic API key set — edit" : "Set your Anthropic API key"}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 self-end rounded-lg border border-zinc-300 p-3 text-xs dark:border-zinc-700">
      <p className="text-zinc-600 dark:text-zinc-400">
        Used to generate flashcards and quizzes with Claude. Stored only in this browser&apos;s
        localStorage and sent directly to this app&apos;s own API routes. Leave blank to rely on
        the server&apos;s key, if one is configured.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-..."
          className="flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          onClick={() => {
            onApiKeyChange(draft);
            setOpen(false);
          }}
          className="rounded bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
        >
          Save
        </button>
      </div>
    </div>
  );
}
