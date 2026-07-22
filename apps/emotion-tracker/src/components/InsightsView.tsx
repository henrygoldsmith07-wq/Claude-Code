"use client";

import type { Entry } from "@/lib/types";

interface Props {
  entries: Entry[];
  onBack: () => void;
}

export default function InsightsView({ entries, onBack }: Props) {
  const completed = entries.filter((e) => e.status === "complete" && e.summary);

  const emotionMap = new Map<string, number>();
  for (const e of completed) {
    const emo = e.summary!.coreEmotion.trim();
    if (emo) emotionMap.set(emo, (emotionMap.get(emo) || 0) + 1);
  }
  const emotions = Array.from(emotionMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxEmotion = emotions[0]?.[1] || 1;

  const biasMap = new Map<string, number>();
  for (const e of completed) {
    for (const b of e.summary!.possibleBiases) {
      const t = b.type.trim();
      if (t) biasMap.set(t, (biasMap.get(t) || 0) + 1);
    }
  }
  const biases = Array.from(biasMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayCounts: { date: Date; count: number; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const count = completed.filter((e) => {
      const ed = new Date(e.createdAt);
      ed.setHours(0, 0, 0, 0);
      return ed.getTime() === d.getTime();
    }).length;
    dayCounts.push({
      date: d,
      count,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
    });
  }
  const maxDay = Math.max(...dayCounts.map((d) => d.count), 1);

  let streak = 0;
  const uniqueDays = new Set(
    completed.map((e) => {
      const d = new Date(e.createdAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }),
  );
  let check = new Date(today);
  while (uniqueDays.has(check.getTime())) {
    streak++;
    check.setDate(check.getDate() - 1);
  }
  if (streak === 0) {
    check = new Date(today);
    check.setDate(check.getDate() - 1);
    while (uniqueDays.has(check.getTime())) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6 animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Insights</h2>
          <p className="mt-0.5 text-xs text-muted">
            Patterns from your completed reflections
          </p>
        </div>
        <button
          onClick={onBack}
          className="rounded-xl border border-border bg-card px-4 py-1.5 text-sm transition-colors hover:bg-card-hover"
        >
          ← Back
        </button>
      </div>

      {completed.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-3xl opacity-70">📊</p>
          <p className="text-sm text-muted">
            Complete a few reflections to see patterns in your emotions and
            thinking.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Completed", value: completed.length },
              {
                label: "Current streak",
                value: (
                  <>
                    {streak}{" "}
                    <span className="text-base font-normal text-muted">
                      days
                    </span>
                  </>
                ),
              },
              { label: "Unique emotions", value: emotionMap.size },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {stat.label}
                </p>
                <p className="mt-1.5 text-3xl font-semibold tabular-nums">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Last 14 days
            </h3>
            <div className="flex h-24 items-end gap-1.5">
              {dayCounts.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-accent transition-all"
                    style={{
                      height: `${(d.count / maxDay) * 100}%`,
                      minHeight: d.count > 0 ? "4px" : "0",
                    }}
                    title={`${d.count} reflection${d.count !== 1 ? "s" : ""}`}
                  />
                  <span className="text-[10px] text-muted">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
              Most common core emotions
            </h3>
            <div className="flex flex-col gap-2.5">
              {emotions.map(([emo, count]) => (
                <div key={emo} className="flex items-center gap-3">
                  <div
                    className="w-32 shrink-0 truncate text-sm font-medium"
                    title={emo}
                  >
                    {emo}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${(count / maxEmotion) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-muted tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {biases.length > 0 && (
            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Biases Claude noticed most often
              </h3>
              <div className="flex flex-wrap gap-2">
                {biases.map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-full border border-amber-200/80 bg-amber-50/80 px-3 py-1 text-sm dark:border-amber-900/60 dark:bg-amber-950/40"
                  >
                    {type}{" "}
                    <span className="text-muted">×{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
