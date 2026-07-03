"use client";

import { useState } from "react";
import { useSleep } from "@/lib/domains/sleep";
import StatCard from "@/components/shared/StatCard";
import Sparkline from "@/components/shared/Sparkline";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, inputClass } from "@/components/shared/formClasses";
import { todayIso } from "@/lib/date";

export default function SleepPanel() {
  const { entries, addEntry, deleteEntry, targetHours, stats } = useSleep();
  const [date, setDate] = useState(todayIso());
  const [bedTime, setBedTime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [quality, setQuality] = useState("3");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addEntry(date, bedTime, wakeTime, parseInt(quality, 10));
  }

  const points = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((e) => ({ label: e.date.slice(5), value: e.durationHours }));

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Log bedtime and wake time to track duration, quality, and sleep debt against an {targetHours}h target.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Last night" value={stats.lastNight ? `${stats.lastNight.durationHours}h` : "—"} />
        <StatCard label="7-day average" value={`${stats.avgDurationHours7d.toFixed(1)}h`} />
        <StatCard
          label="Sleep debt (7d)"
          value={`${stats.sleepDebtHours7d.toFixed(1)}h`}
          accent={stats.sleepDebtHours7d > 5 ? "warn" : "default"}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Duration trend (14 days)</h2>
        <Sparkline points={points} formatValue={(n) => `${n}h`} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Log sleep</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          <input
            type="time"
            value={bedTime}
            onChange={(e) => setBedTime(e.target.value)}
            className={inputClass}
            title="Bedtime"
          />
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className={inputClass}
            title="Wake time"
          />
          <select value={quality} onChange={(e) => setQuality(e.target.value)} className={inputClass}>
            {[1, 2, 3, 4, 5].map((q) => (
              <option key={q} value={q}>
                Quality {q}/5
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass}>
            Save
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">History</h2>
        {entries.length === 0 ? (
          <EmptyState message="No sleep logged yet." />
        ) : (
          <ul className="flex flex-col gap-1">
            {[...entries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 14)
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span>
                    {e.date} · {e.bedTime}–{e.wakeTime} · {e.durationHours}h · quality {e.quality}/5
                  </span>
                  <button onClick={() => deleteEntry(e.id)} className="text-zinc-400 hover:text-rose-500">
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
