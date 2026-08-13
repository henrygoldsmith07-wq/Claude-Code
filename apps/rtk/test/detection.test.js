'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pickParser, PARSERS } = require('../src/parsers');

// Parser-detection accuracy (roadmap: improve parser-detection accuracy).
// The full labeled corpus + CI gate lives in benchmark/detection.js; these
// unit tests pin the specific fixes so `npm test` catches regressions too.

test('detection: yarn build with Next output picks next (not pm)', () => {
  const out = 'Creating an optimized production build...\nFailed to compile.\n./src/app/page.tsx:42:10\nType error: boom';
  assert.equal(pickParser(['yarn', 'build'], out), PARSERS.nextBuild);
});

test('detection: ruff rule code after file:line:col is detected via sniffing', () => {
  const out = 'src/app.py:20:1: E501 line too long\nFound 1 error.';
  assert.equal(pickParser(['python', '-m', 'lint'], out), PARSERS.ruff);
});

test('detection: bun test routes to vitest', () => {
  const out = 'FAIL src/a.test.ts > boom\nAssertionError: nope\nTests  1 failed';
  assert.equal(pickParser(['bun', 'test'], out), PARSERS.vitest);
});

test('detection: git diff output stays generic (git parser is for conflicts)', () => {
  const out = 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -10,7 +10,7 @@\n-  const x: number = "oops";\n+  const x: number = 1;';
  assert.equal(pickParser(['git', 'diff'], out), PARSERS.generic);
});

test('detection: npm ci routes to pm even with npm error output', () => {
  const out = 'npm error code ERESOLVE\nnpm error peer react@"^17.0.0" from @myorg/ui@2.1.0';
  assert.equal(pickParser(['npm', 'ci'], out), PARSERS.pm);
});

test('detection: pnpm install routes to pm', () => {
  const out = 'ERR_PNPM_OUTDATED_LOCKFILE Cannot install with frozen-lockfile';
  assert.equal(pickParser(['pnpm', 'install'], out), PARSERS.pm);
});

test('detection: Windows cmd wrapper around npm test routes to vitest', () => {
  const out = 'FAIL src/a.test.ts > boom\nAssertionError: nope\nTests  1 failed';
  assert.equal(pickParser(['cmd', '/c', 'npm', 'test'], out), PARSERS.vitest);
});

test('detection: ESLint output keeps eslint (not ruff) on argv', () => {
  const out = '/src/app.ts:10:5  error  F401  `os` imported but unused\n✖ 2 problems (2 errors, 0 warnings)';
  assert.equal(pickParser(['npx', 'eslint', '.'], out), PARSERS.eslint);
});

test('detection: GHA annotations detected via output sniff on generic argv', () => {
  const out = '::error file=src/app.ts,line=10:: boom\nError: Process completed with exit code 1.';
  assert.equal(pickParser(['bash', './scripts/build.sh'], out), PARSERS.gha);
});
