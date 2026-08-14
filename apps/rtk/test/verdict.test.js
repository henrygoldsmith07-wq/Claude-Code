'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isRetry, retriesFrom, netTokenEffect, headlineVerdict } = require('../src/verdict');

function pairs({ both = 0, rawOnly = 0, rtkOnly = 0 }) {
  const out = [];
  for (let i = 0; i < both; i += 1) out.push({ raw: true, rtk: true });
  for (let i = 0; i < rawOnly; i += 1) out.push({ raw: true, rtk: false });
  for (let i = 0; i < rtkOnly; i += 1) out.push({ raw: false, rtk: true });
  return out;
}

test('detects a response that asked for the unfiltered output', () => {
  assert.equal(isRetry('I need to see the full output to tell what failed.').retry, true);
  assert.equal(isRetry('Please re-run without the filter so I can see the raw log.').retry, true);
});

test('does not count a hedge as a retry when the model still answered', () => {
  // "the error is X, though more would help" is an answer, not a round trip.
  const r = isRetry('The error is in billing.ts:14 — though I could not see the full stack.');
  assert.equal(r.retry, false);
  assert.match(r.reason, /still committed to an answer/);
});

test('counts a missing needle as a retry even when the model sounded confident', () => {
  const r = retriesFrom([
    { label: 'a', response: 'The failure is obviously in foo.ts.', foundNeedles: false },
  ]);
  assert.equal(r.retries, 1);
  assert.equal(r.detectedFromMissingNeedle, 1);
  assert.match(r.reasons[0].reason, /did not identify the failure/);
});

test('reports that retry detection under-counts', () => {
  const r = retriesFrom([{ label: 'a', response: 'The error is at line 4.', foundNeedles: true }]);
  assert.equal(r.retries, 0);
  assert.match(r.caveat, /under-counts/);
});

test('a saving with no extra retries is reported as a clean saving', () => {
  const e = netTokenEffect({ rawToolTokens: 50000, rtkToolTokens: 7000, rawRetries: 0, rtkRetries: 0 });
  assert.equal(e.extraRetries, 0);
  assert.equal(e.profitable, true);
  assert.match(e.note, /no additional retries/);
});

test('retries eat into the saving and the net is what is reported', () => {
  const e = netTokenEffect({ rawToolTokens: 50000, rtkToolTokens: 7000, rtkRetries: 2, calls: 10 });
  assert.equal(e.extraRetries, 2);
  assert.ok(e.net < e.grossSaved);
  assert.match(e.note, /net/);
});

test('a filter that causes enough retries is a net loss, and says so', () => {
  // The failure mode a filtered-output-only benchmark cannot see: 86% reduction
  // per call, and still losing tokens overall.
  const e = netTokenEffect({ rawToolTokens: 50000, rtkToolTokens: 7000, rtkRetries: 12, calls: 10 });
  assert.equal(e.profitable, false);
  assert.match(e.note, /net LOSS/);
});

test('refuses the headline claim on a synthetic corpus however good the numbers', () => {
  const v = headlineVerdict({
    pairs: pairs({ both: 500 }),
    rawToolTokens: 100000,
    rtkToolTokens: 20000,
    corpusIsReal: false,
  });
  assert.equal(v.supported, false);
  assert.ok(v.blockers.some((b) => /synthetic/i.test(b)));
});

test('refuses the headline claim when equivalence is not demonstrated', () => {
  // The current benchmark's shape: perfect results, sample far too small.
  const v = headlineVerdict({
    pairs: pairs({ both: 14 }),
    rawToolTokens: 100000,
    rtkToolTokens: 20000,
    corpusIsReal: true,
  });
  assert.equal(v.supported, false);
  assert.ok(v.blockers.some((b) => /equivalence is not demonstrated/i.test(b)));
  assert.match(v.note, /paired cases are needed/);
});

test('refuses the headline claim when RTK caused extra retries', () => {
  const v = headlineVerdict({
    pairs: pairs({ both: 500 }),
    rawToolTokens: 100000,
    rtkToolTokens: 20000,
    rtkRetries: 3,
    corpusIsReal: true,
  });
  assert.equal(v.supported, false);
  assert.ok(v.blockers.some((b) => /more retr/i.test(b)));
});

test('refuses the headline claim when the reduction is below the claimed floor', () => {
  const v = headlineVerdict({
    pairs: pairs({ both: 500 }),
    rawToolTokens: 100000,
    rtkToolTokens: 80000,
    corpusIsReal: true,
  });
  assert.equal(v.supported, false);
  assert.ok(v.blockers.some((b) => /below the 50% floor/i.test(b)));
});

test('makes the claim when every condition actually holds', () => {
  const v = headlineVerdict({
    pairs: pairs({ both: 480, rawOnly: 10, rtkOnly: 10 }),
    rawToolTokens: 200000,
    rtkToolTokens: 40000,
    rawRetries: 4,
    rtkRetries: 4,
    corpusIsReal: true,
  });
  assert.equal(v.supported, true);
  assert.match(v.claim, /cut tool-result tokens by 80%/);
  assert.match(v.claim, /no additional retries/);
  assert.match(v.claim, /statistically equivalent/);
  assert.match(v.claim, /90% CI/);
});

test('the claim never omits the interval it rests on', () => {
  const v = headlineVerdict({
    pairs: pairs({ both: 500 }),
    rawToolTokens: 200000,
    rtkToolTokens: 40000,
    corpusIsReal: true,
  });
  assert.equal(v.supported, true);
  assert.match(v.claim, /±5 points/);
});
