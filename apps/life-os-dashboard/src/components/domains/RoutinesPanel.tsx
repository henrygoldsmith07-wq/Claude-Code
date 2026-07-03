"use client";

import { useState } from "react";
import { useRoutines } from "@/lib/domains/routines";
import EmptyState from "@/components/shared/EmptyState";
import ProgressBar from "@/components/shared/ProgressBar";
import { buttonClass, ghostButtonClass, inputClass } from "@/components/shared/formClasses";
import type { RoutineTime } from "@/lib/types";

export default function RoutinesPanel() {
  const { addRoutine, deleteRoutine, toggleStep, stats } = useRoutines();
  const [name, setName] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<RoutineTime>("morning");
  const [stepsText, setStepsText] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name.trim() || steps.length === 0) return;
    addRoutine(name.trim(), timeOfDay, steps);
    setName("");
    setStepsText("");
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Build morning, evening, or custom routines and check them off daily.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">New routine</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Routine name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} flex-1`}
              required
            />
            <select
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value as RoutineTime)}
              className={inputClass}
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <textarea
            placeholder="One step per line (e.g. Drink water, Stretch, Journal)"
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            className={`${inputClass} h-24`}
            required
          />
          <button type="submit" className={`${buttonClass} self-start`}>
            Create routine
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Today</h2>
        {stats.perRoutine.length === 0 ? (
          <EmptyState message="No routines yet. Create one above." />
        ) : (
          stats.perRoutine.map(({ routine, todayLog, pct, streak }) => (
            <div key={routine.id} className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {routine.name} <span className="text-xs text-zinc-500">({routine.timeOfDay})</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    streak {streak.current}d (best {streak.best}d)
                  </div>
                </div>
                <button onClick={() => deleteRoutine(routine.id)} className={ghostButtonClass}>
                  Delete
                </button>
              </div>
              <ProgressBar pct={pct} />
              <ul className="flex flex-col gap-1">
                {routine.steps.map((step, i) => {
                  const done = todayLog?.completedStepIndexes.includes(i) ?? false;
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <button
                        onClick={() => toggleStep(routine.id, i)}
                        className={`h-5 w-5 shrink-0 rounded border text-xs ${
                          done ? "border-teal-600 bg-teal-600 text-white" : "border-zinc-300 dark:border-zinc-700"
                        }`}
                        aria-label="Toggle step"
                      >
                        {done ? "✓" : ""}
                      </button>
                      <span className={done ? "text-zinc-400 line-through" : ""}>{step}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
