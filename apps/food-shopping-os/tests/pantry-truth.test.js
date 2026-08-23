import { describe, it, expect } from 'vitest';
import { pantryTruth, quickCheck } from '../src/lib/pantry-truth.js';

const TODAY = '2026-08-23';
const events = [
  { itemId: 'weighed', name: 'Chicken', to: 'consumed', qty: '150 g' },
  { itemId: 'ghost', name: 'Milk', to: 'consumed' }, // no quantity — uncounted use
  { itemId: 'ghost', name: 'Milk', to: 'consumed' },
];

describe('pantry truth — confidence as evidence, not vibes', () => {
  it('a fresh receipt-backed exact row scores high with no penalties', () => {
    const truth = pantryTruth({
      id: 'fresh', name: 'Yoghurt', qty: '450 g',
      confidence: 'confirmed', receiptId: 'rcp1', source: 'receipt',
      lastConfirmedAt: '2026-08-22',
    }, { events, today: TODAY });
    expect(truth.confidencePct).toBeGreaterThanOrEqual(90);
    // One day of honest knowledge-decay is fine; nothing else may penalise it.
    expect(truth.drivers.every((d) => d.id === 'time-decay' || d.delta >= 0)).toBe(true);
    expect(truth.rangeLow).toBeLessThan(truth.estimate.amount);
    expect(truth.rangeHigh).toBeGreaterThan(truth.estimate.amount);
    expect(truth.requiresCheck).toBe(false);
  });

  it('time since confirmation decays confidence', () => {
    const fresh = pantryTruth({ id: 'a', name: 'Rice', qty: '600 g', confidence: 'definite', lastConfirmedAt: '2026-08-22' }, { today: TODAY });
    const stale = pantryTruth({ id: 'b', name: 'Rice', qty: '600 g', confidence: 'definite', lastConfirmedAt: '2026-06-01' }, { today: TODAY });
    expect(stale.confidencePct).toBeLessThan(fresh.confidencePct);
    expect(stale.drivers.some((d) => d.id === 'time-decay')).toBe(true);
  });

  it('uncounted consumption hurts more than weighed deductions help', () => {
    const ghost = pantryTruth({ id: 'ghost', name: 'Milk', qty: '620 ml', confidence: 'probable', lastConfirmedAt: '2026-08-21' }, { events, today: TODAY });
    const weighed = pantryTruth({ id: 'weighed', name: 'Chicken', qty: '800 g', confidence: 'probable', lastConfirmedAt: '2026-08-21' }, { events, today: TODAY });
    expect(ghost.drivers.some((d) => d.id === 'uncounted-consumption')).toBe(true);
    expect(weighed.drivers.some((d) => d.id === 'cooking-deduction')).toBe(true);
    expect(ghost.confidencePct).toBeLessThan(weighed.confidencePct);
  });

  it('manual entries and unknown amounts are penalised honestly', () => {
    const truth = pantryTruth({ id: 'm', name: 'Quinoa', source: 'manual', editedManually: true }, { today: TODAY });
    expect(truth.estimate).toBeNull();
    expect(truth.drivers.some((d) => d.id === 'quantity-certainty')).toBe(true);
    expect(truth.drivers.some((d) => d.id === 'manual-edit')).toBe(true);
    expect(truth.existsLikelihoodPct).toBeLessThan(truth.confidencePct + 11);
  });

  it('widens the expected range as confidence falls', () => {
    const confident = pantryTruth({ id: 'c1', name: 'Rice', qty: '600 g', confidence: 'confirmed', receiptId: 'r', lastConfirmedAt: '2026-08-22' }, { today: TODAY });
    const shaky = pantryTruth({ id: 'c2', name: 'Rice', qty: '600 g', confidence: 'unknown', lastConfirmedAt: '2026-05-01' }, { today: TODAY });
    const width = (t) => t.rangeHigh - t.rangeLow;
    expect(width(shaky)).toBeGreaterThan(width(confident));
    expect(shaky.rangeLow).toBeLessThan(600);
    expect(shaky.rangeHigh).toBeGreaterThan(600); // brackets the recorded amount
  });
});

describe('quick pantry check — typed questions, ranked by doubt', () => {
  const rows = [
    { id: 'q1', name: 'Milk', qty: '620 ml', confidence: 'probable', lastConfirmedAt: '2026-08-20' },   // decent → confirm
    { id: 'q2', name: 'Quinoa', confidence: 'unknown', source: 'manual' },                              // amount unknown
    { id: 'q3', name: 'Old jam', confidence: 'unknown', lastConfirmedAt: '2026-03-01' },                // existence
    { id: 'q4', name: 'Fresh bread', qty: '1 loaf', confidence: 'confirmed', receiptId: 'x', lastConfirmedAt: '2026-08-22' },
  ];

  it('asks the right question for each kind of uncertainty', () => {
    const out = quickCheck(rows, { events, today: TODAY, limit: 5 });
    const byName = Object.fromEntries(out.questions.map((q) => [q.name, q]));
    expect(byName['Quinoa'].type).toBe('amount');
    expect(byName['Quinoa'].prompt).toMatch(/roughly how much\?/);
    expect(byName['Old jam'].type).toBe('existence');
    expect(byName['Old jam'].prompt).toMatch(/still have it\?/);
    expect(byName.Milk.type).toBe('confirm');
    expect(byName.Milk.prompt).toMatch(/still around 620 ml\?/);
    expect(byName['Fresh bread']).toBeUndefined(); // confident rows are never asked
  });

  it('respects the limit and ranks lowest confidence first', () => {
    const out = quickCheck(rows, { events, today: TODAY, limit: 2 });
    expect(out.questions).toHaveLength(2);
    const pct = out.questions.map((q) => q.confidencePct);
    expect(pct).toEqual([...pct].sort((a, b) => a - b));
    expect(out.remaining).toBeGreaterThan(0);
  });

  it('says nothing needs checking when everything is trusted', () => {
    const out = quickCheck([{ id: 'ok', name: 'Bread', qty: '1', confidence: 'confirmed', receiptId: 'r', lastConfirmedAt: '2026-08-22' }],
      { today: TODAY });
    expect(out.questions).toHaveLength(0);
    expect(out.assumption).toMatch(/Nothing needs checking/);
  });
});
