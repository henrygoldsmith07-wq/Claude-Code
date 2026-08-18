import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('shared-origin history keys are unique and owned by one app', async () => {
  const keys = [
    ['forq', 'forq-state-v2'],
    ['french', 'fp.pulse-history.v2'],
    ['rapport', 'rapport.pulse-history.v2'],
    ['reflect', 'reflectEntries'],
    ['reflect-consent', 'reflectPulseOptIn'],
  ];
  assert.equal(new Set(keys.map(([, key]) => key)).size, keys.length);
  assert.equal(keys.filter(([, key]) => key.endsWith('.v2')).length, 2);
  const repository = await readFile(join(root, 'apps', 'revise', 'src', 'data', 'storage-namespace.ts'), 'utf8');
  for (const key of ['revise.lastPullAt.v1', 'revise.onboardedAt.v1', 'revise.seedVersion.v1']) assert.match(repository, new RegExp(key.replaceAll('.', '\\.'), 'u'));
  for (const file of ['repository.ts', 'sync.ts']) {
    assert.doesNotMatch(
      await readFile(join(root, 'apps', 'revise', 'src', 'data', file), 'utf8'),
      /\b(?:readMeta|writeMeta)\s*\(\s*["'](?:lastPullAt|onboardedAt|seedVersion)["']/u,
    );
  }
});
