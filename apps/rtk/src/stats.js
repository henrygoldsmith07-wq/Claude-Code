'use strict';

const fs = require('fs');
const path = require('path');

function findRtkDir(startDir) {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, '.rtk');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallback = path.join(startDir, '.rtk');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function statsPath(cwd) {
  return path.join(findRtkDir(cwd), 'stats.json');
}

function load(cwd) {
  const file = statsPath(cwd);
  if (!fs.existsSync(file)) return { commands: {} };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { commands: {} };
  }
}

function save(cwd, data) {
  fs.writeFileSync(statsPath(cwd), JSON.stringify(data, null, 2));
}

function record(cwd, label, rawChars, emittedChars) {
  const data = load(cwd);
  const entry = data.commands[label] || { invocations: 0, rawChars: 0, emittedChars: 0 };
  entry.invocations += 1;
  entry.rawChars += rawChars;
  entry.emittedChars += emittedChars;
  data.commands[label] = entry;
  save(cwd, data);
  return data;
}

function formatGain(data) {
  const labels = Object.keys(data.commands);
  if (!labels.length) {
    return 'rtk gain: no commands recorded yet. Run some commands through `rtk` first.';
  }

  let totalRaw = 0;
  let totalEmitted = 0;
  let totalInvocations = 0;

  const rows = labels
    .map((label) => {
      const entry = data.commands[label];
      totalRaw += entry.rawChars;
      totalEmitted += entry.emittedChars;
      totalInvocations += entry.invocations;
      const pct = entry.rawChars ? Math.round((1 - entry.emittedChars / entry.rawChars) * 100) : 0;
      return { label, invocations: entry.invocations, raw: entry.rawChars, emitted: entry.emittedChars, pct };
    })
    .sort((a, b) => b.raw - a.raw);

  const totalPct = totalRaw ? Math.round((1 - totalEmitted / totalRaw) * 100) : 0;
  const barPct = Math.max(0, Math.min(100, totalPct));
  const bar = '#'.repeat(Math.round(barPct / 5)).padEnd(20, '.');

  const lines = [
    'rtk gain — cumulative token savings',
    '',
    `  efficiency     [${bar}] ${totalPct}%`,
    `  commands run   ${totalInvocations}`,
    `  raw chars      ${totalRaw}  (~${Math.round(totalRaw / 4)} tokens)`,
    `  emitted chars  ${totalEmitted}  (~${Math.round(totalEmitted / 4)} tokens)`,
    '',
    '  command           calls   raw       emitted   saved',
  ];

  for (const row of rows) {
    lines.push(
      `  ${row.label.padEnd(16)}  ${String(row.invocations).padEnd(6)} ${String(row.raw).padEnd(9)} ${String(row.emitted).padEnd(9)} ${row.pct}%`
    );
  }

  return lines.join('\n');
}

module.exports = { findRtkDir, statsPath, load, save, record, formatGain };
