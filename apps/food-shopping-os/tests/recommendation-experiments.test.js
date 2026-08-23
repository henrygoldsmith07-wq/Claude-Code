import { describe, it, expect } from 'vitest';
import {
  mulberry32, randomPick, cheapestPick, pantryFirstPick,
  runRecommendationExperiment, explainWinner, measureVector,
  expiringMatches, strategyOutcomes,
} from '../src/lib/recommendation-experiments.js';
import { createLedgerEntry, recordExecution, amendEntry } from '../src/lib/outcome-ledger.js';

const r = (id, name, { cost = null, time = 30, ingredients = [], tags = [], equipment = [] } = {}) =>
  ({ id, name, costPerServing: cost, time, ingredients, tags, equipment });

const pool = [
  r('random-stew', 'Random stew', { cost: 4.0, time: 40 }),
  r('cheap-pasta', 'Cheap pasta', { cost: 1.2, time: 15 }),
  r('pantry-curry', 'Pantry curry', { cost: 3.0, time: 25, ingredients: [{ name: 'Rice' }, { name: 'Onion' }] }),
  r('fancy-fish', 'Fancy fish', { cost: 7.5, time: 50 }),
];

const pantry = [
  { name: 'Rice', qty: '1 kg' },
  { name: 'Onions', qty: '500 g' },
  { name: 'Spinach', qty: '200 g', expiry: '2026-08-24' },
];

describe('the four baselines — same situation, four strategies', () => {
  it('A random respects the seed and stays inside the eligible pool', () => {
    const rng = mulberry32(7);
    const a = randomPick(pool, rng);
    const b = randomPick(pool, rng);
    expect(pool).toContain(a);
    expect(mulberry32(7) && typeof a.id).toBe('string');
    // Same seed reproduces the same sequence.
    const rng2 = mulberry32(7);
    expect(randomPick(pool, rng2).id).toBe(a.id);
    expect(randomPick(pool, rng2).id).toBe(b.id);
  });

  it('B cheapest picks the minimum cost per serving', () => {
    expect(cheapestPick(pool).id).toBe('cheap-pasta');
  });

  it('C pantry-first picks maximum ingredient overlap', () => {
    expect(pantryFirstPick(pool, pantry).id).toBe('pantry-curry');
  });

  it('runRecommendationExperiment returns all strategies on the shared pool', () => {
    const out = runRecommendationExperiment({ eligible: pool, pantryItems: pantry, seed: 3 });
    expect(Object.keys(out.picks).sort()).toEqual(['A', 'B', 'C']);
    expect(out.picks.B.id).toBe('cheap-pasta');
  });
});

describe('measureVector — one honest number per dimension', () => {
  it('covers pantry utilisation, expiry use and repetition', () => {
    const v = measureVector(pool[2], {
      pantryItems: pantry,
      priceTable: { rice: 0.9, onion: 0.3 },
      today: '2026-08-22',
      recentMeals: ['pantry-curry', 'pantry-curry'],
    });
    expect(v.pantryUtilisationPct).toBe(100);
    expect(v.expiryRiskUse.length).toBe(0); // curry uses no expiring stock
    expect(v.repetitionCount).toBe(2);
    expect(v.constraintsOk).toBe(true);
  });

  it('flags expiring stock the meal would actually use', () => {
    const spinach = r('saag', 'Saag', { ingredients: [{ name: 'Spinach' }] });
    const hits = expiringMatches(spinach, pantry, { today: '2026-08-22', horizonDays: 3 });
    expect(hits.map((p) => p.name)).toContain('Spinach');
  });
});

describe('why this won — explanations in household language', () => {
  it('names expiring items, owned share, spend, real minutes and ratings', () => {
    const winner = r('chicken-traybake', 'Chicken traybake', {
      cost: 4.8,
      time: 25,
      ingredients: [{ name: 'Chicken' }, { name: 'Spinach' }],
      tags: ['batch'],
    });
    const lines = explainWinner(winner, {
      pantryItems: [
        { name: 'Chicken', qty: '600 g' },
        { name: 'Spinach', qty: '200 g', expiry: '2026-08-23' },
      ],
      priceTable: {},
      today: '2026-08-22',
      cookingTimeHistory: [{ recipeId: 'chicken-traybake', actualMins: 31 }, { recipeId: 'chicken-traybake', actualMins: 33 }],
      ratings: { 'chicken-traybake': 4.3 },
      beaten: [r('fancy-fish', 'Fancy fish', { cost: 7.5 })],
    });
    const text = lines.join(' | ');
    expect(text).toMatch(/uses Spinach expiring tomorrow/);
    expect(text).toMatch(/own 100% of the ingredients/);
    expect(text).toMatch(/~32 minutes/);
    expect(text).toMatch(/rated it 4\.3\/5/);
    expect(text).toMatch(/beats Fancy fish by £2\.7/);
    expect(text).toMatch(/scales well for leftovers/);
  });

  it('stays silent when there is nothing to claim', () => {
    expect(explainWinner(null)).toEqual([]);
    const plain = explainWinner(r('x', 'X', { time: null }), {});
    expect(plain).toEqual([]);
  });
});

describe('closing the loop — actual outcomes per strategy', () => {
  const entryFor = (strategy, { cooked, wasted = 0, cost = null }) => {
    let e = createLedgerEntry({
      date: '2026-08-23',
      recipeId: `r-${strategy}`,
      recommendation: { source: `experiment:${strategy}`, reasons: [] },
    });
    e = recordExecution(e, { cooked, skipped: !cooked });
    if (wasted) e = amendEntry(e, 'leftovers', { portionsCreated: 2, portionsConsumed: 2 - wasted, portionsWasted: wasted });
    if (cost != null) e = amendEntry(e, 'purchase', { actualCost: cost });
    return e;
  };

  it('computes cook rate, waste and cost for A/B/C/D', () => {
    const entries = [
      entryFor('A', { cooked: false }),
      entryFor('A', { cooked: true, wasted: 1, cost: 5 }),
      entryFor('B', { cooked: true, cost: 2 }),
      entryFor('C', { cooked: true, cost: 2.4 }),
      entryFor('D', { cooked: true, wasted: 0, cost: 2.8 }),
    ];
    const out = strategyOutcomes(entries);
    expect(out.A.cookRatePct).toBe(50);
    expect(out.A.wastedPortions).toBe(1);
    expect(out.B.actualCostTotal).toBe(2);
    expect(out.D.cookRatePct).toBe(100);
  });
});
