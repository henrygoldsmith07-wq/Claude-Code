'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { filterErr } = require('../src/filter');

test('success output collapses to a single summary line', () => {
  const noise = Array.from({ length: 200 }, (_, i) => `  ✓ case ${i} (1ms)`);
  const output = [...noise, 'Tests  200 passed', 'Duration 3s'].join('\n');

  const { emitted } = filterErr(output, 0);

  assert.equal(emitted.split('\n').length, 1);
  assert.match(emitted, /passed/i);
});

test('success output with no recognizable summary still collapses', () => {
  const output = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');

  const { emitted } = filterErr(output, 0);

  assert.equal(emitted.split('\n').length, 1);
  assert.match(emitted, /suppressed/);
});

test('failure output keeps only failure-relevant lines', () => {
  const noise = Array.from({ length: 100 }, (_, i) => `  ✓ case ${i} (1ms)`);
  const failure = [
    'FAIL src/lib/billing.test.ts > createInvoice > applies discount correctly',
    'AssertionError: expected 9000 to equal 8000',
    'Expected: 8000',
    'Received: 9000',
    '❯ src/lib/billing.ts:142:19',
  ];
  const output = [...noise, ...failure, 'Tests  1 failed | 99 passed'].join('\n');

  const { emitted } = filterErr(output, 1);
  const lines = emitted.split('\n');

  assert.ok(lines.length < 15, `expected filtered output to be short, got ${lines.length} lines`);
  assert.ok(emitted.includes('AssertionError'));
  assert.ok(!emitted.includes('case 0 (1ms)'));
});

test('failure output with no matching pattern falls back to the tail', () => {
  const output = Array.from({ length: 50 }, (_, i) => `plain line ${i}`).join('\n');

  const { emitted } = filterErr(output, 1);

  assert.equal(emitted.split('\n').length, 15);
  assert.ok(emitted.includes('plain line 49'));
});
