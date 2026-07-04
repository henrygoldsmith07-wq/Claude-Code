"use client";

import type { HeatmapDay } from "@/lib/stats";

interface Props {
  days: HeatmapDay[];
}

export default function Heatmap({ days }: Props) {
  return (
    <div className="grid grid-flow-col grid-rows-7 gap-1">
      {days.map((day) => (
        <div
          key={day.date}
          title={day.date}
          className={
            day.studied
              ? "h-3 w-3 rounded-sm bg-emerald-500"
              : "h-3 w-3 rounded-sm bg-zinc-200 dark:bg-zinc-800"
          }
        />
      ))}
    </div>
  );
}
