import test from 'node:test';
import assert from 'node:assert/strict';
import { affectedProjects, evaluateProject, loadDependencyMap, matchesGlob, readChangedPaths } from './vercel-ignore.mjs';

const map = loadDependencyMap();
const activeProjects = Object.entries(map.projects)
  .filter(([, project]) => project.deploy !== false && project.kind !== 'retired')
  .map(([id]) => id);

test('glob matching handles repository roots and nested paths', () => {
  assert.equal(matchesGlob('README.md', '**/README.md'), true);
  assert.equal(matchesGlob('apps/daily-debate/README.md', '**/README.md'), true);
  assert.equal(matchesGlob('apps/daily-debate/src/page.tsx', 'apps/daily-debate/**'), true);
  assert.equal(matchesGlob('apps/daily-debate-site/index.html', 'apps/daily-debate/**'), false);
  assert.equal(matchesGlob('apps/daily-debate/src/lib/foo.test.ts', '**/*.test.*'), true);
});

test('the current map contains only current deployable roots', () => {
  assert.equal(map.projects['world-news'], undefined);
  assert.equal(map.projects['world-news-site'], undefined);
  assert.equal(map.projects['dictation-typer'], undefined);
  assert.equal(map.projects['dictation-typer-site'], undefined);
  assert.equal(map.projects['meeting-recorder'], undefined);
  assert.equal(map.projects['meeting-recorder-site'], undefined);
  assert.equal(map.projects['agent-os-control-room'], undefined);
  assert.equal(map.projects.rtk.deploy, false);
  assert.deepEqual(activeProjects, [
    'arise-site',
    'arise',
    'daily-debate-site',
    'daily-debate',
    'ecosystem-shell',
    'emotion-tracker',
    'food-shopping-os',
    'forq-site',
    'french-practice',
    'habit-tracker',
    'le-studio-site',
    'mental-load-tracker',
    'pulse',
    'rapport',
    'reflect-site',
    'revise-site',
    'revise',
    'rtk-site'
  ]);
});

test('an app source change affects only its product project', () => {
  assert.deepEqual(affectedProjects(['apps/pulse/src/lib/store.ts'], map), ['pulse']);
  assert.deepEqual(affectedProjects(['apps/daily-debate/src/app/page.tsx'], map), ['daily-debate']);
  assert.deepEqual(affectedProjects(['apps/food-shopping-os/src/app/page.jsx'], map), ['food-shopping-os']);
});

test('marketing site and product changes remain independent', () => {
  assert.deepEqual(affectedProjects(['apps/arise-site/index.html'], map), ['arise-site']);
  assert.deepEqual(affectedProjects(['apps/arise/src/App.jsx'], map), ['arise']);
  assert.deepEqual(affectedProjects(['apps/le-studio-site/index.html'], map), ['le-studio-site']);
  assert.deepEqual(affectedProjects(['apps/french-practice/src/App.jsx'], map), ['french-practice']);
});

test('ecosystem-shell is driven only by its own runtime and routing files', () => {
  assert.deepEqual(affectedProjects(['apps/ecosystem-shell/routes.json'], map), ['ecosystem-shell']);
  assert.deepEqual(affectedProjects(['apps/ecosystem-shell/vercel.json'], map), ['ecosystem-shell']);
  assert.deepEqual(affectedProjects(['apps/ecosystem-shell/index.html'], map), ['ecosystem-shell']);
  assert.deepEqual(affectedProjects(['apps/rapport/src/app/page.tsx'], map), ['rapport']);
  assert.deepEqual(affectedProjects(['apps/pulse/src/main.tsx'], map), ['pulse']);
});

test('shared theme fans out to actual vendored consumers only', () => {
  assert.deepEqual(affectedProjects(['packages/theme/le-studio.css'], map), [
    'arise',
    'daily-debate',
    'emotion-tracker',
    'food-shopping-os',
    'french-practice',
    'habit-tracker',
    'mental-load-tracker',
    'revise'
  ]);
  assert.equal(affectedProjects(['packages/theme/le-studio.css'], map).includes('pulse'), false);
  assert.equal(affectedProjects(['packages/theme/le-studio.css'], map).includes('rapport'), false);
  assert.equal(affectedProjects(['packages/theme/le-studio.css'], map).includes('le-studio-site'), false);
  assert.deepEqual(affectedProjects(['packages/le-studio-tokens/tokens.css'], map), []);
});

test('app lockfiles stay scoped while root lock/config changes safely fan out', () => {
  assert.deepEqual(affectedProjects(['apps/daily-debate/package-lock.json'], map), ['daily-debate']);
  assert.deepEqual(affectedProjects(['package-lock.json'], map), activeProjects);
  assert.deepEqual(affectedProjects(['vercel.json'], map), activeProjects);
  assert.deepEqual(affectedProjects(['config/affected-deployments.json'], map), activeProjects);
});

test('documentation, registry, workflow, and test-only changes deploy nothing', () => {
  assert.deepEqual(affectedProjects(['README.md'], map), []);
  assert.deepEqual(affectedProjects(['docs/architecture/le-studio-adr-001-ecosystem.md'], map), []);
  assert.deepEqual(affectedProjects(['apps/registry.json'], map), []);
  assert.deepEqual(affectedProjects(['.github/workflows/ecosystem.yml'], map), []);
  assert.deepEqual(affectedProjects(['apps/daily-debate/tests/argGraph.test.ts'], map), []);
  assert.deepEqual(affectedProjects(['apps/daily-debate/benchmark/fixture.ts'], map), []);
  assert.deepEqual(affectedProjects(['scripts/ecosystem-smoke.mjs'], map), []);
  assert.deepEqual(affectedProjects(['apps/rtk/src/filter.js'], map), []);
});

test('unknown shared packages fail open to every active project', () => {
  const affected = affectedProjects(['packages/new-runtime/index.ts'], map);
  assert.deepEqual(affected, activeProjects);
});

test('an unmapped runtime root fails open instead of silently skipping output changes', () => {
  assert.deepEqual(affectedProjects(['new-runtime/index.ts'], map), activeProjects);
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
      return '.\\apps\\pulse\\src\\main.tsx\n';
    }
  });
  assert.deepEqual(changed, ['apps/pulse/src/main.tsx']);
});
