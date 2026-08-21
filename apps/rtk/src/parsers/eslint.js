'use strict';

const name = 'eslint';
const rules = [
  { re: /error/i, keep: true, reason: 'eslint: error' },
  { re: /warning/i, keep: true, reason: 'eslint: warning' },
  { re: /✖|problem.*\(.*\)/i, keep: true, reason: 'eslint: summary' },
  { re: /:\d+:\d+.*\b(error|warning)\b/i, keep: true, reason: 'eslint: file:line diag' },
];
const MAX_LINES = 60;
function filter(output, exitCode, opts = {}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l => l.length>0);
  if (exitCode === 0) {
    const summary = lines.find(l => /error|warning|problem/i.test(l));
    const emitted = summary ? summary.trim() : `✓ eslint — no problems (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /error|warning|✖|\d+:\d+|problem/i.test(l)).slice(0, maxLines);
  const emitted = (kept.length ? kept : lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
