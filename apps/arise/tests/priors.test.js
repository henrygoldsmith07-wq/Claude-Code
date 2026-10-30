// Tests for apps/arise/src/lib/priors.js — the versioned assumption table.
//
// These are pure data helpers: no DOM, no clock, no network. The frozen default
// is asserted to stay frozen, because backtest reproducibility depends on it.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ARISE_PRIORS,
  PROGRESSION_PRIORS,
  resolveArisePriors,
  empiricalOrPrior,
  clamp,
} from '../src/lib/priors.js';

test('the shipped priors are deeply frozen so benchmarks stay reproducible', () => {
  assert.equal(Object.isFrozen(DEFAULT_ARISE_PRIORS), true);
  assert.equal(Object.isFrozen(DEFAULT_ARISE_PRIORS.progression), true);
  assert.equal(Object.isFrozen(DEFAULT_ARISE_PRIORS.progression.strategies), true);
  assert.throws(() => { 'use strict'; DEFAULT_ARISE_PRIORS.progression.daysPerMonth = 31; }, TypeError);
  assert.equal(DEFAULT_ARISE_PRIORS.progression.daysPerMonth, 30.44);
});

test('PROGRESSION_PRIORS aliases the frozen default progression section', () => {
  assert.equal(PROGRESSION_PRIORS, DEFAULT_ARISE_PRIORS.progression);
});

test('resolveArisePriors merges a partial override over the defaults without mutating them', () => {
  const before = JSON.stringify(DEFAULT_ARISE_PRIORS.progression.defaultTargetReps);
  const resolved = resolveArisePriors({ progression: { defaultTargetReps: '5–8' } });
  assert.equal(resolved.progression.defaultTargetReps, '5–8');
  assert.equal(resolved.progression.historyWindow, DEFAULT_ARISE_PRIORS.progression.historyWindow, 'untouched keys keep the default');
  assert.equal(resolved.sessionQuality.score.start, DEFAULT_ARISE_PRIORS.sessionQuality.score.start, 'sibling sections keep the default');
  assert.equal(JSON.stringify(DEFAULT_ARISE_PRIORS.progression.defaultTargetReps), before, 'the frozen default is untouched');
});

test('resolveArisePriors replaces arrays wholesale (no element-wise merge surprises)', () => {
  const resolved = resolveArisePriors({
    progression: { rom: { ladders: { squat: ['quarter', 'half', 'full'] } } },
  });
  assert.deepEqual(resolved.progression.rom.ladders.squat, ['quarter', 'half', 'full']);
  assert.deepEqual(resolved.progression.rom.ladders.hinge, DEFAULT_ARISE_PRIORS.progression.rom.ladders.hinge);
});

test('resolveArisePriors tolerates null/undefined overrides and never hands out the live default', () => {
  assert.deepEqual(resolveArisePriors(null).progression, DEFAULT_ARISE_PRIORS.progression);
  assert.deepEqual(resolveArisePriors().backtest, DEFAULT_ARISE_PRIORS.backtest);
  assert.notEqual(resolveArisePriors(null), DEFAULT_ARISE_PRIORS);
});

// Regression: clamp() fell through Math.max/Math.min and returned NaN for a
// non-finite input. Every caller passes a conservative min (e.g.
// personalisedRate.appliedLoadPctMin, 0 for probabilities), so a NaN used to
// poison the very value the clamp was guarding.
test('clamp collapses a NaN value to the conservative lower bound', () => {
  assert.equal(clamp(NaN, 1, 3), 1);
  assert.equal(clamp(NaN, 0, 1), 0);
  assert.equal(clamp(Infinity, 0.015, 0.06), 0.06, '+Infinity saturates at max');
  assert.equal(clamp(-Infinity, 0.015, 0.06), 0.015, '-Infinity saturates at min');
});

test('clamp ignores a broken bound instead of nan-ing a finite value', () => {
  assert.equal(clamp(0.03, 0.015, NaN), 0.015, 'a NaN max falls back to min');
  assert.equal(clamp(0.03, NaN, 0.06), 0.06, 'a NaN min falls back to max');
  assert.equal(clamp(5, 1, Infinity), 5, 'an open upper bound leaves a finite value alone');
  assert.equal(clamp(5, -Infinity, 3), 3, 'an open lower bound still honours max');
});

test('clamp keeps its ordinary ordering contract for finite inputs', () => {
  assert.equal(clamp(2, 1, 3), 2);
  assert.equal(clamp(0, 1, 3), 1);
  assert.equal(clamp(5, 1, 3), 3);
  assert.equal(clamp(-1, 0, 1), 0);
});

test('empiricalOrPrior keeps the prior until the minimum sample count is met', () => {
  assert.deepEqual(
    empiricalOrPrior({ prior: 0.7, estimate: 0.4, samples: 2, minimumSamples: 5 }),
    { value: 0.7, source: 'prior', samples: 2, minimumSamples: 5 },
  );
  assert.deepEqual(
    empiricalOrPrior({ prior: 0.7, estimate: 0.4, samples: 5, minimumSamples: 5 }),
    { value: 0.4, source: 'empirical', samples: 5, minimumSamples: 5 },
  );
});

test('empiricalOrPrior refuses unusable estimates even with enough samples', () => {
  for (const estimate of [NaN, Infinity, -Infinity, 'not-a-number', null]) {
    const r = empiricalOrPrior({ prior: 0.7, estimate, samples: 9, minimumSamples: 3 });
    assert.equal(r.source, 'prior', `estimate ${String(estimate)} must not replace the prior`);
    assert.equal(r.value, 0.7);
  }
});

test('empiricalOrPrior normalises missing or nonsense arguments to the prior', () => {
  assert.deepEqual(empiricalOrPrior(), { value: undefined, source: 'prior', samples: 0, minimumSamples: 1 });
  assert.equal(empiricalOrPrior({ prior: 0.5, samples: -4 }).samples, 0, 'a negative sample count counts as zero');
  assert.equal(empiricalOrPrior({ prior: 0.5, samples: '7', minimumSamples: '3' }).minimumSamples, 3, 'numeric strings coerce');
  assert.equal(empiricalOrPrior({ prior: 0.5, samples: '7', minimumSamples: 0 }).minimumSamples, 1, 'the minimum never drops below 1');
});
