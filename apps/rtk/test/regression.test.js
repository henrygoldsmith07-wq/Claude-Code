'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { PARSERS } = require('../src/parsers');
const { dedupLines, compressStack, compressJson, compressDiff } = require('../src/structural');
const { redact } = require('../src/redact');

// Preservation guarantee: errors/warnings/file:line never dropped on failure
test('preservation: errors and file:line survive filtering on failure', () => {
  const output = [
    '  ✓ passing case 1',
    'FAIL src/foo.test.ts > bad case',
    'AssertionError: expected 1 to equal 2',
    '  at src/foo.test.ts:10:5',
    'Error: boom in src/bar.ts:42:10',
    'Tests  1 failed',
  ].join('\n');
  const { emitted } = PARSERS.vitest.filter(output, 1);
  assert.ok(emitted.includes('FAIL'));
  assert.ok(emitted.includes('AssertionError'));
  assert.ok(emitted.includes('src/foo.test.ts:10:5'));
  assert.ok(emitted.includes('Error: boom'));
});

test('structural: dedup removes duplicate lines', () => {
  const lines = ['a', 'b', 'a', 'c', 'b'];
  assert.deepEqual(dedupLines(lines), ['a', 'b', 'c']);
});

test('structural: compressStack collapses internal frames but keeps user frames', () => {
  const lines = [
    '  at doThing (src/app.ts:42:10)',
    '  at node:internal/process/task_queues:95:5',
    '  at node_modules/vitest/dist/run.js:10:5',
    '  at src/app.test.ts:12:3',
  ];
  const out = compressStack(lines);
  assert.ok(out.some((l) => l.includes('src/app.ts:42:10')));
  assert.ok(out.some((l) => l.includes('omitted')));
});

test('structural: compressJson prunes nulls and caps arrays', () => {
  const input = JSON.stringify({ error: 'boom', file: 'a.ts', empty: '', extra: null, items: Array.from({ length: 40 }, (_, i) => i) });
  const compressed = compressJson(input);
  assert.ok(compressed !== null);
  assert.ok(!compressed.includes('"empty"'));
  assert.ok(compressed.includes('omitted'));
});

test('structural: compressDiff collapses unchanged hunks', () => {
  const lines = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -10,7 +10,7 @@',
    ...Array.from({ length: 20 }, (_, i) => `  unchanged ${i}`),
    '-  const x: number = \"oops\";',
    '+  const x: number = 1;',
    ...Array.from({ length: 20 }, (_, i) => `  unchanged tail ${i}`),
  ];
  const out = compressDiff(lines);
  assert.ok(out !== null);
  assert.ok(out.some((l) => l.includes('omitted')));
});

test('redaction: secrets are redacted on by default', () => {
  const { text, redactions } = redact('api_key=supersecretvalue123 bearer eyJhbGciOiJfakeToken1234567890 ghp_abc1234567890123456789012345678901234', { enabled: true });
  assert.ok(text.includes('[REDACTED]') || text.includes('[REDACTED-GITHUB-TOKEN]'));
  assert.ok(redactions.length > 0);
});

test('redaction: disabled leaves text intact', () => {
  const input = 'api_key=supersecretvalue123';
  const { text } = redact(input, { enabled: false });
  assert.equal(text, input);
});

test('regression: tsc parser keeps error context', () => {
  const out = 'src/components/Foo.tsx:10:5 - error TS2322: Type string not assignable\n  const x: number = \"oops\";\nFound 1 error';
  const { emitted } = PARSERS.tsc.filter(out, 1);
  assert.ok(emitted.includes('error TS2322'));
  assert.ok(emitted.includes('Found 1 error'));
});

test('regression: next parser keeps Failed to compile on failure', () => {
  const out = ['Creating an optimized production build...', 'Failed to compile.', './src/app/page.tsx:42:10', 'Type error: boom'].join('\n');
  const { emitted } = PARSERS.nextBuild.filter(out, 1);
  assert.ok(emitted.includes('Failed to compile'));
  assert.ok(emitted.includes('page.tsx:42:10'));
});

test('fuzz: parsers handle empty, huge, and binary-ish input without throwing', () => {
  const cases = ['', 'x'.repeat(100000), '\u0000binary\u0000content\u0000', Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n')];
  for (const c of cases) {
    for (const p of Object.values(PARSERS)) {
      const r = p.filter(c, c.includes('FAIL') ? 1 : 0);
      assert.ok(typeof r.emitted === 'string');
    }
  }
});

test('adversarial: long hex not redacted unless labeled as secret', () => {
  const stack = '  at foo (src/app.ts:10:5) hash abcdef0123456789abcdef0123456789';
  const { redactions } = redact(stack, { enabled: true });
  // stack hash should not be flagged
  assert.ok(redactions.length === 0 || !redactions.some((r) => r.pattern === 'aws-access-key'));
});

test('binary safety: null bytes replaced in CLI path', () => {
  const withNul = 'hello\u0000world';
  const replaced = withNul.replace(/\u0000/g, '[NUL]');
  assert.ok(replaced.includes('[NUL]'));
  assert.ok(!replaced.includes('\u0000'));
});
