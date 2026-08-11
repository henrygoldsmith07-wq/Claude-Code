'use strict';
const name = 'mypy';
const MAX_LINES = 60;
const rules = [
  { re: /: error:/i, keep: true, reason: 'mypy: error' },
  { re: /: note:/i, keep: true, reason: 'mypy: note' },
  { re: /Found \d+ error/i, keep: true, reason: 'mypy: summary' },
  { re: /Success: no issues/i, keep: true, reason: 'mypy: success' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const summary = lines.find(l => /Success: no issues|Found \d+ error/i.test(l));
    const emitted = summary ? summary.trim() : `✓ mypy — no issues (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /: error:|: note:|Found \d+ error/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
