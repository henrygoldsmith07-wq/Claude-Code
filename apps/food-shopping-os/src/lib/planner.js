import { RECIPES } from '../data/recipes.js';
import { seededPick } from './utils.js';

/**
 * Plan generation. Hard constraints (diet, budget, time, weight/muscle goals)
 * must hold; soft preferences (occasion, family/sustainable goals, group size)
 * narrow the pool only while enough recipes remain.
 */
const DAIRY = /(?<!coconut\s)milk|yogurt|cheese|parmesan|halloumi|butter|cream/i;
const GLUTEN = /pasta|pappardelle|bread|tortilla|panko|noodle|oat|croissant/i;
const ALCOHOL = /wine/i;

const usesIngredient = (r, re) => r.ingredients.some((i) => re.test(i.name));

export const hardFilter = (recipes, { diet = 'None', goal = 'Balanced', budget = 4, maxTime = null } = {}) =>
  recipes.filter((r) => {
    if (diet === 'Vegan' && !r.tags.includes('vegan')) return false;
    if (diet === 'Vegetarian' && !r.tags.includes('vegan') && !r.tags.includes('vegetarian')) return false;
    if (diet === 'Dairy-free' && usesIngredient(r, DAIRY)) return false;
    if (diet === 'Gluten-free' && usesIngredient(r, GLUTEN)) return false;
    if (diet === 'Halal' && usesIngredient(r, ALCOHOL)) return false;
    if (goal === 'Muscle gain' && r.protein < 20) return false;
    if (goal === 'Weight loss' && r.kcal > 520) return false;
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

const GOAL_PREFS = {
  'Family friendly': (r) => r.tags.includes('family'),
  Sustainable: (r) => r.envScore >= 80,
};

export const scopeCount = (scope) => (scope === '1 meal' ? 1 : scope === 'A day' ? 3 : 7);

/**
 * Build a plan of exactly `count` meals. Returns { meals, note } where note
 * explains any compromise (relaxed constraints or repeated recipes).
 */
export function buildPlan({ scope = 'A week', diet, goal, budget, maxTime, occasion = 'Everyday', people = 2 }, seed) {
  const count = scopeCount(scope);
  let pool = hardFilter(RECIPES, { diet, goal, budget, maxTime });
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
