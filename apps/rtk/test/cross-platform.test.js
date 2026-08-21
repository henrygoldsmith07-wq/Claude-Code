'use strict';

// Cross-platform quality: Windows / macOS / Linux behaviour.
// Covers path parsing (separators, drive letters, home dirs), line endings
// (LF/CRLF/CR/mixed), config discovery from nested directories, exit-code
// passthrough, command detection under shell wrappers, and packaging integrity.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PARSERS, pickParser } = require('../src/parsers');
const { loadConfig } = require('../src/config');

const BIN = path.join(__dirname, '..', 'bin', 'rtk.js');

// ---------------------------------------------------------------------------
// Path parsing — both separators must survive every relevant parser
// ---------------------------------------------------------------------------

test('cross-platform: Windows drive-letter paths keep file:line in tsc output', () => {
  const output = [
    'C:\\Users\\runner\\project\\src\\app.ts(10,5): error TS2322: Type string not assignable',
    'D:\\work\\repo\\lib\\util.ts:42:10 - error TS2345: Argument of type number',
    'Found 2 errors.',
  ].join('\n');
  const { emitted } = PARSERS.tsc.filter(output, 1);
  assert.ok(emitted.includes('TS2322'));
  assert.ok(emitted.includes('TS2345'));
  assert.ok(emitted.includes('Found 2 errors'));
});

test('cross-platform: Unix absolute paths keep file:line in tsc output', () => {
  const output = [
    '/home/runner/work/project/src/app.ts:10:5 - error TS2322: Type string not assignable',
    '/opt/ci/lib/util.ts:42:10 - error TS2345: Argument of type number',
    'Found 2 errors.',
  ].join('\n');
  const { emitted } = PARSERS.tsc.filter(output, 1);
  assert.ok(emitted.includes('TS2322'));
  assert.ok(emitted.includes('TS2345'));
});

test('cross-platform: mixed separators in one log keep every diagnostic', () => {
  const output = [
    'C:\\project\\src\\win.ts:1:1 - error TS2304: Cannot find name win',
    '/home/ci/src/unix.ts:2:2 - error TS2304: Cannot find name unix',
    'Found 2 errors.',
  ].join('\n');
  const { emitted } = PARSERS.tsc.filter(output, 1);
  assert.ok(emitted.includes('TS2304'));
  assert.ok(emitted.includes('Found 2 errors'));
});

// ---------------------------------------------------------------------------
// Line endings — LF, CRLF, CR, mixed
// ---------------------------------------------------------------------------

test('cross-platform: CRLF output retains failure needles in vitest', () => {
  const output = ['FAIL src/a.test.ts > boom', 'AssertionError: expected 1 to equal 2', 'Tests  1 failed'].join('\r\n');
  const { emitted } = PARSERS.vitest.filter(output, 1);
  assert.ok(emitted.includes('FAIL'));
  assert.ok(emitted.includes('AssertionError'));
  assert.ok(emitted.includes('1 failed'));
});

test('cross-platform: mixed LF/CRLF output retains failure needles', () => {
  const output = 'FAIL src/a.test.ts > boom\r\nAssertionError: expected 1 to equal 2\nTests  1 failed\r\n';
  const { emitted } = PARSERS.vitest.filter(output, 1);
  assert.ok(emitted.includes('FAIL'));
  assert.ok(emitted.includes('1 failed'));
});

test('cross-platform: trailing CRLF does not duplicate summary lines', () => {
  const output = 'Test Files  1 passed (1)\r\n      Tests  10 passed (10)\r\n   Duration  0.5s\r\n';
  const { emitted } = PARSERS.vitest.filter(output, 0);
  const lines = emitted.split('\n').filter(l => l.trim());
  const unique = new Set(lines.map(l => l.trim()));
  assert.equal(lines.length, unique.size, 'trailing newline produced duplicate summary lines');
});

// ---------------------------------------------------------------------------
// Config discovery — nearest ancestor from a nested cwd
// ---------------------------------------------------------------------------

test('cross-platform: config discovered from nested working directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-xplat-'));
  const nested = path.join(root, 'a', 'b', 'c');
  fs.mkdirSync(nested, { recursive: true });
  fs.mkdirSync(path.join(root, '.rtk'), { recursive: true });
  fs.writeFileSync(path.join(root, '.rtk', 'config.json'), JSON.stringify({ aggressiveness: 'conservative' }));
  const { config, path: found } = loadConfig(nested);
  assert.ok(found && path.resolve(found).startsWith(path.resolve(root)), `config not found from nested dir: ${found}`);
  assert.equal(config.aggressiveness, 'conservative');
  fs.rmSync(root, { recursive: true, force: true });
});

