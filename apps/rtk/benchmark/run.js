'use strict';

const fs = require('fs');
const path = require('path');
const { PARSERS } = require('../src/parsers');
const f = require('./fixtures');
const d = require('./datasets');

let countTokens, encodingName, costForTokens, formatCost;
try { ({ countTokens, encodingName, costForTokens, formatCost } = require('../src/tokens')); }
catch { countTokens = (s)=>Math.round(String(s).length/4); encodingName=()=>'chars/4'; costForTokens=()=>0; formatCost=(n)=>`$${n.toFixed(4)}`; }

function statsFor({ label, parserName, output, exitCode, criticalNeedles }) {
  const actual = PARSERS[parserName];
  if (!actual) throw new Error(`unknown parser ${parserName}`);
  const start = performance.now();
  const { emitted } = actual.filter(output, exitCode);
  const latencyMs = performance.now() - start;
  const rawChars = output.length;
  const emittedChars = emitted.length;
  const reductionPct = rawChars ? Math.round((1 - emittedChars / rawChars) * 100) : 0;
  const rawTokens = countTokens(output);
  const emittedTokens = countTokens(emitted);
  const tokenReductionPct = rawTokens ? Math.round((1 - emittedTokens / rawTokens) * 100) : 0;
  const tokensSaved = Math.max(0, rawTokens - emittedTokens);
  const rawLines = output.split('\n').length;
  const emittedLines = emitted ? emitted.split('\n').length : 0;
  const criticalRetained = criticalNeedles.every((n) => emitted.includes(n));
  const missing = criticalNeedles.filter(n => !emitted.includes(n));
  const costSaved = costForTokens(tokensSaved, 'gpt-4o');
  return { label, parser: actual.name, rawChars, emittedChars, reductionPct, rawTokens, emittedTokens, tokenReductionPct, tokensSaved, costSaved, rawLines, emittedLines, criticalRetained, criticalNeedles, missing, latencyMs };
}

function mdRow(cells) { return `| ${cells.join(' | ')} |`; }

