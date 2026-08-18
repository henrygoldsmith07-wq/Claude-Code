import { readFile } from 'node:fs/promises';

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function validateDeployment(manifest, vercel) {
  const errors = [];
  const routes = Array.isArray(manifest?.routes) ? manifest.routes : [];
  const redirects = Array.isArray(vercel?.redirects) ? vercel.redirects : [];
  const rewrites = Array.isArray(vercel?.rewrites) ? vercel.rewrites : [];
  const ids = new Set();

  if (manifest?.version !== 2) errors.push('routes.json must declare version 2');
  for (const route of routes) {
    if (!route.id || ids.has(route.id)) errors.push(`duplicate or missing route id: ${route.id || '<empty>'}`);
    ids.add(route.id);
    const path = route.path;
    if (!path || !/^\/[a-z0-9-]+$/.test(path)) errors.push(`invalid route path: ${path}`);
    if (!redirects.some((entry) => entry.source === path && entry.destination === `${path}/`)) {
      errors.push(`${path} is missing its trailing-slash redirect`);
    }
    for (const suffix of ['/', '/:path*']) {
      const source = `${path}${suffix}`;
      if (!rewrites.some((entry) => entry.source === source && typeof entry.destination === 'string' && entry.destination.startsWith('https://'))) {
        errors.push(`${source} is missing an HTTPS upstream rewrite`);
      }
    }
    if (route.prefixMode === 'preserved' && route.basePath !== path) {
      errors.push(`${path} must preserve its matching Next basePath`);
    }
  }
  return errors;
}

export function deploymentSnapshot(manifest, vercel) {
  return JSON.parse(JSON.stringify({ manifest, vercel }));
}

export function rollbackDeployment(current, previous) {
  const errors = validateDeployment(previous.manifest, previous.vercel);
  if (errors.length) throw new Error(`Cannot roll back to an invalid snapshot: ${errors.join('; ')}`);
  return deploymentSnapshot(previous.manifest, previous.vercel);
}
