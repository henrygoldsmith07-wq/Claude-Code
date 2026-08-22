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
  return path.join(startDir, '.rtk');
}

// Only writes create .rtk/ — read-only commands (gain) must not mutate the tree.
function ensureRtkDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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
  const dir = ensureRtkDir(findRtkDir(cwd));
  const file = path.join(dir, 'stats.json');
  // Atomic replace: a crash mid-write must never leave a torn stats.json
  // (a torn file would parse-fail on next load and wipe all history).
  const tmp = file + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  } catch (e) {
    // Stats are best-effort telemetry — never crash the wrapped command
    // (and never clobber its exit code) because stats can't be written.
    console.error(`[rtk] warning: could not save stats (${e.message})`);
  }
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

function approxTokens(chars) {
  return Math.round(chars / 4);
}

function miniBar(pct, width = 10) {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * width);
  return '#'.repeat(filled).padEnd(width, '.');
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
      return {
        label,
        invocations: entry.invocations,
        raw: entry.rawChars,
        emitted: entry.emittedChars,
        pct,
      };
    })
    .sort((a, b) => b.raw - a.raw);

  const totalPct = totalRaw ? Math.round((1 - totalEmitted / totalRaw) * 100) : 0;
  const tokensSaved = approxTokens(totalRaw - totalEmitted);
  const bar = miniBar(totalPct, 20);

  const lines = [
    'rtk gain — cumulative token savings',
    '',
    `  efficiency     [${bar}] ${totalPct}%`,
    `  commands run   ${totalInvocations}`,
    `  raw chars      ${totalRaw.toLocaleString()}  (~${approxTokens(totalRaw).toLocaleString()} tokens)`,
    `  emitted chars  ${totalEmitted.toLocaleString()}  (~${approxTokens(totalEmitted).toLocaleString()} tokens)`,
    `  tokens saved   ~${tokensSaved.toLocaleString()}`,
    '',
    '  command           calls   raw         emitted     saved',
    '  ───────────────────────────────────────────────────────',
  ];

  for (const row of rows) {
    const bar = miniBar(row.pct, 8);
    lines.push(
      `  ${row.label.padEnd(16)}  ${String(row.invocations).padEnd(6)} ${String(row.raw).padEnd(11)} ${String(row.emitted).padEnd(11)} [${bar}] ${row.pct}%`
    );
  }

  return lines.join('\n');
}

module.exports = { findRtkDir, ensureRtkDir, statsPath, load, save, record, formatGain };
