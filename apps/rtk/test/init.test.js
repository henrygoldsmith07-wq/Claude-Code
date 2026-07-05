'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { init, MARKER } = require('../src/init');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rtk-init-test-'));
}

test('init creates .rtk dir and appends instructions to a fresh CLAUDE.md', () => {
  const cwd = tempDir();

  init(cwd);

  assert.ok(fs.existsSync(path.join(cwd, '.rtk')));
  const content = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf8');
  assert.ok(content.includes(MARKER));
  assert.ok(content.includes('rtk err'));
});

test('init preserves existing CLAUDE.md content and is idempotent', () => {
  const cwd = tempDir();
  fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), '# Existing rules\n\n- do not break prod\n');

  init(cwd);
  const afterFirst = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf8');
  init(cwd);
  const afterSecond = fs.readFileSync(path.join(cwd, 'CLAUDE.md'), 'utf8');

  assert.ok(afterFirst.includes('do not break prod'));
  assert.equal(afterFirst, afterSecond);
});
