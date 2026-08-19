import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, deploymentSnapshot, rollbackDeployment } from './ecosystem-deployment.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const shell = join(root, 'apps', 'ecosystem-shell');

describe('ecosystem deployment rollback', () => {
  it('returns the last known-good route snapshot without mutating the candidate', async () => {
    const candidate = { manifest: await readJson(join(shell, 'routes.json')), vercel: await readJson(join(shell, 'vercel.json')) };
    const previous = deploymentSnapshot(
      { ...candidate.manifest, routes: candidate.manifest.routes.filter((route) => route.id !== 'forq') },
      {
        ...candidate.vercel,
        redirects: candidate.vercel.redirects.filter((route) => route.source !== '/forq'),
        rewrites: candidate.vercel.rewrites.filter((route) => !route.source.startsWith('/forq')),
      },
    );
    const rolledBack = rollbackDeployment(candidate, previous);
    assert.equal(rolledBack.manifest.routes.some((route) => route.id === 'forq'), false);
    assert.equal(candidate.manifest.routes.some((route) => route.id === 'forq'), true);
    assert.notEqual(rolledBack, previous);
  });
});
