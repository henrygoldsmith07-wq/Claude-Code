'use strict';

const vitest = require('./vitest');
const jest = require('./jest');
const tsc = require('./tsc');
const nextBuild = require('./next');
const generic = require('./generic');
const eslint = require('./eslint');
const pytest = require('./pytest');
const ruff = require('./ruff');
const mypy = require('./mypy');
const cargo = require('./cargo');
const gotest = require('./gotest');
const gradle = require('./gradle');
const maven = require('./maven');
const docker = require('./docker');
const k8s = require('./k8s');
const terraform = require('./terraform');
const pm = require('./pm');
const ghActions = require('./ghActions');
const git = require('./git');

const PARSERS = {
  vitest, jest, tsc, nextBuild, eslint, pytest, ruff, mypy, cargo, gotest, gradle, maven, docker, k8s, terraform, pm, gha: ghActions, git, generic,
};

// Heuristic parser selection from argv + output shape sniffing.
// Cheap argv pass first; callers that have `output` can pass it for sniffing.
function pickParser(argv, output) {
  const joined = (argv || []).join(' ').toLowerCase();
  // argv-based (fast path, no output needed)
  if (/(^|\s)tsc(\s|$)/.test(joined) || (joined.includes('typescript') && joined.includes('tsc'))) return PARSERS.tsc;
  if (joined.includes('next build')) return PARSERS.nextBuild;
  if (joined.includes('vitest') || joined.includes('bun test') || joined.includes('bun run test')) return PARSERS.vitest;
  if (joined.includes('jest') && !joined.includes('eslint')) return PARSERS.jest;
  if (joined.includes('eslint')) return PARSERS.eslint;
  if (joined.includes('ruff')) return PARSERS.ruff;
  if (joined.includes('mypy')) return PARSERS.mypy;
  if (joined.includes('pytest') || joined.includes('py.test')) return PARSERS.pytest;
  if (joined.includes('cargo test') || /\bcargo\b/.test(joined)) return PARSERS.cargo;
  if (joined.includes('go test') || ((/(^|\s)(go\s+test|go)\b/.test(joined) && joined.includes('test')))) return PARSERS.gotest;
  if (joined.includes('gradle') || joined.includes('./gradlew')) return PARSERS.gradle;
  if (/mvn|\bmvnw\b|maven/.test(joined)) return PARSERS.maven;
  if (joined.includes('docker build') || joined.includes('docker ')) return PARSERS.docker;
  if (joined.includes('kubectl') || joined.includes('k8s') || joined.includes('helm')) return PARSERS.k8s;
  if (joined.includes('terraform')) return PARSERS.terraform;
  if (joined.includes('npm install') || joined.includes('npm ci') || joined.includes('yarn install') || joined.includes('yarn add') || joined.includes('pnpm install') || joined.includes('pnpm add') || joined.includes('pnpm ci') || joined.includes('bun install')) return PARSERS.pm;
  if (joined.includes('npm test') || joined.includes('npm run test') || joined.includes('yarn test') || joined.includes('yarn run test') || joined.includes('pnpm test') || joined.includes('pnpm run test')) return PARSERS.vitest;
  // Output sniffing (when caller has output and argv was generic)
  if (output) {
    const out = String(output);
    if (/error TS\d+/i.test(out)) return PARSERS.tsc;
    if (/Failed to compile|Compiled successfully/i.test(out)) return PARSERS.nextBuild;
    if (/::(error|warning|notice).*::/i.test(out) || /##\[error\]/i.test(out) || /Process completed with exit code/i.test(out)) return PARSERS.gha;
    if (/^FAIL\b.*\bfailed/i.test(out) || /AssertionError|●\s.*Expected/i.test(out)) return /jest/i.test(joined) ? PARSERS.jest : PARSERS.vitest;
    if (/E\s+assert|FAILED\s+.*\.py/i.test(out) || /File ".*", line \d+/i.test(out) && /passed|failed/i.test(out)) return PARSERS.pytest;
    if (/^\s*error\[E\d+\]:/m.test(out) || /-->\s+.*\.rs:\d+:\d+/.test(out)) return PARSERS.cargo;
    if (/^--- FAIL:/m.test(out) || /^FAIL\s+\S+.*\.go/m.test(out)) return PARSERS.gotest;
    if (/BUILD (SUCCESS|FAILURE)/i.test(out) && /\[ERROR\]/i.test(out)) return PARSERS.maven;
    if (/BUILD (SUCCESSFUL|FAILED)/i.test(out)) return PARSERS.gradle;
    if (/: error:/i.test(out) && !/Success: no issues/i.test(out) && !out.includes('reveal_type')) {
      // mypy vs ruff: ruff has rule codes like F401/E501 — and multi-letter
      // families like TID252/SIM117 that `[A-Z]\d{3}` never matched, which
      // silently routed real ruff output to the mypy parser.
      if (/:\d+:\d+:\s*[A-Z]{1,4}\d{2,4}\b/.test(out)) return PARSERS.ruff;
      if (/note:/i.test(out)) return PARSERS.mypy;
    }
    // Ruff rule codes: after file:line:col (`src/a.py:10:5: E501 ...`) or before (`E501 ... at src/a.py:10:5`).
    if (/:\d+:\d+:\s*[A-Z]{1,4}\d{2,4}\b|\b[A-Z]{1,4}\d{2,4}\b.*:\d+:\d+/i.test(out)) return PARSERS.ruff;
    if (/on .*\.tf line \d+/i.test(out) || /Apply complete!/i.test(out)) return PARSERS.terraform;
    if (/ERR!|Cannot resolve dependency/i.test(out)) return PARSERS.pm;
    if (/CrashLoopBackOff|ImagePullBackOff|Error from server/i.test(out)) return PARSERS.k8s;
    if (/CONFLICT|Auto-merging|diff --git/i.test(out) && /merge|rebase|cherry/i.test(joined)) return PARSERS.git;
  }
  return PARSERS.generic;
}

// Semver for PARSER OUTPUT BEHAVIOR (not npm version): bump MAJOR when any
// parser's emitted output changes shape/content, MINOR for new parsers,
// PATCH for detection-only fixes. Consumers pin this in frozen benchmarks.
const PARSER_BEHAVIOR_VERSION = '1.1.0';

function listParsers() {
  return Object.keys(PARSERS).filter(k => k !== 'generic').concat(['generic']);
}

module.exports = { PARSERS, pickParser, listParsers, PARSER_BEHAVIOR_VERSION };
