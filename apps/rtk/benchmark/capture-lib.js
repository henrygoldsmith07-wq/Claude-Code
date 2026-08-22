'use strict';

/**
 * Pure helpers for benchmark/capture.js — no spawning, no filesystem writes.
 * Everything here is importable by tests without touching real tools.
 *
 * Corpus categories are kept strictly separated:
 *   synthetic / adversarial  -> written by corpus-builder.js
 *   captured-real            -> written by capture.js from live tool runs
 */

// --- Catalog ---------------------------------------------------------------
// Declarative captures of GENUINE tool output. Every argv runs inside a fresh
// mkdtemp cwd so nothing outside it is touched. All argv tokens are constants
// (no spaces, no shell metacharacters) so Windows shell:true joining is safe.
//
// Entry shape:
//   tool          family name used in filenames + manifest
//   scenario      short label: 'pass' | 'fail' | 'warn' | ...
//   requires      availability probe args, e.g. ['--version']
//   argv          command tail after the bin, array form
//   skipIfMissing always true — unavailable tools are skipped, never fatal
//   setup         optional map of relative-path -> content written into cwd
//   timeoutMs     optional spawn timeout override

const CATALOG = [
  { tool: 'npm', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'npm', scenario: 'fail', requires: ['--version'],
    argv: ['run', 'rtk-missing-script-xyz'], skipIfMissing: true,
  },

  { tool: 'pnpm', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'pnpm', scenario: 'fail', requires: ['--version'],
    argv: ['run', 'rtk-missing-script-xyz'], skipIfMissing: true,
  },

  { tool: 'bun', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'bun', scenario: 'fail', requires: ['--version'],
    argv: ['run', 'rtk-missing-script-xyz'], skipIfMissing: true,
  },

  { tool: 'pytest', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'pytest', scenario: 'no-tests', requires: ['--version'],
    argv: ['-p', 'no:cacheprovider', '.'], skipIfMissing: true,
    timeoutMs: 30000,
  },
  {
    tool: 'pytest', scenario: 'fail', requires: ['--version'],
    argv: ['-p', 'no:cacheprovider', 'test_missing_file.py'], skipIfMissing: true,
  },

  { tool: 'vitest', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'vitest', scenario: 'no-tests', requires: ['--version'],
    argv: ['run'], skipIfMissing: true,
    timeoutMs: 60000,
  },

  { tool: 'jest', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'jest', scenario: 'no-tests', requires: ['--version'],
    argv: [], skipIfMissing: true,
    timeoutMs: 60000,
  },

  { tool: 'playwright', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'playwright', scenario: 'no-tests', requires: ['--version'],
    argv: ['test'], skipIfMissing: true,
    timeoutMs: 60000,
  },

  // github-actions local emulation via act; omitted entirely on hosts without
  // a runner image — runner-dependent scenarios are intentionally not faked.
  { tool: 'act', scenario: 'list', requires: ['--version'], argv: ['-l'], skipIfMissing: true },

  { tool: 'docker', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'docker', scenario: 'daemon-check', requires: ['--version'],
    argv: ['info'], skipIfMissing: true,
    timeoutMs: 20000,
  },

  {
    tool: 'kubectl', scenario: 'pass', requires: ['version', '--client'],
    argv: ['version', '--client=true'], skipIfMissing: true,
  },
  {
    tool: 'kubectl', scenario: 'fail', requires: ['version', '--client'],
    argv: ['get', 'pods'], skipIfMissing: true,
    timeoutMs: 15000,
  },

  { tool: 'cargo', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'cargo', scenario: 'fail', requires: ['--version'],
    argv: ['metadata', '--no-deps', '--format-version', '1'], skipIfMissing: true,
  },

  { tool: 'go', scenario: 'pass', requires: ['version'], argv: ['version'], skipIfMissing: true },
  {
    tool: 'go', scenario: 'no-tests', requires: ['version'],
    argv: ['test', './...'], skipIfMissing: true,
    timeoutMs: 45000,
  },

  { tool: 'maven', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'maven', scenario: 'fail', requires: ['--version'],
    argv: ['--batch-mode', '--non-recursive', 'validate'], skipIfMissing: true,
    timeoutMs: 90000,
  },

  { tool: 'gradle', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'gradle', scenario: 'fail', requires: ['--version'],
    argv: ['--console=plain', 'rtkNoSuchTask'], skipIfMissing: true,
    timeoutMs: 120000,
  },

  { tool: 'tsc', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'tsc', scenario: 'fail', requires: ['--version'],
    argv: ['--noEmit', 'broken.ts'], skipIfMissing: true,
    setup: { 'broken.ts': 'const n: number = "oops";\n' },
  },
  {
    tool: 'tsc', scenario: 'warn', requires: ['--version'],
    argv: ['--noEmit', 'unused.ts'], skipIfMissing: true,
    setup: { 'unused.ts': 'export function f(unusedArg: string): number {\n  return 1;\n}\n' },
  },

  { tool: 'eslint', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'eslint', scenario: 'fail', requires: ['--version'],
    argv: ['definitely-missing-file.js'], skipIfMissing: true,
  },

  { tool: 'ruff', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'ruff', scenario: 'violations', requires: ['--version'],
    argv: ['check', 'unused.py'], skipIfMissing: true,
    setup: { 'unused.py': 'import os\n\n\ndef main():\n    return 1\n' },
  },

  { tool: 'mypy', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'mypy', scenario: 'fail', requires: ['--version'],
    argv: ['missing.py'], skipIfMissing: true,
  },

  {
    tool: 'terraform', scenario: 'pass', requires: ['version'],
    argv: ['version'], skipIfMissing: true,
  },
  {
    tool: 'terraform', scenario: 'uninit', requires: ['version'],
    argv: ['validate', '-no-color'], skipIfMissing: true,
    setup: { 'main.tf': 'variable "region" {\n  type = string\n}\n' },
    timeoutMs: 45000,
  },

  // --- cloud CLIs -------------------------------------------------------------
  // All scenarios below are offline-safe: version probes and intentionally bad
  // subcommands that fail during argument parsing, long before any API call.

  { tool: 'aws', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'aws', scenario: 'fail', requires: ['--version'],
    argv: ['rtk-invalid-service-xyz', 'describe-things'], skipIfMissing: true,
  },

  { tool: 'gcloud', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'gcloud', scenario: 'fail', requires: ['--version'],
    argv: ['rtk-invalid-group', 'list'], skipIfMissing: true,
  },

  {
    tool: 'az', scenario: 'pass', requires: ['--version'],
    argv: ['--version'], skipIfMissing: true,
    env: { AZURE_CLI_DISABLE_VERSION_CHECK: '1' },
  },
  {
    tool: 'az', scenario: 'fail', requires: ['--version'],
    argv: ['rtk-invalid-group', 'list'], skipIfMissing: true,
    env: { AZURE_CLI_DISABLE_VERSION_CHECK: '1' },
  },

  // --- database migrations ------------------------------------------------------
  // Offline-safe probes only: schema/config validation against generated files
  // inside the temp cwd. No database servers are contacted.

  { tool: 'prisma', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'prisma', scenario: 'validate', requires: ['--version'],
    argv: ['validate'], skipIfMissing: true,
    setup: {
      'prisma/schema.prisma': [
        'datasource db {',
        '  provider = "sqlite"',
        '  url      = "file:./dev.db"',
        '}',
        '',
        'generator client {',
        '  provider = "prisma-client-js"',
        '}',
        '',
        'model User {',
        '  id    Int     @id',
        '  email String  @unique',
        '}',
        '',
      ].join('\n'),
    },
    timeoutMs: 45000,
  },
  {
    tool: 'prisma', scenario: 'fail', requires: ['--version'],
    argv: ['validate'], skipIfMissing: true,
    setup: {
      'prisma/schema.prisma': [
        'datasource db {',
        '  provider = "not-a-real-provider"',
        '  url      = "file:./dev.db"',
        '}',
        '',
        'model User {',
        '  id Int @id',
        '  email String @map(',
        '}',
        '',
      ].join('\n'),
    },
    timeoutMs: 45000,
  },

  { tool: 'knex', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'knex', scenario: 'fail', requires: ['--version'],
    argv: ['migrate:status'], skipIfMissing: true,
    timeoutMs: 30000,
  },

  { tool: 'alembic', scenario: 'pass', requires: ['--version'], argv: ['--version'], skipIfMissing: true },
  {
    tool: 'alembic', scenario: 'fail', requires: ['--version'],
    argv: ['history'], skipIfMissing: true,
    timeoutMs: 30000,
  },

  { tool: 'flyway', scenario: 'pass', requires: ['-v'], argv: ['-v'], skipIfMissing: true },
  {
    tool: 'flyway', scenario: 'fail', requires: ['-v'],
    argv: ['migrate'], skipIfMissing: true,
    timeoutMs: 30000,
  },

  // --- compilers ------------------------------------------------------------------
  // Generated fixtures compiled inside the temp cwd; artifacts land there too.

  {
    tool: 'gcc', scenario: 'pass', requires: ['--version'],
    argv: ['-Wall', '-o', 'hello.out', 'hello.c'], skipIfMissing: true,
    setup: {
      'hello.c': '#include <stdio.h>\n\nint main(void) {\n  printf("hello rtk\\n");\n  return 0;\n}\n',
    },
  },
  {
    tool: 'gcc', scenario: 'fail', requires: ['--version'],
    argv: ['-Wall', '-o', 'broken.out', 'broken.c'], skipIfMissing: true,
    setup: {
      'broken.c': 'int main(void) {\n  return oops;\n}\n',
    },
  },

  {
    tool: 'cc', scenario: 'pass', requires: ['--version'],
    argv: ['-Wall', '-o', 'hello.out', 'hello.c'], skipIfMissing: true,
    setup: {
      'hello.c': '#include <stdio.h>\n\nint main(void) {\n  printf("hello rtk\\n");\n  return 0;\n}\n',
    },
  },
  {
    tool: 'cc', scenario: 'fail', requires: ['--version'],
    argv: ['-Wall', '-o', 'broken.out', 'broken.c'], skipIfMissing: true,
    setup: {
      'broken.c': 'int main(void) {\n  return oops;\n}\n',
    },
  },

  {
    tool: 'javac', scenario: 'pass', requires: ['-version'],
    argv: ['Hello.java'], skipIfMissing: true,
    setup: {
      'Hello.java': 'public class Hello {\n  public static void main(String[] args) {\n    System.out.println("hello rtk");\n  }\n}\n',
    },
  },
  {
    tool: 'javac', scenario: 'fail', requires: ['-version'],
    argv: ['Broken.java'], skipIfMissing: true,
    setup: {
      'Broken.java': 'public class Broken {\n  public static void main(String[] args) {\n    int x = "not an int"\n  }\n}\n',
    },
  },

  // --- linters / type-checkers ------------------------------------------------------

  {
    tool: 'cargo', scenario: 'clippy-warn', requires: ['--version'],
    argv: ['clippy', '--quiet'], skipIfMissing: true,
    setup: {
      'Cargo.toml': '[package]\nname = "rtk-clippy-fixture"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n',
      'src/main.rs': 'fn main() {\n    let _unused = ((1 + 1));\n    println!("hi");\n}\n',
    },
    timeoutMs: 120000,
  },
  {
    tool: 'cargo', scenario: 'clippy-fail', requires: ['--version'],
    argv: ['clippy', '--quiet', '--', '-D', 'warnings'], skipIfMissing: true,
    setup: {
      'Cargo.toml': '[package]\nname = "rtk-clippy-fixture"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n',
      'src/main.rs': 'fn main() {\n    let _unused = ((1 + 1));\n    println!("hi");\n}\n',
    },
    timeoutMs: 120000,
  },

  {
    tool: 'shellcheck', scenario: 'pass', requires: ['--version'],
    argv: ['good.sh'], skipIfMissing: true,
    setup: { 'good.sh': '#!/bin/sh\nprintf "%s\\n" "$1"\n' },
  },
  {
    tool: 'shellcheck', scenario: 'fail', requires: ['--version'],
    argv: ['bad.sh'], skipIfMissing: true,
    setup: { 'bad.sh': '#!/bin/sh\necho $1\n' },
  },

  {
    tool: 'pylint', scenario: 'pass', requires: ['--version'],
    argv: ['good.py'], skipIfMissing: true,
    setup: { 'good.py': 'def main():\n    print("hello rtk")\n\n\nif __name__ == "__main__":\n    main()\n' },
    timeoutMs: 45000,
  },
  {
    tool: 'pylint', scenario: 'violations', requires: ['--version'],
    argv: ['bad.py'], skipIfMissing: true,
    setup: { 'bad.py': 'import os\n\n\ndef main():\n    print(undefined_name)\n' },
    timeoutMs: 45000,
  },

  {
    tool: 'flake8', scenario: 'pass', requires: ['--version'],
    argv: ['good.py'], skipIfMissing: true,
    setup: { 'good.py': 'def main():\n    print("hello rtk")\n\n\nif __name__ == "__main__":\n    main()\n' },
  },
  {
    tool: 'flake8', scenario: 'violations', requires: ['--version'],
    argv: ['bad.py'], skipIfMissing: true,
    setup: { 'bad.py': 'import os\nx = 1\n' },
  },

  {
    tool: 'pyright', scenario: 'pass', requires: ['--version'],
    argv: ['--version'], skipIfMissing: true,
  },
  {
    tool: 'pyright', scenario: 'fail', requires: ['--version'],
    argv: ['bad.py'], skipIfMissing: true,
    setup: { 'bad.py': 'def f(x: int) -> str:\n    return x\n' },
    timeoutMs: 60000,
  },
];

