"use client";

import { useState } from "react";
import { useHealth } from "@/lib/domains/health";
import ProgressBar from "@/components/shared/ProgressBar";
import EmptyState from "@/components/shared/EmptyState";
import Sparkline from "@/components/shared/Sparkline";
import { buttonClass, inputClass } from "@/components/shared/formClasses";
import { todayIso } from "@/lib/date";
import type { MealType } from "@/lib/types";

export default function HealthPanel() {
  const { weights, meals, targets, addWeight, addMeal, deleteMeal, addWater, mealTypeOrder, stats } =
    useHealth();
  const [weightInput, setWeightInput] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [mealNotes, setMealNotes] = useState("");

  function handleAddMeal(e: React.FormEvent) {
    e.preventDefault();
    const cals = parseInt(calories, 10);
    const prot = parseInt(protein, 10) || 0;
    if (Number.isNaN(cals) || cals <= 0) return;
    addMeal({ date: todayIso(), mealType, calories: cals, proteinG: prot, notes: mealNotes.trim() });
    setCalories("");
    setProtein("");
    setMealNotes("");
  }

  const weightPoints = [...weights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map((w) => ({ label: w.date.slice(5), value: w.weightKg }));

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        Log meals, water, and weight against your daily targets.
      </p>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Calories today</div>
          <div className="text-lg font-semibold">
            {stats.todayCalories} / {targets.calories}
          </div>
          <ProgressBar pct={(stats.todayCalories / targets.calories) * 100} />
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Protein today (g)</div>
          <div className="text-lg font-semibold">
            {stats.todayProtein} / {targets.proteinG}
          </div>
          <ProgressBar pct={(stats.todayProtein / targets.proteinG) * 100} />
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">Water today (ml)</div>
          <div className="text-lg font-semibold">
            {stats.todayWaterMl} / {targets.waterMl}
          </div>
          <ProgressBar pct={(stats.todayWaterMl / targets.waterMl) * 100} colorClassName="bg-cyan-500" />
          <div className="mt-1 flex gap-1">
            {[250, 500].map((ml) => (
              <button key={ml} onClick={() => addWater(ml)} className={`${buttonClass} !bg-cyan-600 hover:!bg-cyan-700`}>
                +{ml}ml
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Log a meal</h2>
        <form onSubmit={handleAddMeal} className="flex flex-wrap gap-2">
          <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className={inputClass}>
            {mealTypeOrder.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Calories"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            className={`${inputClass} w-28`}
            required
          />
          <input
            type="number"
            placeholder="Protein (g)"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            className={`${inputClass} w-28`}
          />
          <input
            type="text"
            placeholder="Notes"
            value={mealNotes}
            onChange={(e) => setMealNotes(e.target.value)}
            className={`${inputClass} flex-1`}
          />
          <button type="submit" className={buttonClass}>
            Add
          </button>
        </form>
        {meals.filter((m) => m.date === todayIso()).length === 0 ? (
          <EmptyState message="No meals logged today." />
        ) : (
          <ul className="flex flex-col gap-1">
            {meals
              .filter((m) => m.date === todayIso())
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>
                    {m.mealType} — {m.calories} cal, {m.proteinG}g protein {m.notes && `· ${m.notes}`}
                  </span>
                  <button onClick={() => deleteMeal(m.id)} className="text-zinc-400 hover:text-rose-500">
                    ✕
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Weight trend</h2>
        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            placeholder="Weight (kg)"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className={`${inputClass} w-32`}
          />
          <button
            className={buttonClass}
            onClick={() => {
              const v = parseFloat(weightInput);
              if (!Number.isNaN(v)) {
                addWeight(v);
                setWeightInput("");
              }
            }}
          >
            Log today
          </button>
        </div>
        <Sparkline points={weightPoints} formatValue={(n) => `${n.toFixed(1)}kg`} />
      </section>
    </div>
  );
}
