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
import {
  groceryInflation, kitchenStats, pantryValue, savingsSummary, spentInMonth, spentInWeek, streakFrom,
} from './kitchen.js';
import {
  defaultWeeklyKcal, goalSummary, resolveMaintenance, targetSafety, weekProgress,
} from './goals.js';
import { leftoverItems, leftoverPortions } from './mealplan.js';
import { progressSummary } from './progress.js';
import { bodySummary, cycleSummary, sleepSummary, stressSummary, vitalSummary } from './health.js';
import { activityAdjustment, weekSummary } from './exercise.js';
import {
  basketProjection, priceAlertMatches, restockSuggestions, wasteSummary,
} from './shopping.js';
import { recentFoodsFrom } from './state.js';
import {
  evaluateFoodSuitability,
  filterBySuitability,
  rankBySuitability,
  suitabilityContextFrom,
  suitabilityReach,
  suitabilitySummary,
} from './food-suitability.js';
import { formatters } from './units.js';
import { DEFAULT_WIDGETS } from '../data/preferences.js';
import { RECIPES } from '../data/recipes.js';
import { periodFootprint, swapIdeas } from './footprint.js';
import { fastingSummary } from './fasting.js';
import { DEFAULT_PERMISSIONS, permissionsForRole } from './household.js';
import { buildTasteProfile } from './taste.js';
import { YOUTH_COPY, youthPolicy } from './youth.js';

