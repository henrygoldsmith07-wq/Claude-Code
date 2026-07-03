"use client";

import { useLocalStorage } from "@/lib/useLocalStorage";
import { todayIso } from "@/lib/date";
import type { HealthTargets, MealLog, MealType, WaterLog, WeightEntry } from "@/lib/types";

const DEFAULT_TARGETS: HealthTargets = { calories: 2200, proteinG: 140, waterMl: 2500 };

export function useHealth() {
  const [weights, setWeights] = useLocalStorage<WeightEntry[]>("health.weights", []);
  const [meals, setMeals] = useLocalStorage<MealLog[]>("health.meals", []);
  const [water, setWater] = useLocalStorage<WaterLog[]>("health.water", []);
  const [targets, setTargets] = useLocalStorage<HealthTargets>("health.targets", DEFAULT_TARGETS);

  function addWeight(weightKg: number, date = todayIso()) {
    setWeights([...weights.filter((w) => w.date !== date), { id: crypto.randomUUID(), date, weightKg }]);
  }
  function deleteWeight(id: string) {
    setWeights(weights.filter((w) => w.id !== id));
  }

  function addMeal(meal: Omit<MealLog, "id">) {
    setMeals([...meals, { ...meal, id: crypto.randomUUID() }]);
  }
  function deleteMeal(id: string) {
    setMeals(meals.filter((m) => m.id !== id));
  }

  function addWater(ml: number) {
    const today = todayIso();
    const existing = water.find((w) => w.date === today);
    if (existing) {
      setWater(water.map((w) => (w.id === existing.id ? { ...w, ml: w.ml + ml } : w)));
    } else {
      setWater([...water, { id: crypto.randomUUID(), date: today, ml }]);
    }
  }

  const today = todayIso();
  const todayMeals = meals.filter((m) => m.date === today);
  const todayCalories = todayMeals.reduce((s, m) => s + m.calories, 0);
  const todayProtein = todayMeals.reduce((s, m) => s + m.proteinG, 0);
  const todayWaterMl = water.find((w) => w.date === today)?.ml ?? 0;
  const latestWeight = [...weights].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

  const mealTypeOrder: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

  return {
    weights,
    meals,
    water,
    targets,
    setTargets,
    addWeight,
    deleteWeight,
    addMeal,
    deleteMeal,
    addWater,
    mealTypeOrder,
    stats: { todayCalories, todayProtein, todayWaterMl, latestWeight },
  };
}
