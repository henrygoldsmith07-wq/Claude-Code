/**
 * Applying who you are to what the app offers you.
 *
 * Two strengths of filter, deliberately not the same thing:
 *
 * - **Blocked** — an allergen or an observed religious rule. The recipe is
 *   removed. It doesn't get ranked down, it doesn't appear greyed out with a
 *   warning you might tap through; it isn't offered.
 * - **Flagged** — an intolerance. The amount is the point and only you know
 *   your threshold, so the recipe stays and says what's in it.
 *
 * Everything below matches the words in an ingredient list. That is a real
 * filter and it is not a guarantee, which is what `MATCH_CAVEAT` says on every
 * surface that uses this.
 */

import {
  allergenBy, intoleranceBy, religiousBy, skillBy, timeBudgetBy,
} from '../data/preferences.js';

const textOf = (recipe) => [
  recipe?.name,
  ...(recipe?.ingredients || []).map((i) => (typeof i === 'string' ? i : i.name)),
].filter(Boolean).join(' ');

const hits = (recipe, ids, table) => {
  const text = textOf(recipe);
  return ids
    .map((id) => table[id])
    .filter((rule) => rule && rule.match.test(text))
    .map((rule) => ({ id: rule.id, label: rule.label }));
};

/** Which of your allergens this recipe's ingredients name. */
export const allergenHits = (recipe, allergies = []) => hits(recipe, allergies, allergenBy);

/** Which of your intolerances it names — a flag, not a block. */
export const intoleranceHits = (recipe, intolerances = []) => hits(recipe, intolerances, intoleranceBy);

/** Which observed rule it breaks. */
export const religiousHits = (recipe, diets = []) => hits(recipe, diets, religiousBy);

/**
 * The hard lines: allergens and religious rules together. A recipe with any of
 * these is not shown, so this is the one function the filters must agree on.
 */
export const blockedBy = (recipe, prefs = {}) => [
  ...allergenHits(recipe, prefs.allergies),
  ...religiousHits(recipe, prefs.religious),
];

export const isBlocked = (recipe, prefs = {}) => blockedBy(recipe, prefs).length > 0;

/** Everything worth saying about a recipe and your preferences, in one pass. */
export const recipeFit = (recipe, prefs = {}) => {
  const blocked = blockedBy(recipe, prefs);
  const flagged = intoleranceHits(recipe, prefs.intolerances);
  const skill = skillBy[prefs.skill];
  const budget = timeBudgetBy[prefs.timeBudget];
  const steps = recipe?.steps?.length || 0;
  const minutes = Number(recipe?.time) || 0;
  return {
    blocked,
    flagged,
    tooLong: Boolean(budget && minutes > budget.minutes),
    tooFiddly: Boolean(skill && steps > skill.maxSteps),
    favouriteCuisine: Boolean(recipe?.cuisine && (prefs.cuisines || []).includes(recipe.cuisine)),
  };
};

/** Recipes you could actually be offered. Blocked ones never come back. */
export const allowedByPrefs = (recipes = [], prefs = {}) => recipes.filter((r) => !isBlocked(r, prefs));

/**
 * Rank what's left: your cuisines first, then what fits the time and skill you
 * said you had, with flagged recipes last but still present.
 */
export const rankByPrefs = (recipes = [], prefs = {}) => {
  const score = (recipe) => {
    const fit = recipeFit(recipe, prefs);
    return (fit.favouriteCuisine ? 2 : 0) + (fit.tooLong ? -1 : 0) + (fit.tooFiddly ? -1 : 0) + (fit.flagged.length ? -2 : 0);
  };
  return [...allowedByPrefs(recipes, prefs)].sort((a, b) => score(b) - score(a));
};

/**
 * How much of the recipe book your rules leave you. Worth showing: a set of
 * preferences that hides 95% of the book is something you'd want to know.
 */
export const reach = (recipes = [], prefs = {}) => {
  const total = recipes.length || 0;
  const left = allowedByPrefs(recipes, prefs).length;
  return {
    total,
    left,
    removed: total - left,
    pct: total ? Math.round((left / total) * 100) : 0,
  };
};

/** The preference set in a sentence, for headers. */
export const prefsSummary = (prefs = {}) => {
  const parts = [];
  const n = (list) => (list || []).length;
  if (n(prefs.allergies)) parts.push(`${n(prefs.allergies)} allergen${n(prefs.allergies) === 1 ? '' : 's'}`);
  if (n(prefs.religious)) parts.push(prefs.religious.map((id) => religiousBy[id]?.label).filter(Boolean).join(', '));
  if (n(prefs.intolerances)) parts.push(`${n(prefs.intolerances)} intolerance${n(prefs.intolerances) === 1 ? '' : 's'}`);
  if (n(prefs.cuisines)) parts.push(`${n(prefs.cuisines)} favourite cuisine${n(prefs.cuisines) === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' · ') : 'Nothing set — everything is offered';
};
