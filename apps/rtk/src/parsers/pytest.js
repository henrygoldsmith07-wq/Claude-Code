'use strict';
const name = 'pytest';
const MAX_LINES = 60;
const rules = [
  { re: /^FAILED\b|FAILED\s/i, keep: true, reason: 'pytest: FAILED' },
  { re: /AssertionError|E\s+assert|E\s+AssertionError/i, keep: true, reason: 'pytest: assertion' },
  { re: /ERROR collecting|ERROR at setup/i, keep: true, reason: 'pytest: collection error' },
  { re: /File ".*", line \d+/i, keep: true, reason: 'pytest: traceback file:line' },
  { re: /passed|failed|error/i, keep: true, reason: 'pytest: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const summary = lines.find(l => /\d+\s+passed/i.test(l));
    const emitted = summary ? summary.trim() : `✓ pytest — passed (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /^FAILED\b|AssertionError|E\s+assert|ERROR|File ".*", line \d+|passed|failed|error/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
