'use strict';
const fs = require('fs');
const path = require('path');

const VALID_LEVELS = ['conservative', 'balanced', 'aggressive'];
const DEFAULTS = {
  aggressiveness: 'balanced',
  redact: true,
  truncate: { headLines: 20, tailLines: 5, maxChars: 4000 },
  parsers: {
    vitest: { maxLines: 60 },
    tsc: { maxLines: 40 },
    next: { maxLines: 40 },
    generic: { maxLines: 40 },
  },
  structural: { json: true, diff: true, stack: true, dedup: true },
};

function findConfig(cwd) {
  let search = cwd;
  while (true) {
    const cand = path.join(search, '.rtk', 'config.json');
    if (fs.existsSync(cand)) return cand;
    const cand2 = path.join(search, '.rtkrc.json');
    if (fs.existsSync(cand2)) return cand2;
    const parent = path.dirname(search);
    if (parent === search) break;
    search = parent;
  }
  return null;
}

function loadConfig(cwd) {
  const cfgPath = findConfig(cwd);
  let user = {};
  if (cfgPath) {
    try { user = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { user = {}; }
  }
  // allow override via flag later; env override handled in cli
  const merged = {
    ...DEFAULTS,
    ...user,
    truncate: { ...DEFAULTS.truncate, ...(user.truncate || {}) },
    parsers: {
      vitest: { ...DEFAULTS.parsers.vitest, ...((user.parsers && user.parsers.vitest) || {}) },
      tsc: { ...DEFAULTS.parsers.tsc, ...((user.parsers && user.parsers.tsc) || {}) },
      next: { ...DEFAULTS.parsers.next, ...((user.parsers && user.parsers.next) || {}) },
      generic: { ...DEFAULTS.parsers.generic, ...((user.parsers && user.parsers.generic) || {}) },
    },
    structural: { ...DEFAULTS.structural, ...(user.structural || {}) },
  };
  if (!VALID_LEVELS.includes(merged.aggressiveness)) merged.aggressiveness = 'balanced';
  if (merged.aggressiveness === 'conservative') {
    merged.truncate.headLines = Math.max(merged.truncate.headLines, 30);
    merged.truncate.tailLines = Math.max(merged.truncate.tailLines, 10);
    for (const k of Object.keys(merged.parsers)) merged.parsers[k].maxLines = Math.max(merged.parsers[k].maxLines, 80);
  } else if (merged.aggressiveness === 'aggressive') {
    merged.truncate.headLines = Math.min(merged.truncate.headLines, 12);
    merged.truncate.tailLines = Math.min(merged.truncate.tailLines, 3);
    for (const k of Object.keys(merged.parsers)) merged.parsers[k].maxLines = Math.min(merged.parsers[k].maxLines, 25);
  }
  return { config: merged, path: cfgPath };
}

module.exports = { loadConfig, DEFAULTS, VALID_LEVELS, findConfig };
