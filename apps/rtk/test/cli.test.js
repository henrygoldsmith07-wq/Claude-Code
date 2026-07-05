'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BIN = path.join(__dirname, '..', 'bin', 'rtk.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-cli-test-'));
}

test('rtk err reports a one-line success summary for a passing command', () => {
  const cwd = tempDir();

  const out = execFileSync('node', [BIN, 'err', 'node', '-e', "console.log('5 tests passed')"], {
    cwd,
    encoding: 'utf8',
  });

  assert.equal(out.trim().split('\n').length, 1);
  assert.match(out, /passed/);
});

test('rtk err surfaces failure details and a non-zero exit code', () => {
  const cwd = tempDir();

  assert.throws(() => {
    execFileSync(
      'node',
      [BIN, 'err', 'node', '-e', "console.log('FAIL something broke'); process.exit(1)"],
      { cwd, encoding: 'utf8' }
    );
  }, /Command failed/);
});

test('rtk gain reflects commands run through the CLI', () => {
  const cwd = tempDir();

  execFileSync('node', [BIN, 'err', 'node', '-e', "console.log('ok')"], { cwd, encoding: 'utf8' });
  const gain = execFileSync('node', [BIN, 'gain'], { cwd, encoding: 'utf8' });

  assert.match(gain, /commands run\s+1/);
});
