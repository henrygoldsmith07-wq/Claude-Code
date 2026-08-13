'use strict';

/**
 * Representative datasets for token-saving benchmarks.
 * Each generator is deterministic and shaped like real tool output so numbers are credible.
 * Used by benchmark/run.js and the new datasets report.
 */

function githubActionsLog({ jobs = 3, stepsPerJob = 8 } = {}) {
  const lines = [];
  for (let j = 0; j < jobs; j++) {
    lines.push(`::group::Job ${j}: build`);
    for (let s = 0; s < stepsPerJob; s++) lines.push(`Run step ${s} — checkout / setup-node / npm ci / build ${'·'.repeat(20)}`);
    if (j === jobs - 1) {
      lines.push('Error: Process completed with exit code 1.');
      lines.push('  at action.js:42:10');
      lines.push('  at run (action.js:10:5)');
    } else lines.push('Job passed');
    lines.push('::endgroup::');
  }
  return lines.join('\n');
}

function verboseTestLog({ kind = 'vitest', tests = 300 } = {}) {
  const lines = [];
  for (let i = 0; i < tests; i++) lines.push(` ${kind === 'vitest' ? '✓' : '✔'} suite ${i % 6} > case ${i} (2ms)`);
  lines.push(` Tests  ${tests} passed (${tests})`, ' Duration  4.12s');
  return lines.join('\n');
}

function jsonSearchResults({ hits = 120 } = {}) {
  const arr = Array.from({ length: hits }, (_, i) => ({
    id: `hit-${i}`,
    score: +(1 - i * 0.005).toFixed(3),
    title: `Result ${i} — lorem ipsum dolor sit amet consectetur`,
    snippet: 'A long snippet that would bloat context '.repeat(6),
    url: `https://example.com/p/${i}`,
    meta: { tags: ['a', 'b', 'c'], empty: '', extra: null },
  }));
  return JSON.stringify({ query: 'example search', total: hits, hits: arr, facets: {}, tookMs: 42 }, null, 2);
}

function cliVerboseLog({ lines = 2000 } = {}) {
  return Array.from({ length: lines }, (_, i) => `line ${String(i).padStart(4, '0')} — ${'x'.repeat(40)} ${i % 100 === 0 ? 'Error: flaky timeout' : ''}`.trim()).join('\n');
}

function diffLog({ files = 4 } = {}) {
  const parts = [];
  for (let f = 0; f < files; f++) {
    parts.push(`diff --git a/src/file${f}.ts b/src/file${f}.ts`, `--- a/src/file${f}.ts`, `+++ b/src/file${f}.ts`, `@@ -10,7 +10,7 @@`);
    for (let i = 0; i < 40; i++) parts.push(i === 20 ? '-  const x: number = "oops";' : i === 21 ? '+  const x: number = 1;' : `  line ${i} unchanged content here`);
  }
  return parts.join('\n');
}

function stackLog() {
  return ['Error: boom', '  at doThing (src/app.ts:42:10)', '  at run (src/app.ts:10:5)', '  at node:internal/process/task_queues:95:5', '  at node_modules/vitest/dist/run.js:10:5', '  at src/app.test.ts:12:3'].join('\n');
}

// --- Real-world CI failure shapes (roadmap: "add logs from real CI failures") ---

function npmCiFailLog() {
  return [
    'npm error code ERESOLVE',
    'npm error While resolving: my-app@1.0.0',
    'npm error Found: react@18.2.0',
    'npm error node_modules/react',
    'npm error   react@"^18.2.0" from the root project',
    'npm error',
    'npm error Could not resolve dependency:',
    'npm error peer react@"^17.0.0" from @myorg/ui@2.1.0',
    'npm error node_modules/@myorg/ui',
    'npm error   @myorg/ui@"^2.1.0" from the root project',
    'npm error',
    'npm error Conflicting peer dependency: react@17.0.2',
    'npm error node_modules/react',
    'npm error   peer react@"^17.0.0" from @myorg/ui@2.1.0',
    'npm error node_modules/@myorg/ui',
    'npm error',
    'npm error Fix the upstream dependency conflict, or retry',
    'npm error this command with --force or --legacy-peer-deps',
    'npm error to accept an incorrect (and potentially broken) dependency resolution.',
    'npm error',
    'npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2024-01-15T10_32_00_000Z-debug-0.log',
  ].join('\n');
}

