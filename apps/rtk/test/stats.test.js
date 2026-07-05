'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { record, load, formatGain } = require('../src/stats');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-stats-test-'));
}

test('record accumulates invocations and chars per label', () => {
  const cwd = tempDir();

  record(cwd, 'npm test', 9200, 44);
  record(cwd, 'npm test', 9200, 44);
  record(cwd, 'git status', 500, 500);

  const data = load(cwd);

  assert.equal(data.commands['npm test'].invocations, 2);
  assert.equal(data.commands['npm test'].rawChars, 18400);
  assert.equal(data.commands['npm test'].emittedChars, 88);
  assert.equal(data.commands['git status'].invocations, 1);
});

test('formatGain reports totals and per-command savings', () => {
  const cwd = tempDir();

  record(cwd, 'npm test', 10000, 100);

  const report = formatGain(load(cwd));

  assert.match(report, /efficiency/);
  assert.match(report, /npm test/);
  assert.match(report, /99%/);
});

test('formatGain handles no recorded commands', () => {
  const report = formatGain({ commands: {} });

  assert.match(report, /no commands recorded yet/);
});
