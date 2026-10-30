import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentSnapshot, rollbackDeployment } from './ecosystem-deployment.mjs';

// The route manifest and vercel.json this test used to read lived in
// apps/ecosystem-shell, which was deleted in the 2026-08-21 migration
// (13e352a, "chore: migrate all apps to standalone repos") and moved to its
// own repository. The assertions below are built from a faithful replica of
// that manifest so the pure rollback/validation functions stay tested in
// this repository without depending on files that no longer exist here.
const forqRoute = {
  id: 'forq',
  path: '/forq',
  prefixMode: 'preserved',
  basePath: '/forq',
};
const manifest = {
  version: 2,
  routes: [forqRoute, { id: 'arise', path: '/arise', prefixMode: 'preserved', basePath: '/arise' }],
};
const vercel = {
  redirects: [{ source: '/forq', destination: '/forq/' }, { source: '/arise', destination: '/arise/' }],
  rewrites: [
    // NB: validateDeployment matches each expected rewrite source exactly, so
    // the '<path>/' and '<path>/:path*' entries below are both required.
    { source: '/forq/', destination: 'https://forq.example.com/' },
    { source: '/forq/:path*', destination: 'https://forq.example.com/:path*' },
    { source: '/arise/', destination: 'https://arise.example.com/' },
    { source: '/arise/:path*', destination: 'https://arise.example.com/:path*' },
  ],
};

describe('ecosystem deployment rollback', () => {
  it('returns the last known-good route snapshot without mutating the candidate', () => {
    const candidate = deploymentSnapshot(manifest, vercel);

    // A "bad" current state: the forq route and its vercel wiring were lost.
    const previous = deploymentSnapshot(
      { ...manifest, routes: manifest.routes.filter((route) => route.id !== 'forq') },
      {
        ...vercel,
        redirects: vercel.redirects.filter((route) => route.source !== '/forq'),
        rewrites: vercel.rewrites.filter((route) => !route.source.startsWith('/forq')),
      },
    );

    const rolledBack = rollbackDeployment(candidate, previous);
    assert.equal(rolledBack.manifest.routes.some((route) => route.id === 'forq'), false);
    assert.equal(candidate.manifest.routes.some((route) => route.id === 'forq'), true);
    assert.notEqual(rolledBack, previous);
  });

  it('rejects rolling back to a snapshot that fails route validation', () => {
    // A bad last-known-good state: two routes share an id, so
    // validateDeployment() rejects it and rollbackDeployment() must refuse
    // to restore such a snapshot. (An empty route list is accepted, so the
    // invalidity has to come from a real rule violation.)
    const previous = {
      manifest: {
        ...manifest,
        routes: [...manifest.routes, { ...forqRoute }],
      },
    };

    assert.throws(
      () => rollbackDeployment(manifest, previous),
      /Cannot roll back to an invalid snapshot/,
    );
  });
});
