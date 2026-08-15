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
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <img src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" aria-hidden="true" />
        <div>
          <div className="text-sm font-semibold tracking-tight">Reflect</div>
          <div className="text-[10px] text-muted">Emotion · Insight · Clarity</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <button
          onClick={onNew}
          className="w-full rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          + New reflection
        </button>
        <button
          onClick={onInsights}
          className="w-full rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover"
        >
          📊 Insights
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && (
          <div className="p-5 text-center">
            <p className="text-sm text-muted">No reflections yet</p>
            <p className="mt-1 text-xs text-muted/70">
              Start one above to begin understanding what&apos;s underneath.
            </p>
          </div>
        )}
        <ul className="p-1.5">
          {entries.map((entry) => {
            const isSelected = entry.id === selectedId;
            const isComplete = entry.status === "complete";
            const emotion = entry.summary?.coreEmotion;
            const due = (() => {
              const d = entry.summary?.trace.followUpAt;
              if (!d || entry.longitudinalReview?.assumptionVerdict) return false;
              const dd = new Date(d);
              if (Number.isNaN(dd.getTime())) return false;
              const t = new Date(); t.setHours(0,0,0,0); dd.setHours(0,0,0,0);
              return dd.getTime() <= t.getTime();
            })();
            const verdict = entry.longitudinalReview?.assumptionVerdict ?? null;

            return (
              <li key={entry.id}>
                <div
                  onClick={() => onSelect(entry.id)}
                  className={`group flex cursor-pointer items-start justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    isSelected
                      ? "bg-accent/10 ring-1 ring-accent/30"
                      : "hover:bg-card-hover"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-snug">{entry.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-muted">
                        {new Date(entry.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {verdict ? (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${verdict === "unsupported" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : verdict === "supported" ? "border-amber-500/30 bg-amber-500/10 text-amber-700" : "border-border bg-card text-muted"}`}>
                          {verdict}
                        </span>
                      ) : due ? (
                        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">due: review</span>
                      ) : isComplete && emotion ? (
                        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          {emotion}
                        </span>
                      ) : (
                        <span className="rounded-full bg-reviewsoft px-1.5 py-0.5 text-[10px] font-medium text-review">
                          in progress
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(entry.id);
                    }}
                    className="shrink-0 rounded-md p-0.5 text-muted opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    aria-label="Delete reflection"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
