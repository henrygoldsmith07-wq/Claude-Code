/**
 * The Forq Outcome Ledger — an immutable record for every planned meal.
 *
 * PLAN → RECOMMEND → SHOP → PURCHASE → COOK/SKIP/SUBSTITUTE → EAT →
 * LEFTOVERS → USE/WASTE → MEASURE → LEARN → NEXT RECOMMENDATION
 *
 * Entries are frozen at creation. New information arrives as amendments:
 * each amendment produces a NEW frozen entry with a bumped revision and an
 * audit trail, so the prediction and every correction stay inspectable.
 * ledgerInsights() turns settled entries into answers to the questions that
 * matter — money saved, pantry-first cook rates, waste per recommendation,
 * batch-cooking time savings, time accuracy, skip predictors.
 */

import { uid } from './state.js';

const round2 = (n) => Math.round(n * 100) / 100;

const REASON_TOKENS = {
  usesExpiringFood: 'uses-expiring-food',
  pantryFirst: 'pantry-first',
  lowCost: 'low-cost',
  preferredRecipe: 'preferred-recipe',
  batchFriendly: 'batch-friendly',
  seasonal: 'seasonal',
};

/** Map optimiser/planner signals into canonical recommendation reasons. */
export const deriveReasons = ({ optimiserReasons = [], recipe = {}, context = {} } = {}) => {
  const tokens = new Set();
  for (const reason of optimiserReasons) {
    const r = String(reason).toLowerCase();
    if (/pantry/.test(r)) tokens.add(REASON_TOKENS.pantryFirst);
    if (/expir/.test(r)) tokens.add(REASON_TOKENS.usesExpiringFood);
    if (/budget|cost|£/.test(r)) tokens.add(REASON_TOKENS.lowCost);
    if (/taste|prefer|favourite/.test(r)) tokens.add(REASON_TOKENS.preferredRecipe);
    if (/batch|leftover/.test(r)) tokens.add(REASON_TOKENS.batchFriendly);
  }
  if (context.usesExpiring) tokens.add(REASON_TOKENS.usesExpiringFood);
  if (recipe.tags?.includes('batch') || recipe.tags?.includes('meal-prep')) tokens.add(REASON_TOKENS.batchFriendly);
  return [...tokens];
};

/** Build the immutable seed entry the moment a plan recommends a meal. */
export function createLedgerEntry({
  plannedAt = new Date().toISOString(),
  date,
  slot = 'dinner',
  recipeId,
  recommendation = {},
} = {}) {
  const entry = {
    id: uid('ole'),
    schemaVersion: 1,
    plannedAt,
    date,
    slot,
    recipeId,
    revision: 0,
    history: [],
    recommendation: {
      source: recommendation.source || 'forq',
      reasons: recommendation.reasons || [],
      predictedCost: recommendation.predictedCost ?? null,
      predictedTime: recommendation.predictedTime ?? null,
    },
    purchase: {
      requiredItems: recommendation.requiredItems ?? null,
      alreadyOwnedItems: recommendation.alreadyOwnedItems ?? null,
      purchasedItems: recommendation.purchasedItems ?? null,
      actualCost: null,
    },
    execution: {
      cooked: null,
      substituted: false,
      skipped: false,
      actualCookMinutes: null,
    },
    leftovers: {
      portionsCreated: null,
      portionsConsumed: null,
      portionsWasted: null,
    },
    waste: {
      grams: null,
      estimatedCost: null,
    },
    feedback: {
      rating: null,
      makeAgain: null,
    },
  };
  return Object.freeze(entry);
}

const SECTION_KEYS = new Set(['purchase', 'execution', 'leftovers', 'waste', 'feedback', 'recommendation']);

/**
 * Immutable amendment: returns a new frozen entry with revision+1 and an
 * audit line recording exactly what changed and when.
 */
export function amendEntry(entry, section, patch, { at = new Date().toISOString() } = {}) {
  if (!entry || !SECTION_KEYS.has(section)) return entry;
  const next = {
    ...entry,
    [section]: { ...entry[section], ...patch },
    revision: entry.revision + 1,
    history: [...(entry.history || []), { revision: entry.revision + 1, section, patch, at }],
  };
  return Object.freeze(next);
}

