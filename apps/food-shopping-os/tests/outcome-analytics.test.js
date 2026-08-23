import { describe, it, expect } from 'vitest';
import { weeklyOutcomeSnapshot, outcomeTrends, weekBounds } from '../src/lib/outcome-analytics.js';
import { pantryConfidenceLevel } from '../src/lib/pantry-intelligence.js';

const state = {
  day: '2026-08-21', // a Friday
  household: 2,
  waste: [
    { name: 'Spinach', cost: 1.8, qty: '200 g', date: '2026-08-19' },
    { name: 'Bread', cost: 0.9, date: '2026-07-01' }, // previous month — outside
  ],
  shops: [
    { date: '2026-08-18', total: 40, items: [{ name: 'Milk' }, { name: 'Rice' }] },
    { date: '2026-06-02', total: 99 },
  ],
  shoppingList: [{ name: 'Milk' }, { name: 'Eggs' }],
  plan: {
    '2026-08-17': { dinner: 'chicken-traybake' },
    '2026-08-18': { dinner: 'chickpea-curry' },
  },
  mealPlanEvents: [
    { date: '2026-08-17', slot: 'dinner', plannedRecipeId: 'chicken-traybake', status: 'cooked', at: 1 },
    { date: '2026-08-18', slot: 'dinner', plannedRecipeId: 'chickpea-curry', status: 'skipped', reason: 'takeaway', at: 2 },
  ],
  cooked: [],
  pantry: [
    { id: 'p1', name: 'Yoghurt', confidence: 'confirmed' },
    { id: 'p2', name: 'Milk', confidence: null },
  ],
  pantryEvents: [
    { type: 'purchase', name: 'Bagged salad', date: '2026-08-18' },
    { type: 'pantry_lifecycle', itemId: 'p9', name: 'Old oats', to: 'consumed', date: '2026-08-19' },
  ],
  cookingTimeHistory: [
    { date: '2026-08-18', estimatedMins: 30, actualMins: 36 },
    { date: '2026-08-19', estimatedMins: 20, actualMins: 22 },
  ],
  tasteRatings: { chickenTraybake: 'love', chickpeaCurry: 'like' },
};

describe('weekly outcome snapshot — the household’s own numbers', () => {
  it('computes the north star: waste £ / household / week', () => {
    const snap = weeklyOutcomeSnapshot(state);
    expect(snap.northStar.foodWasteGBP).toBe(1.8);
    expect(snap.northStar.perHouseholdMember).toBe(0.9);
    expect(snap.northStar.discardedItems).toBe(1);
  });

  it('bounds the week Monday → today and keeps outside rows out', () => {
    const { start } = weekBounds('2026-08-21');
    expect(start).toBe('2026-08-17');
    const snap = weeklyOutcomeSnapshot(state);
    expect(snap.weekStart).toBe('2026-08-17');
    expect(snap.supporting.weeklySpendGBP).toBe(40); // the £99 June trip stays out
  });

  it('reports adherence, list accuracy and pantry accuracy', () => {
    const snap = weeklyOutcomeSnapshot(state);
    expect(snap.supporting.plannedMeals).toBe(2);
    expect(snap.supporting.mealsCooked).toBe(1);
    expect(snap.supporting.adherencePct).toBe(50);
    expect(snap.supporting.listAccuracyPct).toBe(50); // Milk purchased, Eggs not (yet)
    // Pantry accuracy shares the app's own confidence classifier.
    const confirmed = state.pantry.filter((i) => pantryConfidenceLevel(i, snap.weekEnd).level === 'definite').length;
    expect(snap.supporting.pantryAccuracyPct).toBe(Math.round((confirmed / state.pantry.length) * 100));
  });

  it('counts unused purchases and leftover utilisation honestly', () => {
    const snap = weeklyOutcomeSnapshot(state);
    expect(snap.supporting.unusedIngredients).toBe(1); // bagged salad, never traced again
    expect(snap.supporting.leftoverUtilisationPct).toBeNull();
    expect(snap.leftoverAssumption).toMatch(/No leftover outcomes/);
  });

  it('averages cooking-time prediction error over timed cooks only', () => {
    const snap = weeklyOutcomeSnapshot(state);
    expect(snap.supporting.cookingTimeErrorMins).toBe(4); // |6| + |2| ÷ 2
  });

  it('scores recipe satisfaction from your own ratings', () => {
    const snap = weeklyOutcomeSnapshot(state);
    expect(snap.supporting.recipeSatisfaction.value).toBeCloseTo(4.5, 2);
    expect(snap.supporting.recipeSatisfaction.samples).toBeGreaterThanOrEqual(2);
  });
});

describe('outcome trends — weeks in a row, deltas included', () => {
  it('builds oldest-first snapshots and diffs the latest against last week', () => {
    const busy = {
      ...state,
      waste: [
        ...state.waste,
        { name: 'Cream', cost: 3.5, date: '2026-08-14' }, // previous week
      ],
    };
    const trend = outcomeTrends(busy, { today: '2026-08-21', weeks: 2 });
    expect(trend.snapshots).toHaveLength(2);
    expect(trend.snapshots[0].weekEnd).toBe('2026-08-14');
    expect(trend.latest.northStar.foodWasteGBP).toBe(1.8);
    expect(trend.deltaVsPrevWeek.foodWasteGBP).toBe(-1.7); // improving
  });

  it('stays on-device by being a pure function of state', () => {
    const before = JSON.stringify(state);
    weeklyOutcomeSnapshot(state);
    outcomeTrends(state, { weeks: 3 });
    expect(JSON.stringify(state)).toBe(before);
  });
});
