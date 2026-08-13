'use strict';

/**
 * Parser-detection accuracy benchmark — roadmap: "improve parser-detection
 * accuracy". Scores `pickParser(argv, output)` against a labeled corpus of
 * realistic (argv, output) pairs covering every parser, then reports the miss
 * list. CI fails if any labeled case is mis-detected (curated corpus = 100%
 * target), so accuracy regressions are caught at the source rather than in the
 * field.
 *
 * Usage:
 *   node benchmark/detection.js [--write]
 */

const fs = require('fs');
const path = require('path');
const { pickParser, PARSERS } = require('../src/parsers');

// Labeled corpus: argv (as the CLI would see it, incl. the wrapper `rtk`)
// plus the output the tool produced. `expected` is the parser the CLI should
// select. Includes argv-fast-path cases AND output-sniff cases.
function buildCases() {
  const vFail = ['FAIL src/a.test.ts > boom', 'AssertionError: expected 1 to equal 2', '  at src/a.test.ts:10:5', 'Tests  1 failed'].join('\n');
  const vPass = [' ✓ src/a.test.ts > ok (2ms)', 'Test Files  1 passed (1)', '      Tests  10 passed (10)', '   Duration  0.5s'].join('\n');
  return [
    { label: 'tsc via argv', argv: ['npx', 'tsc', '--noEmit'], output: 'src/a.ts:5:1 - error TS2322: Type string not assignable\nFound 1 error', expected: 'tsc' },
    { label: 'tsc via output sniff', argv: ['npm', 'run', 'typecheck'], output: 'src/a.ts:5:1 - error TS2345: Argument of type number is not assignable\nFound 1 error in 1 file', expected: 'tsc' },
    { label: 'vitest via argv', argv: ['npx', 'vitest', 'run'], output: vFail, expected: 'vitest' },
    { label: 'vitest via npm test', argv: ['npm', 'test'], output: vFail, expected: 'vitest' },
    { label: 'vitest via bun test', argv: ['bun', 'test'], output: vFail, expected: 'vitest' },
    { label: 'vitest pass via npm test', argv: ['npm', 'test'], output: vPass, expected: 'vitest' },
    { label: 'jest via argv', argv: ['npx', 'jest', '--runInBand'], output: '● foo > bar\nAssertionError: expected 1 to equal 2\n  at src/foo.test.ts:10:5\nTests: 1 failed, 1 total', expected: 'jest' },
    { label: 'eslint via argv', argv: ['npx', 'eslint', '.'], output: '/src/app.ts:10:5  error  F401  `os` imported but unused\n✖ 2 problems (2 errors, 0 warnings)', expected: 'eslint' },
    { label: 'ruff via argv', argv: ['ruff', 'check', '.'], output: 'src/app.py:10:5: F401 `os` imported but unused\nFound 2 errors.', expected: 'ruff' },
    { label: 'ruff via output sniff', argv: ['python', '-m', 'lint'], output: 'src/app.py:20:1: E501 line too long\nFound 1 error.', expected: 'ruff' },
    { label: 'mypy via argv', argv: ['mypy', 'src'], output: 'src/app.py:10: error: Incompatible types\nFound 1 error in 1 file', expected: 'mypy' },
    { label: 'pytest via argv', argv: ['pytest', 'tests/'], output: 'FAILED tests/test_foo.py::test_bar - AssertionError: assert 1 == 2\n1 failed, 2 passed in 0.12s', expected: 'pytest' },
    { label: 'pytest via output sniff', argv: ['tox'], output: 'FAILED tests/test_x.py::test_y - TypeError: boom\nFile "tests/test_x.py", line 10, in test_y\n2 failed, 8 passed in 1.2s', expected: 'pytest' },
    { label: 'cargo via argv', argv: ['cargo', 'test'], output: 'error[E0308]: mismatched types\n --> src/main.rs:10:5\nwarning: unused variable\nFinished test 1 failed', expected: 'cargo' },
    { label: 'go test via argv', argv: ['go', 'test', './...'], output: '--- FAIL: TestFoo (0.00s)\n    foo_test.go:10: expected 1 got 2\nFAIL\tgithub.com/foo/bar\t0.012s', expected: 'gotest' },
    { label: 'gradle via argv', argv: ['./gradlew', 'test'], output: 'FAILURE: Build failed with an exception\nTask :app:compile FAILED\ne: /src/App.kt:10:5 Unresolved reference\nBUILD FAILED in 2s', expected: 'gradle' },
    { label: 'maven via argv', argv: ['mvn', 'test'], output: '[ERROR] COMPILATION ERROR\n[ERROR] /src/App.java:[10,5] cannot find symbol\n[INFO] BUILD FAILURE', expected: 'maven' },
    { label: 'docker via argv', argv: ['docker', 'build', '-t', 'x', '.'], output: 'Step 3/5 : RUN npm ci\nERROR: failed to solve: process "/bin/sh -c npm ci" did not complete', expected: 'docker' },
    { label: 'k8s via argv', argv: ['kubectl', 'get', 'pods'], output: 'NAME READY STATUS RESTARTS\nmy-pod 0/1 CrashLoopBackOff 5', expected: 'k8s' },
    { label: 'terraform via argv', argv: ['terraform', 'plan'], output: 'Error: Invalid value\n on main.tf line 10, in resource "aws_instance" "web"', expected: 'terraform' },
    { label: 'npm ci failure', argv: ['npm', 'ci'], output: 'npm ERR! code ERESOLVE\nnpm ERR! Could not resolve dependency foo', expected: 'pm' },
    { label: 'pnpm install failure', argv: ['pnpm', 'install'], output: 'ERR_PNPM_OUTDATED_LOCKFILE Cannot install with frozen-lockfile', expected: 'pm' },
    { label: 'GHA annotations via sniff', argv: ['bash', './scripts/build.sh'], output: '::group::Build\n::error file=src/app.ts,line=10:: boom\nError: Process completed with exit code 1.\n::endgroup::', expected: 'gha' },
    { label: 'git merge conflict', argv: ['git', 'merge', 'feature'], output: 'CONFLICT (content): Merge conflict in src/app.ts\nAuto-merging src/app.ts\nerror: could not apply abc123', expected: 'git' },
    { label: 'git diff stays generic', argv: ['git', 'diff'], output: 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -10,7 +10,7 @@\n-  const x: number = "oops";\n+  const x: number = 1;', expected: 'generic' },
    { label: 'next build via argv', argv: ['npx', 'next', 'build'], output: 'Compiled successfully\nBuild completed in 12s', expected: 'nextBuild' },
    { label: 'next build via sniff', argv: ['npm', 'run', 'build'], output: 'Creating an optimized production build...\nFailed to compile.\n./src/app/page.tsx:42:10\nType error: boom', expected: 'nextBuild' },
    { label: 'generic command', argv: ['ls', '-la'], output: 'total 32\ndrwxr-xr-x  build  package.json  src  test', expected: 'generic' },
    { label: 'cat build log (no marker)', argv: ['cat', 'build.log'], output: 'building...\nEverything up-to-date.\nBuild complete', expected: 'generic' },
    { label: 'Windows npm test (cmd)', argv: ['cmd', '/c', 'npm', 'test'], output: vFail, expected: 'vitest' },
    { label: 'yarn build with next output', argv: ['yarn', 'build'], output: 'Failed to compile.\n./src/app/page.tsx:42:10', expected: 'nextBuild' },
    { label: 'terraform apply success', argv: ['terraform', 'apply'], output: 'Apply complete! Resources: 3 added, 0 changed, 0 destroyed.', expected: 'terraform' },
  ];
}

function evaluate(cases) {
  return cases.map((c) => {
    const got = pickParser(c.argv, c.output);
    const expected = PARSERS[c.expected];
    return { ...c, gotName: got.name, expectedName: expected.name, ok: got === expected };
  });
}

function render(rows) {
  const lines = [];
  lines.push('# RTK benchmark — parser-detection accuracy');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  const total = rows.length;
  const ok = rows.filter((r) => r.ok).length;
  const pct = Math.round((ok / total) * 1000) / 10;
  lines.push(`**Accuracy: ${ok}/${total} (${pct}%)** — every labeled (argv, output) pair must pick the right parser.`);
  lines.push('');
  lines.push('| Case | argv | Expected | Detected | Verdict |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const r of rows) {
    lines.push(`| ${r.label} | \`${r.argv.join(' ')}\` | ${r.expectedName} | ${r.gotName} | ${r.ok ? '✓' : '✗ MISS'} |`);
  }
  lines.push('');
  lines.push('> Covers the argv fast-path AND output-sniffing path for every parser, plus ambiguous cases that must fall through to `generic` (git diff) and cross-package-manager variants (`npm`/`pnpm`/`bun`/`yarn`, Windows `cmd`).');
  lines.push('> CI fails if any row is a miss — detection accuracy is a 100% target on this curated corpus, so regressions surface here before the field.');
  return lines.join('\n') + '\n';
}

function run({ writeArtifacts = false } = {}) {
  const cases = buildCases();
  const rows = evaluate(cases);
  const markdown = render(rows);
  if (writeArtifacts) {
    fs.writeFileSync(path.join(__dirname, 'detection.md'), markdown);
    fs.writeFileSync(path.join(__dirname, 'detection.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  }
  return { rows, markdown };
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  const { rows, markdown } = run({ writeArtifacts: write });
  console.log(markdown);
  if (write) console.log('[rtk detection] wrote benchmark/detection.md and detection.json');
  const misses = rows.filter((r) => !r.ok);
  if (misses.length) {
    console.error(`[rtk detection] FAIL — ${misses.length} miss(es): ${misses.map((r) => `${r.label} (expected ${r.expectedName}, got ${r.gotName})`).join('; ')}`);
    process.exitCode = 1;
  } else {
    console.log(`[rtk detection] PASS — ${rows.length}/${rows.length} cases detected correctly`);
  }
}

module.exports = { run, buildCases, evaluate };
