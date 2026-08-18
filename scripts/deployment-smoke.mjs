#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDeployment } from './ecosystem-deployment.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = path.join(root, 'apps', 'ecosystem-shell');
const manifest = JSON.parse(await readFile(path.join(shell, 'routes.json'), 'utf8'));
const vercel = JSON.parse(await readFile(path.join(shell, 'vercel.json'), 'utf8'));
const index = await readFile(path.join(shell, 'index.html'), 'utf8');
const failures = validateDeployment(manifest, vercel);

for (const route of manifest.routes ?? []) {
  if (!index.includes(`href="${route.path}/"`)) failures.push(`${route.path} is absent from the shell landing page`);
  if (typeof route.upstream !== 'string' || !route.upstream.startsWith('https://')) {
    failures.push(`${route.path} does not declare an HTTPS deployment upstream`);
  }
}

const baseUrl = process.env.DEPLOYMENT_URL || process.env.ECOSYSTEM_URL;
if (baseUrl) {
  for (const route of manifest.routes ?? []) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${route.path}/`, { redirect: 'manual' });
    if (response.status < 200 || response.status >= 400) {
      failures.push(`${route.path} deployment smoke returned HTTP ${response.status}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Deployment smoke passed for ${(manifest.routes ?? []).length} routes${baseUrl ? ` at ${baseUrl}` : ''}.`);
