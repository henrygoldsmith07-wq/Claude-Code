'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'docker';
const MAX_LINES = 60;
const rules = [
  { re: /ERROR|error:.*failed|failed to/i, keep: true, reason: 'docker: error' },
  { re: /Step \d+\/\d+.*-->|#\d+ \[/i, keep: true, reason: 'docker: build step' },
  { re: /Successfully built|Successfully tagged/i, keep: true, reason: 'docker: success' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const ok = lines.find(l => /Successfully built|Successfully tagged|DONE \d+/i.test(l));
    const emitted = ok ? ok.trim() : `✓ docker — done (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  const kept = lines.filter(l => (
    /ERROR|error:.*failed|failed to|Step \d+\/\d+/i.test(l)
    // Legacy builder failure line and BuildKit-wrapped compiler errors
    // (`#15 2.34 src/main.rs:3:5: error[E0425]: ...`) matched nothing.
    || /returned a non-zero code/i.test(l)
    || /error\[E\d+\]/i.test(l)
  )).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 30).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