const SCENARIO_RE = /^[a-z0-9][a-z0-9._-]*$/;

function validateCatalog(catalog = CATALOG) {
  const seen = new Set();
  for (const e of catalog) {
    if (!e || typeof e.tool !== 'string' || !e.tool) throw new Error(`catalog entry missing tool: ${JSON.stringify(e)}`);
    if (typeof e.scenario !== 'string' || !SCENARIO_RE.test(e.scenario)) {
      throw new Error(`catalog entry ${e.tool} has bad scenario: ${e.scenario}`);
    }
    if (!Array.isArray(e.requires) || !e.requires.length || !e.requires.every((a) => typeof a === 'string')) {
      throw new Error(`catalog entry ${e.tool}/${e.scenario} needs non-empty requires:[string]`);
    }
    if (!Array.isArray(e.argv) || !e.argv.every((a) => typeof a === 'string')) {
      throw new Error(`catalog entry ${e.tool}/${e.scenario} needs argv:[string]`);
    }
    if (!/^[A-Za-z][A-Za-z0-9._+-]*$/.test(e.tool)) {
      throw new Error(`catalog tool name not a plain binary token: ${e.tool}`);
    }
    if (!e.argv.every((tok) => !/[\r\n"'`$&|;<>(){}\\*?\[\]\s]/.test(tok))) {
      throw new Error(`catalog entry ${e.tool}/${e.scenario} has unsafe argv token (shell metachars)`);
    }
    const key = `${e.tool}/${e.scenario}`;
    if (seen.has(key)) throw new Error(`duplicate catalog key: ${key}`);
    seen.add(key);
  }
  return true;
}

// --- Filename sanitization ---------------------------------------------------

function sanitizeName(raw) {
  let s = String(raw ?? '').toLowerCase();
  s = s.replace(/[^a-z0-9._-]+/g, '-').replace(/-{2,}/g, '-')
    .replace(/^[.\-]+/, '').replace(/[-.]+$/, '');
  s = s.slice(0, 80);
  return s || 'unnamed';
}

function logFilename(tool, scenario) {
  return `${sanitizeName(tool)}-${sanitizeName(scenario)}.log`;
}

// --- Host info -----------------------------------------------------------------

const os = require('os');

function buildHostInfo(now = process) {
  return { platform: os.platform(), release: os.release(), node: now.version };
}

// --- Manifest merge --------------------------------------------------------------

const CATEGORY_CAPTURED_REAL = 'captured-real';

/**
 * Pure merge. Existing entries pass through untouched (same references).
 * New entries are appended; ONLY prior captured-real entries sharing a
 * filename with an incoming entry are superseded (re-capture hygiene) —
 * synthetic/adversarial entries are never replaced or edited. Legacy entries
 * lacking `category` trigger a top-level `_categories` note instead of
 * editing those entries.
 */
function mergeManifest(manifest, newEntries) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files)) {
    throw new Error('mergeManifest: manifest must be an object with a files array');
  }
  if (!Array.isArray(newEntries) || !newEntries.length) {
    return { result: manifest, appended: [], replaced: [] };
  }
  const incomingNames = new Set(newEntries.map((e) => e.file));
  const kept = [];
  const replaced = [];
  for (const old of manifest.files) {
    const isOldCapturedReal = Boolean(old) && (old.category === CATEGORY_CAPTURED_REAL || old.provenance === CATEGORY_CAPTURED_REAL);
    if (isOldCapturedReal && incomingNames.has(old.file)) {
      replaced.push(old.file);
    } else {
      kept.push(old);
    }
  }
  const legacyWithoutCategory = kept.filter((e) => !e || typeof e.category !== 'string');
  const result = {};
  for (const k of Object.keys(manifest)) result[k] = manifest[k];
  result.files = kept.concat(newEntries.map((e) => ({ ...e })));
  result.count = result.files.length;
  result.generatedAt = new Date().toISOString();
  if (legacyWithoutCategory.length && newEntries.some((e) => typeof e.category === 'string')) {
    result._categories = {
      note: 'entries above without a category predate the category field; captured-real entries below carry category',
      values: Array.from(new Set(newEntries.map((e) => e.category))),
    };
  }
  return { result, appended: newEntries.map((e) => e.file), replaced };
}

