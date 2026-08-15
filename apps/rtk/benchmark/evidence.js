'use strict';

/**
 * What RTK is currently entitled to claim.
 *
 * The other benchmark scripts measure reduction and retention, and both look
 * excellent. This one asks the question those cannot answer: is the evidence
 * good enough to support the headline claim?
 *
 * Today the answer is no, and the point of this script is that the answer is
 * printed next to the good numbers rather than left to be inferred. When the
 * real corpus exists, the same script starts saying yes with no code change.
 *
 *   node benchmark/evidence.js
 *   node benchmark/evidence.js --write
 */

const fs = require('fs');
const path = require('path');
const { buildCases } = require('./agent-solve');
const { tostPaired, mcnemarExact, requiredPairs, wilsonInterval } = require('../src/equivalence');
const { headlineVerdict, retriesFrom } = require('../src/verdict');
const { emptyAgentCorpus, emptyCiCorpus, corpusReport } = require('../src/corpus');

function main() {
  const write = process.argv.includes('--write');
  const cases = buildCases();

  // The precondition harness scores whether each arm retains the needles a fix
  // depends on. That is the best proxy available without live model calls, and
  // it is treated as a *pair* per case rather than two independent samples.
  const pairs = [];
  const rawResponses = [];
  const rtkResponses = [];
  let rawToolTokens = 0;
  let rtkToolTokens = 0;

  for (const c of cases) {
    const raw = c.output;
    const { emitted } = c.parser.filter(raw, c.exitCode);
    const text = String(emitted ?? '');
    const has = (hay) => c.fixNeedles.every((n) => String(hay).includes(n));
    const rawOk = has(raw);
    const rtkOk = has(text);
    pairs.push({ raw: rawOk, rtk: rtkOk, label: c.label });
    rawResponses.push({ label: c.label, response: '', foundNeedles: rawOk });
    rtkResponses.push({ label: c.label, response: '', foundNeedles: rtkOk });
    // Tokens approximated by chars/4 — this script is about the inference, and
    // the tokenizer-accurate numbers live in benchmark/run.js.
    rawToolTokens += Math.ceil(raw.length / 4);
    rtkToolTokens += Math.ceil(text.length / 4);
  }

  const equivalence = tostPaired(pairs);
  const difference = mcnemarExact(equivalence.b, equivalence.c);
  const rawRetries = retriesFrom(rawResponses);
  const rtkRetries = retriesFrom(rtkResponses);

  const verdict = headlineVerdict({
    pairs,
    rawToolTokens,
    rtkToolTokens,
    rawRetries: rawRetries.retries,
    rtkRetries: rtkRetries.retries,
    calls: cases.length,
    // The only corpus that exists today is the generated one.
    corpusIsReal: false,
  });

  const rawCi = wilsonInterval(pairs.filter((p) => p.raw).length, pairs.length);
  const rtkCi = wilsonInterval(pairs.filter((p) => p.rtk).length, pairs.length);
  const need = requiredPairs();

  const lines = [];
  lines.push('# RTK evidence audit — what can actually be claimed');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Task success');
  lines.push('');
  lines.push('| Arm | Success | 90% CI (Wilson) |');
  lines.push('| --- | ---: | --- |');
  lines.push(`| raw | ${pairs.filter((p) => p.raw).length}/${pairs.length} | ${pct(rawCi.lower)}–${pct(rawCi.upper)} |`);
  lines.push(`| rtk | ${pairs.filter((p) => p.rtk).length}/${pairs.length} | ${pct(rtkCi.lower)}–${pct(rtkCi.upper)} |`);
  lines.push('');
  lines.push(`- Discordant pairs (the only ones carrying information): **${equivalence.discordant}** (${equivalence.b} raw-only, ${equivalence.c} RTK-only)`);
  lines.push(`- Difference (RTK − raw): **${(equivalence.difference * 100).toFixed(1)} points**, 90% CI ${(equivalence.lower * 100).toFixed(1)} to ${(equivalence.upper * 100).toFixed(1)}`);
  lines.push(`- Equivalence (TOST, ±${(equivalence.margin * 100).toFixed(0)} points): **${equivalence.equivalent ? 'demonstrated' : 'NOT demonstrated'}**`);
  lines.push(`- ${equivalence.note}`);
  lines.push(`- ${difference.note}`);
  lines.push('');
  lines.push(`> A significance test is not an equivalence test. "No significant difference" and "equivalent" are different claims, and with ${pairs.length} pairs only the first is even reachable.`);
  lines.push('');
  lines.push('## Corpus');
  lines.push('');
  lines.push('```');
  lines.push(corpusReport(emptyAgentCorpus(), emptyCiCorpus()).text);
  lines.push('```');
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push('```');
  lines.push(verdict.note);
  lines.push('```');
  lines.push('');
  lines.push(`Required sample: ${need.note}`);

  const text = lines.join('\n');
  console.log(text);

  if (write) {
    const outMd = path.join(__dirname, 'evidence.md');
    fs.writeFileSync(outMd, `${text}\n`);
    fs.writeFileSync(
      path.join(__dirname, 'evidence.json'),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), equivalence, difference, verdict: { supported: verdict.supported, blockers: verdict.blockers }, economics: verdict.economics, requiredPairs: need }, null, 2)}\n`,
    );
    console.log(`\nWrote ${outMd}`);
  }

  // Never fails the build. The claim not being supported yet is the current
  // true state of the project, not a regression to block a commit on.
  process.exit(0);
}

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

if (require.main === module) main();

module.exports = { main };
