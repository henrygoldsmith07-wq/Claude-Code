#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = path.join(root, '.github', 'workflows');
const required = ['revise.yml', 'pulse.yml', 'rapport.yml', 'food-shopping-os.yml'];
const failures = [];

for (const file of required) {
  const workflowPath = path.join(workflowDir, file);
  const source = readFileSync(workflowPath, 'utf8');
  const blocks = source.split(/(?=^\s*-\s+(?:name|run):)/gm);
  const e2eBlocks = blocks.filter((block) => /playwright|test:e2e/i.test(block));
  if (!e2eBlocks.length) {
    failures.push(`${file}: no browser E2E step found`);
    continue;
  }
  for (const block of e2eBlocks) {
    if (/optional|skip(?:ping)?|continue-on-error:\s*true|\|\|\s*(?:true|echo)/i.test(block)) {
      failures.push(`${file}: browser E2E is advisory instead of hard-fail`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Hard-fail browser E2E policy passed for ${required.length} workflows.`);
