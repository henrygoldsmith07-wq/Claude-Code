'use strict';
const name = 'terraform';
const MAX_LINES = 80;
const rules = [
  { re: /Error:/i, keep: true, reason: 'terraform: Error' },
  { re: /on .*\.tf line \d+/i, keep: true, reason: 'terraform: file:line' },
  { re: /Apply complete!|Plan:.*to add/i, keep: true, reason: 'terraform: plan summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const summary = lines.find(l => /Apply complete!|Plan:/i.test(l));
    const emitted = summary ? summary.trim() : `✓ terraform — ok (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /Error:|on .*\.tf line \d+|Apply complete!|Plan:/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(40,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
