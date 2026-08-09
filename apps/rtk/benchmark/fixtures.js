'use strict';

/**
 * Deterministic synthetic fixtures shaped like real tool outputs.
 * All fixtures are inline — no filesystem, no external tools required.
 * Sizes are chosen to mirror real runs so the reduction numbers are credible.
 */

function vitestPassFixture({ lines = 800 } = {}) {
  // Real vitest --run output: ~0.8-1k lines of ✓ per test plus 3 summary lines
  const head = Array.from({ length: lines - 3 }, (_, i) => ` ✓ src/lib/foo${i % 10}.test.ts > suite ${i % 5} > case ${i} (2ms)`);
  const tail = [' Test Files  10 passed (10)', '      Tests  200 passed (200)', '   Duration  3.21s'];
  return head.concat(tail).join('\n');
}

function vitestFailFixture({ lines = 800, fails = 2 } = {}) {
  const passing = Array.from({ length: lines - 30 - fails * 6 }, (_, i) => ` ✓ src/lib/foo${i % 10}.test.ts > suite > case ${i} (2ms)`);
  const failures = [];
  for (let k = 0; k < fails; k++) {
    failures.push(
      `FAIL src/lib/billing.test.ts > createInvoice > case ${k}`,
      `AssertionError: expected 9000 to equal 8000 [${k}]`,
      `Expected: 8000`,
      `Received: 9000`,
      ` ❯ src/lib/billing.ts:14${2 + k}:19`,
      `   at src/lib/billing.test.ts:4${k}:12`,
    );
  }
  const tail = [' Test Files  1 failed | 9 passed (10)', '      Tests  2 failed | 198 passed (200)', '   Duration  3.21s'];
  return passing.concat(failures, tail).join('\n');
}

function tscPassFixture() {
  // tsc --noEmit on a clean project prints nothing; the shell wrapper + cwd/prefix
  // lines are the only noise rtk has to suppress. Synthetic 2-line wrapper is realistic.
  return ['tsc --noEmit', ''].join('\n');
}

function tscFailFixture({ errors = 4 } = {}) {
  const lines = [];
  for (let i = 0; i < errors; i++) {
    lines.push(`src/components/Foo.tsx:${10 + i}:5 - error TS2322: Type 'string' is not assignable to type 'number'.`);
    lines.push(`  const x: number = "oops ${i}";`);
  }
  lines.push(`Found ${errors} errors in ${errors} files.`);
  return lines.join('\n');
}

function nextBuildFailFixture() {
  return [
    'Creating an optimized production build...',
    ' ✓ Compiled successfully',
    'Failed to compile.',
    './src/app/page.tsx:42:10',
    "Type error: Property 'foo' does not exist on type 'Bar'.",
    '  42 |   return foo.bar;',
    '     |          ^^^',
    'Collecting page data...',
  ].join('\n');
}

function nextBuildPassFixture() {
  // Successful next build is ~400 chars of route table / summary — rtk keeps it.
  // Reduction is intentionally modest on success; the value is on failure.
  return [
    'Creating an optimized production build...',
    ' ✓ Compiled successfully',
    'Collecting page data...',
    'Generating static pages (5/5)',
    'Collecting build traces...',
    'Finalizing page optimization...',
    'Route (app)                              Size     First Load JS',
    '┌ ○ /                                    5.2 kB   87 kB',
    '├ ○ /about                               1.1 kB   83 kB',
    'Build completed',
  ].join('\n');
}

function genericFailFixture() {
  // Generic tool: totals line must match the TOTALS_RE pattern (Tests / Suites / Snapshots / Time)
  return [
    'ok line 1',
    'ok line 2',
    'Error: something broke at step 2',
    '  at foo.js:10:5',
    'Tests  1 failed',
  ].join('\n');
}

module.exports = {
  vitestPassFixture,
  vitestFailFixture,
  tscPassFixture,
  tscFailFixture,
  nextBuildPassFixture,
  nextBuildFailFixture,
  genericFailFixture,
};
