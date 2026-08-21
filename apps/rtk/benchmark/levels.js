'use strict';

/**
 * Adaptive compression research benchmark.
 *
 * Compares conservative / balanced / aggressive compression across the same
 * paired task corpus, reporting per level: token reduction, needle retention,
 * TOST equivalence interval, and discordant pairs. The point is to give the
 * adaptive-compression decision its evidence base WITHOUT turning it on —
 * `headlineVerdict()` still refuses any claim until a real corpus exists, and
 * nothing here flips the default level.
 *
 * Usage:
 *   node benchmark/levels.js                 # 300 tasks at all three levels
 *   node benchmark/levels.js --count=500
 *   node benchmark/levels.js --write
 */

const fs = require('fs');
const path = require('path');
const { generateSyntheticTasks, evaluatePaired } = require('./paired');
const { requiredPairs, wilsonInterval } = require('../src/equivalence');
const { collectProvenance } = require('../src/provenance');

const LEVELS = ['conservative', 'balanced', 'aggressive'];

function runLevels({ count = 300, seed = 0xC0FFEE } = {}) {
  const tasks = generateSyntheticTasks({ count, seed });
  const perLevel = {};
  for (const level of LEVELS) {
    perLevel[level] = evaluatePaired(tasks, { level });
    // attach raw outputs for failure capture
    perLevel[level].tasksById = new Map(tasks.map(t => [t.id, t]));
  }
  return { tasks, perLevel };
}

