/**
 * Local outcome analytics — the household's own value dashboard.
 *
 * Separate from product analytics (which stays coarse and optional).
 * These numbers answer "did Forq actually help?" not "did they use it?".
 * Computed on-device from the household's own records. Never uploaded.
 *
 * North star:  food waste £ / household / week
 * Supporting:  adherence · list→purchased accuracy · pantry utilisation ·
 *              leftover reuse · monthly waste £ · avoided waste £ ·
 *              predicted-vs-actual spend · cooking-time MAE · satisfaction
 */

import { dayStamp } from './kitchen.js';
import { weeklyOutcomeSnapshot, outcomeTrends } from './outcome-analytics.js';
import { predictionMetrics } from './outcome-ledger.js';
import { householdOutcomes } from './household-outcomes.js';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The core dashboard — every number the user sees about whether Forq works.
 *
 * @param {object} state - full app state
 * @param {object} opts - { today, weeks (trend length), ledgerEntries }
 */
export function outcomeDashboard(state = {}, opts = {}) {
  const today = opts.today || state.day || dayStamp();
  const week = weeklyOutcomeSnapshot(state, { today });
  const trends = outcomeTrends(state, { today, weeks: opts.weeks || 6 });
  const predictions = predictionMetrics(opts.ledgerEntries || state.outcomeLedger || []);
  const outcomes = householdOutcomes(state, { today });

  return {
    northStar: {
      label: 'Food wasted this month',
      value: outcomes.waste.value,
      unit: 'GBP',
      trendVsPrevWeek: trends.deltaVsPrevWeek?.foodWasteGBP ?? null,
      assumption: outcomes.waste.weightAssumption,
    },
    primary: [
      { key: 'adherence', label: 'Plan adherence', pct: week.supporting.adherencePct },
      { key: 'listAccuracy', label: 'Shopping-list accuracy', pct: week.supporting.listAccuracyPct },
      { key: 'pantryUtilisation', label: 'Pantry utilisation', pct: week.supporting.pantryAccuracyPct },
      { key: 'leftoverReuse', label: 'Leftovers reused', pct: week.supporting.leftoverUtilisationPct },
    ],
    secondary: {
      weeklySpendGBP: week.supporting.weeklySpendGBP,
      unusedIngredients: week.supporting.unusedIngredients,
      cookTimeMAE: week.supporting.cookingTimeErrorMins,
      costPredictionError: predictions.costPredictionError,
      timePredictionError: predictions.cookTimeError,
      recipeSatisfaction: week.supporting.recipeSatisfaction || null,
    },
    avoidedWasteGBP: (() => {
      // Avoided waste = expiring items used before their date × their recorded cost.
      const saved = (state.pantryEvents || []).filter(
        (e) => e.to === 'consumed' && e.expiry && String(e.date).slice(0, 10) <= String(e.expiry).slice(0, 10)
      );
      if (!saved.length) return null;
      return round2(saved.reduce((s, e) => s + (Number(e.value) || 0), 0));
    })(),
    predictedVsActualSpendPct: (() => {
      if (!outcomes.spend.trips) return null;
      const planned = state.weeklyBudget || null;
      if (!planned) return null;
      return Math.round(((outcomes.spend.total - planned) / planned) * 100);
    })(),
    trends,
    onDevice: true,
  };
}
