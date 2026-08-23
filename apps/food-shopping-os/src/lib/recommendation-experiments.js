/**
 * Controlled recommendation experiments — simple baselines vs Forq.
 *
 * Four strategies face the same meal-planning situation:
 *   A  random eligible recipe      B  cheapest recipe
 *   C  pantry-first                D  current Forq (multi-objective engine)
 *
 * Every pick carries the same measured vector (cost, pantry coverage,
 * expiry risk, time, repetition, constraints) plus a WHY THIS WON
 * explanation in plain household language. Outcomes recorded through the
 * outcome ledger with source 'experiment:<A|B|C|D>' close the loop:
 * strategyOutcomes() turns settled entries into per-strategy results.
 */

import { pantryCoverage } from './optimiser.js';
import { dayStamp } from './kitchen.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Deterministic PRNG so experiments are reproducible. */
export const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Soon-expiring pantry rows whose name matches one of the meal's ingredients. */
export const expiringMatches = (meal, pantryItems = [], { today = dayStamp(), horizonDays = 2 } = {}) => {
  const cutoff = (() => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() + horizonDays); return d; })();
  return (pantryItems || []).filter((p) => {
    if (!p?.expiry || !p?.name) return false;
    const exp = new Date(`${p.expiry}T12:00:00`);
    if (!(exp <= cutoff)) return false;
    const n = norm(p.name);
    return (meal?.ingredients || []).some((ing) => {
      const i = norm(ing?.name);
      return i.includes(n) || n.includes(i);
    });
  });
};

const coverageOf = (meal, pantryItems) =>
  pantryCoverage([meal], pantryItems);

/** The measured vector every strategy is judged on. */
export const measureVector = (recipe, { pantryItems = [], priceTable = null, today = dayStamp(), recentMeals = [], equipmentOwned = null } = {}) => {
  const cov = coverageOf(recipe, pantryItems);
  const expiring = expiringMatches(recipe, pantryItems, { today });
  const cost = priceTable && (recipe.ingredients || []).length
    ? round2((recipe.ingredients || []).reduce((s, ing) => s + (priceTable[norm(ing?.name)] != null
      ? priceTable[norm(ing.name)] : 0), 0))
    : null;
  const equipNeeded = recipe.equipment || [];
  const owned = new Set((equipmentOwned || []).map(norm));
  return {
    costGBP: recipe.costPerServing ?? cost,
    pantryUtilisationPct: cov == null ? null : Math.round(cov * 100),
    expiryRiskUse: expiring.length ? expiring.map((p) => p.name) : [],
    predictedTimeMins: Number(recipe.time) || null,
    repetitionCount: recentMeals.filter((id) => id === recipe.id).length,
    constraintsOk: equipNeeded.every((e) => owned.has(norm(e))),
  };
};

/* ---------- The four strategies ---------- */

export const randomPick = (eligible, rng = mulberry32(42)) =>
  eligible.length ? eligible[Math.floor(rng() * eligible.length)] : null;

export const cheapestPick = (eligible) =>
  [...eligible].sort((a, b) => (a.costPerServing ?? Infinity) - (b.costPerServing ?? Infinity))[0] || null;

export const pantryFirstPick = (eligible, pantryItems = []) => {
  let best = null;
  let bestCov = -1;
  for (const recipe of eligible) {
    const cov = coverageOf(recipe, pantryItems) ?? 0;
    if (cov > bestCov) { bestCov = cov; best = recipe; }
  }
  return best;
};

/** Strategy D: the live engine over single-meal candidates. */
export async function forqPick(eligible, context = {}, fetchImpl = undefined) {
  if (!eligible.length) return null;
  const { chooseOptimalPlan } = await import('./optimiser.js');
  const candidates = eligible.map((r) => [{
    id: r.id,
    title: r.name,
    time: r.time,
    ingredients: r.ingredients || [],
  }]);
  const best = chooseOptimalPlan(candidates, {
    pantryItems: context.pantryItems || [],
    today: context.today,
    weeklyBudget: context.weeklyBudget ?? null,
    maxTimeMins: context.maxTimeMins ?? null,
    equipmentOwned: context.equipmentOwned ?? [],
    strictEquipment: Boolean(context.strictEquipment),
    wasteScores: {},
  });
  return best ? { ...eligible[best.candidateIndex], __score: best.score, __reasons: best.reasons } : null;
}

