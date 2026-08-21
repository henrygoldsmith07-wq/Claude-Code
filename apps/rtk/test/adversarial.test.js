'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PARSERS } = require('../src/parsers');
const { compressJson, compressNdjson, compressAnnotations } = require('../src/structural');
const { countTokensForFamily, TOKENIZER_FAMILIES, FAMILY_HEADLINE_MODEL, COST_TABLE, costForTokens } = require('../src/tokens');

// Roadmap: adversarial failure cases + Unicode/ANSI handling + big-output robustness.

test('adversarial: CRLF line endings retain failure needles', () => {
  const output = ['FAIL src/a.test.ts > boom', 'AssertionError: expected 1 to equal 2', 'Tests  1 failed'].join('\r\n');
  const { emitted } = PARSERS.vitest.filter(output, 1);
  assert.ok(emitted.includes('FAIL'));
  assert.ok(emitted.includes('AssertionError'));
  assert.ok(emitted.includes('1 failed'));
});

test('adversarial: truncated mid-error (no trailing newline) keeps the error prefix', () => {
  const output = 'FAIL src/a.test.ts > boom\nAssertionError: expected 1 to eq';
  const { emitted } = PARSERS.vitest.filter(output, 1);
  assert.ok(emitted.includes('FAIL'));
  assert.ok(emitted.includes('AssertionError'));
});

test('adversarial: ANSI escapes around every token do not hide failures', () => {
  const esc = (s) => `\u001b[31m${s}\u001b[0m`;
  const output = [esc('FAIL') + ' src/a.test.ts > boom', esc('AssertionError:') + ' expected 1 to equal 2', '  at ' + esc('src/a.test.ts:10:5'), esc('Tests  1 failed')].join('\n');
  const { emitted } = PARSERS.vitest.filter(output, 1);
  assert.ok(emitted.includes('FAIL'));
  assert.ok(emitted.includes('AssertionError'));
  assert.ok(emitted.includes('src/a.test.ts:10:5'));
});

test('adversarial: deeply nested JSON compresses without throwing and keeps the error', () => {
  // Built as text, not via JSON.stringify: recursive serialisation of deep
  // nesting blows the call stack on runners with small stacks (Windows CI).
  // Depth stays well under every engine's recursion budget.
  let input = '{"error":"deep boom"}';
  for (let i = 0; i < 500; i++) input = `{"level":${i},"empty":"","next":${input}}`;
  const out = compressJson(input);
  assert.ok(typeof out === 'string', 'should return a string, got null');
  assert.ok(out.includes('deep boom'));
  assert.ok(out.length < input.length);
});

test('adversarial: binary-ish bytes never throw and failure markers survive', () => {
  const output = 'line\u0000one\nFAIL src/a.test.ts > boom\u0001\u0002\nAssertionError: nope\nTests  1 failed';
  const { emitted } = PARSERS.vitest.filter(output, 1);
  assert.ok(typeof emitted === 'string');
  assert.ok(emitted.includes('FAIL'));
});

test('adversarial: huge single line (1MB) filters to a string', () => {
  const output = 'x'.repeat(1_000_000) + '\nError: boom at src/app.ts:10:5';
  const { emitted } = PARSERS.generic.filter(output, 1);
  assert.ok(typeof emitted === 'string');
  assert.ok(emitted.includes('Error: boom'));
  assert.ok(emitted.length < output.length);
});

test('adversarial: multi-megabyte output filters within reason and keeps needles', () => {
  const output = Array.from({ length: 60_000 }, (_, i) => `line ${i} — ${'payload'.repeat(6)}`).join('\n') + '\nError: boom at src/app.ts:42:10';
  const t0 = performance.now();
  const { emitted } = PARSERS.generic.filter(output, 1);
  const elapsed = performance.now() - t0;
  assert.ok(typeof emitted === 'string');
  assert.ok(emitted.includes('Error: boom'));
  assert.ok(elapsed < 2000, `filter took ${elapsed.toFixed(0)}ms`);
});

test('adversarial: GHA annotated ::error file=...:: lines are retained (real CI format)', () => {
  const output = [
    'Run npm run lint',
    '  npx eslint .',
    '::error file=/src/app.ts,line=10,endLine=10,title=ESLint::F401 `os` imported but unused',
    '::error file=/src/lib/util.ts,line=42,endLine=42,title=ESLint::E501 Line too long',
    'Error: Process completed with exit code 1.',
  ].join('\n');
  const { emitted } = PARSERS.gha.filter(output, 1);
  assert.ok(emitted.includes('::error file=/src/app.ts'));
  assert.ok(emitted.includes('Process completed with exit code 1.'));
  assert.ok(emitted.includes('F401'));
});

test('adversarial: mixed NDJSON error lines survive compression', () => {
  const lines = Array.from({ length: 200 }, (_, i) => JSON.stringify(i === 100 ? { level: 'error', msg: 'boom', file: 'src/app.ts:10:5' } : { level: 'info', msg: `ok ${i}` }));
  const out = compressNdjson(lines.join('\n'));
  assert.ok(out !== null);
  assert.ok(out.includes('boom'));
});

test('adversarial: annotations with odd spacing are still compressed without dropping the error', () => {
  const output = '::group::Build\nsome noisy output line\n::error file=a.ts,line=3:: boom\n::endgroup::';
  const out = compressAnnotations(output);
  assert.ok(out !== null);
  assert.ok(out.includes('boom'));
});

// Multi-family tokenizer (roadmap: measure tokenizer savings across model families)
test('families: every js-tiktoken family counts tokens and produces positive savings on a noisy log', () => {
  const raw = Array.from({ length: 300 }, (_, i) => ` ✓ suite ${i % 5} > case ${i} (2ms)`).join('\n') + '\nTest Files  1 passed (1)\n      Tests  300 passed (300)\n   Duration  4.12s';
  const { emitted } = PARSERS.vitest.filter(raw, 0);
  for (const fam of TOKENIZER_FAMILIES) {
    const rawTokens = countTokensForFamily(raw, fam.id);
    const emittedTokens = countTokensForFamily(emitted, fam.id);
    assert.ok(rawTokens > 0, `${fam.id} should count tokens`);
    assert.ok(emittedTokens < rawTokens, `${fam.id} should save tokens (${emittedTokens} < ${rawTokens})`);
  }
});

test('families: unknown family falls back to the default encoder without throwing', () => {
  assert.ok(countTokensForFamily('hello world', 'nope') > 0);
});

test('families: new cost rows are present and positive', () => {
  for (const model of Object.values(FAMILY_HEADLINE_MODEL)) {
    assert.ok(costForTokens(1000, model) > 0, `${model} should have a cost`);
  }
  assert.ok(COST_TABLE['gpt-4'].blended > COST_TABLE['gpt-4o'].blended);
});
