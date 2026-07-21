"use client";

import type { Entry } from "@/lib/types";

interface Props {
  entries: Entry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onInsights: () => void;
}

export default function EntryList({
  entries,
  selectedId,
  onSelect,
  onDelete,
  onNew,
  onInsights,
}: Props) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
        <button
          onClick={onNew}
          className="w-full rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          + New reflection
        </button>
        <button
          onClick={onInsights}
          className="w-full rounded-full border border-indigo-300 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
        >
          Insights
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && (
          <p className="p-4 text-sm text-zinc-500">No reflections yet. Start one above.</p>
        )}
        <ul>
          {entries.map((entry) => (
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
                      : "in progress"}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
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
