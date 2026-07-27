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
        className="self-end text-xs text-ink3 hover:underline"
      >
        {apiKey ? "Anthropic API key set — edit" : "Set your Anthropic API key"}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 self-end rounded-lg border border-line p-3 text-xs">
      <p className="text-ink2">
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
          className="flex-1 rounded border border-line px-2 py-1"
        />
        <button
          onClick={() => {
            onApiKeyChange(draft);
            setOpen(false);
          }}
          className="rounded bg-accent px-3 py-1 text-onaccent"
        >
          Save
        </button>
      </div>
    </div>
  );
}
