'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_MARGIN,
  wilsonInterval,
  tostPaired,
  mcnemarExact,
  requiredPairs,
} = require('../src/equivalence');

/** n pairs where both arms succeed, plus explicit discordant pairs. */
function pairs({ both = 0, rawOnly = 0, rtkOnly = 0, neither = 0 }) {
  const out = [];
  for (let i = 0; i < both; i += 1) out.push({ raw: true, rtk: true });
  for (let i = 0; i < rawOnly; i += 1) out.push({ raw: true, rtk: false });
  for (let i = 0; i < rtkOnly; i += 1) out.push({ raw: false, rtk: true });
  for (let i = 0; i < neither; i += 1) out.push({ raw: false, rtk: false });
  return out;
}

test('wilson interval does not claim certainty from a perfect small sample', () => {
  // Wald would give [1, 1] here — zero uncertainty from 14 observations.
  const ci = wilsonInterval(14, 14);
  assert.equal(ci.point, 1);
  assert.ok(ci.lower < 0.85, `lower bound should admit real uncertainty, got ${ci.lower}`);
  assert.ok(ci.upper > 0.999);
});

test('wilson interval narrows as evidence accumulates', () => {
  const small = wilsonInterval(14, 14);
  const large = wilsonInterval(1000, 1000);
  assert.ok(large.lower > small.lower);
});

test('the current 14-case benchmark cannot demonstrate equivalence', () => {
  // This is the headline finding: a perfect 14/14 vs 14/14 result is not
  // evidence of equivalence, because 14 pairs only bound the difference at
  // about ±21 points.
  const result = tostPaired(pairs({ both: 14 }));
  assert.equal(result.equivalent, false);
  assert.equal(result.discordant, 0);
  assert.match(result.reason, /More cases needed/);
});

test('a large run with no disagreement does demonstrate equivalence', () => {
  const result = tostPaired(pairs({ both: 400 }));
  assert.equal(result.equivalent, true);
  assert.match(result.note, /within ±5 points/);
});

test('equivalence fails when RTK loses materially more cases than it wins', () => {
  const result = tostPaired(pairs({ both: 300, rawOnly: 40, rtkOnly: 5 }));
  assert.equal(result.equivalent, false);
  assert.ok(result.difference < 0);
  assert.match(result.reason, /may be worse/);
});

test('equivalence also fails when RTK is materially better', () => {
  // Equivalence is two-sided on purpose: a filter that changes success in
  // either direction is not behaving like a transparent one.
  const result = tostPaired(pairs({ both: 300, rawOnly: 5, rtkOnly: 40 }));
  assert.equal(result.equivalent, false);
  assert.match(result.reason, /may be better/);
});

test('a handful of balanced disagreements at scale is still equivalent', () => {
  const result = tostPaired(pairs({ both: 480, rawOnly: 10, rtkOnly: 10 }));
  assert.equal(result.equivalent, true);
  assert.equal(result.discordant, 20);
});

test('only discordant pairs carry information about the difference', () => {
  const a = tostPaired(pairs({ both: 200, rawOnly: 5, rtkOnly: 5 }));
  const b = tostPaired(pairs({ both: 100, neither: 100, rawOnly: 5, rtkOnly: 5 }));
  assert.equal(a.difference, b.difference);
  assert.equal(a.discordant, b.discordant);
});

test('empty input reports no data rather than equivalence', () => {
  const result = tostPaired([]);
  assert.equal(result.equivalent, false);
  assert.match(result.note, /cannot be shown/);
});

test('mcnemar says plainly that no difference is not equivalence', () => {
  const result = mcnemarExact(2, 3);
  assert.ok(result.p > 0.05);
  assert.match(result.note, /This is not equivalence/);
});

test('mcnemar detects a real one-sided difference', () => {
  const result = mcnemarExact(20, 2);
  assert.ok(result.p < 0.05);
  assert.match(result.note, /Significant difference/);
});

test('no-difference and not-equivalent can both be true at once', () => {
  // The combination that means "not enough data", and the reason both tests
  // are reported rather than either alone.
  const sample = pairs({ both: 20, rawOnly: 1, rtkOnly: 1 });
  const tost = tostPaired(sample);
  const mc = mcnemarExact(1, 1);
  assert.equal(tost.equivalent, false);
  assert.ok(mc.p > 0.05);
});

test('required sample size is reported before data is collected', () => {
  const need = requiredPairs();
  assert.ok(need.pairs > 100, `expected a non-trivial sample, got ${need.pairs}`);
  assert.equal(need.margin, DEFAULT_MARGIN);
  assert.match(need.note, /paired cases are needed/);
});

test('a tighter margin demands more cases', () => {
  const loose = requiredPairs({ margin: 0.1 });
  const tight = requiredPairs({ margin: 0.02 });
  assert.ok(tight.pairs > loose.pairs);
});
