/**
 * Turning goals into numbers.
 *
 * A body goal sets the energy delta and the protein/fat priorities; dietary
 * patterns then cap, floor or reshape what's left. The result is a plain
 * {kcal, protein, carbs, fat} target that the diary measures against — and
 * that the user can overwrite at any point by switching to custom mode.
 */

import {
  ACTIVITY_LEVELS, DIET_PATTERNS, KCAL_PER_G, activityLevel, bodyGoal, dietPattern,
} from '../data/goals.js';
import { DEFAULT_TARGETS } from '../data/nutrients.js';
import { weekDates } from './kitchen.js';
import { caffeineLimitMg, isUnderEighteen, youthGoal, youthKcalFactor } from './youth.js';

const round = (n) => Math.round(n);
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------- Maintenance energy ---------- */

/**
 * Mifflin-St Jeor. Without a stated sex we take the midpoint of the two
 * constants rather than assuming one.
 */
export const bmr = ({ weightKg, heightCm, age, sex = 'unspecified' }) => {
  if (!weightKg || !heightCm || !age) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  return Math.max(0, round(base + offset));
};

/** BMR × activity — the calories that hold your weight steady. */
export const maintenanceFrom = (stats = {}) => {
  const base = bmr(stats);
  if (!base) return null;
  return round(base * activityLevel(stats.activity).factor);
};

/**
 * The maintenance figure to plan from: computed from body stats when they're
 * there, otherwise whatever the user typed in.
 */
export const resolveMaintenance = (state = {}) =>
  maintenanceFrom(state.body || {}) || Math.max(0, Number(state.maintenanceKcal) || 0) || null;

/* ---------- Macro targets ---------- */

const kcalOf = ({ protein = 0, carbs = 0, fat = 0 }) =>
  protein * KCAL_PER_G.protein + carbs * KCAL_PER_G.carbs + fat * KCAL_PER_G.fat;

/**
 * Fill the calories protein hasn't claimed with fat and carbs, honouring a
 * carb cap and a fat floor. Whatever a cap refuses, the other macro absorbs.
 */
const balance = (kcal, protein, { carbCap = Infinity, fatFloorPct = 0, fatPct = 0.3 }) => {
  const left = Math.max(0, kcal - protein * KCAL_PER_G.protein);
  // Fat takes its share of the day's energy, but never more than protein left.
  let fatKcal = Math.min(left, Math.max(kcal * fatFloorPct, kcal * fatPct));
  let carbs = (left - fatKcal) / KCAL_PER_G.carbs;

  // A carb cap hands the difference to fat.
  if (carbs > carbCap) {
    carbs = carbCap;
    fatKcal = left - carbs * KCAL_PER_G.carbs;
  }
  return { fat: Math.max(0, fatKcal / KCAL_PER_G.fat), carbs: Math.max(0, carbs) };
};

/**
 * Daily targets for a goal + diet combination.
 *
 * `maintenanceKcal` anchors everything; without one we fall back to the
 * calorie target already in play, so the split is still meaningful.
 */
export const computeTargets = ({
  goal = 'maintain',
  diets = [],
  maintenanceKcal = null,
  weightKg = null,
  fallbackKcal = DEFAULT_TARGETS.kcal,
  youth = false,
} = {}) => {
  // Under 18 a deficit goal falls back to maintenance, and no multiplier is
  // allowed to take the day below it — whatever the stored goal says.
  const g = bodyGoal(youth ? youthGoal(goal) : goal);
  const kcalFactor = youth ? youthKcalFactor(g.kcalFactor) : g.kcalFactor;
  const patterns = diets.map(dietPattern).filter(Boolean);

  const base = maintenanceKcal || fallbackKcal;
  const kcal = Math.max(1000, round(base * kcalFactor));

  // Protein: per kilo when we know the weight, otherwise a share of energy.
  let protein = weightKg ? weightKg * g.proteinPerKg : (kcal * g.proteinPct) / KCAL_PER_G.protein;
  for (const p of patterns) {
    if (p.proteinPerKgFloor && weightKg) protein = Math.max(protein, weightKg * p.proteinPerKgFloor);
    else if (p.proteinPctFloor) protein = Math.max(protein, (kcal * p.proteinPctFloor) / KCAL_PER_G.protein);
  }
  // Protein can't eat the whole budget — leave room for fat.
  protein = clamp(protein, 0, (kcal * 0.45) / KCAL_PER_G.protein);

  const carbCap = Math.min(...patterns.map((p) => p.carbCap ?? Infinity), Infinity);
  const fatFloorPct = Math.max(0, ...patterns.map((p) => p.fatFloorPct ?? 0));
  const fatPct = patterns.find((p) => p.fatPct)?.fatPct ?? g.fatPct;

  const { fat, carbs } = balance(kcal, protein, { carbCap, fatFloorPct, fatPct });

  return {
    kcal,
    protein: round(protein),
    carbs: round(carbs),
    fat: round(fat),
  };
};

/** Micronutrient targets a pattern genuinely implies (fibre, sugar, sat fat). */
export const dietTargetPatch = (diets = []) =>
  diets
    .map(dietPattern)
    .filter(Boolean)
    .reduce((acc, p) => ({ ...acc, ...(p.targetPatch || {}) }), {});

