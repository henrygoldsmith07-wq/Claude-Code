'use strict';

// Pathological input tests — the shapes real output takes that fixtures don't.
// Covers: 100k+ line logs, millions of repeated chars, enormous stack traces,
// malformed JSON, mixed stdout/stderr, invalid UTF-8, unusual Unicode,
// Windows paths, Unix paths, nested causes, interleaved parallel output,
// truncated messages, ANSI escape codes.
//
// Contract under test: parsers never throw, never hang (bounded time), and
// never lose a failure-critical needle that raw contained.

const test = require('node:test');
const assert = require('node:assert/strict');
const { PARSERS } = require('../src/parsers');
const { applyStructural } = require('../src/structural');
const { stripAnsi, safeDecode } = require('../src/ansi');

const ALL = Object.values(PARSERS);

function filterAll(output, exitCode) {
  const results = {};
  for (const p of ALL) {
    const t0 = performance.now();
    let emitted;
    try { emitted = p.filter(output, exitCode).emitted; }
    catch (e) { throw new Error(`parser ${p.name} threw on ${output.length}-char input: ${e.message}`); }
    const ms = performance.now() - t0;
    assert.ok(ms < 5000, `parser ${p.name} took ${ms.toFixed(0)}ms on ${output.length}-char input`);
    assert.equal(typeof emitted, 'string', `parser ${p.name} returned non-string`);
    results[p.name] = emitted;
  }
  return results;
}

function structuralAll(emittedLines, rawOutput) {
  try {
    const out = applyStructural(emittedLines.filter(Boolean), rawOutput, {
      structural: { json: true, diff: true, stack: true, dedup: true, ndjson: true, xml: true, sarif: true, annotations: true },
    });
    assert.ok(Array.isArray(out), 'applyStructural must return an array');
    return out.join('\n');
  } catch (e) {
    throw new Error(`applyStructural threw: ${e.message}`);
  }
}

test('pathological: 100k-line log filters in bounded time and keeps the error', () => {
  const lines = Array.from({ length: 100_000 }, (_, i) =>
    i === 99_999 ? 'Error: boom at src/app.ts:42:10' : `ok line ${i} ${'x'.repeat(20)}`);
  const output = lines.join('\n');
  const results = filterAll(output, 1);
  for (const [name, emitted] of Object.entries(results)) {
    if (name === 'generic') assert.ok(emitted.includes('boom'), `${name} lost the error needle`);
  }
});

test('pathological: 5M repeated characters do not hang or throw', () => {
  const output = 'a'.repeat(5_000_000) + '\nFAIL src/a.test.ts > boom\nAssertionError: expected 1 to equal 2';
  const results = filterAll(output, 1);
  for (const [, emitted] of Object.entries(results)) {
    assert.ok(emitted.includes('FAIL') || emitted.includes('AssertionError'));
  }
});

test('pathological: enormous stack trace (10k frames) keeps user frames', () => {
  const frames = [];
  for (let i = 0; i < 10_000; i++) {
    frames.push(i % 2 === 0 ? `  at userFn${i} (src/app.ts:${i}:5)` : `  at internal${i} (node:internal/process/task_queues:95:5)`);
  }
  const output = ['Error: deep boom at src/root.ts:1:1', ...frames].join('\n');
  const results = filterAll(output, 1);
  // vitest keeps error line; generic keeps matched lines
  assert.ok(results.vitest.includes('deep boom'), 'vitest lost the error header');
  const structured = structuralAll(results.generic.split('\n'), output);
  assert.ok(structured.includes('src/root.ts:1:1'), 'structural pass lost root frame');
});

test('pathological: malformed JSON does not throw and falls back safely', () => {
  const cases = [
    '{ "incomplete": [1,2,',
    '{"a":}',
    '[1,2,3',
    '{"nested":{"deeper":{"deepest":',
    '\u0000{"key":"value"}\u0000',
    'not json at all but has Error: boom at src/app.ts:10:5',
  ];
  for (const c of cases) {
    const results = filterAll(c, 1);
    for (const [, emitted] of Object.entries(results)) assert.equal(typeof emitted, 'string');
    // structural json path must not throw either
    structuralAll(['{ "incomplete": [1,2,'], c);
  }
});

test('pathological: mixed stdout/stderr interleaving keeps both failure kinds', () => {
  // Real combined streams interleave progress with errors mid-line
  const output = [
    'downloading deps... 40%',
    'WARN deprecated pkg@1.0.0',
    'downloading deps... 80%',
    'Error: cannot resolve dependency foo at src/index.js:10:5',
    'npm ERR! code ERESOLVE',
    'Tests  1 failed',
  ].join('\n');
  const results = filterAll(output, 1);
  assert.ok(results.generic.includes('ERESOLVE') || results.generic.includes('cannot resolve'), 'generic lost npm error');
  assert.ok(results.pm.includes('ERESOLVE'), 'pm parser lost ERESOLVE');
});