export const deriveApp = (state) => {
  const activeMember = state.members.find((member) => member.id === state.activeMemberId) || null;
  const youth = youthPolicy(state);
  const householdAccess = activeMember
    ? { ...permissionsForRole(activeMember.role), ...(activeMember.permissions || {}) }
    : { ...DEFAULT_PERMISSIONS };

  // One context object for every surface that asks "is this safe / preferred?".
  const planDiets = [...new Set([...state.diets, ...state.members.flatMap((m) => m.diets || [])])];
  const suitabilityCtx = suitabilityContextFrom({
    allergies: state.allergies,
    intolerances: state.intolerances,
    religious: state.religious,
    diets: state.diets,
    planDiets,
    members: state.members,
    cuisines: state.cuisines,
    skill: state.skill,
    timeBudget: state.timeBudget,
    units: state.units,
  });

  // Legacy prefs bag kept for components that still read app.prefs.*
  const prefs = {
    allergies: state.allergies,
    intolerances: state.intolerances,
    religious: state.religious,
    diets: state.diets,
    cuisines: state.cuisines,
    skill: state.skill,
    timeBudget: state.timeBudget,
    units: state.units,
  };

  const catalogue = [...CATALOGUE, ...state.customFoods];
  const recipeBook = [...RECIPES, ...state.myRecipes];
  const tasteProfile = buildTasteProfile(recipeBook, state.tasteRatings, state.favourites);
  const entries = state.log[state.day] || [];
  const totals = dayTotals(entries);
  const glasses = state.water + state.waterExtraMl / GLASS_ML;
  const cookedDays = state.cooked.map((c) => c.date);
  const progress = progressSummary(state, state.day);
  const loggedDays = Object.keys(state.log).filter((date) => state.log[date]?.length).length;
  const personaTier = loggedDays < 3 && state.cooked.length < 2
    ? 'starter'
    : loggedDays < 30 && state.cooked.length < 20
      ? 'regular'
      : 'established';
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
    maintenanceKcalResolved: resolveMaintenance(state),
    targetSafety: targetSafety(state),
    goalSummary: goalSummary(state),
    weeklyKcalTarget: state.weeklyKcal || defaultWeeklyKcal(state.targets.kcal),
    week: weekProgress(state.log, {
      weeklyKcal: state.weeklyKcal || defaultWeeklyKcal(state.targets.kcal),
      today: state.day,
    }),
    recentFoods: recentFoodsFrom(state.log, catalogue),
    entriesFor: (date) => state.log[date] || [],
    kcalFor: (date) => dayTotals(state.log[date] || []).kcal,
    portions: state.members.length
      ? Math.round(state.members.reduce((n, m) => n + (Number(m.portions) || 1), 0) * 10) / 10
      : state.household || 1,
    planDiets,
    activeMember,
    youth,
    childMode: youth.on,
    householdAccess,
    leftovers: leftoverItems(state.pantry),
    leftoverPortions: leftoverPortions(state.pantry),
    body_: bodySummary(state, state.day),
    vitalsSummary: vitalSummary(state.vitals),
    sleepSummary: sleepSummary(state.sleep, { today: state.day }),
    stressSummary: stressSummary(state.stress, { today: state.day }),
    cycle: cycleSummary(state.cycles, state.day),
    training: weekSummary(state.workouts, state.day),
    activity: activityAdjustment(state, state.day),
    game: progress,
    xp: progress.xp,
    level: progress.level,
    streak: streakFrom(cookedDays, state.day),
    cookedToday: cookedDays.includes(state.day),
    cookedIds: state.cooked.map((c) => c.recipeId),
    pantryValue: pantryValue(state.pantry),
    spentThisWeek: spentInWeek(state.shops, state.day),
    spentThisMonth: spentInMonth(state.shops, state.day),
    inflation: groceryInflation(state.shops),
    savings: savingsSummary(state.shops),
    priceAlertStatus: priceAlertMatches(state.priceAlerts, state.shops),
    basket: basketProjection(state.shoppingList, {
      budget: state.weeklyBudget,
      spent: spentInWeek(state.shops, state.day),
      offers: state.offers,
      today: state.day,
    }),
    restock: restockSuggestions(state.shops, state.pantry, state.shoppingList),
    wasted: wasteSummary(state.waste),
    stats: kitchenStats({ ...state, xp: progress.xp }, state.day),
    personaTier,

    /* ---------- Central food suitability (every surface reads these) ---------- */
    prefs,
    suitabilityCtx,
    prefsSummary: suitabilitySummary(suitabilityCtx),
    /** Blocked recipes removed once, not re-hidden later. */
    safeRecipes: filterBySuitability(recipeBook, suitabilityCtx),
    recipeReach: suitabilityReach(recipeBook, suitabilityCtx),
    tasteProfile,
    /** Full structured result for one recipe or food. */
    suitabilityFor: (item) => evaluateFoodSuitability(item, suitabilityCtx),
    /** Legacy shape used by older components. */
    fitFor: (recipe) => {
      const s = evaluateFoodSuitability(recipe, suitabilityCtx);
      return {
        blocked: s.blockers.filter((b) => b.kind === 'allergy' || b.kind === 'religious' || b.kind === 'diet' || b.kind === 'household')
          .map((b) => ({ id: b.code.split(':')[1] || b.code, label: b.label })),
        flagged: s.warnings.filter((w) => w.kind === 'intolerance')
          .map((w) => ({ id: w.code.split(':')[1] || w.code, label: w.label })),
        tooLong: s.warnings.some((w) => w.code === 'time:over'),
        tooFiddly: s.warnings.some((w) => w.code === 'skill:over'),
        favouriteCuisine: s.preferences.some((p) => p.kind === 'preference' && p.code.startsWith('cuisine:')),
        suitability: s,
      };
    },
    rankRecipes: (list) => rankBySuitability(list, suitabilityCtx),
    filterRecipesSafe: (list) => filterBySuitability(list, suitabilityCtx),
    fmt: formatters(prefs),
    homeWidgets: state.widgets || DEFAULT_WIDGETS,
    footprint,
    footprintSwaps: swapIdeas(footprint),
    fasting: youth.fasting
      ? fastingSummary(state.log, { today: state.day, plan: state.fastPlan })
      : { ready: false, hidden: true, nights: 0, reason: YOUTH_COPY.fasting },
  };
};
