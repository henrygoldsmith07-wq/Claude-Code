'use strict';
const name = 'go-test';
const MAX_LINES = 60;
const rules = [
  { re: /^--- FAIL:/i, keep: true, reason: 'go: FAIL' },
  { re: /^FAIL\s/i, keep: true, reason: 'go: FAIL package' },
  { re: /.*\.go:\d+:/i, keep: true, reason: 'go: file:line' },
  { re: /\bok\b|\bFAIL\b/i, keep: true, reason: 'go: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const summary = lines.filter(l => /\bok\b.*\d+\.\d+s/i.test(l) || /^ok\s/i.test(l));
    const emitted = summary.length ? summary.join('\n') : `✓ go test — ok (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
  }
  const kept = lines.filter(l => /^--- FAIL:|^FAIL\s|.*\.go:\d+:|\bok\b|\bFAIL\b/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
