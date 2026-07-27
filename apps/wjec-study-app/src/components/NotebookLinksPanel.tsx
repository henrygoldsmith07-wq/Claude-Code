"use client";

import { useState } from "react";

interface Props {
  linkedCount: number;
  onImport: (links: Record<string, string>) => void;
}

export default function NotebookLinksPanel({ linkedCount, onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleImport() {
    try {
      const parsed = JSON.parse(draft) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object of topicId -> notebook URL");
      }
      const links: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") links[key] = value;
      }
      onImport(links);
      setDraft("");
      setError(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="self-end text-xs text-ink3 hover:underline"
      >
        NotebookLM links: {linkedCount} topics linked — bulk import
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 self-end rounded-lg border border-line p-3 text-xs">
      <p className="text-ink2">
        Paste a JSON object mapping topic IDs to NotebookLM notebook URLs, e.g.{" "}
        <code>{`{"chemistry-1": "https://notebooklm.google.com/notebook/..."}`}</code>. Topic IDs
        are shown next to each topic below.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        placeholder='{"chemistry-1": "https://notebooklm.google.com/notebook/..."}'
        className="w-full rounded border border-line p-2 font-mono"
      />
      {error && <p className="text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleImport}
          className="rounded bg-accent px-3 py-1 text-onaccent"
        >
          Import
        </button>
        <button onClick={() => setOpen(false)} className="rounded px-3 py-1 hover:bg-surface2 dark:hover:bg-surface">
          Cancel
        </button>
      </div>
    </div>
  );
}
