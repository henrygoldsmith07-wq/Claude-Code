'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'maven';
const MAX_LINES = 80;
const rules = [
  { re: /\[ERROR\]/i, keep: true, reason: 'maven: [ERROR]' },
  { re: /BUILD (SUCCESS|FAILURE)/i, keep: true, reason: 'maven: BUILD status' },
  { re: /Tests run:.*Failures:/i, keep: true, reason: 'maven: surefire summary' },
  { re: /^Caused by:/i, keep: true, reason: 'maven: exception cause chain' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const status = lines.find(l => /BUILD SUCCESS/i.test(l) || /Tests run:.*Failures: 0/i.test(l));
    const emitted = status ? status.trim() : `✓ maven — BUILD SUCCESS (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  const kept = lines.filter(l => (
    /\[ERROR\]|BUILD (SUCCESS|FAILURE)|Tests run:.*Failures:|FAILURE|^Caused by:/i.test(l)
    // Keep surefire exception stack frames — [ERROR] headlines without the
    // `at com.example...` chain lose the trace entirely.
    || /^\s*at\s+[\w.$]+\(/.test(l)
  )).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 40).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
