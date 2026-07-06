"use client";

import { SUBJECTS } from "@/lib/curriculum";
import { studyHeatmap } from "@/lib/stats";
import { formatDuration, totalMsByKind, totalMsBySubject, weeklyTrend } from "@/lib/timeLog";
import type { TimeSession } from "@/lib/types";
import Heatmap from "./Heatmap";

interface Props {
  studyDays: string[];
  sessions: TimeSession[];
}

export default function TimeAnalyticsPanel({ studyDays, sessions }: Props) {
  const bySubject = totalMsBySubject(sessions);
  const focusMs = totalMsByKind(sessions, "focus");
  const maxMs = Math.max(1, ...SUBJECTS.map((s) => bySubject[s.id] ?? 0));
  const { thisWeekMs, lastWeekMs } = weeklyTrend(sessions);
  const deltaMs = thisWeekMs - lastWeekMs;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium">This week vs last week</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-2xl font-semibold">{formatDuration(thisWeekMs)}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            last week {formatDuration(lastWeekMs)}
          </span>
          <span
            className={
              deltaMs >= 0
                ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                : "text-xs font-medium text-zinc-500 dark:text-zinc-400"
            }
          >
            {deltaMs >= 0 ? "▲" : "▼"} {formatDuration(Math.abs(deltaMs))}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Just a gentle trend — study time naturally ebbs and flows, so a quieter week isn&apos;t a
          failure.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium">Study activity (last 12 weeks)</p>
        <div className="mt-3 overflow-x-auto">
          <Heatmap days={studyHeatmap(studyDays)} />
        </div>
      </div>

      <div className="rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium">Time by subject</p>
        <div className="mt-3 flex flex-col gap-2">
          {SUBJECTS.map((s) => {
            const ms = bySubject[s.id] ?? 0;
            return (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0">{s.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${(ms / maxMs) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-zinc-500 dark:text-zinc-400">
                  {formatDuration(ms)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Total focus timer time logged: {formatDuration(focusMs)}
        </p>
      </div>
    </div>
  );
}