function render({ count, seed, perLevel }, prov) {
  const lines = [];
  lines.push('# RTK compression levels — conservative vs balanced vs aggressive');
  lines.push('');
  lines.push(`Generated: ${prov.executionDate}`);
  lines.push(`RTK commit: ${prov.rtkCommit}`);
  lines.push(`Benchmark version: ${prov.benchmarkVersion}`);
  lines.push(`Corpus version: ${prov.corpusVersion}`);
  lines.push(`Operating system: ${prov.operatingSystem}`);
  lines.push('');
  lines.push(`> **Synthetic corpus — regression evidence only.** Same ${count} deterministic tasks (seed ${seed}) run through each compression level. This measures how much headroom aggressive compression has and where it starts losing fixability; it does not by itself justify enabling aggressive mode as a default.`);
  lines.push('');
  lines.push('## Cross-level summary');
  lines.push('');
  lines.push('| Level | Raw success | RTK success | Difference (RTK−raw) | 90% CI | Discordant (raw-only) | Token reduction | Net tokens |');
  lines.push('| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |');
  for (const level of LEVELS) {
    const { stats, equivalence, economics } = perLevel[level];
    const ci = `${(equivalence.lower * 100).toFixed(2)} to ${(equivalence.upper * 100).toFixed(2)}`;
    lines.push(`| ${level} | ${(stats.rawSuccessRate * 100).toFixed(1)}% | ${(stats.rtkSuccessRate * 100).toFixed(1)}% | ${(equivalence.difference * 100).toFixed(2)} pts | ${ci} | ${equivalence.b} | ${stats.avgReduction}% | ${economics.net > 0 ? '+' : ''}${economics.net.toLocaleString()} |`);
  }
  lines.push('');
  lines.push('## Equivalence per level (TOST ±5 points)');
  lines.push('');
  for (const level of LEVELS) {
    const eq = perLevel[level].equivalence;
    lines.push(`- **${level}**: ${eq.equivalent ? 'demonstrated' : 'NOT demonstrated'} — ${eq.note}`);
  }
  lines.push('');
  lines.push(`> Sample-size note: ${requiredPairs().note}`);
  lines.push('');

  lines.push('## Per-tool reduction and retention by level');
  lines.push('');
  lines.push('| Tool | n | Conservative red. | Balanced red. | Aggressive red. | Aggressive losses (raw-only) |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  const tools = [...new Set(perLevel.balanced.results.map(r => r.tool))].sort();
  for (const tool of tools) {
    const n = perLevel.balanced.results.filter(r => r.tool === tool).length;
    const reds = LEVELS.map(level => {
      const rows = perLevel[level].results.filter(r => r.tool === tool);
      const avgRaw = rows.reduce((s, r) => s + r.rawTokens, 0);
      const avgRtk = rows.reduce((s, r) => s + r.rtkTokens, 0);
      return avgRaw ? `${Math.round((1 - avgRtk / avgRaw) * 100)}%` : '—';
    });
    const losses = perLevel.aggressive.results.filter(r => r.tool === tool && r.rawSuccess && !r.rtkSuccess).length;
    lines.push(`| ${tool} | ${n} | ${reds[0]} | ${reds[1]} | ${reds[2]} | ${losses} |`);
  }
  lines.push('');

  // Failure detail for the level that loses cases
  lines.push('## Where aggressive loses cases (raw succeeds, aggressive fails)');
  lines.push('');
  const aggLosses = perLevel.aggressive.results.filter(r => r.rawSuccess && !r.rtkSuccess);
  if (!aggLosses.length) {
    lines.push('> Aggressive retained all needles on this corpus — the loss budget is untested here. Real-corpus failures will be harsher.');
  } else {
    lines.push(`> ${aggLosses.length} case(s): these are the regression tests guarding against over-compression.`);
    lines.push('');
    lines.push('| ID | Tool | Missing needles |');
    lines.push('| --- | --- | --- |');
    for (const f of aggLosses.slice(0, 20)) {
      lines.push(`| ${f.taskId} | ${f.tool} | ${f.missingNeedles.join(', ').slice(0, 80)} |`);
    }
  }
  lines.push('');

  lines.push('## Recommendation logic (not auto-enabled)');
  lines.push('');
  lines.push('```');
  lines.push('Adaptive compression MAY be considered when ALL hold on a REAL corpus:');
  lines.push('  1. balanced shows equivalence within margin on real captured tasks');
  lines.push('  2. aggressive shows equivalence OR its extra savings exceed retry costs');
  lines.push('  3. per-tool analysis shows no tool family with systematic losses');
  lines.push('Until then: default stays "balanced". No config change ships from this file.');
  lines.push('```');
  lines.push('');
  lines.push('## Provenance');
  lines.push('');
  lines.push('```');
  lines.push(`rtk commit: ${prov.rtkCommit}`);
  lines.push(`benchmark version: ${prov.benchmarkVersion}`);
  lines.push(`corpus version: ${prov.corpusVersion}`);
  lines.push(`execution date: ${prov.executionDate}`);
  lines.push('```');
  return lines.join('\n') + '\n';
}

function run(opts = {}) {
  const count = opts.count ?? 300;
  const seed = opts.seed ?? 0xC0FFEE;
  const prov = collectProvenance({ benchmarkName: 'levels' });
  const data = runLevels({ count, seed });
  const markdown = render({ count, seed, ...data }, prov);
  const json = {
    generatedAt: prov.executionDate,
    provenance: prov,
    count,
    seed,
    levels: Object.fromEntries(LEVELS.map(level => {
      const { stats, equivalence, economics } = data.perLevel[level];
      return [level, {
        stats,
        equivalence,
        economics: { grossSaved: economics.grossSaved, extraRetries: economics.extraRetries, net: economics.net },
        losses: data.perLevel[level].results.filter(r => r.rawSuccess && !r.rtkSuccess).map(r => ({ id: r.taskId, tool: r.tool, missing: r.missingNeedles })),
      }];
    })),
  };
  if (opts.write) {
    fs.writeFileSync(path.join(__dirname, 'levels.md'), markdown);
    fs.writeFileSync(path.join(__dirname, 'levels.json'), JSON.stringify(json, null, 2));
  }
  return { ...data, markdown, json, prov };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const countArg = args.find(a => a.startsWith('--count='))?.split('=')[1];
  const count = countArg ? Math.max(10, Math.min(2000, parseInt(countArg, 10) || 300)) : 300;
  const seedArg = args.find(a => a.startsWith('--seed='))?.split('=')[1];
  const seed = seedArg ? parseInt(seedArg, 10) : 0xC0FFEE;
  const { markdown, perLevel } = run({ count, seed, write });
  console.log(markdown);
  if (write) console.log(`[rtk levels] wrote benchmark/levels.md and levels.json (${count} tasks × 3 levels)`);

  // CI gate: balanced must not lose anything; report aggressive separately.
  const balancedLosses = perLevel.balanced.results.filter(r => r.rawSuccess && !r.rtkSuccess);
  if (balancedLosses.length) {
    console.error(`[rtk levels] FAIL — balanced lost ${balancedLosses.length} case(s): ${balancedLosses.slice(0, 5).map(f => f.taskId).join(', ')}`);
    process.exitCode = 1;
  } else {
    const aggLosses = perLevel.aggressive.results.filter(r => r.rawSuccess && !r.rtkSuccess);
    console.log(`[rtk levels] PASS — balanced clean; aggressive ${aggLosses.length ? `lost ${aggLosses.length} case(s) (documented, not gated)` : 'clean'}`);
  }
}

module.exports = { run, runLevels, LEVELS };
