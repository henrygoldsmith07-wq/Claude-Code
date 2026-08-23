import { describe, it, expect } from 'vitest';
import {
  createLedgerEntry, amendEntry, recordExecution, deriveReasons, ledgerInsights,
} from '../src/lib/outcome-ledger.js';

const seed = (over = {}) => createLedgerEntry({
  plannedAt: '2026-08-23T09:00:00.000Z',
  date: '2026-08-23',
  slot: 'dinner',
  recipeId: 'curry',
  recommendation: { reasons: ['pantry-first', 'low-cost'], predictedCost: 4.8, predictedTime: 25 },
  ...over,
});

const settle = (entry, over = {}) => recordExecution(entry, { cooked: true, actualCookMinutes: 31, ...over });

describe('outcome ledger — immutable per-meal records', () => {
  it('creates the frozen prediction-time record', () => {
    const entry = seed();
    expect(Object.isFrozen(entry)).toBe(true);
    expect(entry.recommendation).toMatchObject({ source: 'forq', predictedCost: 4.8, predictedTime: 25 });
    expect(entry.execution.cooked).toBeNull();
    expect(entry.revision).toBe(0);
  });

  it('amendments produce a new frozen revision with an audit trail', () => {
    const first = seed();
    const second = recordExecution(first, { cooked: true, actualCookMinutes: 31 });
    expect(second).not.toBe(first);
    expect(Object.isFrozen(second)).toBe(true);
    expect(second.revision).toBe(1);
    expect(second.execution.actualCookMinutes).toBe(31);
    expect(first.execution.cooked).toBeNull(); // original untouched
    expect(second.history[0]).toMatchObject({ section: 'execution', patch: { cooked: true } });
    expect(first === second).toBe(false);
  });

  it('rejects amendments to unknown sections', () => {
    const entry = seed();
    expect(amendEntry(entry, 'notASection', { x: 1 })).toBe(entry);
  });

  it('derives canonical reasons from optimiser signals', () => {
    const reasons = deriveReasons({
      optimiserReasons: ['100% already in your pantry.', 'Uses 67% of stock expiring within 7 days.', 'Inside budget at £3.20.'],
      recipe: { tags: ['batch'] },
      context: {},
    });
    expect(reasons).toEqual(expect.arrayContaining(['pantry-first', 'uses-expiring-food', 'low-cost', 'batch-friendly']));
  });
});

describe('ledger insights — the questions that matter', () => {
  // mk() already settles execution; insights fixtures use it directly.
  const settle = (entry) => entry;
  const mk = ({ reasons, cooked, predictedCost, actualCost, predTime, actualMins, created = 0, wasted = 0, grams = 0 }) => {
    let e = createLedgerEntry({
      date: '2026-08-23',
      recipeId: 'r1',
      recommendation: { reasons, predictedCost: predictedCost ?? null, predictedTime: predTime ?? null },
    });
    e = recordExecution(e, { cooked, skipped: !cooked && cooked !== null, actualCookMinutes: actualMins });
    if (created || wasted) e = amendEntry(e, 'leftovers', { portionsCreated: created, portionsConsumed: created - wasted, portionsWasted: wasted });
    if (grams) e = amendEntry(e, 'waste', { grams });
    if (actualCost != null) e = amendEntry(e, 'purchase', { actualCost });
    return e;
  };

  it('answers whether Forq saved money vs prediction and baseline', () => {
    const entries = [
      settle(mk({ reasons: ['low-cost'], predictedCost: 5, actualCost: 4 })),
      settle(mk({ reasons: [], predictedCost: 6, actualCost: 7 })),
    ];
    const out = ledgerInsights(entries, { baselineCostPerMeal: 6.5 });
    expect(out.didForqSaveMoney.ready).toBe(true);
    expect(out.didForqSaveMoney.predictedTotal).toBe(11);
    expect(out.didForqSaveMoney.actualTotal).toBe(11);
    expect(out.didForqSaveMoney.savedVsBaseline).toBeCloseTo(2, 2);
  });

  it('shows pantry-first meals get cooked more often', () => {
    const entries = [
      settle(mk({ reasons: ['pantry-first'], cooked: true })),
      settle(mk({ reasons: ['pantry-first'], cooked: true })),
      settle(mk({ reasons: ['preferred-recipe'], cooked: false })),
      settle(mk({ reasons: ['preferred-recipe'], cooked: false })),
    ];
    const out = ledgerInsights(entries);
    expect(out.doPantryFirstGetCookedMore.ready).toBe(true);
    expect(out.doPantryFirstGetCookedMore.pantryFirstCookRate).toBe(100);
    expect(out.doPantryFirstGetCookedMore.otherCookRate).toBe(0);
  });

  it('compares waste across recommendation reasons', () => {
    const entries = [
      settle(amendEntry(mk({ reasons: ['pantry-first'] }), 'leftovers', { portionsCreated: 2, portionsConsumed: 2, portionsWasted: 0 })),
      settle(amendEntry(mk({ reasons: ['preferred-recipe'] }), 'leftovers', { portionsCreated: 2, portionsConsumed: 0, portionsWasted: 2 })),
    ];
    const out = ledgerInsights(entries);
    expect(out.whichRecommendationsWasteLess.byReason['pantry-first'].wastedPct).toBe(0);
    expect(out.whichRecommendationsWasteLess.byReason['preferred-recipe'].wastedPct).toBe(100);
  });

  it('measures time accuracy with bias language', () => {
    const entries = [
      settle(mk({ reasons: [], cooked: true, predTime: 25, actualMins: 31 })),
      settle(mk({ reasons: [], cooked: true, predTime: 30, actualMins: 36 })),
    ];
    const out = ledgerInsights(entries);
    expect(out.areTimesAccurate.samples).toBe(2);
    expect(out.areTimesAccurate.meanAbsErrorMins).toBe(6);
    expect(out.areTimesAccurate.biasAssumption).toMatch(/run long/);
  });

  it('surfaces skip predictors as lifts against the overall skip rate', () => {
    const entries = [
      ...Array.from({ length: 4 }, () => settle(mk({ reasons: ['complex'], cooked: false }))),
      ...Array.from({ length: 4 }, () => settle(mk({ reasons: ['quick-win'], cooked: true }))),
    ];
    const out = ledgerInsights(entries);
    expect(out.whatPredictsSkip.ready).toBe(true);
    const top = out.whatPredictsSkip.factors[0];
    expect(top.reason).toBe('complex');
    expect(top.skipRatePct).toBe(100);
    expect(top.liftVsOverall).toBeGreaterThan(0);
  });

  it('refuses to answer without evidence — nulls, never invented zeros', () => {
    const out = ledgerInsights([]);
    expect(out.didForqSaveMoney.ready).toBe(false);
    expect(out.areTimesAccurate.ready).toBe(false);
    expect(out.adherencePct).toBeNull();
  });
});
