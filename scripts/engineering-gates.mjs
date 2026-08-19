#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const gates = [
  ['repository smoke', ['scripts/smoke.mjs']],
  ['deployment configuration', ['scripts/check-deploy-config.mjs']],
  ['deployment smoke', ['scripts/deployment-smoke.mjs']],
  ['hard-fail browser E2E policy', ['scripts/check-hard-fail-e2e.mjs']],
  ['ecosystem smoke', ['scripts/ecosystem-smoke.mjs']],
  ['rollback and collision tests', ['--test', 'scripts/ecosystem-rollback.test.mjs', 'apps/ecosystem-shell/tests/storage-collision.test.mjs']],
  ['performance budget configuration', ['scripts/check-performance-budgets.mjs']],
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
