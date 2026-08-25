import { describe, it, expect } from 'vitest';
import {
  randomPick, cheapestPick, pantryFirstPick, fastestPick, leastRepetitivePick,
  mulberry32, measureVector, explainWinner, strategyOutcomes,
} from '../src/lib/recommendation-experiments.js';
import { chooseOptimalPlan } from '../src/lib/optimiser.js';

/* ---- Synthetic household: 12 recipes, 8 pantry rows, realistic constraints ---- */

const r = (id, name, opts = {}) => ({
  id, name,
  costPerServing: opts.cost ?? null,
  time: opts.time ?? null,
  ingredients: (opts.ings || []).map((n) => ({ name: n })),
  tags: opts.tags || [],
  equipment: opts.equipment || [],
});

const RECIPES = [
  r('curry', 'Coconut curry', { cost: 3.2, time: 30, ings: ['Rice', 'Coconut milk', 'Curry paste', 'Coriander'], tags: ['vegan'] }),
  r('traybake', 'Chicken traybake', { cost: 4.8, time: 45, ings: ['Chicken', 'Potato', 'Peppers', 'Paprika'], tags: ['batch'] }),
  r('pasta', 'Tomato pasta', { cost: 1.2, time: 15, ings: ['Pasta', 'Tinned tomatoes', 'Garlic'], tags: ['vegan', 'quick'] }),
  r('stirfry', 'Tofu stir-fry', { cost: 2.8, time: 20, ings: ['Tofu', 'Soy sauce', 'Broccoli', 'Ginger'], tags: ['vegan', 'quick'] }),
  r('salmon', 'Teriyaki salmon', { cost: 7.5, time: 35, ings: ['Salmon', 'Soy sauce', 'Rice'] }),
  r('soup', 'Lentil soup', { cost: 1.5, time: 40, ings: ['Lentils', 'Carrot', 'Onion', 'Cumin'], tags: ['vegan', 'batch'] }),
  r('omelette', 'Cheese omelette', { cost: 2.0, time: 10, ings: ['Eggs', 'Cheese', 'Butter'], tags: ['quick'] }),
  r('chilli', 'Bean chilli', { cost: 2.5, time: 35, ings: ['Kidney beans', 'Tinned tomatoes', 'Rice'], tags: ['vegan', 'batch'] }),
  r('roast', 'Sunday roast', { cost: 6.0, time: 90, ings: ['Chicken', 'Potato', 'Carrot', 'Gravy'] }),
  r('stew', 'Beef stew', { cost: 5.5, time: 120, ings: ['Beef', 'Potato', 'Carrot', 'Onion'], tags: ['batch'] }),
  r('salad', 'Greek salad', { cost: 3.0, time: 10, ings: ['Feta', 'Cucumber', 'Olives', 'Onion'], tags: ['vegetarian', 'quick'] }),
  r('tacos', 'Fish tacos', { cost: 5.0, time: 25, ings: ['White fish', 'Tortilla', 'Cabbage', 'Lime'] }),
];

const PANTRY = [
  { name: 'Rice', qty: '1 kg' },
  { name: 'Onion', qty: '500 g' },
  { name: 'Tinned tomatoes', qty: '2 x 400 g' },
  { name: 'Coconut milk', qty: '400 ml' },
  { name: 'Kidney beans', qty: '2 tins' },
  { name: 'Lentils', qty: '500 g' },
  { name: 'Garlic', qty: '1 bulb' },
  { name: 'Spinach', qty: '200 g', expiry: '2026-08-24' },
];

const STRATEGIES = {
  A_random: (eligible, rng) => randomPick(eligible, rng),
  B_cheapest: (eligible) => cheapestPick(eligible),
  C_pantry_first: (eligible) => pantryFirstPick(eligible, PANTRY),
  D_fastest: (eligible) => fastestPick(eligible),
  E_least_repeat: (eligible) => leastRepetitivePick(eligible, []),
  F_forq: (eligible) => chooseOptimalPlan(
    eligible.map((recipe) => [{ id: recipe.id, title: recipe.name, time: recipe.time, costPerServing: recipe.costPerServing, tags: recipe.tags, ingredients: recipe.ingredients.map((i) => ({ name: i.name, qty: '100 g' })) }]),
    { pantryItems: PANTRY, today: '2026-08-23' }
  )?.meals?.[0] || null,
};

