'use strict';

/**
 * Raw vs RTK agent-solve benchmark — the "is compressed output still fixable" proof.
 * Now with tokenizer-accurate token counts (o200k_base) + cost.
 */

const { PARSERS } = require('../src/parsers');
const f = require('./fixtures');
const fs = require('fs');
const path = require('path');
let countTokens, encodingName, costForTokens, formatCost;
try { ({ countTokens, encodingName, costForTokens, formatCost } = require('../src/tokens')); }
catch { countTokens = (s)=>Math.round(String(s).length/4); encodingName=()=>'chars/4'; costForTokens=()=>0; formatCost=(n)=>`$${n.toFixed(4)}`; }

function hasNeedles(text, needles) { return needles.every(n => text.includes(n)); }
function missingNeedles(text, needles) { return needles.filter(n => !text.includes(n)); }

function buildCases() {
  return [
    { label: 'Vitest — wrong discount math (assertion diff + stack)', parser: PARSERS.vitest, output: f.vitestFailFixture({ lines: 1200, fails: 2 }), exitCode: 1, fixNeedles: ['FAIL', 'AssertionError', 'Expected:', 'Received:', 'billing.ts:14', 'Duration'] },
    { label: 'tsc — 4 type errors (file:line + TS code)', parser: PARSERS.tsc, output: f.tscFailFixture({ errors: 4 }), exitCode: 2, fixNeedles: ['error TS2322', 'Found 4 errors'] },
    { label: 'Next build — type error in page (Failed to compile + file ref)', parser: PARSERS.nextBuild, output: f.nextBuildFailFixture(), exitCode: 1, fixNeedles: ['Failed to compile', 'Type error', 'page.tsx:42'] },
    { label: 'Generic tool failure (Error + totals)', parser: PARSERS.generic, output: f.genericFailFixture(), exitCode: 1, fixNeedles: ['Error:', '1 failed'] },
    { label: 'tsc — single TS error with context line (true TS shape)', parser: PARSERS.tsc, output: 'src/components/Foo.tsx:10:5 - error TS2322: Type \'string\' is not assignable to type \'number\'.\n  const x: number = "oops";\nFound 1 error in 1 file.', exitCode: 1, fixNeedles: ['error TS2322', 'Foo.tsx:10:5', 'Found 1 error'] },
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
    const fixable = rtkHas;
    const rawTokens = countTokens(raw);
    const rtkTokens = countTokens(emitted);
    const saving = rawTokens ? Math.round((1 - rtkTokens / rawTokens) * 100) : 0;
    const tokensSaved = Math.max(0, rawTokens - rtkTokens);
    const costSaved = costForTokens(tokensSaved, 'gpt-4o');
    return { label: c.label, parser: c.parser.name, rawChars: raw.length, rtkChars: emitted.length, rawTokens, rtkTokens, tokensSaved, costSaved, savingPct: saving, fixNeedles: c.fixNeedles, rawHas, rtkHas, rawMissing, rtkMissing, fixable };
  });
}

function render(rows) {
  const enc = encodingName();
  const lines = [];
  lines.push('# RTK — raw vs RTK agent-solve benchmark');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Tokenizer: ${enc}`);
  lines.push('');
  lines.push(`> Precondition for agent solves: every fix-critical needle present in raw output is still present in RTK-compressed output, at lower token cost. Tokenizer: ${enc}.`);
  lines.push('> No LLM calls — this harness measures needle retention + context saving; swap `hasNeedles()` for a model call to make it a live agent benchmark (same cases + needles are the ground truth).');
  lines.push('');
  lines.push('| Case | Parser | Raw tokens | RTK tokens | Saved | $ saved/1k runs* | Fixable? |');
  lines.push('| --- | --- | ---: | ---: | ---: | ---: | --- |');
  for (const r of rows) {
    const verdict = r.fixable ? '✓ yes — all needles retained' : `✗ no — missing: ${r.rtkMissing.join(', ')}`;
    lines.push(`| ${r.label} | ${r.parser} | ${r.rawTokens.toLocaleString()} | ${r.rtkTokens.toLocaleString()} | ${r.savingPct}% (~${r.tokensSaved.toLocaleString()}) | ${formatCost(r.costSaved * 1000)} | ${verdict} |`);
  }
  lines.push('');
  lines.push(`> Fixable = every fixNeedle present in RTK output. Tokenizer: ${enc}. Cost/1k runs = tokensSaved × $2.50/1M (GPT-4o input) — see src/tokens.js for Claude/Gemini table.`);
  lines.push('> CI fails if any RTK row is not fixable.');
  return lines.join('\n') + '\n';
}

function run({ writeArtifacts = false } = {}) {
  const cases = buildCases();
  const rows = evaluate(cases);
  const markdown = render(rows);
  if (writeArtifacts) {
    fs.writeFileSync(path.join(__dirname, 'agent-solve.md'), markdown);
    fs.writeFileSync(path.join(__dirname, 'agent-solve.json'), JSON.stringify({ generatedAt: new Date().toISOString(), tokenizer: encodingName(), rows }, null, 2));
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
    console.log(`[rtk agent-solve] PASS — ${rows.length}/${rows.length} cases fixable at ~${Math.round(rows.reduce((s,r)=>s+r.savingPct,0)/Math.max(1,rows.length))}% avg token saving (${encodingName()})`);
  }
}

module.exports = { run, buildCases, evaluate };