function buildEntry({ file, tool, scenario, command, exitCode, bytes, sha256, capturedAt, host }) {
  return {
    file,
    provenance: 'captured',
    tool,
    category: CATEGORY_CAPTURED_REAL,
    scenario,
    capturedAt,
    source: 'live-run',
    command,
    exitCode,
    bytes,
    sha256,
    host,
  };
}

/**
 * Provenance-complete entry for logs contributed from elsewhere (ingest mode).
 * Nothing is computed from live runs: command stays null and the note travels
 * verbatim. sha256/bytes are computed by the caller over the contributed bytes.
 */
function buildIngestEntry({ file, tool, scenario, capturedAt, bytes, sha256, host, note }) {
  const entry = {
    file,
    provenance: 'captured',
    tool,
    category: CATEGORY_CAPTURED_REAL,
    scenario,
    capturedAt,
    source: 'contributed',
    command: null,
    bytes,
    sha256,
    host,
  };
  if (typeof note === 'string' && note.length) entry.note = note;
  return entry;
}

// -- Summary ---------------------------------------------------------------------

function summarizeManifest(files) {
  const byCategory = {};
  const byTool = {};
  for (const e of Array.isArray(files) ? files : []) {
    const cat = e && typeof e.category === 'string' ? e.category : '(none)';
    const tool = e && typeof e.tool === 'string' ? e.tool : '(unknown)';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byTool[tool] = (byTool[tool] || 0) + 1;
  }
  return { total: Array.isArray(files) ? files.length : 0, byCategory, byTool };
}

module.exports = {
  CATALOG,
  CATEGORY_CAPTURED_REAL,
  SCENARIO_RE,
  validateCatalog,
  sanitizeName,
  logFilename,
  buildHostInfo,
  buildEntry,
  buildIngestEntry,
  mergeManifest,
  summarizeManifest,
};