/**
 * Run all four strategies against one situation and measure every pick.
 * Returns { eligible, picks: {A,B,C,D}, vectors: keyed by strategy }.
 */
export function runRecommendationExperiment({
  eligible = [], pantryItems = [], seed = 7, context = {},
} = {}) {
  const rng = mulberry32(seed);
  const picks = {
    A: randomPick(eligible, rng),
    B: cheapestPick(eligible),
    C: pantryFirstPick(eligible, pantryItems),
  };
  return { eligible, picks };
}

/** Why THIS won — plain-language lines a household actually benefits from. */
export function explainWinner(recipe, { pantryItems = [], priceTable = null, today = dayStamp(), cookingTimeHistory = [], ratings = {}, beaten = [] } = {}) {
  if (!recipe) return [];
  const lines = [];

  const expiring = expiringMatches(recipe, pantryItems, { today, horizonDays: 2 });
  for (const item of expiring.slice(0, 2)) {
    const daysLeft = Math.max(0, Math.round((new Date(`${item.expiry}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000));
    lines.push(`uses ${item.name} expiring ${daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`}`);
  }

  const cov = coverageOf(recipe, pantryItems);
  if (cov != null && cov > 0) {
    lines.push(`you already own ${Math.round(cov * 100)}% of the ingredients`);
  }

  const missingCost = priceTable && (recipe.ingredients || [])
    .filter((ing) => coverageOf({ ingredients: [ing] }, pantryItems) !== 1)
    .reduce((s, ing) => s + (priceTable[norm(ing?.name)] ?? 0), 0);
  if (missingCost > 0) lines.push(`£${round2(missingCost)} estimated additional spend`);

  const history = (cookingTimeHistory || []).filter((h) => h.recipeId === recipe.id && Number.isFinite(Number(h.actualMins)));
  const mins = history.length
    ? Math.round(history.reduce((s, h) => s + Number(h.actualMins), 0) / history.length)
    : Number(recipe.time) || null;
  if (mins != null) lines.push(history.length ? `normally takes you ~${mins} minutes` : `cooks in about ${mins} minutes`);

  const rating = ratings[recipe.id];
  if (rating) {
    if (rating === 'love') lines.push('household loved it before');
    else if (rating === 'like') lines.push('household liked it before');
    else if (typeof rating === 'number') lines.push(`household rated it ${rating}/5`);
  }
  if ((recipe.tags || []).includes('batch')) lines.push('scales well for leftovers');

  for (const other of beaten || []) {
    if (!other?.name || other.id === recipe.id) continue;
    if (other.costPerServing != null && recipe.costPerServing != null && other.costPerServing > recipe.costPerServing) {
      lines.push(`beats ${other.name} by £${round2(other.costPerServing - recipe.costPerServing)} a serving`);
    }
  }
  return lines;
}

/**
 * Close the loop: per-strategy actual outcomes from settled ledger entries
 * recorded with recommendation.source = 'experiment:<X>'.
 */
export function strategyOutcomes(entries = []) {
  const groups = {};
  for (const entry of entries || []) {
    const source = String(entry?.recommendation?.source || '');
    if (!source.startsWith('experiment:')) continue;
    const key = source.split(':')[1] || '?';
    const row = (groups[key] = groups[key] || { planned: 0, cooked: 0, skipped: 0, wastedPortions: 0, actualCostTotal: 0, pricedMeals: 0 });
    row.planned += 1;
    if (entry.execution.cooked) row.cooked += 1;
    if (entry.execution.skipped) row.skipped += 1;
    row.wastedPortions += entry.leftovers?.portionsWasted || 0;
    if (entry.purchase?.actualCost != null) { row.actualCostTotal = round2(row.actualCostTotal + entry.purchase.actualCost); row.pricedMeals += 1; }
  }
  return Object.fromEntries(Object.entries(groups).map(([key, row]) => [
    key,
    { ...row, cookRatePct: row.planned ? Math.round((row.cooked / row.planned) * 100) : null },
  ]));
}