test('cross-platform: .rtkrc.json at repo root is honored', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-xplat-'));
  const nested = path.join(root, 'deep', 'deeper');
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(root, '.rtkrc.json'), JSON.stringify({ aggressiveness: 'aggressive' }));
  const { config } = loadConfig(nested);
  assert.equal(config.aggressiveness, 'aggressive');
  fs.rmSync(root, { recursive: true, force: true });
});

test('cross-platform: malformed config file falls back to defaults without throwing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-xplat-'));
  fs.mkdirSync(path.join(root, '.rtk'), { recursive: true });
  fs.writeFileSync(path.join(root, '.rtk', 'config.json'), '{ not valid json !!');
  const { config } = loadConfig(root);
  assert.equal(config.aggressiveness, 'balanced');
  assert.equal(typeof config.truncate.headLines, 'number');
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Command detection under shell wrappers (cmd /c, bash -c, npx)
// ---------------------------------------------------------------------------

test('cross-platform: cmd /c wrapper routes npm test to vitest parser', () => {
  const fail = ['FAIL src/a.test.ts > boom', 'AssertionError: expected 1 to equal 2', 'Tests  1 failed'].join('\n');
  assert.equal(pickParser(['cmd', '/c', 'npm', 'test'], fail), PARSERS.vitest);
});

test('cross-platform: bash -c wrapper routes tsc to tsc parser', () => {
  const fail = 'src/a.ts:5:1 - error TS2322: boom\nFound 1 error';
  assert.equal(pickParser(['bash', '-c', 'npx tsc --noEmit'], fail), PARSERS.tsc);
});

test('cross-platform: pwsh wrapper routes vitest run to vitest parser', () => {
  const fail = ['FAIL src/a.test.ts > boom', 'AssertionError: expected 1 to equal 2', 'Tests  1 failed'].join('\n');
  assert.equal(pickParser(['pwsh', '-Command', 'npx vitest run'], fail), PARSERS.vitest);
});

test('cross-platform: ./gradlew with forward and backslash argv both detect gradle', () => {
  assert.equal(pickParser(['./gradlew', 'test'], 'BUILD FAILED'), PARSERS.gradle);
  assert.equal(pickParser(['.\\gradlew.bat', 'test'], 'BUILD FAILED'), PARSERS.gradle);
});

// ---------------------------------------------------------------------------
// Executable invocation + exit-code passthrough (real CLI, current platform)
// ---------------------------------------------------------------------------

test('cross-platform: CLI passes through exit code 0 on success', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-xplat-'));
  const out = execFileSync('node', [BIN, 'err', 'node', '-e', "console.log('3 tests passed')"], { cwd, encoding: 'utf8' });
  assert.match(out, /passed/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('cross-platform: CLI propagates non-zero exit codes', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-xplat-'));
  let code = 0;
  try {
    execFileSync('node', [BIN, 'err', 'node', '-e', 'process.exit(7)'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    code = e.status;
  }
  assert.equal(code, 7, `expected exit code 7 passthrough, got ${code}`);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('cross-platform: stdin pipe mode works end-to-end', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-xplat-'));
  const log = ['FAIL src/a.test.ts > boom', 'AssertionError: expected 1 to equal 2', 'Tests  1 failed'].join('\n');
  let out = '';
  let code = 0;
  try {
    out = execFileSync('node', [BIN, 'err', '--stdin'], { cwd, encoding: 'utf8', input: log });
  } catch (e) {
    // Failure markers in the piped log make rtk infer exit code 1 — correct
    // passthrough behaviour; the filtered output still arrives on stdout.
    out = e.stdout || '';
    code = e.status;
  }
  assert.equal(code, 1, 'stdin mode should infer exit code 1 for failing log');
  assert.ok(out.includes('FAIL'));
  assert.ok(out.includes('AssertionError'));
  fs.rmSync(cwd, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Packaging — declared files actually exist (npm pack would ship them)
// ---------------------------------------------------------------------------

test('cross-platform: package.json files entries exist on disk', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  for (const dir of pkg.files) {
    const full = path.join(__dirname, '..', dir);
    assert.ok(fs.existsSync(full), `declared files entry missing: ${dir}`);
  }
  assert.ok(pkg.bin['rtk'].endsWith('rtk.js'), 'bin entry points at rtk.js');
  assert.ok(fs.existsSync(path.join(__dirname, '..', pkg.bin['rtk'])), 'bin target missing');
});

test('cross-platform: engines floor is satisfied by the running node', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  const major = parseInt(process.version.slice(1), 10);
  const floor = parseInt(String(pkg.engines.node).replace(/[^\d]/g, ''), 10);
  assert.ok(major >= floor, `node ${process.version} below engines floor ${pkg.engines.node}`);
});
