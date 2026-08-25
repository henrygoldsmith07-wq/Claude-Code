import { describe, it, expect } from 'vitest';
import { outcomeDashboard } from '../src/lib/outcome-dashboard-data.js';

const state = {
  day: '2026-08-21',
  household: 2,
  waste: [{ name: 'Spinach', cost: 1.8, qty: '200 g', date: '2026-08-19' }],
  shops: [{ date: '2026-08-18', total: 40, items: [{ name: 'Milk' }] }],
  shoppingList: [{ name: 'Milk' }, { name: 'Eggs' }],
  plan: { '2026-08-17': { dinner: 'chicken-traybake' } },
  mealPlanEvents: [
    { date: '2026-08-17', slot: 'dinner', plannedRecipeId: 'chicken-traybake', status: 'cooked', at: 1 },
  ],
  cooked: [],
  pantry: [{ id: 'p1', name: 'Yoghurt', confidence: 'confirmed' }],
  pantryEvents: [
    { type: 'purchase', name: 'Bagged salad', date: '2026-08-18' },
    { itemId: 'p9', to: 'consumed', value: 2.5, date: '2026-08-19', expiry: '2026-08-20' },
  ],
  cookingTimeHistory: [
    { date: '2026-08-18', estimatedMins: 30, actualMins: 36 },
  ],
  tasteRatings: { chickenTraybake: 'love' },
  weeklyBudget: 50,
};

describe('outcome dashboard — did Forq actually help?', () => {
  it('computes the north star (food waste £) with trend', () => {
    const dash = outcomeDashboard(state);
    expect(dash.northStar.foodWasteGBP ?? dash.northStar.value).toBeDefined();
    expect(dash.northStar.label).toMatch(/waste/i);
  });

  it('reports all four primary percentages', () => {
    const dash = outcomeDashboard(state);
    for (const item of dash.primary) {
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('pct');
    }
    expect(dash.primary.map((p) => p.key)).toEqual(['adherence', 'listAccuracy', 'pantryUtilisation', 'leftoverReuse']);
  });

  it('includes secondary metrics from prediction errors and satisfaction', () => {
    const dash = outcomeDashboard(state);
    expect(dash.secondary.cookTimeMAE).not.toBeNull();
    expect(dash.secondary.recipeSatisfaction?.value ?? dash.secondary.recipeSatisfaction).toBeTruthy();
  });

  it('tracks avoided waste from consumed-before-expiry items', () => {
    const dash = outcomeDashboard(state);
    expect(dash.avoidedWasteGBP).toBeCloseTo(2.5, 2);
  });

  it('computes predicted vs actual spend delta against budget', () => {
    const dash = outcomeDashboard(state);
    // spend was £40 against a £50 budget → −20%
    expect(dash.predictedVsActualSpendPct).toBe(-20);
  });

  it('includes weekly trends', () => {
    const dash = outcomeDashboard(state);
    expect(dash.trends.snapshots.length).toBeGreaterThan(0);
    expect(dash.trends.assumption).toMatch(/on-device|never uploaded/i);
  });

  it('flags itself as on-device only', () => {
    expect(outcomeDashboard(state).onDevice).toBe(true);
  });
});
