import { describe, it, expect } from 'vitest';
import {
  randomPick, cheapestPick, pantryFirstPick, fastestPick, leastRepetitivePick,
  mulberry32, measureVector, explainWinner, strategyOutcomes,
} from '../src/lib/recommendation-experiments.js';
import { chooseOptimalPlan } from '../src/lib/optimiser.js';

/* ---- Synthetic household: 12 recipes, 8 pantry rows, realistic constraints ---- */

const r = (id, name, cost, time, ings, tags = []) =>
  ({ id, name, costPerServing: cost, time, ingredients: ings.map((n) => ({ name: n })), tags });

const RECIPES = [
  r('curry', 'Coconut curry', 3.2, 30, ['Rice', 'Coconut milk', 'Curry paste', 'Coriander'], ['vegan']),
  r('traybake', 'Chicken traybake', 4.8, 45, ['Chicken', 'Potato', 'Peppers', 'Paprika'], ['batch']),
  r('pasta', 'Tomato pasta', 1.2, 15, ['Pasta', 'Tinned tomatoes', 'Garlic'], ['vegan', 'quick']),
  r('stirfry', 'Tofu stir-fry', 2.8, 20, ['Tofu', 'Soy sauce', 'Broccoli', 'Ginger'], ['vegan', 'quick']),
  r('salmon', 'Teriyaki salmon', 7.5, 35, ['Salmon', 'Soy sauce', 'Rice'], []),
  r('soup', 'Lentil soup', 1.5, 40, ['Lentils', 'Carrot', 'Onion', 'Cumin'], ['vegan', 'batch']),
  r('omelette', 'Cheese omelette', 2.0, 10, ['Eggs', 'Cheese', 'Butter'], ['quick']),
  r('chilli', 'Bean chilli', 2.5, 35, ['Kidney beans', 'Tinned tomatoes', 'Rice'], ['vegan', 'batch']),
  r('roast', 'Sunday roast', 6.0, 90, ['Chicken', 'Potato', 'Carrot', 'Gravy'], []),
  r('stew', 'Beef stew', 5.5, 120, ['Beef', 'Potato', 'Carrot', 'Onion'], ['batch']),
  r('salad', 'Greek salad', 3.0, 10, ['Feta', 'Cucumber', 'Olives', 'Onion'], ['vegetarian', 'quick']),
  r('tacos', 'Fish tacos', 5.0, 25, ['White fish', 'Tortilla', 'Cabbage', 'Lime'], []),
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
    eligible.map((recipe) => [{ id: recipe.id, title: recipe.name, time: recipe.time, ingredients: recipe.ingredients.map((i) => ({ name: i.name, qty: '100 g' })) }]),
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
        dietaryOk: !picked.tags.includes('meat') || true,
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
