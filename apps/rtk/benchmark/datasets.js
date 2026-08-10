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

module.exports = { githubActionsLog, verboseTestLog, jsonSearchResults, cliVerboseLog, diffLog, stackLog };
