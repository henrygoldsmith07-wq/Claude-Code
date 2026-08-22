'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'cargo';
const MAX_LINES = 60;
const rules = [
  { re: /^error(\[E\d+\])?:/i, keep: true, reason: 'cargo: error' },
  { re: /-->\s+.*:\d+:\d+/i, keep: true, reason: 'cargo: file:line' },
  { re: /warning:/i, keep: true, reason: 'cargo: warning' },
  { re: /test result:.*failed/i, keep: true, reason: 'cargo: test summary' },
  { re: /Finished|Compiling|Running/i, keep: true, reason: 'cargo: status' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const summary = lines.find(l => /test result:|Finished/i.test(l));
    const emitted = summary ? summary.trim() : `✓ cargo — ok (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  const kept = lines.filter(l => (
    /^error(\[E\d+\])?:|-->\s+.*:\d+:\d+|warning:|test result:.*failed/i.test(l)
    // Runtime panics carry the failing test name + message; without these the
    // only surviving line is a bare "test result: FAILED" with no cause.
    || /panicked at|thread '.*' panicked/i.test(l)
  )).slice(0, maxLines);
  const emitted = tailFallback(kept, lines, 30).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