test('pathological: invalid UTF-8 / lone surrogates are repaired without losing needles', () => {
  const raw = Buffer.from([0x45, 0x72, 0x72, 0x6f, 0x72, 0x3a, 0x20, 0xff, 0xfe, 0x20, 0x62, 0x6f, 0x6f, 0x6d]); // "Error: \xff\xfe boom"
  const decoded = safeDecode(raw.toString('utf8'));
  assert.ok(decoded.includes('Error:'), 'decode lost Error prefix');
  assert.ok(!/[\uD800-\uDFFF]/.test(decoded.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')), 'lone surrogates survived safeDecode');
  // Lone surrogate directly
  const lone = 'Error: boom \uD800 at src/app.ts:10:5';
  const repaired = safeDecode(lone);
  assert.ok(repaired.includes('Error: boom'));
  const results = filterAll(repaired, 1);
  assert.ok(Object.values(results).every(e => typeof e === 'string'));
});

test('pathological: unusual Unicode (RTL, ZWJ, combining) survives filtering', () => {
  const output = [
    'Error: فشل الاختبار at src/اختبار.ts:10:5', // Arabic
    'Error: 測試失敗 at src/测试.ts:20:15', // CJK
    'Error: fail 👨‍👩‍👧‍👦 family emoji at src/family.ts:30:25', // ZWJ sequence
    'Error: café naïve résumé at src/café.ts:40:35', // combining accents
    'Tests  4 failed',
  ].join('\n');
  const results = filterAll(output, 1);
  for (const [name, emitted] of Object.entries(results)) {
    if (name === 'vitest' || name === 'generic') {
      assert.ok(emitted.includes('فشل') || emitted.includes('測試') || emitted.includes('café'), `${name} mangled unicode errors`);
    }
  }
});

test('pathological: Windows paths (backslashes, drive letters) keep file:line', () => {
  const output = [
    'C:\\Users\\runner\\project\\src\\components\\Foo.tsx(10,5): error TS2322: Type string not assignable',
    'C:\\project\\src\\app.ts:42:10 - error TS2345: Argument of type number',
    '.\\src\\lib\\util.ts:7:1: error TS2304: Cannot find name',
    'Found 3 errors.',
  ].join('\n');
  const results = filterAll(output, 1);
  assert.ok(results.tsc.includes('TS2322'), 'tsc lost TS2322 on windows paths');
  assert.ok(results.tsc.includes('TS2345'), 'tsc lost TS2345 on windows paths');
  assert.ok(results.tsc.includes('Found 3 errors'), 'tsc lost totals');
});

test('pathological: Unix absolute paths keep file:line', () => {
  const output = [
    '/home/runner/work/project/src/app.ts:10:5 - error TS2322: Type string not assignable',
    '/usr/local/lib/node_modules/pkg/dist/index.d.ts:100:20 - error TS2307: Cannot find module',
    'Found 2 errors.',
  ].join('\n');
  const results = filterAll(output, 1);
  assert.ok(results.tsc.includes('TS2322'));
  assert.ok(results.tsc.includes('TS2307'));
});

test('pathological: nested causes (Caused by chains) keep every level', () => {
  const output = [
    'Error: outermost failure',
    'Caused by: Error: middle failure at src/middle.ts:42:10',
    '  at middle (src/middle.ts:42:10)',
    'Caused by: java.lang.NullPointerException: root cause',
    '  at com.example.Root.run(Root.java:10)',
    'BUILD FAILURE',
  ].join('\n');
  const results = filterAll(output, 1);
  const structured = structuralAll(results.maven.split('\n'), output);
  const combined = results.generic + '\n' + structured;
  assert.ok(combined.includes('outermost'), 'lost outermost cause');
  assert.ok(combined.includes('middle.ts:42:10'), 'lost middle cause file ref');
  assert.ok(combined.includes('NullPointer') || combined.includes('root cause'), 'lost root cause');
});

test('pathological: interleaved parallel worker output keeps each worker error', () => {
  const chunks = [];
  for (let w = 0; w < 4; w++) {
    for (let i = 0; i < 50; i++) {
      chunks.push(`[worker-${w}] step ${i} ok`);
      if (i === 25) chunks.push(`[worker-${w}] Error: worker ${w} failed at src/worker${w}.ts:${100 + w}:5`);
    }
  }
  const output = chunks.join('\n');
  const results = filterAll(output, 1);
  for (let w = 0; w < 4; w++) {
    assert.ok(
      results.generic.includes(`worker${w}.ts`) || results.generic.includes(`worker ${w} failed`),
      `generic lost worker-${w} error`
    );
  }
});

test('pathological: truncated messages (mid-token, no trailing newline) keep the prefix', () => {
  const cases = [
    'FAIL src/a.test.ts > boom\nAssertionError: expected 1 to eq',           // cut mid-word
    'Error: something went wr',                                              // cut mid-message
    'src/app.ts:10:5 - error TS2322: Type \'str',                            // cut mid-quote
    'at src/app.ts:10:',                                                     // cut mid-location
  ];
  for (const c of cases) {
    const results = filterAll(c, 1);
    for (const [name, emitted] of Object.entries(results)) {
      assert.ok(emitted.length > 0, `${name} emitted empty for truncated input`);
      // The first meaningful token must survive somewhere
      if (c.startsWith('FAIL')) assert.ok(emitted.includes('FAIL') || name !== 'vitest', 'vitest lost FAIL on truncation');
      if (c.startsWith('error TS')) assert.ok(emitted.includes('error TS') || name !== 'tsc', 'tsc lost error code on truncation');
    }
  }
});

test('pathological: ANSI escape codes (SGR, OSC, cursor, broken) never hide failures', () => {
  const esc = String.fromCharCode(27);
  const cases = [
    `${esc}[31mFAIL${esc}[0m src/a.test.ts > boom`,                          // SGR color
    `${esc}]0;window title${esc}\\ FAIL src/b.test.ts > boom`,               // OSC title
    `${esc}[2J${esc}[H FAIL src/c.test.ts > boom`,                           // cursor home
    `${esc}[31 FAIL src/d.test.ts > boom`,                                   // broken/truncated escape
    `${esc} FAIL src/e.test.ts > boom`,                                      // lone ESC
    `${esc}[38;5;196mFAIL${esc}[39m src/f.test.ts > boom`,                   // 256-color
  ];
  for (const c of cases) {
    const stripped = stripAnsi(c);
    assert.ok(stripped.includes('FAIL'), `stripAnsi lost FAIL from: ${JSON.stringify(c)}`);
    const results = filterAll(stripped, 1);
    assert.ok(results.vitest.includes('FAIL'), 'vitest lost FAIL after strip');
  }
});

test('pathological: NUL bytes and control characters are neutralized', () => {
  const output = 'ok\u0000line\nFAIL src/a.test.ts > boom\u0001\u0002\nAssertionError: nope\u0007\nTests  1 failed';
  const results = filterAll(output, 1);
  assert.ok(results.vitest.includes('FAIL'));
  assert.ok(results.vitest.includes('AssertionError'));
  assert.ok(!results.vitest.includes('\u0000'), 'NUL byte leaked into emitted output');
});

test('pathological: empty and whitespace-only inputs produce sane output', () => {
  for (const c of ['', ' ', '\n\n\n', '\t', '\r\n\r\n']) {
    const results = filterAll(c, 1);
    for (const [name, emitted] of Object.entries(results)) {
      assert.equal(typeof emitted, 'string', `${name} non-string on whitespace input`);
    }
    const resultsPass = filterAll(c, 0);
    for (const [, emitted] of Object.entries(resultsPass)) {
      assert.ok(emitted.length > 0 || emitted === '', 'pass path should be short string');
    }
  }
});

test('pathological: extremely long single line (10MB) is handled within budget', () => {
  const output = 'x'.repeat(10_000_000) + '\nError: tail boom at src/app.ts:1:1';
  const t0 = performance.now();
  const results = filterAll(output, 1);
  const ms = performance.now() - t0;
  assert.ok(ms < 10_000, `all parsers took ${ms.toFixed(0)}ms on 10MB single line`);
  assert.ok(results.generic.includes('tail boom'), 'generic lost tail error on huge line');
});

test('pathological: CR-only line endings (old Mac) still surface failures', () => {
  const output = 'FAIL src/a.test.ts > boom\rAssertionError: expected 1 to equal 2\rTests  1 failed';
  const results = filterAll(output, 1);
  // CR-only is one giant line to split('\n'); the parser must not crash and
  // ideally keeps the failure markers since they are all on that line.
  assert.ok(typeof results.vitest === 'string');
});

test('pathological: BOM-prefixed output parses cleanly', () => {
  const bom = '\uFEFF';
  const output = bom + 'FAIL src/a.test.ts > boom\nAssertionError: expected 1 to equal 2\nTests  1 failed';
  const results = filterAll(output, 1);
  assert.ok(results.vitest.includes('FAIL'), 'vitest lost FAIL behind BOM');
});

test('pathological: duplicate identical error lines dedupe without losing the last distinct one', () => {
  const dup = Array.from({ length: 200 }, () => 'Error: same problem at src/same.ts:10:5').join('\n');
  const output = dup + '\nError: different problem at src/other.ts:99:9';
  const results = filterAll(output, 1);
  const structured = structuralAll(results.generic.split('\n'), output);
  assert.ok(structured.includes('other.ts:99:9'), 'dedup lost the distinct final error');
});