/**
 * Micronutrient limits that follow the person rather than the pattern: an
 * age-appropriate caffeine figure under 18, and no alcohol allowance at all.
 */
export const youthTargetPatch = (state) => ({
  caffeine: caffeineLimitMg({ age: state.body?.age ?? null, weightKg: state.body?.weightKg || null }),
  alcohol: 0,
});

/** The full target set to store: macros from the goal, micros from reference + diet. */
export const targetsFor = (state) => {
  const youth = isUnderEighteen(state);
  return {
    ...DEFAULT_TARGETS,
    ...dietTargetPatch(state.diets),
    ...computeTargets({
      goal: state.goal,
      diets: state.diets,
      maintenanceKcal: resolveMaintenance(state),
      weightKg: state.body?.weightKg || null,
      fallbackKcal: state.targets?.kcal || DEFAULT_TARGETS.kcal,
      youth,
    }),
    ...(youth ? youthTargetPatch(state) : {}),
  };
};

/** What the current macro split works out as, in calories and percentages. */
export const macroBreakdown = (targets) => {
  const total = kcalOf(targets) || 1;
  return ['protein', 'carbs', 'fat'].map((key) => ({
    key,
    grams: targets[key] || 0,
    kcal: round((targets[key] || 0) * KCAL_PER_G[key]),
    pct: Math.round(((targets[key] || 0) * KCAL_PER_G[key] * 100) / total),
  }));
};

/** How far a custom split drifts from its own calorie target. */
export const macroMismatch = (targets) => round(kcalOf(targets) - (targets.kcal || 0));

/* ---------- Weekly targets ---------- */

export const defaultWeeklyKcal = (dailyKcal) => round((dailyKcal || 0) * 7);

/**
 * The week as a budget rather than seven separate days: what you've eaten so
 * far, what's left, and what that leaves for the days still to come.
 */
export const weekProgress = (log = {}, { weeklyKcal, today }) => {
  const dates = weekDates(today);
  const days = dates.map((date) => ({
    date,
    kcal: (log[date] || []).reduce((sum, e) => {
      const per100 = e.per100;
      const value = per100 ? ((per100.kcal || 0) * (e.grams || 0)) / 100 : (e.nutrients?.kcal || 0);
      return sum + value;
    }, 0),
  })).map((d) => ({ ...d, kcal: round(d.kcal) }));

  const elapsed = dates.indexOf(today) + 1;
  const eaten = days.reduce((sum, d) => sum + d.kcal, 0);
  const left = round((weeklyKcal || 0) - eaten);
  const daysLeft = Math.max(0, 7 - elapsed);
  const loggedDays = days.filter((d) => d.kcal > 0).length;

  return {
    dates,
    days,
    eaten,
    left,
    elapsed,
    daysLeft,
    loggedDays,
    /** Spread what's left over the days that remain, today included. */
    perDayLeft: round(left / Math.max(1, daysLeft + (days[elapsed - 1]?.kcal ? 0 : 1))),
    pct: weeklyKcal ? Math.round((eaten / weeklyKcal) * 100) : 0,
    onTrack: weeklyKcal ? eaten <= (weeklyKcal / 7) * elapsed : true,
  };
};

/* ---------- Diet fit ---------- */

const textOf = (food) => `${food.name || ''} ${food.brand || ''} ${(food.tags || []).join(' ')}`;

/** Which of your patterns a food clashes with — named, so the UI can say why. */
export const dietConflicts = (food, diets = []) => {
  if (!food) return [];
  const text = textOf(food);
  return diets
    .map(dietPattern)
    .filter((p) => p && p.excludes && p.excludes.test(text))
    .map((p) => p.label);
};

/** Recipes are judged on their ingredients, plus the tags they carry. */
export const recipeConflicts = (recipe, diets = []) => {
  if (!recipe) return [];
  const text = `${recipe.name} ${recipe.tags.join(' ')} ${recipe.ingredients.map((i) => i.name).join(' ')}`;
  return diets
    .map(dietPattern)
    .filter((p) => {
      if (!p) return false;
      if (p.recipeTag) return !p.recipeTag(recipe);
      return p.excludes ? p.excludes.test(text) : false;
    })
    .map((p) => p.label);
};

export const recipeAllowed = (recipe, diets = []) => recipeConflicts(recipe, diets).length === 0;

/** Recipes that fit, best fit first when a pattern expresses a preference. */
export const filterByDiet = (recipes = [], diets = []) => {
  const allowed = recipes.filter((r) => recipeAllowed(r, diets));
  const prefs = diets.map(dietPattern).filter((p) => p && p.prefer);
  if (!prefs.length) return allowed;
  return [...allowed].sort((a, b) => {
    const score = (r) => prefs.filter((p) => p.prefer(r)).length - (prefs.some((p) => p.discourage?.test(r.ingredients.map((i) => i.name).join(' '))) ? 1 : 0);
    return score(b) - score(a);
  });
};

/** A one-line summary of the goal set, for headers and the coach. */
export const goalSummary = (state = {}) => {
  const { diets = [] } = state;
  const g = bodyGoal(isUnderEighteen(state) ? youthGoal(state.goal) : state.goal);
  const names = diets.map((d) => dietPattern(d)?.label).filter(Boolean);
  return names.length ? `${g.label} · ${names.join(' · ')}` : g.label;
};

export { ACTIVITY_LEVELS, DIET_PATTERNS };
