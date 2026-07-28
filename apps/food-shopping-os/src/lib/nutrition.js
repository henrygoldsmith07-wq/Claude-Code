/**
 * Pure nutrition maths for the food diary.
 *
 * A log entry is either weight-based (`per100` + `grams`, so portions rescale
 * exactly) or a flat quick-add (`nutrients` only). Everything else in the app
 * — rings, meal subtotals, remaining-for-the-day — is derived from these two
 * shapes, so there is a single source of truth for "what did I eat today".
 *
 * All 24 tracked nutrients flow through the same scaling and summing, so
 * magnesium behaves exactly like calories: one number per 100 g, multiplied
 * by the portion.
 */

import { ALCOHOL_UNIT_G, GLASS_ML, NUTRIENTS, NUTRIENT_KEYS } from '../data/nutrients.js';

export const MEALS = [
  { key: 'breakfast', label: 'Breakfast', from: 4, to: 10.5 },
  { key: 'lunch', label: 'Lunch', from: 10.5, to: 15 },
  { key: 'dinner', label: 'Dinner', from: 17, to: 22 },
  { key: 'snack', label: 'Snacks', from: 22, to: 4 },
];

export const MEAL_KEYS = MEALS.map((m) => m.key);
export const mealLabel = (key) => MEALS.find((m) => m.key === key)?.label || 'Snacks';

/** Everything tracked, energy and micronutrients alike. */
export const MACROS = NUTRIENT_KEYS;

const round = (v, dp = 2) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Scale a per-100 g/ml profile to an arbitrary weight — all 24 nutrients. */
export const scale = (per100, grams) => {
  const k = (Number(grams) || 0) / 100;
  const out = {};
  for (const key of NUTRIENT_KEYS) out[key] = round((per100[key] || 0) * k, key === 'transFat' ? 3 : 2);
  out.kcal = Math.round((per100.kcal || 0) * k);
  return out;
};

export const EMPTY = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, 0]));

/** Nutrients for one entry, whichever shape it has. */
export const entryMacros = (entry) => {
  if (!entry) return { ...EMPTY };
  if (entry.per100) return scale(entry.per100, entry.grams);
  return { ...EMPTY, ...(entry.nutrients || {}) };
};

export const sumMacros = (entries = []) =>
  entries.reduce((acc, e) => {
    const m = entryMacros(e);
    for (const key of NUTRIENT_KEYS) acc[key] = round(acc[key] + (m[key] || 0));
    acc.kcal = Math.round(acc.kcal);
    return acc;
  }, { ...EMPTY });

/** Totals for a whole day, plus a per-meal breakdown. */
export const dayTotals = (entries = []) => ({
  ...sumMacros(entries),
  byMeal: Object.fromEntries(MEAL_KEYS.map((k) => [k, sumMacros(entries.filter((e) => e.meal === k))])),
});

export const remaining = (totals, goals) => ({
  kcal: Math.round((goals.kcalGoal || 0) - (totals.kcal || 0)),
  protein: round((goals.proteinGoal || 0) - (totals.protein || 0), 1),
  carbs: round((goals.carbsGoal || 0) - (totals.carbs || 0), 1),
  fat: round((goals.fatGoal || 0) - (totals.fat || 0), 1),
});

/* ---------- Full nutrient reporting ---------- */

/**
 * Every tracked nutrient against its target, ready to render: goals read as
 * progress towards, limits read as headroom left.
 */
export const nutrientRows = (totals, targets = {}, group) =>
  NUTRIENTS
    .filter((n) => !group || n.group === group)
    .map((n) => {
      const target = targets[n.key] ?? n.target;
      const value = totals[n.key] || 0;
      const pct = target ? Math.round((value / target) * 100) : 0;
      const tone = n.kind === 'limit'
        ? (pct > 100 ? 'danger' : pct >= 80 ? 'warn' : 'good')
        : (pct >= 100 ? 'good' : pct >= 60 ? 'muted' : 'faint');
      return { ...n, target, value, pct, tone };
    });

/* Energy macros are budgets, not deficiencies — being under them mid-afternoon
   is normal, so they never show up as "running low". */
const NOT_A_DEFICIENCY = new Set(['kcal', 'carbs', 'fat']);

/** How much of the day is short on a goal, or over a limit. */
export const nutrientAlerts = (totals, targets = {}) => {
  const rows = nutrientRows(totals, targets);
  return {
    over: rows.filter((r) => r.kind === 'limit' && r.pct > 100),
    low: rows.filter((r) => r.kind === 'goal' && !NOT_A_DEFICIENCY.has(r.key) && r.pct < 50),
    hit: rows.filter((r) => r.kind === 'goal' && r.pct >= 100),
  };
};

/**
 * Micronutrients only exist for entries logged against a real food, so say
 * plainly how much of the day's energy carries a full profile.
 */
export const nutrientCoverage = (entries = []) => {
  const total = sumMacros(entries).kcal;
  if (!total) return { pct: 100, kcal: 0, total: 0 };
  const covered = sumMacros(entries.filter((e) => e.per100 && e.per100.sodium !== undefined)).kcal;
  return { pct: Math.round((covered / total) * 100), kcal: covered, total };
};

/** Glasses ticked off plus the water in everything logged. */
export const hydration = (totals, glasses = 0) => {
  const fromDrinks = Math.round(totals.water || 0);
  const fromGlasses = glasses * GLASS_ML;
  return { fromDrinks, fromGlasses, total: fromDrinks + fromGlasses };
};

export const alcoholUnits = (grams = 0) => Math.round((grams / ALCOHOL_UNIT_G) * 10) / 10;

