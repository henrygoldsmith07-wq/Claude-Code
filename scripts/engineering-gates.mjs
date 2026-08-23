#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const gates = [
  ['repository smoke', ['scripts/smoke.mjs']],
  ['CODEOWNERS coverage', ['scripts/check-codeowners.mjs']],
  ['deployment configuration', ['scripts/check-deploy-config.mjs']],
  // 'deployment smoke' and 'ecosystem smoke' moved with ecosystem-shell to its
  // own repo on 2026-08-21; app E2E/lint/curriculum gates moved with their apps.
  ['hard-fail browser E2E policy', ['scripts/check-hard-fail-e2e.mjs']],
  ['performance budget configuration', ['scripts/check-performance-budgets.mjs']],
  ['security static audit', ['scripts/security-audit.mjs']],
];
const failures = [];

for (const [name, args] of gates) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) failures.push(name);
}

if (failures.length) {
  console.error(`\nEngineering gates failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nEngineering gates passed.');
