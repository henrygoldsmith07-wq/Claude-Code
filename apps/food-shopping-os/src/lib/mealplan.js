/**
 * The meal plan, read every way the app needs it.
 *
 * The plan itself is one small object — `{ 'YYYY-MM-DD': { breakfast, lunch,
 * dinner } }` of recipe ids. A week view, a month view, the cost of a range,
 * what to batch cook, what leftovers already cover and what is left to buy are
 * all derived here, so nothing is stored twice and a move is a pure function of
 * the plan you had.
 */

import { byId } from '../data/recipes.js';
import { MEAL_SLOTS } from '../data/plan.js';
import { itemsFromRecipes } from '../data/stores.js';
import { addDays, dayStamp, weekStart } from './kitchen.js';

export const SLOT_KEYS = MEAL_SLOTS.map((s) => s.key);

/* ---------- Calendar ---------- */

export const monthStart = (stamp = dayStamp()) => `${String(stamp).slice(0, 7)}-01`;

export const monthLabel = (stamp = dayStamp()) =>
  new Date(`${monthStart(stamp)}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

export const daysInMonth = (stamp = dayStamp()) => {
  const d = new Date(`${monthStart(stamp)}T12:00:00`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

/** Every date in the month containing `stamp`. */
export const monthDates = (stamp = dayStamp()) => {
  const start = monthStart(stamp);
  return Array.from({ length: daysInMonth(stamp) }, (_, i) => addDays(start, i));
};

/**
 * The month as a Monday-first grid, padded with the neighbouring days so every
 * row is a full week. Padding days are marked so the view can dim them.
 */
export const monthGrid = (stamp = dayStamp()) => {
  const first = weekStart(monthStart(stamp));
  const month = String(stamp).slice(0, 7);
  const weeks = Math.ceil((daysInMonth(stamp) + ((new Date(`${monthStart(stamp)}T12:00:00`).getDay() + 6) % 7)) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(first, i);
    return { date, inMonth: date.slice(0, 7) === month };
  });
};

export const shiftWeek = (stamp = dayStamp(), n = 0) => addDays(weekStart(stamp), n * 7);

export const shiftMonth = (stamp = dayStamp(), n = 0) => {
  const d = new Date(`${monthStart(stamp)}T12:00:00`);
  return dayStamp(new Date(d.getFullYear(), d.getMonth() + n, 1, 12));
};

export const isToday = (stamp, today = dayStamp()) => stamp === today;

/* ---------- Reading a plan ---------- */

/** Every filled slot across `dates`, in calendar then meal order. */
export const planEntries = (plan = {}, dates = []) =>
  dates.flatMap((date) =>
    SLOT_KEYS
      .filter((slot) => (plan[date] || {})[slot])
      .map((slot) => ({ date, slot, recipeId: plan[date][slot], recipe: byId(plan[date][slot]) }))
      .filter((e) => e.recipe));

const CALENDAR_TIMES = {
  breakfast: ['080000', '090000'],
  lunch: ['123000', '133000'],
  dinner: ['183000', '193000'],
};

const icsEscape = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const compactDate = (stamp) => String(stamp).replace(/-/g, '');

/** Export a selected week or month as portable calendar events. */
export const mealPlanIcs = (
  plan = {},
  dates = [],
  { now = new Date(), calendarName = 'Forq meal plan', timezone = 'Europe/London' } = {},
) => {
  const entries = planEntries(plan, dates);
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Le Studio//Forq//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    `X-WR-TIMEZONE:${timezone}`,
  ];
  entries.forEach(({ date, slot, recipe }) => {
    const [start, end] = CALENDAR_TIMES[slot] || CALENDAR_TIMES.dinner;
    const label = MEAL_SLOTS.find((meal) => meal.key === slot)?.label || slot;
    lines.push(
      'BEGIN:VEVENT',
      `UID:forq-${date}-${slot}@forq.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${timezone}:${compactDate(date)}T${start}`,
      `DTEND;TZID=${timezone}:${compactDate(date)}T${end}`,
      `SUMMARY:${icsEscape(`${label} · ${recipe.name}`)}`,
      `DESCRIPTION:${icsEscape(`${recipe.time} min · ${recipe.kcal} kcal · ${recipe.protein}g protein`)}`,
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return { text: `${lines.join('\r\n')}\r\n`, events: entries.length };
};

/** The distinct dishes in a range, each with how many slots it fills. */
export const planDishes = (plan = {}, dates = []) => {
  const counts = new Map();
  for (const entry of planEntries(plan, dates)) {
    const found = counts.get(entry.recipeId);
    if (found) found.slots.push(entry);
    else counts.set(entry.recipeId, { recipe: entry.recipe, slots: [entry] });
  }
  return [...counts.values()].sort((a, b) => b.slots.length - a.slots.length);
};

/** Cost, calories and coverage for a range — everything the header quotes. */
export const planStats = (plan = {}, dates = [], { people = 1 } = {}) => {
  const entries = planEntries(plan, dates);
  const cost = entries.reduce((sum, e) => sum + e.recipe.costPerServing * people, 0);
  const kcal = entries.reduce((sum, e) => sum + e.recipe.kcal, 0);
  const daysPlanned = new Set(entries.map((e) => e.date)).size;
  const slots = dates.length * SLOT_KEYS.length;
  return {
    meals: entries.length,
    cost: Math.round(cost * 100) / 100,
    kcal,
    kcalPerDay: daysPlanned ? Math.round(kcal / daysPlanned) : 0,
    daysPlanned,
    emptyDays: dates.length - daysPlanned,
    fill: slots ? Math.round((entries.length / slots) * 100) : 0,
    minutes: entries.reduce((sum, e) => sum + e.recipe.time, 0),
  };
};

/* ---------- Changing a plan ---------- */

const withSlot = (plan, date, slot, recipeId) => {
  const day = { ...(plan[date] || {}) };
  if (recipeId) day[slot] = recipeId;
  else delete day[slot];
  const next = { ...plan };
  if (Object.keys(day).length) next[date] = day;
  else delete next[date];
  return next;
};

/**
 * Drag a meal onto another slot. An occupied target swaps — dragging Tuesday's
 * dinner onto Thursday's puts Thursday's back on Tuesday, so nothing is ever
 * silently lost.
 */
export const moveMeal = (plan = {}, from, to) => {
  if (!from || !to) return plan;
  if (from.date === to.date && from.slot === to.slot) return plan;
  const moving = (plan[from.date] || {})[from.slot];
  if (!moving) return plan;
  const displaced = (plan[to.date] || {})[to.slot] || null;
  return withSlot(withSlot(plan, from.date, from.slot, displaced), to.date, to.slot, moving);
};

/** Same dish, second slot — used by "repeat this" and by leftovers. */
export const copyMealTo = (plan = {}, from, to) => {
  const recipeId = (plan[from.date] || {})[from.slot];
  return recipeId ? withSlot(plan, to.date, to.slot, recipeId) : plan;
};

export const clearDates = (plan = {}, dates = []) => {
  const next = { ...plan };
  for (const d of dates) delete next[d];
  return next;
};

/** Apply a generated plan: [{date, slot, recipeId}] in one pass. */
export const applyEntries = (plan = {}, entries = []) =>
  entries.reduce((acc, e) => (e.recipeId ? withSlot(acc, e.date, e.slot, e.recipeId) : acc), plan);

/* ---------- Leftovers ---------- */

export const LEFTOVER_CAT = 'Leftovers';
export const LEFTOVER_DAYS = 3;

export const leftoverItems = (pantry = []) => pantry.filter((p) => p.cat === LEFTOVER_CAT);

/** Portions of each dish sitting in the fridge, by recipe id. */
export const leftoverPortions = (pantry = []) => {
  const map = new Map();
  for (const item of leftoverItems(pantry)) {
    if (!item.recipeId) continue;
    map.set(item.recipeId, (map.get(item.recipeId) || 0) + (Number(item.portions) || 0));
  }
  return map;
};

/** A pantry item for portions you cooked but didn't eat. */
export const leftoverEntry = (recipe, portions, day = dayStamp()) => ({
  name: `${recipe.name} (leftovers)`,
  emoji: recipe.emoji,
  cat: LEFTOVER_CAT,
  location: 'Fridge',
  recipeId: recipe.id,
  portions: Math.max(1, Math.round(portions)),
  qty: `${Math.max(1, Math.round(portions))} portion${portions > 1 ? 's' : ''}`,
  cost: 0,
  expiry: addDays(day, LEFTOVER_DAYS),
  addedAt: day,
});

/**
 * Which planned meals the fridge already covers. Portions are spent in
 * calendar order, so the first two Tuesday-and-Thursday chillis are covered and
 * a third would still need shopping for.
 */
export const coveredByLeftovers = (plan = {}, dates = [], pantry = []) => {
  const left = new Map(leftoverPortions(pantry));
  const covered = [];
  for (const entry of planEntries(plan, dates)) {
    const have = left.get(entry.recipeId) || 0;
    if (have <= 0) continue;
    left.set(entry.recipeId, have - 1);
    covered.push(entry);
  }
  return covered;
};

/* ---------- Batch cooking ---------- */

/**
 * Dishes planned more than once in a range: cook them once, on the first day
 * they appear, and the rest of the week reheats.
 */
export const batchGroups = (plan = {}, dates = [], { people = 1 } = {}) =>
  planDishes(plan, dates)
    .filter((d) => d.slots.length > 1)
    .map(({ recipe, slots }) => ({
      recipe,
      cookOn: slots[0].date,
      covers: slots.slice(1),
      portions: slots.length * people,
      batches: Math.ceil((slots.length * people) / (recipe.servings || 1)),
      saves: Math.round(recipe.time * (slots.length - 1) * 0.75),
    }));

/* ---------- Shopping ---------- */

/**
 * The list for a range: every dish you haven't already got in the fridge as
 * leftovers, minus the ingredients your pantry already holds.
 */
export const shoppingForPlan = (plan = {}, dates = [], { pantry = [] } = {}) => {
  const coveredIds = coveredByLeftovers(plan, dates, pantry).map((e) => e.recipeId);
  const spend = [...coveredIds];
  const recipes = [];
  const seen = new Set();
  for (const entry of planEntries(plan, dates)) {
    const i = spend.indexOf(entry.recipeId);
    if (i >= 0) { spend.splice(i, 1); continue; } // a leftover portion covers it
    if (seen.has(entry.recipeId)) continue;
    seen.add(entry.recipeId);
    recipes.push(entry.recipe);
  }
  return itemsFromRecipes(recipes, pantry.map((p) => p.name));
};