function cargoBuildFailLog() {
  return [
    '   Compiling my-app v0.1.0 (/workspace)',
    'error[E0308]: mismatched types',
    ' --> src/main.rs:10:5',
    '  |',
    '10 |     let n: i32 = compute();',
    '  |         ^   -------- this expression has type `i64`',
    '  |         |',
    '  |         expected `i32`, found `i64`',
    '  |',
    '   = note: expected type `i32`',
    '              found type `i64`',
    'warning: unused variable: `tmp`',
    ' --> src/lib.rs:42:9',
    '  |',
    '42 |     let tmp = 1;',
    '  |         ^^^ help: if this is intentional, prefix it with an underscore: `_tmp`',
    '  |',
    '  = note: `#[warn(unused_variables)]` on by default',
    'error: could not compile `my-app` (bin "my-app") due to 1 previous error',
  ].join('\n');
}

function playwrightFailLog() {
  return [
    '  1) tests/login.spec.ts:18:5 › login with valid credentials',
    '',
    '    Error: expect(received).toEqual(expected)',
    '',
    '    - Expected  - 2',
    '    + Received  + 1',
    '',
    '    - "redirected": false,',
    '    - "token": "abc",',
    '    + "redirected": true,',
    '',
    '    Expected: {"redirected": false, "token": "abc"}',
    '    Received: {"redirected": true}',
    '',
    '       at tests/login.spec.ts:20:15',
    '',
    '    attachment: screenshot.png (image/png)',
    '',
    '  2 failed, 18 passed, 0 skipped (21 tests, 3.4s)',
  ].join('\n');
}

function eslintScanLog() {
  const lines = [];
  const files = ['app.ts', 'lib/util.ts', 'components/Button.tsx', 'pages/index.tsx', 'server.ts'];
  const codes = ['F401', 'E501', 'N2023', 'S101', 'R105'];
  for (let i = 0; i < files.length; i++) {
    lines.push(`/src/${files[i]}:${10 + i}:${5 + i}  error  ${codes[i]}  unused variable / line too long / forbidden any  eslint`);
  }
  lines.push('', '✖ 5 problems (5 errors, 0 warnings)');
  lines.push('', '  5 errors and 0 warnings potentially fixable with the `--fix` option.');
  return lines.join('\n');
}

function ghaRealFailLog() {
  return [
    'Run npm run lint',
    '  npm run lint',
    '  shell: /usr/bin/bash -e {0}',
    '  env:',
    '    CI: true',
    '  npx eslint .',
    '::error file=/src/app.ts,line=10,endLine=10,title=ESLint::F401 `os` imported but unused',
    '::error file=/src/lib/util.ts,line=42,endLine=42,title=ESLint::E501 Line too long',
    'Error: Process completed with exit code 1.',
    '  at cleanup (/home/runner/work/_actions/actions/setup-node/v4/dist/setup/index.js:4:5)',
  ].join('\n');
}

function pytestTracebackLog() {
  return [
    '============================= test session starts ==============================',
    'collected 10 items',
    '',
    'tests/test_billing.py ....F.....',
    '',
    '_______________________________ test_billing_calc ________________________________',
    '',
    '    def test_billing_calc():',
    '>       assert calc(100, 3) == 310',
    'E       assert 300 == 310',
    'E        +  where 300 = calc(100, 3)',
    '',
    'tests/test_billing.py:8: AssertionError',
    '',
    '=========================== short test summary info ============================',
    'FAILED tests/test_billing.py::test_billing_calc - AssertionError: assert 300 == 310',
    '========================= 1 failed, 9 passed in 0.42s ==========================',
  ].join('\n');
}

module.exports = { githubActionsLog, verboseTestLog, jsonSearchResults, cliVerboseLog, diffLog, stackLog, npmCiFailLog, cargoBuildFailLog, playwrightFailLog, eslintScanLog, ghaRealFailLog, pytestTracebackLog };
