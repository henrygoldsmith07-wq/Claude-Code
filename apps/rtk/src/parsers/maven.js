'use strict';
const name = 'maven';
const MAX_LINES = 80;
const rules = [
  { re: /\[ERROR\]/i, keep: true, reason: 'maven: [ERROR]' },
  { re: /BUILD (SUCCESS|FAILURE)/i, keep: true, reason: 'maven: BUILD status' },
  { re: /Tests run:.*Failures:/i, keep: true, reason: 'maven: surefire summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const status = lines.find(l => /BUILD SUCCESS/i.test(l) || /Tests run:.*Failures: 0/i.test(l));
    const emitted = status ? status.trim() : `✓ maven — BUILD SUCCESS (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /\[ERROR\]|BUILD (SUCCESS|FAILURE)|Tests run:.*Failures:|FAILURE/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(40,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
