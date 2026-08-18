import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, validateDeployment } from './ecosystem-deployment.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const shell = join(root, 'apps', 'ecosystem-shell');
const manifest = await readJson(join(shell, 'routes.json'));
const vercel = await readJson(join(shell, 'vercel.json'));
const errors = validateDeployment(manifest, vercel);
const index = await readFile(join(shell, 'index.html'), 'utf8');

for (const route of manifest.routes) {
  if (!index.includes(`href="${route.path}/"`)) errors.push(`${route.path} is missing from the shell landing page`);
}

const forqConfig = await readFile(join(root, 'apps', 'food-shopping-os', 'next.config.mjs'), 'utf8');
if (!forqConfig.includes("basePath: process.env.APP_BASE_PATH || ''")) errors.push('Forq does not expose the reversible APP_BASE_PATH switch');

const reviseData = join(root, 'apps', 'revise', 'src', 'data');
for (const file of ['repository.ts', 'sync.ts']) {
  const source = await readFile(join(reviseData, file), 'utf8');
  if (/\b(?:readMeta|writeMeta)\s*\(\s*["'](?:lastPullAt|onboardedAt|seedVersion)["']/.test(source)) {
    errors.push(`${file} still accesses an unprefixed Revise metadata key`);
  }
}

const shellFiles = await readdir(shell);
if (!shellFiles.includes('routes.json')) errors.push('route manifest is missing');

const baseUrl = process.env.ECOSYSTEM_URL;
if (baseUrl) {
  for (const route of manifest.routes) {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${route.path}/`, { redirect: 'manual' });
    if (response.status < 200 || response.status >= 400) errors.push(`${route.path} smoke request returned HTTP ${response.status}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Ecosystem smoke passed for ${manifest.routes.length} routes${baseUrl ? ` at ${baseUrl}` : ''}.`);
}
