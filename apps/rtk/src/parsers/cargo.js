'use strict';
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
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const summary = lines.find(l => /test result:|Finished/i.test(l));
    const emitted = summary ? summary.trim() : `✓ cargo — ok (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /^error(\[E\d+\])?:|-->.*:\d+:\d+|warning:|test result:.*failed/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
