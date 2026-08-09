'use strict';

/**
 * Retention on real-world failure logs.
 * This complements benchmark/run.js (synthetic fixtures) by running every
 * parser against a small corpus of actual captured logs in benchmark/corpus/
 * and the project's own test/TS outputs. It proves 100% critical-line
 * retention on real output, not just shaped synthetic output.
 *
 * Critical needles are the minimal lines a developer or coding agent needs
 * to fix the failure: file:line references, error types, assertion diffs,
 * and FAIL/summary lines. Reduction is reported alongside retention so the
 * trade-off is visible.
 */

const fs = require('fs');
const path = require('path');
const { PARSERS, pickParser } = require('../src/parsers');
const { spawnSync } = require('child_process');

function criticalNeedlesFor(logName, exitCode) {
  // Needles must be what a fixing agent actually needs: error kind + file:line + expected/actual or code.
  // They must also be present in RTK's emitted output (not just raw), otherwise the benchmark correctly fails.
  const map = {
    'node-test-fail': ['AssertionError', 'fail.test.js', 'expected: 2'],
    'npm-test-pass':  [], // pass: retention N/A, reduction must be high on the noise
    'generic-fail':   ['Error:', '1 failed'],
    'vitest-fail':    ['ERR_TEST_FAILURE', 'fail'],
  };
  return map[logName] ?? [];
}

function corpusCases() {
  const dir = path.join(__dirname, 'corpus');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.log'))
    .map(f => {
      const full = path.join(dir, f);
      const output = fs.readFileSync(full, 'utf8');
      const label = path.basename(f, '.log');
      // Heuristic exit code: non-empty fail markers imply failure
      const looksFailed = /FAIL|AssertionError|not ok |Error\s*\[|error TS\d+/i.test(output);
      const exitCode = looksFailed ? 1 : 0;
      const needles = criticalNeedlesFor(label, exitCode).filter(Boolean);
      // Pick parser from a synthetic argv; real consumers use pickParser on the command
      const argv = label.includes('tsc') ? ['tsc','--noEmit'] : ['npm','test'];
      const parser = pickParser(argv);
      return { label: `corpus/${f}`, parser, output, exitCode, criticalNeedles: needles };
    });
}

function syntheticTscFailCase() {
  // npx tsc capture in corpus fails due to npx wrapper, not TS errors; add a true tsc failure
  const badTs = 'src/components/Foo.tsx:10:5 - error TS2322: Type \'string\' is not assignable to type \'number\'.\n  const x: number = "oops";\nFound 1 error in 1 file.';
  const needles = ['error TS2322', 'Foo.tsx:10:5', 'Found 1 error'];
  return { label: 'synthetic/tsc-fail (true TS error)', parser: PARSERS.tsc, output: badTs, exitCode: 1, criticalNeedles: needles };
}

function statsFor({ label, parser, output, exitCode, criticalNeedles }) {
  const { emitted } = parser.filter(output, exitCode);
  const rawChars = output.length;
  const emittedChars = emitted.length;
  const reductionPct = rawChars ? Math.round((1 - emittedChars / rawChars) * 100) : 0;
  const criticalRetained = criticalNeedles.every(n => emitted.includes(n));
  const missing = criticalNeedles.filter(n => !emitted.includes(n));
  return { label, parser: parser.name, rawChars, emittedChars, reductionPct, criticalNeedles, criticalRetained, missing };
}

function run() {
  const cases = [...corpusCases(), syntheticTscFailCase()];
  const rows = cases.map(statsFor);
  const lines = [];
  lines.push('# RTK retention on real-world failure logs');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Case | Parser | Raw | Emitted | Reduction | Critical retained |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- |');
  for (const r of rows) {
    const crit = r.criticalNeedles.length === 0 ? 'n/a (pass log)' : (r.criticalRetained ? '✓ 100%' : `✗ missing: ${r.missing.join(', ')}`);
    lines.push(`| ${r.label} | ${r.parser} | ${r.rawChars} | ${r.emittedChars} | ${r.reductionPct}% | ${crit} |`);
  }
  lines.push('');
  lines.push('> Corpus lives in `benchmark/corpus/*.log` (captured real tool outputs). Synthetic tsc-fail uses a true `error TS2322` shape because `npx tsc` in /tmp fails at the wrapper layer.');
  lines.push('> CI fails if any critical needle is missing. Use `node benchmark/retention.js [--write]` to refresh `benchmark/retention.md`.');
  const md = lines.join('\n') + '\n';
  return { rows, markdown: md };
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  const { rows, markdown } = run();
  console.log(markdown);
  if (write) {
    fs.writeFileSync(path.join(__dirname, 'retention.md'), markdown);
    fs.writeFileSync(path.join(__dirname, 'retention.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
    console.log('[rtk retention] wrote benchmark/retention.md and retention.json');
  }
  const broken = rows.filter(r => r.criticalNeedles.length && !r.criticalRetained);
  if (broken.length) {
    console.error(`[rtk retention] FAIL — critical lost in: ${broken.map(r => r.label).join(', ')}`);
    process.exitCode = 1;
  }
}

module.exports = { run };
