import { RECIPES } from '../data/recipes.js';
import { recipeAllowed } from './goals.js';
import { seededPick } from './utils.js';

/**
 * Plan generation. Hard constraints (your dietary patterns, budget, time and
 * body goal) must hold; soft preferences (occasion, family/sustainable goals,
 * group size) narrow the pool only while enough recipes remain.
 *
 * Dietary exclusions are the same rules the rest of the app uses — one
 * definition of what "vegan" or "gluten-free" means, in `data/goals.js`.
 */
export const hardFilter = (recipes, { diets = [], goal = 'maintain', budget = 4, maxTime = null } = {}) =>
  recipes.filter((r) => {
    if (!recipeAllowed(r, diets)) return false;
    if ((goal === 'muscle' || goal === 'recomp') && r.protein < 20) return false;
    if (goal === 'lose' && r.kcal > 520) return false;
    if (r.costPerServing > budget) return false;
    if (maxTime && r.time > maxTime) return false;
    return true;
  });

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

export const scopeCount = (scope) => (scope === '1 meal' ? 1 : scope === 'A day' ? 3 : 7);

/**
 * Build a plan of exactly `count` meals. Returns { meals, note } where note
 * explains any compromise (relaxed constraints or repeated recipes).
 */
export function buildPlan({ scope = 'A week', diets = [], goal, budget, maxTime, occasion = 'Everyday', people = 2 }, seed) {
  const count = scopeCount(scope);
  let pool = hardFilter(RECIPES, { diets, goal, budget, maxTime });
  let relaxed = false;
  if (pool.length === 0) {
    pool = RECIPES;
    relaxed = true;
  }

  const prefs = [
    GOAL_PREFS[goal],
    OCCASION_PREFS[occasion],
    people >= 4 ? (r) => r.servings >= 4 : null,
  ].filter(Boolean);
  for (const pref of prefs) {
    const narrowed = pool.filter(pref);
    if (narrowed.length >= Math.min(count, 3)) pool = narrowed;
  }

  const unique = seededPick(pool, Math.min(count, pool.length), seed);
  const meals = Array.from({ length: count }, (_, i) => unique[i % unique.length]);

  const note = relaxed
    ? 'Nothing matched every filter — showing the closest fits instead.'
    : unique.length < count
      ? `Only ${unique.length} recipe${unique.length === 1 ? '' : 's'} match your filters, so the plan repeats them.`
      : null;
  return { meals, note };
}
