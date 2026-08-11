'use strict';

// Jest — shares vitest patterns but tuned for Jest prefixes (FAIL, ●, Expected/Received)
const name = 'jest';
const MAX_LINES = 60;
const rules = [
  { re: /^FAIL\b|^ FAIL/i, keep: true, reason: 'jest: FAIL header' },
  { re: /AssertionError|Expected|Received|Error:|●\s|❯/i, keep: true, reason: 'jest: assertion/error' },
  { re: /^\s*at\s+.+:\d+:\d+/i, keep: true, reason: 'jest: stack' },
  { re: /Test Suites|Tests:|Snapshots:|Time:/i, keep: true, reason: 'jest: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const kept = lines.filter(l => /Test Suites|Tests:|Snapshots:|Time:/i.test(l));
    const emitted = kept.length ? kept.join('\n') : `✓ jest — passed (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
  }
  const kept = lines.filter(l => /^FAIL\b|AssertionError|Expected|Received|Error:|●\s|❯|^\s*at\s+.+:\d+:\d+/i.test(l) || /Test Suites|Tests:|Snapshots:|Time:/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(20,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
