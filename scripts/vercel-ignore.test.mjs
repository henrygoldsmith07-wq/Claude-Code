import test from 'node:test';
import assert from 'node:assert/strict';
import { affectedProjects, evaluateProject, loadDependencyMap, matchesGlob, readChangedPaths } from './vercel-ignore.mjs';

const map = loadDependencyMap();
const activeProjects = Object.entries(map.projects)
  .filter(([, project]) => project.deploy !== false && project.kind !== 'retired')
  .map(([id]) => id);

test('glob matching handles repository roots and nested paths', () => {
  assert.equal(matchesGlob('README.md', '**/README.md'), true);
  assert.equal(matchesGlob('packages/theme/le-studio.css', 'packages/theme/**'), true);
  assert.equal(matchesGlob('packages/theme/other.css', 'packages/theme/le-studio.css/**'), false);
  assert.equal(matchesGlob('src/lib/foo.test.ts', '**/*.test.*'), true);
});

// All apps moved to standalone repos on 2026-08-21 (see apps/registry.json
// 'external'). Every former Vercel project is kept as deploy:false for
// provenance, so this repo deploys nothing from any path.
test('the current map has no deployable projects — apps live in their own repos', () => {
  assert.deepEqual(activeProjects, []);
  for (const id of ['arise', 'daily-debate', 'pulse', 'revise', 'rtk-site', 'le-studio-site']) {
    assert.equal(map.projects[id]?.deploy, false, `${id} should be deploy:false`);
  }
});

test('no changed path can trigger a deploy anymore', () => {
  assert.deepEqual(affectedProjects(['packages/theme/le-studio.css'], map), []);
  assert.deepEqual(affectedProjects(['vercel.json'], map), []);
  assert.deepEqual(affectedProjects(['config/affected-deployments.json'], map), []);
  assert.deepEqual(affectedProjects(['scripts/ecosystem-smoke.mjs'], map), []);
});

test('documentation, registry, workflow, and test-only changes deploy nothing', () => {
  assert.deepEqual(affectedProjects(['README.md'], map), []);
  assert.deepEqual(affectedProjects(['apps/registry.json'], map), []);
  assert.deepEqual(affectedProjects(['.github/workflows/engineering.yml'], map), []);
});

test('retired root project never deploys, even for a global change', () => {
  assert.deepEqual(evaluateProject('root', ['package-lock.json'], map), {
    projectId: 'root',
    deploy: false,
    reason: 'retired-project',
    changedPaths: []
  });
});

test('diff reader is injectable and normalizes Git paths', () => {
  const changed = readChangedPaths({
    base: 'old',
    head: 'new',
    exec: (_file, args) => {
      assert.deepEqual(args.slice(0, 4), ['diff', '--name-only', 'old', 'new']);
      return '.\\src\\workspace_daemon\\main.py\n';
    }
  });
  assert.deepEqual(changed, ['src/workspace_daemon/main.py']);
});
