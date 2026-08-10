'use strict';

const fs = require('fs');
const path = require('path');
const { PARSERS } = require('../src/parsers');
const f = require('./fixtures');
const d = require('./datasets');

function statsFor({ label, parserName, output, exitCode, criticalNeedles }) {
  const actual = PARSERS[parserName];
  if (!actual) throw new Error(`unknown parser ${parserName}`);
  const { emitted } = actual.filter(output, exitCode);
  const rawChars = output.length;
  const emittedChars = emitted.length;
  const reductionPct = rawChars ? Math.round((1 - emittedChars / rawChars) * 100) : 0;
  const rawLines = output.split('\n').length;
  const emittedLines = emitted ? emitted.split('\n').length : 0;
  const criticalRetained = criticalNeedles.every((n) => emitted.includes(n));
  return { label, parser: actual.name, rawChars, emittedChars, reductionPct, rawLines, emittedLines, criticalRetained, criticalNeedles };
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
    { label: 'Truncate (2k-line verbose log)', parserName: 'generic', output: Array.from({ length: 2000 }, (_, i) => `line ${i} — some verbose output that would bloat context`).join('\n'), exitCode: 0, criticalNeedles: [] },
    // Representative datasets (GitHub, logs, JSON, search, CLI, diff, stack)
    { label: 'GitHub Actions log (failure)', parserName: 'generic', output: d.githubActionsLog({ jobs: 3 }), exitCode: 1, criticalNeedles: ['exit code 1', 'action.js:42:10'] },
    { label: 'Search results JSON (120 hits)', parserName: 'generic', output: d.jsonSearchResults({ hits: 120 }), exitCode: 0, criticalNeedles: [] },
    { label: 'CLI verbose (2k lines)', parserName: 'generic', output: d.cliVerboseLog({ lines: 2000 }), exitCode: 0, criticalNeedles: [] },
    { label: 'Diff (4 files)', parserName: 'generic', output: d.diffLog({ files: 4 }), exitCode: 1, criticalNeedles: ['diff --git', 'const x'] },
    { label: 'Stack trace', parserName: 'vitest', output: d.stackLog(), exitCode: 1, criticalNeedles: ['Error: boom', 'app.ts:42:10'] },
  ];

  const rows = cases.map((c) => statsFor(c));

  const md = [];
  md.push('# RTK benchmark — evidence');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Commit: ${(() => { try { return require('child_process').execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })()}`);
  md.push('');
  md.push(mdRow(['Command', 'Parser', 'Raw chars', 'Emitted chars', 'Reduction', 'Raw lines', 'Emitted lines', 'Critical retained']));
  md.push(mdRow(['---', '---', '---:', '---:', '---:', '---:', '---:', '---:']));
  for (const r of rows) {
    const crit = r.criticalNeedles.length === 0 ? 'n/a' : (r.criticalRetained ? '✓ 100%' : '✗ FAIL');
    md.push(mdRow([r.label, r.parser, String(r.rawChars), String(r.emittedChars), `${r.reductionPct}%`, String(r.rawLines), String(r.emittedLines), crit]));
  }
  md.push('');
  md.push('> Fixtures are deterministic synthetic logs shaped like real tool output (see `benchmark/fixtures.js`, `datasets.js`).');
  md.push('> Reduction = `1 − emitted/raw`. Critical retained checks that every failure/error/total line the developer needs is still present.');
  md.push('> `tsc pass` raw is near-empty (tsc prints nothing on success); rtk collapses it to one line — the negative % reflects that the shell wrapper dominates.');
  md.push('> Representative datasets: GitHub Actions, JSON/search results, CLI verbose, diff, and stack traces demonstrate structural filtering at scale.');

  const jsonPayload = { generatedAt: new Date().toISOString(), rows };
  if (writeJson) {
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(jsonPayload, null, 2));
  }
  return { markdown: md.join('\n') + '\n', rows, json: jsonPayload };
}

if (require.main === module) {
  const writeJson = process.argv.includes('--write');
  const { markdown } = run({ writeJson });
  if (writeJson) {
    const out = path.join(__dirname, 'results.md');
    fs.writeFileSync(out, markdown);
    console.log(`[rtk benchmark] wrote ${out} and benchmark/results.json`);
  }
  console.log(markdown);
  const { rows } = run();
  const broken = rows.filter((r) => r.criticalNeedles.length && !r.criticalRetained);
  if (broken.length) {
    console.error(`[rtk benchmark] FAIL — critical info lost in: ${broken.map((r) => r.label).join(', ')}`);
    process.exitCode = 1;
  }
}

module.exports = { run };
