'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { truncate } = require('../src/truncate');

test('short output passes through unchanged', () => {
  const output = 'line 1\nline 2\nline 3';

  const { emitted, truncated } = truncate(output);

  assert.equal(emitted, output);
  assert.equal(truncated, false);
});

test('long output is truncated to head and tail with an omission marker', () => {
  const output = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');

  const { emitted, truncated } = truncate(output, { headLines: 20, tailLines: 5 });
  const lines = emitted.split('\n');

  assert.equal(truncated, true);
  assert.equal(lines[0], 'line 0');
  assert.equal(lines.at(-1), 'line 199');
  assert.ok(emitted.includes('omitted'));
  assert.ok(emitted.length < output.length);
});
