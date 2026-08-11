import { RECIPES } from '../data/recipes.js';
import { recipeAllowed } from './goals.js';
import { seasonScore } from '../data/seasons.js';
import { seededPick } from './utils.js';
import { tasteScore } from './taste.js';
import { canonicalName } from './aliases.js';

/* ---------- Equipment ---------- */

/** Appliance tags a dish needs beyond a normal hob/oven kitchen. */
export const EQUIPMENT_TAGS = ['air-fryer', 'slow-cooker'];

export const equipmentTags = (recipe) => (recipe?.tags || []).filter((tag) => EQUIPMENT_TAGS.includes(tag));

/**
 * A dish is cookable when it needs no special kit, or every appliance it names
 * is in the owned set. Never assumed — an untagged dish always fits.
 */
export const equipmentOk = (recipe, owned = []) => {
  if (!recipe) return false;
  const needed = equipmentTags(recipe);
  if (!needed.length) return true;
  return needed.every((tag) => owned.includes(tag));
};

/* ---------- Variety ---------- */

/**
 * A plan that avoids repeating dishes and ingredients where the pool allows,
 * then only wraps once everything has been used. Seeded so the same request
 * with the same seed still produces the same plan.
 */
export const varietyMeals = (pool, count, seed) => {
  const out = [];
  const usedIds = new Set();
  const usedIng = new Set();
  const remaining = [...pool];
  for (let i = 0; i < remaining.length; i += 1) {
    const j = (i + seed * 7) % remaining.length;
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  const keyOf = (r) => canonicalName(r.name);
  while (out.length < count && remaining.length) {
    const fresh = remaining.findIndex((r) => {
      if (usedIds.has(keyOf(r))) return false;
      const ings = (r.ingredients || []).map((i) => String(i.name || i).toLowerCase());
      return ings.filter((ing) => usedIng.has(ing)).length === 0;
    });
    const pick = fresh >= 0 ? remaining.splice(fresh, 1)[0] : remaining.shift();
    if (!pick) break;
    usedIds.add(keyOf(pick));
    (pick.ingredients || []).forEach((i) => usedIng.add(String(i.name || i).toLowerCase()));
    out.push(pick);
  }
  while (out.length < count) out.push(pool[out.length % pool.length]);
  return out;
};

/**
 * Plan generation. Hard constraints (your dietary patterns, budget, time and
 * body goal) must hold; soft preferences (occasion, what's in your pantry,
 * what's in season, family size) narrow the pool only while enough recipes
 * remain, so a preference never leaves you with nothing.
 *
 * Dietary exclusions are the same rules the rest of the app uses — one
 * definition of what "vegan" or "gluten-free" means, in `data/goals.js`.
 */
export const hardFilter = (recipes, { diets = [], goal = 'maintain', budget = 4, maxTime = null, equipment = null } = {}) =>
  recipes.filter((r) => {
    if (!recipeAllowed(r, diets)) return false;
    if ((goal === 'muscle' || goal === 'recomp') && r.protein < 20) return false;
    if (goal === 'lose' && r.kcal > 520) return false;
    if (r.costPerServing > budget) return false;
    if (maxTime && r.time > maxTime) return false;
    if (equipment && !equipmentOk(r, equipment)) return false;
    return true;
  });

/** How many of a dish's ingredients you already have. */
export const pantryHits = (recipe, pantryNames = []) => {
  if (!pantryNames.length) return 0;
  const have = pantryNames.map((n) => n.toLowerCase()).filter(Boolean);
  return recipe.ingredients.filter((i) => {
    const name = i.name.toLowerCase();
    return have.some((h) => h.includes(name) || name.includes(h));
  }).length;
};

const OCCASION_PREFS = {
  'Meal prep': (r) => r.tags.some((t) => ['batch', 'meal-prep', 'freezer'].includes(t)),
  'Date night': (r) => r.tags.includes('date-night'),
  Party: (r) => r.tags.includes('family') || r.tags.includes('quick'),
  BBQ: (r) => r.tags.includes('family'),
  Camping: (r) => r.tags.includes('one-pot') || r.tags.includes('quick'),
  Student: (r) => r.costPerServing <= 1.5,
};

/** Body goals express a preference beyond their hard cut-off. */
const GOAL_PREFS = {
  muscle: (r) => r.protein >= 30,
  recomp: (r) => r.protein >= 28,
  lose: (r) => r.kcal <= 450,
  gain: (r) => r.kcal >= 550,
};

/** Dishes worth cooking in bulk: they scale, keep, or reheat well. */
export const BATCH_TAGS = ['batch', 'freezer', 'one-pot', 'meal-prep'];
const batchable = (r) => r.servings >= 4 || r.tags.some((t) => BATCH_TAGS.includes(t));

export const scopeCount = (scope) =>
  (scope === '1 meal' ? 1 : scope === 'A day' ? 3 : scope === 'A month' ? 28 : 7);

/** Which meals a scope covers: a day is breakfast→dinner, longer runs are dinners. */
export const scopeMeals = (scope) =>
  (scope === 'A day' ? ['breakfast', 'lunch', 'dinner'] : ['dinner']);

/**
 * Build a plan of exactly `count` dishes. Returns { meals, note } where note
 * explains any compromise (relaxed constraints, repeated recipes, or a
 * deliberate batch-cooking repeat).
 *
 * `days` overrides the scope's count, so the month view can ask for however
 * many days that month actually has.
 */
export function buildPlan(
  {
    scope = 'A week', diets = [], goal, budget, maxTime, occasion = 'Everyday', people = 2,
    pantry = [], month = null, batch = false, days = null, recipes = RECIPES, taste = null,
    leftovers = [], equipment = null, expiry = [], variety = false,
  },
  seed,
) {
  const count = Math.max(1, days || scopeCount(scope));
  const slots = scopeMeals(scope);

  /** Preferences applied in order, each kept only while the pool stays usable. */
  const narrow = (pool, wanted) => {
    const prefs = [
      GOAL_PREFS[goal],
      OCCASION_PREFS[occasion],
      taste?.rated ? (r) => tasteScore(r, taste) > 0 : null,
      people >= 4 ? (r) => r.servings >= 4 : null,
      pantry.length ? (r) => pantryHits(r, pantry) >= 2 : null,
      // Dishes that use something about to go off are worth cooking first.
      expiry.length ? (r) => pantryHits(r, expiry) >= 1 : null,
      month ? (r) => seasonScore(r, month) >= 1 : null,
    ].filter(Boolean);
    let out = pool;
    for (const pref of prefs) {
      const narrowed = out.filter(pref);
      if (narrowed.length >= Math.min(wanted, 3)) out = narrowed;
    }
    return [...out].sort((a, b) => {
      const seasonal = month ? seasonScore(b, month) - seasonScore(a, month) : 0;
      const cost = (Number(a.costPerServing) || 0) - (Number(b.costPerServing) || 0);
      return seasonal * 4 + cost;
    });
  };

  // A day's plan takes one dish from each meal; everything else is dinners.
  if (slots.length > 1) {
    let relaxedDay = false;
    const picks = slots.map((meal, i) => {
      const forSlot = recipes.filter((r) => r.meal === meal);
      const mealPool = hardFilter(forSlot, { diets, goal, budget, maxTime, equipment });
      if (!mealPool.length) relaxedDay = true;
      const pool = mealPool.length ? narrow(mealPool, 1) : forSlot;
      return seededPick(pool, 1, seed + i * 17)[0];
    }).filter(Boolean);
    return {
      meals: picks,
      note: relaxedDay || picks.length < slots.length
        ? 'Nothing matched every filter — showing the closest fits instead.'
        : null,
    };
  }

  const dinners = recipes.filter((r) => r.meal === 'dinner');
  let pool = hardFilter(dinners, { diets, goal, budget, maxTime, equipment });
  let relaxed = false;
  if (pool.length === 0) {
    pool = hardFilter(dinners, { diets, goal, budget, maxTime });
    relaxed = true;
  }
  if (pool.length === 0) {
    pool = dinners;
    relaxed = true;
  }

  const leftoverMeals = leftovers
    .flatMap((item) => {
      const recipe = recipes.find((candidate) => candidate.id === item.recipeId);
      const portions = Math.max(0, Math.floor(Number(item.portions) || 0));
      return recipe && pool.some((candidate) => candidate.id === recipe.id)
        ? Array.from({ length: Math.min(portions, count) }, () => recipe)
        : [];
    })
    .slice(0, count);
  if (leftoverMeals.length) {
    const remaining = count - leftoverMeals.length;
    const ranked = narrow(
      pool.filter((recipe) => !leftoverMeals.some((item) => item.id === recipe.id)),
      remaining,
    );
    const fillPool = ranked.length ? ranked : pool;
    const unique = seededPick(fillPool, Math.min(remaining, fillPool.length), seed);
    const fill = Array.from({ length: remaining }, (_, index) => unique[index % unique.length]).filter(Boolean);
    return {
      meals: [...leftoverMeals, ...fill],
      note: `Leftover-first plan: ${leftoverMeals.length} meal${leftoverMeals.length === 1 ? '' : 's'} use portions already in the fridge; the rest favour seasonal, lower-cost dishes.`,
    };
  }

  // Batch mode asks for fewer dishes on purpose: cook once, eat three times.
  if (batch && count > 2) {
    const keepers = pool.filter(batchable);
    const batchPool = narrow(keepers.length >= 3 ? keepers : pool, 3);
    const cooks = Math.max(2, Math.round(count / 3));
    const unique = seededPick(batchPool, Math.min(cooks, batchPool.length), seed);
    if (unique.length) {
      const meals = Array.from({ length: count }, (_, i) => unique[Math.floor((i * unique.length) / count)]);
      const each = Math.round(count / unique.length);
      return {
        meals,
        note: relaxed
          ? 'Nothing matched every filter — showing the closest fits instead.'
          : `Batch plan: cook ${unique.length} dish${unique.length === 1 ? '' : 'es'}, each covering about ${each} meal${each === 1 ? '' : 's'}.`,
      };
    }
  }

  pool = narrow(pool, count);

  const unique = seededPick(pool, Math.min(count, pool.length), seed);
  const meals = variety
    ? varietyMeals(pool, count, seed)
    : Array.from({ length: count }, (_, i) => unique[i % unique.length]);

  const note = relaxed
    ? 'Nothing matched every filter — showing the closest fits instead.'
    : unique.length < count
      ? `Only ${unique.length} recipe${unique.length === 1 ? '' : 's'} match your filters, so the plan repeats them.`
      : variety && new Set(meals.map((m) => m.id)).size < count
        ? 'Variety on: dishes repeat only once the kitchen runs out of distinct options.'
        : null;
  return { meals, note };
}
