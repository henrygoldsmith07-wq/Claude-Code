'use strict';
const name = 'ruff';
const MAX_LINES = 60;
const rules = [
  { re: /\b[A-Z]\d{3}\b|error|warning/i, keep: true, reason: 'ruff: rule code' },
  { re: /.*:\d+:\d+.*\b[A-Z]\d{3}\b/i, keep: true, reason: 'ruff: file:line code' },
  { re: /Found \d+ error/i, keep: true, reason: 'ruff: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const found = lines.find(l => /Found \d+ error/i.test(l));
    const emitted = found ? found.trim() : `✓ ruff — no errors (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /\b[A-Z]\d{3}\b|Found \d+ error|error/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