function runExperiment({ trials = 50, seed = 42, eligiblePool = RECIPES }) {
  const results = {};
  for (const [name, pick] of Object.entries(STRATEGIES)) {
    const rng = mulberry32(seed);
    const vectors = [];
    for (let t = 0; t < trials; t++) {
      const picked = pick(eligiblePool, rng);
      if (!picked) continue;
      const v = measureVector(picked, { pantryItems: PANTRY });
      vectors.push({
        ...v,
        costGBP: picked.costPerServing,
        predictedTimeMins: picked.time,
        dietaryOk: !(picked.tags || []).includes('meat'),
        repetitionCount: 0,
        ingredientsUsed: (picked.ingredients || []).filter((ing) =>
          PANTRY.some((p) => norm(p.name).includes(norm(ing.name)) || norm(ing.name).includes(norm(p.name)))
        ).length,
      });
    }
    results[name] = summarise(vectors);
  }
  return results;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function summarise(vectors) {
  const avg = (fn) => vectors.length ? Math.round(vectors.reduce((s, v) => s + fn(v), 0) / vectors.length * 100) / 100 : null;
  return {
    trials: vectors.length,
    avgCost: avg((v) => v.costGBP ?? 0),
    avgIngredientsUsed: avg((v) => v.ingredientsUsed || 0),
    avgTimeMins: avg((v) => v.predictedTimeMins ?? 0),
    avgPantryUtilisationPct: avg((v) => v.pantryUtilisationPct ?? 0),
    avgRepetition: avg((v) => v.repetitionCount ?? 0),
  };
}

describe('recommendation experiment — Forq vs five baselines', () => {
  it('runs all six strategies on the same household state', () => {
    const results = runExperiment({ trials: 30, seed: 42 });
    expect(Object.keys(results).sort()).toEqual(['A_random', 'B_cheapest', 'C_pantry_first', 'D_fastest', 'E_least_repeat', 'F_forq']);
    for (const [, row] of Object.entries(results)) {
      expect(row.trials).toBeGreaterThan(0);
    }
  });

  it('Forq uses more pantry ingredients than random or cheapest', () => {
    const results = runExperiment({ trials: 30, seed: 42 });
    expect(results.F_forq.avgIngredientsUsed).toBeGreaterThanOrEqual(results.A_random.avgIngredientsUsed);
    expect(results.F_forq.avgIngredientsUsed).toBeGreaterThanOrEqual(results.B_cheapest.avgIngredientsUsed);
  });

  it('Forq has lower average cost than random', () => {
    const results = runExperiment({ trials: 30, seed: 42 });
    expect(results.F_forq.avgCost).toBeLessThanOrEqual(results.A_random.avgCost);
  });

  it('cheapest wins on cost alone — Forq does not pretend otherwise', () => {
    const results = runExperiment({ trials: 30, seed: 42 });
    expect(results.B_cheapest.avgCost).toBeLessThanOrEqual(results.F_forq.avgCost);
  });

  it('fastest wins on time alone — Forq does not pretend otherwise', () => {
    const results = runExperiment({ trials: 30, seed: 42 });
    expect(results.D_fastest.avgTimeMins).toBeLessThanOrEqual(results.F_forq.avgTimeMins);
  });

  it('produces a comparison table with every strategy and dimension', () => {
    const results = runExperiment({ trials: 30, seed: 42 });
    const dimensions = ['avgCost', 'avgIngredientsUsed', 'avgTimeMins', 'avgPantryUtilisationPct'];
    for (const strategy of Object.keys(results)) {
      for (const dim of dimensions) {
        expect(results[strategy][dim], `${strategy}.${dim}`).not.toBeNull();
      }
    }
  });

  it('explains why Forq chose what it did in household language', () => {
    const winner = RECIPES.find((r) => r.id === 'curry');
    const lines = explainWinner(winner, {
      pantryItems: PANTRY,
      today: '2026-08-23',
      cookingTimeHistory: [{ recipeId: 'curry', actualMins: 28 }],
      ratings: { curry: 4.5 },
      beaten: [r('salmon', 'Teriyaki salmon', { cost: 7.5 })],
    });
    const text = lines.join(' | ');
    expect(text).toMatch(/already own/);
    expect(text).toMatch(/~28 minutes/);
    expect(text).toMatch(/4\.5\/5/);
    expect(text).toMatch(/beats Teriyaki salmon/);
  });
});

describe('strategy outcomes — closing the loop with real data', () => {
  it('computes cook rate per strategy from ledger entries', async () => {
    const { createLedgerEntry, recordExecution } = await import('../src/lib/outcome-ledger.js');
    const entries = [];
    for (const [strategy, cooked] of [['A', false], ['A', true], ['B', true], ['B', true], ['C', true], ['D', true], ['F', true]]) {
      let e = createLedgerEntry({
        date: '2026-08-23',
        recipeId: `r-${strategy}`,
        recommendation: { source: `experiment:${strategy}`, reasons: [] },
      });
      e = recordExecution(e, { cooked, skipped: !cooked });
      entries.push(e);
    }
    const { strategyOutcomes } = await import('../src/lib/recommendation-experiments.js');
    const out = strategyOutcomes(entries);
    expect(out.A.cookRatePct).toBe(50);
    expect(out.B.cookRatePct).toBe(100);
    expect(out.F.cookRatePct).toBe(100);
  });
});
