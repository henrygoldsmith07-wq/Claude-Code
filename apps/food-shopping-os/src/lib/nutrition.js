/**
 * Pure nutrition maths for the food diary.
 *
 * A log entry is either weight-based (`per100` + `grams`, so portions rescale
 * exactly) or a flat quick-add (`nutrients` only). Everything else in the app
 * — rings, meal subtotals, remaining-for-the-day — is derived from these two
 * shapes, so there is a single source of truth for "what did I eat today".
 */

export const MEALS = [
  { key: 'breakfast', label: 'Breakfast', from: 4, to: 10.5 },
  { key: 'lunch', label: 'Lunch', from: 10.5, to: 15 },
  { key: 'dinner', label: 'Dinner', from: 17, to: 22 },
  { key: 'snack', label: 'Snacks', from: 22, to: 4 },
];

export const MEAL_KEYS = MEALS.map((m) => m.key);
export const mealLabel = (key) => MEALS.find((m) => m.key === key)?.label || 'Snacks';

export const MACROS = ['kcal', 'protein', 'carbs', 'fat', 'fibre'];

const round = (v, dp = 1) => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Scale a per-100 g/ml profile to an arbitrary weight. */
export const scale = (per100, grams) => {
  const k = (Number(grams) || 0) / 100;
  return {
    kcal: Math.round((per100.kcal || 0) * k),
    protein: round((per100.protein || 0) * k),
    carbs: round((per100.carbs || 0) * k),
    fat: round((per100.fat || 0) * k),
    fibre: round((per100.fibre || 0) * k),
  };
};

export const EMPTY = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };

/** Nutrients for one entry, whichever shape it has. */
export const entryMacros = (entry) => {
  if (!entry) return { ...EMPTY };
  if (entry.per100) return scale(entry.per100, entry.grams);
  return { ...EMPTY, ...(entry.nutrients || {}) };
};

export const sumMacros = (entries = []) =>
  entries.reduce((acc, e) => {
    const m = entryMacros(e);
    for (const key of MACROS) acc[key] = round(acc[key] + (m[key] || 0));
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
  protein: round((goals.proteinGoal || 0) - (totals.protein || 0)),
  carbs: round((goals.carbsGoal || 0) - (totals.carbs || 0)),
  fat: round((goals.fatGoal || 0) - (totals.fat || 0)),
});

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
      kcal: Math.round(Number(kcal) || 0),
      protein: round(Number(protein) || 0),
      carbs: round(Number(carbs) || 0),
      fat: round(Number(fat) || 0),
      fibre: 0,
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

/** A recipe serving, logged like any other food. */
export const recipeAsFood = (recipe) => ({
  id: `recipe--${recipe.id}`,
  name: recipe.name,
  brand: 'Recipe',
  emoji: recipe.emoji,
  unit: 'g',
  source: 'recipe',
  tags: recipe.tags || [],
  per100: {
    kcal: Math.round((recipe.kcal / 350) * 100),
    protein: round((recipe.protein / 350) * 100),
    carbs: round((recipe.carbs / 350) * 100),
    fat: round((recipe.fat / 350) * 100),
    fibre: round(((recipe.fibre || 0) / 350) * 100),
  },
  // A serving is modelled as 350 g of plated food so portions scale sensibly.
  servings: [
    { label: '1 serving', grams: 350 },
    { label: 'Half serving', grams: 175 },
    { label: '1½ servings', grams: 525 },
  ],
});
