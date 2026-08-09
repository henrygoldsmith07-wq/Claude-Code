'use strict';

/**
 * Raw vs RTK agent-solve benchmark — the "is compressed output still fixable" proof.
 *
 * No model calls. Instead it proves the precondition for agent solves:
 * for every failure case, the same fix-critical needles that are present in
 * raw output are still present (and locatable) in RTK-compressed output,
 * at ~5-100x less context cost. The companion synthetic benchmark
 * (benchmark/run.js) already covers shaped tool output; retention.js covers
 * real captured logs; this harness ties them together with a per-case
 * "would an agent still have what it needs" verdict.
 *
 * Each case defines:
 *  - output + exitCode (the failing run)
 *  - fixNeedles: the exact strings a patch must be derived from
 *                (file:line, error type, expected/received, FAIL header)
 *  - raw vs rtk needle hit rate and token estimate (~chars/4) so the
 *    cost/retention trade-off is measured.
 *
 * To graduate to a live LLM benchmark, replace `hasNeedles()` with a
 * tool-call to your model and reuse the same cases + needles as ground truth.
 */

const { PARSERS } = require('../src/parsers');
const f = require('./fixtures');
const fs = require('fs');
const path = require('path');

function tokens(chars) { return Math.round((chars || 0) / 4); }
function hasNeedles(text, needles) {
  return needles.every(n => text.includes(n));
}
function missingNeedles(text, needles) {
  return needles.filter(n => !text.includes(n));
}

function buildCases() {
  return [
    {
      label: 'Vitest — wrong discount math (assertion diff + stack)',
      parser: PARSERS.vitest,
      output: f.vitestFailFixture({ lines: 1200, fails: 2 }),
      exitCode: 1,
      fixNeedles: ['FAIL', 'AssertionError', 'Expected:', 'Received:', 'billing.ts:14', 'Duration'],
    },
    {
      label: 'tsc — 4 type errors (file:line + TS code)',
      parser: PARSERS.tsc,
      output: f.tscFailFixture({ errors: 4 }),
      exitCode: 2,
      fixNeedles: ['error TS2322', 'Found 4 errors'],
    },
    {
      label: 'Next build — type error in page (Failed to compile + file ref)',
      parser: PARSERS.nextBuild,
      output: f.nextBuildFailFixture(),
      exitCode: 1,
      fixNeedles: ['Failed to compile', 'Type error', 'page.tsx:42'],
    },
    {
      label: 'Generic tool failure (Error + totals)',
      parser: PARSERS.generic,
      output: f.genericFailFixture(),
      exitCode: 1,
      fixNeedles: ['Error:', '1 failed'],
    },
    {
      label: 'tsc — single TS error with context line (true TS shape)',
      parser: PARSERS.tsc,
      output: 'src/components/Foo.tsx:10:5 - error TS2322: Type \'string\' is not assignable to type \'number\'.\n  const x: number = "oops";\nFound 1 error in 1 file.',
      exitCode: 1,
      fixNeedles: ['error TS2322', 'Foo.tsx:10:5', 'Found 1 error'],
    },
  ];
}

function evaluate(cases) {
  return cases.map(c => {
    const raw = c.output;
    const { emitted } = c.parser.filter(raw, c.exitCode);
    const rawHas = hasNeedles(raw, c.fixNeedles);
    const rtkHas = hasNeedles(emitted, c.fixNeedles);
    const rawMissing = missingNeedles(raw, c.fixNeedles);
    const rtkMissing = missingNeedles(emitted, c.fixNeedles);
    // Fixable means RTK still contains every needle raw had; raw is ground truth.
    const fixable = rtkHas; // rawHas is true by construction for these fixtures
    const rawTokens = tokens(raw.length);
    const rtkTokens = tokens(emitted.length);
    const saving = rawTokens ? Math.round((1 - rtkTokens / rawTokens) * 100) : 0;
    return {
      label: c.label,
      parser: c.parser.name,
      rawChars: raw.length,
      rtkChars: emitted.length,
      rawTokens,
      rtkTokens,
      tokensSaved: rawTokens - rtkTokens,
      savingPct: saving,
      fixNeedles: c.fixNeedles,
      rawHas,
      rtkHas,
      rawMissing,
      rtkMissing,
      fixable,
    };
  });
}

function render(rows) {
  const lines = [];
  lines.push('# RTK — raw vs RTK agent-solve benchmark');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('> Precondition for agent solves: every fix-critical needle present in raw output is still present in RTK-compressed output, at lower token cost.');
  lines.push('> No LLM calls — this harness measures needle retention + context saving; swap `hasNeedles()` for a model call to make it a live agent benchmark (same cases + needles are the ground truth).');
  lines.push('');
  lines.push('| Case | Parser | Raw tokens | RTK tokens | Saved | Fixable? |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- |');
  for (const r of rows) {
    const verdict = r.fixable ? '✓ yes — all needles retained' : `✗ no — missing: ${r.rtkMissing.join(', ')}`;
    lines.push(`| ${r.label} | ${r.parser} | ${r.rawTokens.toLocaleString()} | ${r.rtkTokens.toLocaleString()} | ${r.savingPct}% (~${r.tokensSaved.toLocaleString()}) | ${verdict} |`);
  }
  lines.push('');
  lines.push('> Fixable = every fixNeedle present in RTK output. Raw is ground truth — fixtures are shaped so rawHas is true by construction.');
  lines.push('> Token cost ≈ chars/4. CI fails if any RTK row is not fixable.');
  return lines.join('\n') + '\n';
}

function run({ writeArtifacts = false } = {}) {
  const cases = buildCases();
  const rows = evaluate(cases);
  const markdown = render(rows);
  if (writeArtifacts) {
    fs.writeFileSync(path.join(__dirname, 'agent-solve.md'), markdown);
    fs.writeFileSync(path.join(__dirname, 'agent-solve.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  }
  return { rows, markdown };
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  const { rows, markdown } = run({ writeArtifacts: write });
  console.log(markdown);
  if (write) console.log('[rtk agent-solve] wrote benchmark/agent-solve.md and agent-solve.json');
  const broken = rows.filter(r => !r.fixable);
  if (broken.length) {
    console.error(`[rtk agent-solve] FAIL — would not be fixable after RTK: ${broken.map(r => r.label).join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`[rtk agent-solve] PASS — ${rows.length}/${rows.length} cases fixable at ~${Math.round(rows.reduce((s,r)=>s+r.savingPct,0)/Math.max(1,rows.length))}% avg token saving`);
  }
}

module.exports = { run, buildCases, evaluate };
