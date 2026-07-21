"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";

interface Props {
  entries: Entry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function EntryList({ entries, selectedId, onSelect, onDelete, onNew }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? entries.filter(
        (e) =>
          e.title.toLowerCase().includes(query.toLowerCase()) ||
          e.summary?.coreEmotion?.toLowerCase().includes(query.toLowerCase()) ||
          e.messages.some((m) => m.content.toLowerCase().includes(query.toLowerCase()))
      )
    : entries;

  function handleDelete(id: string, title: string) {
    if (window.confirm(`Delete reflection "${title}"? This cannot be undone.`)) {
      onDelete(id);
    }
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-zinc-200 dark:border-zinc-800 sm:w-72 sm:shrink-0">
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button
          onClick={onNew}
          className="w-full rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + New reflection
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reflections…"
          className="mt-2 w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">
            {entries.length === 0
              ? "No reflections yet. Start one above."
              : "No matches for your search."}
          </p>
        )}
        <ul>
          {filtered.map((entry) => (
            <li key={entry.id}>
              <div
                onClick={() => onSelect(entry.id)}
                className={`group flex cursor-pointer items-start justify-between gap-2 border-b border-zinc-100 px-3 py-3 text-sm dark:border-zinc-900 ${
                  entry.id === selectedId
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{entry.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {new Date(entry.createdAt).toLocaleDateString()} ·{" "}
                    {entry.status === "complete"
                      ? entry.summary?.coreEmotion ?? "complete"
                      : `in progress · ${entry.messages.length} msgs`}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(entry.id, entry.title);
                  }}
                  className="shrink-0 text-zinc-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
                  aria-label="Delete reflection"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