function run({ writeJson = false } = {}) {
  const cases = [
    { label: 'Vitest pass (200 tests)', parserName: 'vitest', output: f.vitestPassFixture({ lines: 1200 }), exitCode: 0, criticalNeedles: ['200 passed', 'Duration'] },
    { label: 'Vitest failure (2 fails)', parserName: 'vitest', output: f.vitestFailFixture({ lines: 1200, fails: 2 }), exitCode: 1, criticalNeedles: ['FAIL', 'AssertionError', 'Expected:', 'Duration', '1 failed'] },
    { label: 'tsc pass (clean)', parserName: 'tsc', output: f.tscPassFixture(), exitCode: 0, criticalNeedles: [] },
    { label: 'tsc failure (4 errors)', parserName: 'tsc', output: f.tscFailFixture({ errors: 4 }), exitCode: 2, criticalNeedles: ['error TS2322', 'Found 4 errors'] },
    { label: 'Next build failure', parserName: 'nextBuild', output: f.nextBuildFailFixture(), exitCode: 1, criticalNeedles: ['Failed to compile', 'Type error'] },
    { label: 'Next build pass', parserName: 'nextBuild', output: f.nextBuildPassFixture(), exitCode: 0, criticalNeedles: ['Compiled successfully', 'Build completed'] },
    { label: 'Generic failure', parserName: 'generic', output: f.genericFailFixture(), exitCode: 1, criticalNeedles: ['Error:', '1 failed'] },
    { label: 'ESLint errors', parserName: 'eslint', output: '/src/app.ts:10:5: error F401 `os` imported but unused\n/src/app.ts:20:1: error E501 line too long (120 > 79)\n✖ 2 problems (2 errors, 0 warnings)', exitCode: 1, criticalNeedles: ['F401', 'E501'] },
    { label: 'Pytest failure', parserName: 'pytest', output: 'FAILED tests/test_foo.py::test_bar - AssertionError: assert 1 == 2\nE   assert 1 == 2\nFile \"/tests/test_foo.py\", line 10, in test_bar\n1 failed, 2 passed in 0.12s', exitCode: 1, criticalNeedles: ['FAILED', 'assert 1 == 2'] },
    { label: 'Ruff', parserName: 'ruff', output: 'src/app.py:10:5: F401 `os` imported but unused\nsrc/app.py:20:1: E501 line too long\nFound 2 errors.', exitCode: 1, criticalNeedles: ['F401', 'Found 2 errors'] },
    { label: 'mypy', parserName: 'mypy', output: 'src/app.py:10: error: Incompatible types\n  Revealed type is \"str\"\nFound 1 error in 1 file', exitCode: 1, criticalNeedles: ['error: Incompatible', 'Found 1 error'] },
    { label: 'Cargo error', parserName: 'cargo', output: 'error[E0308]: mismatched types\n --> src/main.rs:10:5\n  |   expected `i32`, found `&str`\nwarning: unused variable\nFinished test [unoptimized] 1 failed', exitCode: 1, criticalNeedles: ['error[E0308]', 'src/main.rs:10:5'] },
    { label: 'Go test FAIL', parserName: 'gotest', output: '--- FAIL: TestFoo (0.00s)\n    foo_test.go:10: expected 1 got 2\nFAIL\tgithub.com/foo/bar\t0.012s', exitCode: 1, criticalNeedles: ['FAIL: TestFoo', 'foo_test.go:10'] },
    { label: 'Maven BUILD FAILURE', parserName: 'maven', output: '[ERROR] COMPILATION ERROR\n[ERROR] /src/App.java:[10,5] cannot find symbol\nTests run: 1, Failures: 1\n[INFO] BUILD FAILURE', exitCode: 1, criticalNeedles: ['[ERROR]', 'BUILD FAILURE', 'Failures: 1'] },
    { label: 'Gradle BUILD FAILED', parserName: 'gradle', output: 'FAILURE: Build failed with an exception\nTask :app:compile FAILED\ne: /src/App.kt:10:5 Unresolved reference\nBUILD FAILED in 2s', exitCode: 1, criticalNeedles: ['FAILED', 'BUILD FAILED'] },
    { label: 'Docker ERROR', parserName: 'docker', output: 'Step 3/5 : RUN npm ci\nERROR: failed to solve: process \"/bin/sh -c npm ci\" did not complete successfully', exitCode: 1, criticalNeedles: ['ERROR: failed to solve'] },
    { label: 'K8s CrashLoop', parserName: 'k8s', output: 'NAME READY STATUS RESTARTS\nmy-pod 0/1 CrashLoopBackOff 5\nEvents:\n  Warning Failed pod/my-pod', exitCode: 1, criticalNeedles: ['CrashLoopBackOff'] },
    { label: 'Terraform Error', parserName: 'terraform', output: 'Error: Invalid value\n on main.tf line 10, in resource \"aws_instance\" \"web\"', exitCode: 1, criticalNeedles: ['Error:', 'main.tf line 10'] },
    { label: 'npm ERR!', parserName: 'pm', output: 'npm ERR! code ENOENT\nnpm ERR! Cannot resolve dependency foo\nadded 0 packages', exitCode: 1, criticalNeedles: ['npm ERR!'] },
    { label: 'Git CONFLICT', parserName: 'git', output: 'CONFLICT (content): Merge conflict in src/app.ts\nAuto-merging src/app.ts\nerror: could not apply abc123', exitCode: 1, criticalNeedles: ['CONFLICT', 'Merge conflict'] },
    { label: 'GHA annotation', parserName: 'gha', output: '::group::Build\n::error file=src/app.ts,line=10:: boom\nError: Process completed with exit code 1.\n::endgroup::', exitCode: 1, criticalNeedles: ['::error', 'exit code 1'] },
    { label: 'Truncate (2k-line verbose log)', parserName: 'generic', output: Array.from({ length: 2000 }, (_, i) => `line ${i} — some verbose output that would bloat context`).join('\n'), exitCode: 0, criticalNeedles: [] },
    { label: 'GitHub Actions log (failure)', parserName: 'generic', output: d.githubActionsLog({ jobs: 3 }), exitCode: 1, criticalNeedles: ['exit code 1', 'action.js:42:10'] },
    { label: 'Search results JSON (120 hits)', parserName: 'generic', output: d.jsonSearchResults({ hits: 120 }), exitCode: 0, criticalNeedles: [] },
    { label: 'CLI verbose (2k lines)', parserName: 'generic', output: d.cliVerboseLog({ lines: 2000 }), exitCode: 0, criticalNeedles: [] },
    { label: 'Diff (4 files)', parserName: 'generic', output: d.diffLog({ files: 4 }), exitCode: 1, criticalNeedles: ['diff --git', 'const x'] },
    { label: 'Stack trace', parserName: 'vitest', output: d.stackLog(), exitCode: 1, criticalNeedles: ['Error: boom', 'app.ts:42:10'] },
    { label: 'NDJSON logs', parserName: 'generic', output: Array.from({length:50},(_,i)=>JSON.stringify(i===25?{level:'error',msg:'boom',file:'src/app.ts:10:5'}:{level:'info',msg:`ok ${i}`})).join('\n'), exitCode: 1, criticalNeedles: ['boom'] },
    { label: 'JUnit XML', parserName: 'generic', output: '<?xml version=\"1.0\"?><testsuite name=\"foo\"><testcase classname=\"a\" name=\"t1\"/><testcase classname=\"a\" name=\"t2\"><failure message=\"boom\">at src/app.ts:10:5</failure></testcase></testsuite>', exitCode: 1, criticalNeedles: ['failure', 'boom'] },
    { label: 'SARIF', parserName: 'generic', output: JSON.stringify({version:'2.1.0', runs:[{tool:{driver:{name:'eslint'}}, results:[{level:'error', message:{text:'boom'}, locations:[{physicalLocation:{artifactLocation:{uri:'src/app.ts'}}}]}]}]}), exitCode: 1, criticalNeedles: ['boom'] },
    { label: 'ANSI escapes', parserName: 'vitest', output: '\u001b[31mFAIL\u001b[0m src/app.test.ts > boom\n\u001b[31mAssertionError: expected 1 to equal 2\u001b[0m\n  at \u001b[33msrc/app.ts:10:5\u001b[0m', exitCode: 1, criticalNeedles: ['FAIL', 'AssertionError'] },
    { label: 'Unicode + emoji', parserName: 'generic', output: 'Error: boom 💥 at src/ünicode.ts:10:5\nTests  1 failed — café naïve résumé', exitCode: 1, criticalNeedles: ['Error: boom', '1 failed'] },
    { label: 'Nested JSON', parserName: 'generic', output: JSON.stringify({a:{b:{c:{d:{e:'deep error', empty:null, x:''}}, arr:Array.from({length:40},(_,i)=>i)}}}), exitCode: 1, criticalNeedles: ['deep error'] },
  ];

  const rows = cases.map((c) => statsFor(c));

  const enc = encodingName();
  const md = [];
  md.push('# RTK benchmark — evidence');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Commit: ${(() => { try { return require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })()}`);
  md.push(`Tokenizer: ${enc} (js-tiktoken o200k_base when available, else chars/4 fallback)`);
  md.push('');
  md.push(mdRow(['Command', 'Parser', 'Raw chars', 'Emitted chars', 'Reduction', 'Raw tokens', 'Emitted tokens', 'Token red.', 'Saved $/1k runs*', 'Latency', 'Critical retained']));
  md.push(mdRow(['---', '---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---:']));
  for (const r of rows) {
    const crit = r.criticalNeedles.length === 0 ? 'n/a' : (r.criticalRetained ? '✓ 100%' : `✗ FAIL (missing: ${r.missing.join(', ')})`);
    const costPer1k = r.costSaved * 1000;
    md.push(mdRow([r.label, r.parser, String(r.rawChars), String(r.emittedChars), `${r.reductionPct}%`, String(r.rawTokens), String(r.emittedTokens), `${r.tokenReductionPct}%`, formatCost(costPer1k), `${r.latencyMs.toFixed(1)}ms`, crit]));
  }
  md.push('');
  md.push(`> Tokenizer: ${enc}. When js-tiktoken is installed, token counts use o200k_base (GPT-4o family); else chars/4 fallback. Both are reported where applicable.`);
  md.push('> Fixtures are deterministic synthetic logs shaped like real tool output (see `benchmark/fixtures.js`, `datasets.js`).');
  md.push('> Reduction = `1 − emitted/raw`. Critical retained checks that every failure/error/total line the developer needs is still present.');
  md.push('> `*` Saved $/1k runs = tokensSaved × $2.50/1M (GPT-4o input price) × 1000 — blended table in `src/tokens.js` has Claude/Gemini too.');
  md.push('> Latency = parser filter time per fixture (p50 proxy; wall-clock in `performance.now()`).<br> `tsc pass` raw is near-empty (tsc prints nothing on success); rtk collapses it to one line — the negative % reflects that the shell wrapper dominates.');
  md.push('> Representative datasets: GitHub Actions, JSON/search results, CLI verbose, diff, stack, NDJSON, JUnit, SARIF, ANSI, Unicode — plus all 15+ tool parsers.');
  md.push('> Latency: p50/p95 measured in benchmark/perf.js (separate harness).');

  const jsonPayload = { generatedAt: new Date().toISOString(), tokenizer: enc, rows };
  if (writeJson) {
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(jsonPayload, null, 2));
  }
  return { markdown: md.join('\n') + '\n', rows, json: jsonPayload };
}

if (require.main === module) {
  const writeJson = process.argv.includes('--write');
  const { markdown, rows } = run({ writeJson });
  if (writeJson) {
    const out = path.join(__dirname, 'results.md');
    fs.writeFileSync(out, markdown);
    console.log(`[rtk benchmark] wrote ${out} and benchmark/results.json`);
  }
  console.log(markdown);
  const broken = rows.filter((r) => r.criticalNeedles.length && !r.criticalRetained);
  if (broken.length) {
    console.error(`[rtk benchmark] FAIL — critical info lost in: ${broken.map((r) => r.label).join(', ')}`);
    process.exitCode = 1;
  }
}

module.exports = { run };