/** UK labels often show salt while the nutrient data stores sodium. */
export const saltEquivalent = (sodiumMg = 0) =>
  Math.round(((Number(sodiumMg) || 0) * 2.5 / 1000) * 10) / 10;

/** Which meal a log lands in when the clock decides. */
export const mealForTime = (date = new Date()) => {
  const h = date.getHours() + date.getMinutes() / 60;
  for (const m of MEALS) {
    if (m.key === 'snack') continue;
    if (h >= m.from && h < m.to) return m.key;
  }
  return 'snack';
};

export const timeStamp = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const minutesOf = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const byTime = (a, b) => minutesOf(a.time) - minutesOf(b.time);

/**
 * Meal-timing insight for a day: first and last bite, the eating window
 * between them, and how much of the day's energy landed after 8pm.
 */
export const timingInsight = (entries = [], lateFrom = 20) => {
  if (!entries.length) return null;
  const sorted = [...entries].sort(byTime);
  const first = sorted[0].time;
  const last = sorted[sorted.length - 1].time;
  const windowMins = Math.max(0, minutesOf(last) - minutesOf(first));
  const total = sumMacros(entries).kcal;
  const lateKcal = sumMacros(sorted.filter((e) => minutesOf(e.time) >= lateFrom * 60)).kcal;
  const gaps = sorted.slice(1).map((e, i) => minutesOf(e.time) - minutesOf(sorted[i].time));
  return {
    first,
    last,
    windowMins,
    windowLabel: `${Math.floor(windowMins / 60)}h ${windowMins % 60}m`,
    lateKcal,
    latePct: total ? Math.round((lateKcal / total) * 100) : 0,
    longestGapMins: gaps.length ? Math.max(...gaps) : 0,
  };
};

/** Snack-only view: how many, how much, and when. */
export const snackSummary = (entries = []) => {
  const snacks = entries.filter((e) => e.meal === 'snack');
  const totals = sumMacros(snacks);
  return {
    count: snacks.length,
    ...totals,
    pctOfDay: (() => {
      const day = sumMacros(entries).kcal;
      return day ? Math.round((totals.kcal / day) * 100) : 0;
    })(),
  };
};

/**
 * Portion choices for a food: its own serving sizes, a flat 100 g/ml, and
 * whatever weight the user has already dialled in.
 */
export const servingOptions = (food, grams) => {
  const base = [...(food?.servings || [])];
  const unit = food?.unit || 'g';
  if (!base.some((o) => o.grams === 100)) base.push({ label: `100 ${unit}`, grams: 100 });
  if (grams && !base.some((o) => Math.abs(o.grams - grams) < 0.01)) {
    base.push({ label: `${round(grams)} ${unit}`, grams, custom: true });
  }
  return base;
};

export const defaultServing = (food) => food?.servings?.[0] || { label: '100 g', grams: 100 };

/** Build a log entry from a catalogue food. */
export const buildEntry = (food, { grams, meal, time, servingLabel, source, qty = 1 } = {}) => {
  const serving = defaultServing(food);
  const weight = grams ?? serving.grams * qty;
  const now = new Date();
  return {
    id: `e${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    foodId: food.id,
    name: food.name,
    brand: food.brand || null,
    emoji: food.emoji,
    unit: food.unit || 'g',
    grams: round(weight, 1),
    servingLabel: servingLabel ?? (qty === 1 ? serving.label : `${qty} × ${serving.label}`),
    per100: food.per100,
    meal: meal || mealForTime(now),
    time: time || timeStamp(now),
    source: source || 'search',
  };
};

/** Quick-add: calories (and optional macros) with no food behind them. */
export const buildQuickEntry = ({ kcal, protein = 0, carbs = 0, fat = 0, meal, time, label } = {}) => {
  const now = new Date();
  return {
    id: `q${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    foodId: null,
    name: label || 'Quick add',
    brand: null,
    emoji: '⚡',
    unit: null,
    grams: null,
    servingLabel: 'Estimated',
    per100: null,
    nutrients: {
      ...EMPTY,
      kcal: Math.round(Number(kcal) || 0),
      protein: round(Number(protein) || 0, 1),
      carbs: round(Number(carbs) || 0, 1),
      fat: round(Number(fat) || 0, 1),
    },
    meal: meal || mealForTime(now),
    time: time || timeStamp(now),
    source: 'quick',
  };
};

/** Copy entries onto another day/meal — new ids, kept portions. */
export const copyEntries = (entries = [], { meal, time } = {}) =>
  entries.map((e, i) => ({
    ...e,
    id: `c${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 6)}`,
    meal: meal || e.meal,
    time: time || e.time,
    source: 'copy',
  }));

/**
 * A recipe serving, logged like any other food. `micros` (estimated from the
 * ingredient list — see `estimateRecipeMicros`) fills in everything a recipe
 * card doesn't print.
 */
export const recipeAsFood = (recipe, micros = null) => ({
  id: `recipe--${recipe.id}`,
  name: recipe.name,
  brand: 'Recipe',
  emoji: recipe.emoji,
  unit: 'g',
  source: 'recipe',
  tags: recipe.tags || [],
  per100: {
    ...(micros || {}),
    kcal: Math.round((recipe.kcal / 350) * 100),
    protein: round((recipe.protein / 350) * 100, 1),
    carbs: round((recipe.carbs / 350) * 100, 1),
    fat: round((recipe.fat / 350) * 100, 1),
    fibre: round(((recipe.fibre || 0) / 350) * 100, 1),
  },
  // A serving is modelled as 350 g of plated food so portions scale sensibly.
  servings: [
    { label: '1 serving', grams: 350 },
    { label: 'Half serving', grams: 175 },
    { label: '1½ servings', grams: 525 },
  ],
});
