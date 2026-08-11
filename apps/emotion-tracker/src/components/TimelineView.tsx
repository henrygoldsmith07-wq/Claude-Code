"use client";

import type { Entry } from "@/lib/types";

function toneFor(e: Entry): string {
  const v = e.longitudinalReview?.assumptionVerdict;
  if (v === "unsupported") return "border-emerald-500/30 bg-emerald-500/10";
  if (v === "supported") return "border-amber-500/30 bg-amber-500/10";
  if (v === "partial") return "border-sky-500/30 bg-sky-500/10";
  if (!e.summary) return "border-border bg-card";
  return "border-border bg-card";
}

export default function TimelineView({
  entries,
  onSelect,
}: {
  entries: Entry[];
  onSelect: (id: string) => void;
}) {
  const sorted = [...entries]
    .filter((e) => e.summary || e.status === "in_progress")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (sorted.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No reflections yet — your timeline will appear here.</p>;
  }

  // group by month
  const groups = new Map<string, Entry[]>();
  for (const e of sorted) {
    const key = e.createdAt.slice(0, 7);
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([month, list]) => (
        <div key={month}>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">{month}</h4>
          <div className="mt-2 flex flex-col gap-2 border-l border-border pl-4">
            {list.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(e.id)}
                className={`relative rounded-xl border px-3 py-2.5 text-left transition-colors hover:brightness-105 ${toneFor(e)}`}
              >
                <span className="absolute -left-[19px] top-3 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-muted">
                  <span>{new Date(e.createdAt).toLocaleDateString()}</span>
                  {e.summary?.coreEmotion && <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent">{e.summary.coreEmotion}</span>}
                  {e.longitudinalReview?.assumptionVerdict && (
                    <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-[10px]">{e.longitudinalReview.assumptionVerdict}</span>
                  )}
                  {e.status === "in_progress" && <span className="rounded-full bg-reviewsoft px-1.5 py-0.5 text-[10px] text-review">in progress</span>}
                </p>
                {e.summary?.trace.predictedOutcome && e.longitudinalReview?.actualOutcome && (
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-medium text-foreground">Predicted:</span> {e.summary.trace.predictedOutcome.slice(0, 80)} ·{" "}
                    <span className="font-medium text-foreground">Actual:</span> {e.longitudinalReview.actualOutcome.slice(0, 80)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
