'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_LEVELS = ['conservative', 'balanced', 'aggressive'];
const DEFAULTS = {
  aggressiveness: 'balanced',
  redact: true,
  truncate: { headLines: 20, tailLines: 5, maxChars: 4000 },
  parsers: {
    vitest: { maxLines: 60 },
    jest: { maxLines: 60 },
    tsc: { maxLines: 40 },
    next: { maxLines: 40 },
    eslint: { maxLines: 60 },
    pytest: { maxLines: 60 },
    ruff: { maxLines: 60 },
    mypy: { maxLines: 60 },
    cargo: { maxLines: 60 },
    'go-test': { maxLines: 60 },
    gradle: { maxLines: 80 },
    maven: { maxLines: 80 },
    docker: { maxLines: 60 },
    k8s: { maxLines: 60 },
    terraform: { maxLines: 80 },
    pm: { maxLines: 60 },
    gha: { maxLines: 60 },
    git: { maxLines: 60 },
    generic: { maxLines: 40 },
  },
  structural: { json: true, diff: true, stack: true, dedup: true, ndjson: true, xml: true, sarif: true, annotations: true },
  contextWindow: 2,
  dedupAcrossCommands: false,
  otel: { enabled: false, file: null },
  preset: null,
  plugins: [],
  preservation: [],
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
  // Global fallback: ~/.config/rtk/config.json and ~/.rtkrc.json
  try {
    const home = os.homedir();
    const g1 = path.join(home, '.config', 'rtk', 'config.json');
    if (fs.existsSync(g1)) return g1;
    const g2 = path.join(home, '.rtkrc.json');
    if (fs.existsSync(g2)) return g2;
  } catch {}
  return null;
}

function globalConfigPath() {
  try { return path.join(os.homedir(), '.config', 'rtk', 'config.json'); } catch { return null; }
}

function loadConfig(cwd) {
  const cfgPath = findConfig(cwd);
  let user = {};
  if (cfgPath) {
    try { user = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch { user = {}; }
  }
  const merged = {
    ...DEFAULTS,
    ...user,
    truncate: { ...DEFAULTS.truncate, ...(user.truncate || {}) },
    parsers: {
      vitest: { ...DEFAULTS.parsers.vitest, ...((user.parsers && user.parsers.vitest) || {}) },
      jest: { ...DEFAULTS.parsers.jest, ...((user.parsers && user.parsers.jest) || {}) },
      tsc: { ...DEFAULTS.parsers.tsc, ...((user.parsers && user.parsers.tsc) || {}) },
      next: { ...DEFAULTS.parsers.next, ...((user.parsers && user.parsers.next) || {}) },
      eslint: { ...DEFAULTS.parsers.eslint, ...((user.parsers && user.parsers.eslint) || {}) },
      pytest: { ...DEFAULTS.parsers.pytest, ...((user.parsers && user.parsers.pytest) || {}) },
      ruff: { ...DEFAULTS.parsers.ruff, ...((user.parsers && user.parsers.ruff) || {}) },
      mypy: { ...DEFAULTS.parsers.mypy, ...((user.parsers && user.parsers.mypy) || {}) },
      cargo: { ...DEFAULTS.parsers.cargo, ...((user.parsers && user.parsers.cargo) || {}) },
      'go-test': { ...DEFAULTS.parsers['go-test'], ...((user.parsers && user.parsers['go-test']) || {}) },
      gradle: { ...DEFAULTS.parsers.gradle, ...((user.parsers && user.parsers.gradle) || {}) },
      maven: { ...DEFAULTS.parsers.maven, ...((user.parsers && user.parsers.maven) || {}) },
      docker: { ...DEFAULTS.parsers.docker, ...((user.parsers && user.parsers.docker) || {}) },
      k8s: { ...DEFAULTS.parsers.k8s, ...((user.parsers && user.parsers.k8s) || {}) },
      terraform: { ...DEFAULTS.parsers.terraform, ...((user.parsers && user.parsers.terraform) || {}) },
      pm: { ...DEFAULTS.parsers.pm, ...((user.parsers && user.parsers.pm) || {}) },
      gha: { ...DEFAULTS.parsers.gha, ...((user.parsers && user.parsers.gha) || {}) },
      git: { ...DEFAULTS.parsers.git, ...((user.parsers && user.parsers.git) || {}) },
      generic: { ...DEFAULTS.parsers.generic, ...((user.parsers && user.parsers.generic) || {}) },
    },
    structural: { ...DEFAULTS.structural, ...(user.structural || {}) },
    otel: { ...DEFAULTS.otel, ...(user.otel || {}) },
  };
  // Env aggressiveness override
  const envLevel = process.env.RTK_AGGRESSIVENESS;
  if (envLevel && VALID_LEVELS.includes(envLevel)) merged.aggressiveness = envLevel;
  // Env context window override
  const envWindow = process.env.RTK_CONTEXT_WINDOW;
  if (envWindow != null && /^\d+$/.test(String(envWindow))) merged.contextWindow = Math.max(0, Math.min(10, parseInt(envWindow, 10)));
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
  if (typeof merged.contextWindow !== 'number' || isNaN(merged.contextWindow)) merged.contextWindow = 2;
  merged.contextWindow = Math.max(0, Math.min(10, Math.round(merged.contextWindow)));
  return { config: merged, path: cfgPath };
}

module.exports = { loadConfig, DEFAULTS, VALID_LEVELS, findConfig, globalConfigPath };
