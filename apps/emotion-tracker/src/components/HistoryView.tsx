"use client";

import type { Entry } from "@/lib/types";

interface Props {
  entries: Entry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: (mode: "quick" | "full") => void;
}

function monthLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function isDue(entry: Entry): boolean {
  const date = entry.summary?.trace.followUpAt;
  if (!date || entry.longitudinalReview?.assumptionVerdict) return false;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return parsed.getTime() <= today.getTime();
}

export default function HistoryView({ entries, selectedId, onSelect, onDelete, onNew }: Props) {
  const sorted = entries.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const groups: { label: string; entries: Entry[] }[] = [];
  for (const entry of sorted) {
    const label = monthLabel(entry.createdAt);
    const group = groups.find((item) => item.label === label);
    if (group) group.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }

  return (
    <div className="mx-auto max-w-4xl p-5 sm:p-8 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Your record</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">History</h1>
          <p className="mt-1 text-sm text-muted">Every reflection, prediction and follow-up in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNew("quick")} className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-card-hover">+ Quick reflection</button>
          <button type="button" onClick={() => onNew("full")} className="rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover">+ Full reflection</button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <p className="text-sm font-medium">No history yet</p>
          <p className="mt-1 text-xs text-muted">Start a reflection and your record will build here.</p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.label} aria-labelledby={`history-${group.label}`}>
              <h2 id={`history-${group.label}`} className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">{group.label}</h2>
              <div className="flex flex-col gap-2">
                {group.entries.map((entry) => {
                  const selected = selectedId === entry.id;
                  const verdict = entry.longitudinalReview?.assumptionVerdict;
                  return (
                    <div key={entry.id} className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${selected ? "border-accent/40 bg-accent/5" : "border-border bg-card hover:bg-card-hover"}`}>
                      <button type="button" onClick={() => onSelect(entry.id)} className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{entry.title}</p>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">{entry.mode === "quick" ? "quick" : "full"}</span>
                          {entry.status === "in_progress" && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700">in progress</span>}
                          {isDue(entry) && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700">follow-up due</span>}
                          {verdict && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700">{verdict}</span>}
                        </div>
                        <p className="mt-1 text-xs text-muted">{new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{entry.summary?.coreEmotion ? ` · ${entry.summary.coreEmotion}` : ""}</p>
                        {entry.summary?.trace.predictedOutcome && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-foreground/80"><span className="font-medium">Prediction:</span> {entry.summary.trace.predictedOutcome}</p>}
                        {entry.longitudinalReview?.actualOutcome && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted"><span className="font-medium text-foreground/80">Actual:</span> {entry.longitudinalReview.actualOutcome}</p>}
                      </button>
                      <button type="button" onClick={() => onDelete(entry.id)} className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted opacity-60 hover:bg-dangersoft hover:text-danger sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Delete ${entry.title}`}>×</button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
