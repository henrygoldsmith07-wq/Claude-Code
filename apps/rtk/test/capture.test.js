'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const {
  CATALOG,
  CATEGORY_CAPTURED_REAL,
  validateCatalog,
  sanitizeName,
  logFilename,
  buildHostInfo,
  buildEntry,
  buildIngestEntry,
  mergeManifest,
  summarizeManifest,
} = require('../benchmark/capture-lib');

const CAPTURE_JS = path.join(__dirname, '..', 'benchmark', 'capture.js');
const CORPUS_DIR = path.join(__dirname, '..', 'benchmark', 'corpus');

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) deepFreeze(value[k]);
    Object.freeze(value);
  }
  return value;
}

function fixtureManifest({ legacyWithoutCategory = false } = {}) {
  const files = [
    { file: 'vitest-fail.log', provenance: 'synthetic', tool: 'vitest', category: 'simple-failure', capturedAt: '2026-08-21T14:56:32.182Z' },
    { file: 'huge-log.log', provenance: 'adversarial', tool: 'generic', category: 'huge', capturedAt: '2026-08-21T14:56:32.215Z' },
    { file: 'real-git-status.log', provenance: 'captured', tool: 'git', category: 'successful', capturedAt: '2026-08-21T14:56:32.485Z', command: 'git status' },
  ];
  if (legacyWithoutCategory) files.push({ file: 'ancient.log', provenance: 'synthetic', tool: 'legacy', capturedAt: '2026-01-01T00:00:00.000Z' });
  return deepFreeze({
    generatedAt: '2026-08-21T14:56:34.068Z',
    count: files.length,
    files,
  });
}

function capturedEntry(file) {
  return buildEntry({
    file,
    tool: 'npm',
    scenario: 'pass',
    command: 'npm --version',
    exitCode: 0,
    bytes: 9,
    sha256: 'a'.repeat(64),
    capturedAt: '2026-08-21T15:00:00.000Z',
    host: { platform: 'win32', release: '10.0.22631', node: 'v22.0.0' },
  });
}

// --- catalog shape -----------------------------------------------------------

test('catalog is well-formed', () => {
  assert.equal(validateCatalog(), true);
});