/** Convenience status amendment mirroring markMealPlanOutcome semantics. */
export const recordExecution = (entry, { cooked, substituted = false, skipped = false, actualCookMinutes = null } = {}) =>
  amendEntry(entry, 'execution', { cooked, substituted, skipped, actualCookMinutes });

/* ---------- Insights ---------- */

const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

const cookRate = (rows) => {
  const judged = rows.filter((e) => e.execution.cooked !== null);
  if (!judged.length) return null;
  return judged.filter((e) => e.execution.cooked).length / judged.length;
};

const hasAnyReason = (entry, needles) =>
  entry.recommendation.reasons.some((r) => needles.some((n) => r.includes(n)));

/**
 * Answers from settled ledger entries. Every answer states its sample size;
 * null means "not enough evidence yet", never zero.
 */
export function ledgerInsights(entries = [], { baselineCostPerMeal = null } = {}) {
  const all = entries || [];
  const executed = all.filter((e) => e.execution.cooked !== null);

  // Did Forq save money? Compare predicted vs actual on settled purchases.
  const priced = executed.filter((e) => e.purchase.actualCost != null && e.recommendation.predictedCost != null);
  const predictedTotal = round2(priced.reduce((s, e) => s + e.recommendation.predictedCost, 0));
  const actualTotal = round2(priced.reduce((s, e) => s + e.purchase.actualCost, 0));
  let didForqSaveMoney = { ready: false, saved: null, assumption: 'No meals with both predicted and actual cost yet.' };
  if (priced.length) {
    const vsBaseline = baselineCostPerMeal != null
      ? round2((baselineCostPerMeal - actualTotal / priced.length) * priced.length)
      : null;
    didForqSaveMoney = {
      ready: true,
      meals: priced.length,
      predictedTotal,
      actualTotal,
      deltaVsPrediction: round2(predictedTotal - actualTotal),
      savedVsBaseline: vsBaseline,
      assumption: baselineCostPerMeal != null
        ? `Actual spend vs your £${round2(baselineCostPerMeal)} per-meal baseline.`
        : 'Actual vs predicted at recommendation time; set a baseline to measure savings against shops.',
    };
  }

  // Do pantry-first meals get cooked more often?
  const pantryFirst = executed.filter((e) => hasAnyReason(e, ['pantry-first', 'uses-expiring']));
  const rest = executed.filter((e) => !hasAnyReason(e, ['pantry-first', 'uses-expiring']));
  const pfr = cookRate(pantryFirst);
  const or = cookRate(rest);
  const doPantryFirstGetCookedMore = pfr == null || or == null
    ? { ready: false, pantryFirstCookRate: null, otherCookRate: null, assumption: 'Need executed meals in both groups.' }
    : {
        ready: true,
        pantryFirstMeals: pantryFirst.length,
        otherMeals: rest.length,
        pantryFirstCookRate: pct(pfr * 100, 100) !== null ? Math.round(pfr * 100) : null,
        otherCookRate: Math.round(or * 100),
        liftPct: Math.round((pfr - or) * 100),
        assumption: 'Cook rate of pantry-first/expiring-use recommendations vs the rest.',
      };

  // Which recommendations result in less waste?
  const withLeftovers = all.filter((e) => e.leftovers.portionsCreated != null || e.waste.grams != null);
  const bySource = {};
  for (const entry of withLeftovers) {
    const dominant = entry.recommendation.reasons[0] || 'unreasoned';
    const row = (bySource[dominant] = bySource[dominant] || { meals: 0, wastedPortions: 0, createdPortions: 0, wasteGrams: 0 });
    row.meals += 1;
    row.createdPortions += entry.leftovers.portionsCreated || 0;
    row.wastedPortions += entry.leftovers.portionsWasted || 0;
    row.wasteGrams += entry.waste.grams || 0;
  }
  const whichRecommendationsWasteLess = Object.keys(bySource).length
    ? {
        ready: true,
        byReason: Object.fromEntries(Object.entries(bySource).map(([reason, row]) => [
          reason,
          { ...row, wastedPct: row.createdPortions ? Math.round((row.wastedPortions / row.createdPortions) * 100) : null },
        ])),
        assumption: 'Grouped by the first recorded recommendation reason.',
      }
    : { ready: false, byReason: {}, assumption: 'No leftover outcomes recorded yet.' };

  // Does batch cooking actually save time (per serving)?
  const timed = executed.filter((e) => e.execution.actualCookMinutes != null && e.recipe?.servings);
  const batchRows = timed.filter((e) => hasAnyReason(e, ['batch']));
  const plainRows = timed.filter((e) => !hasAnyReason(e, ['batch']));
  const minsPerServing = (row) => row.reduce((s, e) => s + e.execution.actualCookMinutes / (e.recipe?.servings || 1), 0) / row.length;
  const doesBatchSaveTime = batchRows.length && plainRows.length
    ? {
        ready: true,
        batchMinutesPerServing: round1(minsPerServing(batchRows)),
        otherMinutesPerServing: round1(minsPerServing(plainRows)),
        samples: [batchRows.length, plainRows.length],
        assumption: 'Actual cook minutes per serving, batch-tagged vs not.',
      }
    : { ready: false, assumption: 'Need timed cooks on both batch and non-batch meals.' };

  // Are estimated cooking times accurate?
  const accuracyRows = executed.filter((e) => e.execution.actualCookMinutes != null && e.recommendation.predictedTime != null);
  const errors = accuracyRows.map((e) => e.execution.actualCookMinutes - e.recommendation.predictedTime);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const areTimesAccurate = accuracyRows.length
    ? {
        ready: true,
        samples: accuracyRows.length,
        meanAbsErrorMins: Math.round(mean(errors.map(Math.abs))),
        biasMins: Math.round(mean(errors)),
        biasAssumption: (() => {
          const b = mean(errors);
          return b > 2 ? 'Dishes run long — pad estimates.' : b < -2 ? 'Dishes finish early — tighten estimates.' : 'Estimates calibrated.';
        })(),
      }
    : { ready: false, assumption: 'No timed cooks yet.' };

  // What predicts a planned meal being skipped?
  const skipped = executed.filter((e) => e.execution.skipped);
  const notSkipped = executed.filter((e) => !e.execution.skipped);
  const overallSkipRate = executed.length ? skipped.length / executed.length : null;
  const predictors = {};
  for (const entry of all) {
    for (const reason of entry.recommendation.reasons) {
      const group = predictors[reason] = predictors[reason] || { planned: 0, skipped: 0 };
      if (entry.execution.cooked === null) continue;
      group.planned += 1;
      if (entry.execution.skipped) group.skipped += 1;
    }
  }
  const whatPredictsSkip = overallSkipRate == null
    ? { ready: false, factors: [], assumption: 'No executed plans yet.' }
    : {
        ready: true,
        overallSkipRatePct: Math.round(overallSkipRate * 100),
        factors: Object.entries(predictors)
          .filter(([, g]) => g.planned >= 3)
          .map(([reason, g]) => ({
            reason,
            planned: g.planned,
            skipRatePct: Math.round((g.skipped / g.planned) * 100),
            liftVsOverall: Math.round(((g.skipped / g.planned) - overallSkipRate) * 100),
          }))
          .sort((a, b) => b.liftVsOverall - a.liftVsOverall)
          .slice(0, 5),
        assumption: 'Reasons appearing in ≥3 planned meals; lift is vs the overall skip rate.',
      };

  return {
    entries: all.length,
    executed: executed.length,
    adherencePct: pct(executed.filter((e) => e.execution.cooked).length, executed.length),
    didForqSaveMoney,
    doPantryFirstGetCookedMore,
    whichRecommendationsWasteLess,
    doesBatchSaveTime,
    areTimesAccurate,
    whatPredictsSkip,
  };
}

function round1(n) { return Math.round(n * 10) / 10; }
