'use strict';
const { splitLines, tailFallback, result, RULE_CODE_RE } = require('./util');

const name = 'ruff';
const MAX_LINES = 60;
const rules = [
  { re: new RegExp(`${RULE_CODE_RE.source}|error|warning`, 'i'), keep: true, reason: 'ruff: rule code' },
  { re: new RegExp(`:\\d+:\\d+.*${RULE_CODE_RE.source}`, 'i'), keep: true, reason: 'ruff: file:line code' },
  { re: /Found \d+ error/i, keep: true, reason: 'ruff: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const found = lines.find(l => /Found \d+ error/i.test(l));
    const emitted = found ? found.trim() : `✓ ruff — no errors (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  // Rule codes are [A-Z]{1,4}\d{2,4} (F401/E501 but also TID252/SIM117) —
  // `[A-Z]\d{3}` silently dropped every multi-letter family.
  const codeRe = new RegExp(`${RULE_CODE_RE.source}|Found \\d+ error|error`, 'i');
  const kept = lines.filter(l => codeRe.test(l)).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 30).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
