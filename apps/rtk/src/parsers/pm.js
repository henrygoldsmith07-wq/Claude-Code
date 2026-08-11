'use strict';
const name = 'pm';
const MAX_LINES = 60;
const rules = [
  { re: /ERR!|error |failed to|Cannot resolve|peer dep/i, keep: true, reason: 'pm: error' },
  { re: /added \d+ package|audited \d+ package/i, keep: true, reason: 'pm: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const summary = lines.find(l => /added \d+ package|audited \d+ package|up to date/i.test(l));
    const emitted = summary ? summary.trim() : `✓ pm — ok (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /ERR!|error |failed to|Cannot resolve|peer dep|added \d+ package/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
