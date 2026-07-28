/**
 * Everything the app reads back, computed from what you stored.
 *
 * This is the other half of the store: `state` is the record of what you did,
 * and this turns it into every number the screens show. Keeping it a plain
 * function of state is what guarantees the app never stores a figure twice —
 * delete the thing behind a number and the number goes with it.
 */

import { CATALOGUE } from '../data/foods.js';
import { GLASS_ML } from '../data/nutrients.js';
import { dayTotals, hydration, nutrientCoverage } from './nutrition.js';
import { kitchenStats, pantryValue, spentInWeek, streakFrom } from './kitchen.js';
import { defaultWeeklyKcal, goalSummary, resolveMaintenance, weekProgress } from './goals.js';
import { leftoverItems, leftoverPortions } from './mealplan.js';
import { progressSummary } from './progress.js';
import { bodySummary, cycleSummary, sleepSummary, stressSummary, vitalSummary } from './health.js';
import { activityAdjustment, weekSummary } from './exercise.js';
import { basketProjection, restockSuggestions, wasteSummary } from './shopping.js';
import { recentFoodsFrom } from './state.js';
import { allowedByPrefs, prefsSummary, reach, recipeFit } from './preferences.js';
import { formatters } from './units.js';
import { DEFAULT_WIDGETS } from '../data/preferences.js';
import { RECIPES } from '../data/recipes.js';
import { periodFootprint, swapIdeas } from './footprint.js';
import { fastingSummary } from './fasting.js';

export const deriveApp = (state) => {
  // The hard lines, gathered once so every surface filters the same way.
  const prefs = {
    allergies: state.allergies,
    intolerances: state.intolerances,
    religious: state.religious,
    cuisines: state.cuisines,
    skill: state.skill,
    timeBudget: state.timeBudget,
    units: state.units,
  };
  const catalogue = [...CATALOGUE, ...state.customFoods];
  const entries = state.log[state.day] || [];
  const totals = dayTotals(entries);
  const glasses = state.water + state.waterExtraMl / GLASS_ML;
  const cookedDays = state.cooked.map((c) => c.date);
  const progress = progressSummary(state, state.day);
  const footprint = periodFootprint(state.log, { today: state.day });
  return {
    catalogue,
    entries,
    totals,
    kcalToday: totals.kcal,
    proteinToday: totals.protein,
    carbsToday: totals.carbs,
    fatToday: totals.fat,
    fibreToday: totals.fibre,
    kcalGoal: state.targets.kcal,
    proteinGoal: state.targets.protein,
    carbsGoal: state.targets.carbs,
    fatGoal: state.targets.fat,
    coverage: nutrientCoverage(entries),
    hydration: hydration(totals, glasses),
    /* goals */
    maintenanceKcalResolved: resolveMaintenance(state),
    goalSummary: goalSummary(state),
    weeklyKcalTarget: state.weeklyKcal || defaultWeeklyKcal(state.targets.kcal),
    week: weekProgress(state.log, {
      weeklyKcal: state.weeklyKcal || defaultWeeklyKcal(state.targets.kcal),
      today: state.day,
    }),
    recentFoods: recentFoodsFrom(state.log, catalogue),
    entriesFor: (date) => state.log[date] || [],
    kcalFor: (date) => dayTotals(state.log[date] || []).kcal,
    /* family — how many portions a meal has to stretch to, and everyone's diets */
    portions: state.members.length
      ? Math.round(state.members.reduce((n, m) => n + (Number(m.portions) || 1), 0) * 10) / 10
      : state.household || 1,
    planDiets: [...new Set([...state.diets, ...state.members.flatMap((m) => m.diets || [])])],
    /* leftovers */
    leftovers: leftoverItems(state.pantry),
    leftoverPortions: leftoverPortions(state.pantry),
    /* health and training, read back the same way as everything else */
    body_: bodySummary(state, state.day),
    vitalsSummary: vitalSummary(state.vitals),
    sleepSummary: sleepSummary(state.sleep, { today: state.day }),
    stressSummary: stressSummary(state.stress, { today: state.day }),
    cycle: cycleSummary(state.cycles, state.day),
    training: weekSummary(state.workouts, state.day),
    activity: activityAdjustment(state, state.day),
    /* the game layer — all counted from the records above, never banked */
    game: progress,
    xp: progress.xp,
    level: progress.level,
    /* kitchen */
    streak: streakFrom(cookedDays, state.day),
    cookedToday: cookedDays.includes(state.day),
    cookedIds: state.cooked.map((c) => c.recipeId),
    pantryValue: pantryValue(state.pantry),
    spentThisWeek: spentInWeek(state.shops, state.day),
    /* shopping */
    basket: basketProjection(state.shoppingList, {
      budget: state.weeklyBudget,
      spent: spentInWeek(state.shops, state.day),
      offers: state.offers,
    }),
    restock: restockSuggestions(state.shops, state.pantry, state.shoppingList),
    wasted: wasteSummary(state.waste),
    stats: kitchenStats({ ...state, xp: progress.xp }, state.day),
    /* preferences: the filter every recipe surface shares, and the formatters
       that decide how a number is written */
    prefs,
    prefsSummary: prefsSummary(prefs),
    /** Blocked recipes are removed here once, not remembered to be hidden later. */
    safeRecipes: allowedByPrefs(RECIPES, prefs),
    recipeReach: reach(RECIPES, prefs),
    fitFor: (recipe) => recipeFit(recipe, prefs),
    fmt: formatters(prefs),
    homeWidgets: state.widgets || DEFAULT_WIDGETS,
    /* advanced surfaces, each derived from what you logged like everything else */
    footprint,
    footprintSwaps: swapIdeas(footprint),
    fasting: fastingSummary(state.log, { today: state.day, plan: state.fastPlan }),
  };
};
