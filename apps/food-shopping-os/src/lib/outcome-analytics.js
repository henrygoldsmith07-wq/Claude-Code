/**
 * Outcome analytics — the household's own numbers, computed locally.
 *
 * Deliberately separate from product analytics: product events count clicks
 * ("a plan was generated"); this counts outcomes ("this week wasted £2.40").
 * Nothing here leaves the device — these functions are pure reads of app
 * state, and any persisted snapshots live in the household's own store.
 *
 * North-star: food waste £ / household / week.
 */

import { dayStamp } from './kitchen.js';
import { planOutcome } from './plan-outcome.js';
import { pantryConfidenceLevel } from './pantry-intelligence.js';

const round2 = (n) => Math.round(n * 100) / 100;
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

const shiftStamp = (today, days) => {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const inWindow = (date, from, to) => {
  const stamp = String(date || '').slice(0, 10);
  return Boolean(stamp) && stamp >= from && stamp <= to;
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Monday-start week containing `today`. */
export const weekBounds = (today = dayStamp()) => {
  const d = new Date(`${today}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  const start = shiftStamp(today, -dow);
  return { start, end: today };
};

/** Recipe satisfaction on the household's own 1–5 scale. */
export const recipeSatisfaction = (state = {}) => {
  const ratings = Object.values(state.recipeRatings || {}).filter((v) => Number.isFinite(Number(v)));
  const tasteValues = Object.values(state.tasteRatings || {}).map((t) => ({ love: 5, like: 4, nope: 2 }[t])).filter(Boolean);
  const all = [...ratings, ...tasteValues];
  const ledgerRatings = (state.outcomeLedger || [])
    .filter((e) => e.feedback?.rating != null)
    .map((e) => Number(e.feedback.rating));
  const combined = [...all, ...ledgerRatings];
  if (!combined.length) return { value: null, samples: 0, assumption: 'No ratings yet.' };
  return {
    value: round2(combined.reduce((a, b) => a + Number(b), 0) / combined.length),
    samples: combined.length,
    assumption: 'Mean of your own recipe ratings and meal feedback.',
  };
};

/** One ISO week of outcome metrics for this household. */
export function weeklyOutcomeSnapshot(state = {}, { today = state.day || dayStamp() } = {}) {
  const { start, end } = weekBounds(today);
  const days = Math.max(1, Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) + 1);
  const dates = Array.from({ length: days }, (_, i) => shiftStamp(start, i));

  // Waste — the north star.
  const wasteRows = (state.waste || []).filter((w) => inWindow(w?.date, start, end));
  const wasteGBP = round2(wasteRows.reduce((s, w) => s + (Number(w.cost) || 0), 0));

  // Spend.
  const shops = (state.shops || []).filter((s) => inWindow(s?.date, start, end));
  const weeklySpendGBP = round2(shops.reduce((sum, s) => sum + (Number(s.total) || 0), 0));

  // Adherence.
  const plan = planOutcome(state.plan || {}, dates, state.mealPlanEvents, state.cooked, state.pantry);

  // Shopping-list → purchased accuracy: list items that show up in a receipt.
  const purchasedNames = new Set(shops.flatMap((shop) => (shop.items || []).map((i) => norm(i.name))));
  const list = state.shoppingList || [];
  const matchedOnList = list.filter((i) => purchasedNames.has(norm(i.name))).length;

  // Pantry accuracy: confirmed share.
  const confidence = (state.pantry || []).map((item) => pantryConfidenceLevel(item, end));
  const confirmed = confidence.filter((c) => c.level === 'definite').length;

  // Unused purchases: bought-in-window rows with no consumption trace.
  const usedNames = new Set();
  for (const e of state.pantryEvents || []) {
    if (['consumed', 'discarded', 'expired'].includes(String(e?.to || '').toLowerCase())) {
      usedNames.add(norm(e?.name));
    }
  }
  const purchases = (state.pantryEvents || []).filter((e) =>
    String(e?.type || '') === 'purchase' && inWindow(e?.date, start, end));
  const unused = purchases.filter((e) => !usedNames.has(norm(e?.name)) && !(state.pantry || []).some((p) => norm(p?.name) === norm(e?.name)));

  // Leftover utilisation: ledger portions when present, else consumption events on leftover rows.
  const ledgerRows = (state.outcomeLedger || []).filter((e) => inWindow(e?.date, start, end) && e.leftovers?.portionsCreated != null);
  const created = ledgerRows.reduce((s, e) => s + (e.leftovers.portionsCreated || 0), 0);
  const consumed = ledgerRows.reduce((s, e) => s + (e.leftovers.portionsConsumed || 0), 0);
  let leftoverUtilisationPct = created ? Math.round((consumed / created) * 100) : null;
  let leftoverAssumption = created ? 'Portion-level tracking from outcome ledger.' : null;
  if (leftoverUtilisationPct == null) {
    const leftoverIds = new Set((state.pantry || []).filter((p) => p.cat === 'Leftovers').map((p) => p.id));
    const evts = (state.pantryEvents || []).filter((e) => leftoverIds.has(e?.itemId) && inWindow(e?.date, start, end));
    const used = evts.filter((e) => e.to === 'consumed').length;
    const gone = evts.filter((e) => ['consumed', 'discarded', 'expired'].includes(String(e?.to))).length;
    leftoverUtilisationPct = gone ? Math.round((used / gone) * 100) : null;
    leftoverAssumption = gone ? 'Lifecycle events on leftover rows.' : 'No leftover outcomes recorded.';
  }

  // Cooking-time prediction error.
  const timed = (state.cookingTimeHistory || []).filter((h) =>
    inWindow(h?.date, start, end) && Number.isFinite(Number(h?.estimatedMins)) && Number.isFinite(Number(h?.actualMins)));
  const errors = timed.map((h) => Number(h.actualMins) - Number(h.estimatedMins));

  return {
    schemaVersion: 1,
    weekStart: start,
    weekEnd: end,
    northStar: {
      foodWasteGBP: wasteGBP,
      perHouseholdMember: state.household > 1 ? round2(wasteGBP / state.household) : wasteGBP,
      discardedItems: wasteRows.length,
      assumption: wasteRows.length ? `${wasteRows.length} discard${wasteRows.length === 1 ? '' : 's'} recorded.` : 'No discards recorded this week.',
    },
    supporting: {
      plannedMeals: plan.planned,
      mealsCooked: plan.completed,
      adherencePct: plan.adherence,
      listAccuracyPct: list.length ? pct(matchedOnList, list.length) : null,
      pantryAccuracyPct: (state.pantry || []).length ? pct(confirmed, state.pantry.length) : null,
      weeklySpendGBP,
      trips: shops.length,
      unusedIngredients: unused.length,
      leftoverUtilisationPct,
      cookingTimeErrorMins: errors.length ? Math.round(errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length) : null,
      recipeSatisfaction: recipeSatisfaction(state),
    },
    leftoverAssumption,
    sampleSizes: {
      shops: shops.length,
      plannedMeals: plan.planned,
      wasteEvents: wasteRows.length,
      timedCooks: timed.length,
    },
  };
}

/** Weekly snapshots over a trailing range, oldest first, with week-on-week delta. */
export function outcomeTrends(state = {}, { today = state.day || dayStamp(), weeks = 8 } = {}) {
  const snapshots = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const end = shiftStamp(today, -w * 7);
    snapshots.push(weeklyOutcomeSnapshot(state, { today: end }));
  }
  const last = snapshots[snapshots.length - 1];
  const prev = snapshots[snapshots.length - 2] || null;
  return {
    snapshots,
    latest: last,
    deltaVsPrevWeek: prev ? {
      foodWasteGBP: round2(last.northStar.foodWasteGBP - prev.northStar.foodWasteGBP),
      adherencePct: (last.supporting.adherencePct ?? 0) - (prev.supporting.adherencePct ?? 0),
    } : null,
    ready: Boolean(last.sampleSizes.wasteEvents || last.sampleSizes.plannedMeals),
    assumption: 'Computed on-device from this household’s own records. Never uploaded.',
  };
}
