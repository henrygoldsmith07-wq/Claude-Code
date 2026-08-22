'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'gradle';
const MAX_LINES = 80;
const rules = [
  { re: /FAILURE:|FAILED|error:/i, keep: true, reason: 'gradle: failure' },
  { re: /e:.*:\d+:\d+/i, keep: true, reason: 'gradle: file:line' },
  { re: /BUILD (SUCCESSFUL|FAILED)/i, keep: true, reason: 'gradle: build status' },
  { re: /Task :.*FAILED/i, keep: true, reason: 'gradle: task failed' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const status = lines.find(l => /BUILD SUCCESSFUL/i.test(l));
    const emitted = status ? status.trim() : `✓ gradle — BUILD SUCCESSFUL (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  const kept = lines.filter(l => (
    /FAILURE:|FAILED|error:|BUILD (SUCCESSFUL|FAILED)|Task :.*FAILED|e:.*:\d+:\d+/i.test(l)
    // Keep exception stack frames — `FAILED` task lines without the
    // `Caused by:`/`at ...` chain lose the entire exception.
    || /^Caused by:/i.test(l)
    || /^\s*at\s+[\w.$]+\(/.test(l)
  )).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 40).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
