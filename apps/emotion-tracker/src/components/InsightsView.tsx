"use client";

import type { Entry } from "@/lib/types";

interface Props {
  entries: Entry[];
  onBack: () => void;
}

export default function InsightsView({ entries, onBack }: Props) {
  const completed = entries.filter((e) => e.status === "complete" && e.summary);

  // Emotion frequency
  const emotionMap = new Map<string, number>();
  for (const e of completed) {
    const emo = e.summary!.coreEmotion.trim();
    if (emo) emotionMap.set(emo, (emotionMap.get(emo) || 0) + 1);
  }
  const emotions = Array.from(emotionMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxEmotion = emotions[0]?.[1] || 1;

  // Bias frequency
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

  // Activity last 14 days
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

  // Streak (consecutive days ending today or most recent)
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
  // If nothing today, count backward from yesterday
  if (streak === 0) {
    check = new Date(today);
    check.setDate(check.getDate() - 1);
    while (uniqueDays.has(check.getTime())) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Insights</h2>
        <button
          onClick={onBack}
          className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ← Back to reflections
        </button>
      </div>

      {completed.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Complete a few reflections to see patterns in your emotions and thinking.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Completed
              </p>
              <p className="mt-1 text-3xl font-semibold">{completed.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Current streak
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {streak}{" "}
                <span className="text-base font-normal text-zinc-500">days</span>
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Unique emotions
              </p>
              <p className="mt-1 text-3xl font-semibold">{emotionMap.size}</p>
            </div>
          </div>

          {/* Activity */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Last 14 days
            </h3>
            <div className="flex h-24 items-end gap-1.5">
              {dayCounts.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-indigo-500 transition-all dark:bg-indigo-400"
                    style={{
                      height: `${(d.count / maxDay) * 100}%`,
                      minHeight: d.count > 0 ? "4px" : "0",
                    }}
                    title={`${d.count} reflection${d.count !== 1 ? "s" : ""}`}
                  />
                  <span className="text-[10px] text-zinc-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top emotions */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Most common core emotions
            </h3>
            <div className="flex flex-col gap-2">
              {emotions.map(([emo, count]) => (
                <div key={emo} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 truncate text-sm font-medium" title={emo}>
                    {emo}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-violet-500 dark:bg-violet-400"
                      style={{ width: `${(count / maxEmotion) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-zinc-500">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top biases */}
          {biases.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Biases Claude noticed most often
              </h3>
              <div className="flex flex-wrap gap-2">
                {biases.map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm dark:border-amber-900 dark:bg-amber-950"
                  >
                    {type} <span className="text-zinc-500">×{count}</span>
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
