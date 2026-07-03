"use client";

import { useState } from "react";
import { useHabits } from "@/lib/domains/habits";
import StatCard from "@/components/shared/StatCard";
import EmptyState from "@/components/shared/EmptyState";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/shared/formClasses";
import type { HabitFrequency } from "@/lib/types";

export default function HabitsPanel() {
  const { addHabit, archiveHabit, deleteHabit, toggleToday, stats } = useHabits();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [targetPerWeek, setTargetPerWeek] = useState("7");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addHabit(name.trim(), frequency, Math.max(1, parseInt(targetPerWeek, 10) || 7));
    setName("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Build daily and weekly habits, and keep your streaks alive.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Done today" value={`${stats.doneTodayCount} / ${stats.totalActive}`} accent="good" />
        <StatCard label="7-day completion rate" value={`${stats.completionRate7d.toFixed(0)}%`} />
        <StatCard
          label="Best current streak"
          value={`${Math.max(0, ...stats.perHabit.map((p) => p.streak.current))} days`}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Add habit</h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Habit name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} flex-1`}
            required
          />
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
            className={inputClass}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <input
            type="number"
            min={1}
            max={7}
            value={targetPerWeek}
            onChange={(e) => setTargetPerWeek(e.target.value)}
            className={`${inputClass} w-20`}
            title="Target times per week"
          />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Habits</h2>
        {stats.perHabit.length === 0 ? (
          <EmptyState message="No habits yet. Add one above to start building a streak." />
        ) : (
          <ul className="flex flex-col gap-2">
            {stats.perHabit.map(({ habit, doneToday, completions7d, streak }) => (
              <li
                key={habit.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleToday(habit.id)}
                    className={`h-6 w-6 shrink-0 rounded-full border text-xs ${
                      doneToday
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-zinc-300 dark:border-zinc-700"
                    }`}
                    aria-label="Toggle today"
                  >
                    {doneToday ? "✓" : ""}
                  </button>
                  <div>
                    <div className="text-sm font-medium">{habit.name}</div>
                    <div className="text-xs text-zinc-500">
                      {completions7d}/7 this week · streak {streak.current}d (best {streak.best}d)
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => archiveHabit(habit.id)} className={ghostButtonClass}>
                    Archive
                  </button>
                  <button
                    onClick={() => deleteHabit(habit.id)}
                    className="text-zinc-400 hover:text-rose-500"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