test('every catalog entry carries the required fields', () => {
  for (const e of CATALOG) {
    assert.equal(typeof e.tool, 'string', `tool: ${e.tool}`);
    assert.match(e.tool, /^[A-Za-z][A-Za-z0-9._+-]*$/, `plain bin name: ${e.tool}`);
    assert.match(e.scenario, /^[a-z0-9][a-z0-9._-]*$/, `scenario slug: ${e.tool}/${e.scenario}`);
    assert.ok(Array.isArray(e.requires) && e.requires.length >= 1, `requires: ${e.tool}`);
    assert.ok(Array.isArray(e.argv), `argv: ${e.tool}/${e.scenario}`);
    assert.equal(e.skipIfMissing, true, `skipIfMissing: ${e.tool}/${e.scenario}`);
    for (const tok of e.argv) {
      assert.equal(false, /[\r\n"'`$&|;<>(){}\\*?[\]\s]/.test(tok), `no shell metachars: ${e.tool} argv token ${tok}`);
    }
  }
});

test('catalog keys are unique and cover the roadmap tool families', () => {
  const keys = CATALOG.map((e) => `${e.tool}/${e.scenario}`);
  assert.equal(new Set(keys).size, keys.length);
  const tools = new Set(CATALOG.map((e) => e.tool));
  for (const family of [
    'npm', 'pnpm', 'bun', 'pytest', 'vitest', 'jest', 'playwright',
    'docker', 'kubectl', 'terraform',
    'cargo', 'go', 'maven', 'gradle', 'tsc', 'gcc', 'cc', 'javac',
    'eslint', 'ruff', 'mypy', 'shellcheck', 'pylint', 'flake8', 'pyright',
    'aws', 'gcloud', 'az',
    'prisma', 'knex', 'alembic', 'flyway',
  ]) {
    assert.ok(tools.has(family), `family covered: ${family}`);
  }
});

test('expanded catalog carries offline-safe scenarios for new families', () => {
  const byKey = new Map(CATALOG.map((e) => [`${e.tool}/${e.scenario}`, e]));
  for (const key of [
    'aws/pass', 'aws/fail', 'gcloud/pass', 'gcloud/fail', 'az/pass', 'az/fail',
    'prisma/validate', 'prisma/fail', 'knex/fail', 'alembic/fail', 'flyway/fail',
    'gcc/pass', 'gcc/fail', 'cc/pass', 'cc/fail', 'javac/pass', 'javac/fail',
    'cargo/clippy-warn', 'cargo/clippy-fail',
    'shellcheck/pass', 'shellcheck/fail',
    'pylint/violations', 'flake8/violations', 'pyright/fail',
  ]) {
    assert.ok(byKey.has(key), `scenario present: ${key}`);
    assert.equal(byKey.get(key).skipIfMissing, true, `skipIfMissing: ${key}`);
  }
});

test('catalog env overrides, when present, are flat string maps', () => {
  for (const e of CATALOG) {
    if (!e.env) continue;
    for (const [k, v] of Object.entries(e.env)) {
      assert.equal(typeof k, 'string');
      assert.match(k, /^[A-Za-z_][A-Za-z0-9_]*$/, `env key: ${e.tool}/${k}`);
      assert.equal(typeof v, 'string', `env value: ${e.tool}/${k}`);
      assert.notEqual(k.toLowerCase(), 'path', `never override PATH via catalog: ${e.tool}`);
    }
  }
});

test('setup files, when present, use safe relative paths', () => {
  for (const e of CATALOG) {
    for (const rel of Object.keys(e.setup || {})) {
      assert.match(rel, /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/, `safe setup path: ${e.tool}/${rel}`);
      assert.equal(path.isAbsolute(rel), false);
      assert.equal(rel.includes('\\'), false, `no backslashes: ${e.tool}/${rel}`);
      assert.equal(rel.split('/').includes('..'), false, `no traversal: ${e.tool}/${rel}`);
    }
  }
});

// --- sanitization --------------------------------------------------------------

test('sanitizeName produces safe single-component filenames', () => {
  assert.equal(sanitizeName('go test'), 'go-test');
  assert.equal(sanitizeName('GitHub Actions!'), 'github-actions');
  assert.equal(sanitizeName('c++'), 'c');
  assert.equal(sanitizeName(''), 'unnamed');
  assert.equal(sanitizeName(null), 'unnamed');
  const traversal = sanitizeName('../../evil');
  assert.equal(false, /[\\/]/.test(traversal), 'no path separators');
  assert.equal(false, traversal.startsWith('.'), 'no leading dots');
  assert.ok(sanitizeName('x'.repeat(300)).length <= 80);
});

test('logFilename joins tool and scenario safely', () => {
  assert.equal(logFilename('tsc', 'fail'), 'tsc-fail.log');
  assert.equal(logFilename('GitHub Actions', 'no runner!!'), 'github-actions-no-runner.log');
});

// --- host info / entries ----------------------------------------------------------

test('buildHostInfo reports platform, release and node version', () => {
  const host = buildHostInfo();
  assert.deepEqual(Object.keys(host).sort(), ['node', 'platform', 'release']);
  assert.equal(host.platform, process.platform);
  assert.match(host.node, /^v\d/);
});

test('buildEntry matches existing field style plus provenance extras', () => {
  const e = capturedEntry('npm-pass.log');
  assert.equal(e.file, 'npm-pass.log');
  assert.equal(e.provenance, 'captured');
  assert.equal(e.category, CATEGORY_CAPTURED_REAL);
  assert.equal(e.source, 'live-run');
  assert.equal(e.command, 'npm --version');
  assert.equal(typeof e.exitCode, 'number');
  assert.equal(typeof e.bytes, 'number');
  assert.match(e.sha256, /^[0-9a-f]{64}$/);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(e.capturedAt));
  assert.deepEqual(Object.keys(e.host).sort(), ['node', 'platform', 'release']);
});

// --- manifest merge -----------------------------------------------------------------

test('mergeManifest appends entries and keeps existing ones byte-for-byte', () => {
  const manifest = fixtureManifest();
  const before = JSON.stringify(manifest.files[0]);
  const beforeSecond = JSON.stringify(manifest.files[1]);
  const fresh = capturedEntry('npm-pass.log');

  const { result, appended } = mergeManifest(manifest, [fresh]);

  assert.equal(appended.length, 1);
  assert.strictEqual(result.files[0], manifest.files[0], 'same reference, untouched');
  assert.equal(JSON.stringify(result.files[0]), before);
  assert.equal(JSON.stringify(result.files[1]), beforeSecond);
  assert.equal(result.count, 4);
  assert.equal(result.files.length, 4);
  assert.equal(result.files[3].file, 'npm-pass.log');
  assert.notEqual(result.generatedAt, '2026-08-21T14:56:34.068Z');
});

test('mergeManifest does not mutate its input', () => {
  const manifest = fixtureManifest();
  assert.throws(() => { manifest.count = 999; }, TypeError, 'fixture is frozen so mutation throws');
  mergeManifest(manifest, [capturedEntry('npm-pass.log')]);
  assert.equal(manifest.count, 3);
  assert.equal(manifest.files.length, 3);
});

test('mergeManifest supersedes only prior captured-real entries with the same file', () => {
  const manifest = fixtureManifest();
  const priorCaptured = buildEntry({
    file: 'npm-pass.log', tool: 'npm', scenario: 'pass', command: 'npm --version',
    exitCode: 0, bytes: 1, sha256: 'b'.repeat(64),
    capturedAt: '2026-08-20T00:00:00.000Z', host: buildHostInfo(),
  });
  const withPrior = mergeManifest(manifest, [priorCaptured]).result;
  const again = mergeManifest(withPrior, [capturedEntry('npm-pass.log')]);

  assert.deepEqual(again.replaced, ['npm-pass.log']);
  const npmEntries = again.result.files.filter((f) => f.file === 'npm-pass.log');
  assert.equal(npmEntries.length, 1, 'old captured-real entry superseded, not duplicated');
  // synthetic/adversarial/git entries all survive untouched
  assert.ok(again.result.files.some((f) => f.file === 'vitest-fail.log'));
  assert.ok(again.result.files.some((f) => f.file === 'huge-log.log'));
});

test('mergeManifest never replaces synthetic entries even on filename clash', () => {
  const manifest = fixtureManifest();
  const { result } = mergeManifest(manifest, [capturedEntry('vitest-fail.log')]);
  const matching = result.files.filter((f) => f.file === 'vitest-fail.log');
  assert.equal(matching.length, 2, 'synthetic kept untouched, captured-real appended alongside');
  assert.equal(matching[0].provenance, 'synthetic', 'synthetic entry intact at original index');
  assert.equal(matching[1].category, CATEGORY_CAPTURED_REAL);
});

test('mergeManifest adds _categories note only for legacy entries lacking category', () => {
  const legacy = fixtureManifest({ legacyWithoutCategory: true });
  const { result } = mergeManifest(legacy, [capturedEntry('npm-pass.log')]);
  assert.ok(result._categories);
  assert.deepEqual(result._categories.values, ['captured-real']);

  const modern = fixtureManifest();
  const clean = mergeManifest(modern, [capturedEntry('npm-pass.log')]).result;
  assert.equal(clean._categories, undefined);

  const empty = mergeManifest(modern, []);
  assert.equal(empty.appended.length, 0);
  assert.equal(empty.result, modern, 'no-op merge returns the input untouched');

  assert.throws(() => mergeManifest({ files: 'nope' }, []), /files array/);
});

test('mergeManifest round-trips through JSON preserving existing entries verbatim', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-manifest-test-'));
  try {
    const manifestPath = path.join(dir, 'manifest.json');
    const original = fixtureManifest().files;
    fs.writeFileSync(manifestPath, JSON.stringify({ generatedAt: '2026-08-21T14:56:34.068Z', count: original.length, files: original }, null, 2));
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const { result } = mergeManifest(parsed, [capturedEntry('npm-pass.log')]);
    fs.writeFileSync(path.join(dir, 'next.json'), JSON.stringify(result, null, 2));
    const reparsed = JSON.parse(fs.readFileSync(path.join(dir, 'next.json'), 'utf8'));
    for (let i = 0; i < original.length; i++) {
      assert.equal(JSON.stringify(reparsed.files[i]), JSON.stringify(original[i]));
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- ingest entries -----------------------------------------------------------------

test('buildIngestEntry is provenance-complete with source contributed and null command', () => {
  const host = { platform: 'linux', release: '6.1.0', node: 'v22.0.0' };
  const e = buildIngestEntry({
    file: 'git-status.log',
    tool: 'git',
    scenario: 'status',
    capturedAt: '2026-08-21T16:00:00.000Z',
    bytes: 1234,
    sha256: 'c'.repeat(64),
    host,
    note: 'piped from a contributor machine',
  });
  assert.equal(e.file, 'git-status.log');
  assert.equal(e.provenance, 'captured');
  assert.equal(e.category, CATEGORY_CAPTURED_REAL);
  assert.equal(e.source, 'contributed');
  assert.equal(e.command, null);
  assert.equal(e.note, 'piped from a contributor machine');
  assert.equal(e.bytes, 1234);
  assert.match(e.sha256, /^[0-9a-f]{64}$/);
  assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(e.capturedAt));
  assert.deepEqual(e.host, host);
});

test('buildIngestEntry omits note when absent and merges like any captured-real entry', () => {
  const bare = buildIngestEntry({
    file: 'x.log', tool: 'x', scenario: 'contributed',
    capturedAt: '2026-08-21T16:00:00.000Z', bytes: 1, sha256: 'd'.repeat(64), host: buildHostInfo(),
  });
  assert.equal('note' in bare, false);

  const contributed = buildIngestEntry({
    file: 'npm-pass.log', tool: 'npm', scenario: 'pass',
    capturedAt: '2026-08-21T16:00:00.000Z', bytes: 9, sha256: 'e'.repeat(64),
    host: buildHostInfo(), note: 'from CI',
  });
  const { result, appended } = mergeManifest(fixtureManifest(), [contributed]);
  assert.deepEqual(appended, ['npm-pass.log']);
  assert.equal(result.count, 4);
  assert.equal(result.files[3].file, 'npm-pass.log');
  assert.equal(result.files[3].source, 'contributed');
  assert.equal(result.files[3].category, CATEGORY_CAPTURED_REAL);
  // synthetic/adversarial entries untouched
  assert.equal(JSON.stringify(result.files[0]), JSON.stringify(fixtureManifest().files[0]));
});

// --- summary ---------------------------------------------------------------------

test('summarizeManifest groups counts by category and tool', () => {
  const s = summarizeManifest([
    { tool: 'vitest', category: 'simple-failure' },
    { tool: 'vitest', category: 'successful' },
    { tool: 'generic' },
  ]);
  assert.equal(s.total, 3);
  assert.deepEqual(s.byCategory, { 'simple-failure': 1, successful: 1, '(none)': 1 });
  assert.deepEqual(s.byTool, { vitest: 2, generic: 1 });
  assert.deepEqual(summarizeManifest([]), { total: 0, byCategory: {}, byTool: {} });
  assert.equal(summarizeManifest(undefined).total, 0);
});

test('summarizeManifest groups captured-real and contributed entries alongside legacy categories', () => {
  const live = buildEntry({
    file: 'aws-fail.log', tool: 'aws', scenario: 'fail', command: 'aws rtk-invalid-service-xyz describe-things',
    exitCode: 252, bytes: 100, sha256: 'a'.repeat(64),
    capturedAt: '2026-08-21T16:00:00.000Z', host: buildHostInfo(),
  });
  const contributed = buildIngestEntry({
    file: 'git-status.log', tool: 'git', scenario: 'status',
    capturedAt: '2026-08-21T16:00:01.000Z', bytes: 50, sha256: 'c'.repeat(64),
    host: buildHostInfo(), note: 'contributed',
  });
  const s = summarizeManifest([
    ...fixtureManifest().files,
    live,
    contributed,
  ]);
  assert.equal(s.total, 5);
  assert.equal(s.byCategory[CATEGORY_CAPTURED_REAL], 2);
  assert.equal(s.byCategory.successful, 1);
  assert.equal(s.byCategory['simple-failure'], 1);
  assert.equal(s.byTool.aws, 1);
  assert.equal(s.byTool.git, 2);
});

// --- CLI: no-write modes -------------------------------------------------------------

function corpusSnapshot() {
  const files = fs.existsSync(CORPUS_DIR) ? fs.readdirSync(CORPUS_DIR).sort() : [];
  const manifestPath = path.join(CORPUS_DIR, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath) : null;
  return { files, manifest };
}

function runCli(...args) {
  return cp.spawnSync(process.execPath, [CAPTURE_JS, ...args], {
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
  });
}

test('--list prints catalog and availability matrix without writing', () => {
  const before = corpusSnapshot();
  const res = runCli('--list');
  const after = corpusSnapshot();

  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /catalog:/);
  assert.match(res.stdout, /npm\s+pass/);
  assert.match(res.stdout, /(available|UNAVAILABLE)/);
  assert.deepEqual(after.files, before.files, 'corpus directory unchanged');
  assert.deepEqual(after.manifest, before.manifest, 'manifest bytes unchanged');
});

test('--summary prints grouped counts from the manifest without mutating', () => {
  const before = corpusSnapshot();
  const res = runCli('--summary');
  const after = corpusSnapshot();

  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /total: \d+/);
  assert.match(res.stdout, /by category:/);
  assert.match(res.stdout, /by tool:/);
  assert.deepEqual(after.files, before.files);
  assert.deepEqual(after.manifest, before.manifest);
});

test('--dry-run shows planned writes but writes nothing', () => {
  const before = corpusSnapshot();
  const res = runCli('--dry-run');
  const after = corpusSnapshot();

  assert.equal(res.status, 0, `stderr: ${res.stderr}`);
  assert.match(res.stdout, /would write/);
  assert.deepEqual(after.files, before.files);
  assert.deepEqual(after.manifest, before.manifest);
});

// --- CLI: ingest mode -----------------------------------------------------------------

function sha256(buf) {
  return require('crypto').createHash('sha256').update(buf).digest('hex');
}

test('--ingest appends a provenance-complete contributed entry into a temp corpus', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-ingest-test-'));
  try {
    const fixture = path.join(workDir, 'contributed-git-status.log');
    const body = Buffer.from('On branch main\nnothing to commit, working tree clean\n', 'utf8');
    fs.writeFileSync(fixture, body);
    const outDir = path.join(workDir, 'corpus');

    const res = runCli('--ingest', fixture, '--tool', 'git', '--scenario', 'status',
      '--note', 'piped from contributor machine', '--out', outDir);

    assert.equal(res.status, 0, `stderr: ${res.stderr}`);
    assert.match(res.stdout, /ingested/);

    const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.count, 1);
    const entry = manifest.files[0];
    assert.equal(entry.file, 'git-status.log');
    assert.equal(entry.provenance, 'captured');
    assert.equal(entry.category, CATEGORY_CAPTURED_REAL);
    assert.equal(entry.source, 'contributed');
    assert.equal(entry.tool, 'git');
    assert.equal(entry.scenario, 'status');
    assert.equal(entry.command, null);
    assert.equal(entry.note, 'piped from contributor machine');
    assert.equal(entry.bytes, body.length);
    assert.equal(entry.sha256, sha256(body));
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(entry.capturedAt));
    assert.deepEqual(Object.keys(entry.host).sort(), ['node', 'platform', 'release']);

    const copied = fs.readFileSync(path.join(outDir, 'git-status.log'));
    assert.deepEqual(copied, body, 'log bytes copied verbatim');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test('--ingest refuses duplicate sha256 without --force and supersedes with it', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-ingest-dup-test-'));
  try {
    const fixture = path.join(workDir, 'some-tool-output.log');
    fs.writeFileSync(fixture, 'ERR! vitest fail\n1 failed | 2 passed\n');
    const outDir = path.join(workDir, 'corpus');

    const first = runCli('--ingest', fixture, '--tool', 'vitest', '--out', outDir);
    assert.equal(first.status, 0, `stderr: ${first.stderr}`);

    const before = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));

    // same content under a different tool label is still a duplicate by sha256
    const dupe = runCli('--ingest', fixture, '--tool', 'jest', '--out', outDir);
    assert.equal(dupe.status, 1, 'duplicate refused without --force');
    assert.match(dupe.stderr, /duplicate|sha256/i);
    const afterRefusal = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    assert.equal(afterRefusal.count, before.count, 'manifest untouched on refusal');
    assert.equal(fs.readdirSync(outDir).filter((f) => f.endsWith('.log')).length, 1);

    // --force lets the contributor insist; same filename supersedes prior entry
    const forced = runCli('--ingest', fixture, '--tool', 'vitest', '--scenario', 'status',
      '--force', '--note', 're-contributed', '--out', outDir);
    assert.equal(forced.status, 0, `stderr: ${forced.stderr}`);
    const afterForce = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
    assert.equal(afterForce.count, before.count + 1, 'new filename appended alongside original');
    const entries = afterForce.files.filter((f) => f.file === 'vitest-status.log');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].source, 'contributed');
    assert.equal(entries[0].note, 're-contributed');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
});

test('--ingest validates arguments and never touches the default corpus', () => {
  const before = corpusSnapshot();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-ingest-args-test-'));
  try {
    const missing = runCli('--ingest', path.join(workDir, 'nope.log'), '--tool', 'git');
    assert.equal(missing.status, 1, 'missing file fails cleanly');

    const noTool = runCli('--ingest', path.join(workDir, 'x.log'));
    assert.equal(noTool.status, 1, '--tool is required');

    const badTool = runCli('--ingest', path.join(workDir, 'x.log'), '--tool', 'bad tool!');
    assert.equal(badTool.status, 1, 'tool token validated');

    const badScenario = runCli('--ingest', path.join(workDir, 'x.log'), '--tool', 'git', '--scenario', 'BAD SCENARIO');
    assert.equal(badScenario.status, 1, 'scenario slug validated');
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
  const after = corpusSnapshot();
  assert.deepEqual(after.files, before.files, 'default corpus unchanged');
  assert.deepEqual(after.manifest, before.manifest);
});
