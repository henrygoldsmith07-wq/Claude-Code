'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'pytest';
const MAX_LINES = 60;
const rules = [
  { re: /^FAILED\b|FAILED\s/i, keep: true, reason: 'pytest: FAILED' },
  { re: /AssertionError|E\s+assert|E\s+AssertionError/i, keep: true, reason: 'pytest: assertion' },
  { re: /ERROR collecting|ERROR at setup/i, keep: true, reason: 'pytest: collection error' },
  { re: /File ".*", line \d+/i, keep: true, reason: 'pytest: traceback file:line' },
  // `_____ TestFoo _____` section headers are the only place the failing
  // test name appears near its traceback under -q / plain tb styles.
  { re: /^_{5,}\s.+\s_{5,}$/, keep: true, reason: 'pytest: traceback header' },
  { re: /passed|failed|error/i, keep: true, reason: 'pytest: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const summary = lines.find(l => /\d+\s+passed/i.test(l));
    const emitted = summary ? summary.trim() : `✓ pytest — passed (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  const kept = lines.filter(l => (
    /^FAILED\b|AssertionError|E\s+assert|ERROR|File ".*", line \d+|^_{5,}\s.+\s_{5,}$|passed|failed|error/i.test(l)
  )).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 30).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
