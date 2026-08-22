'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'go-test';
const MAX_LINES = 60;
const rules = [
  { re: /^--- FAIL:/i, keep: true, reason: 'go: FAIL' },
  { re: /^FAIL\s/i, keep: true, reason: 'go: FAIL package' },
  { re: /\.go:\d+:/i, keep: true, reason: 'go: file:line' },
  { re: /\bok\b|\bFAIL\b/i, keep: true, reason: 'go: summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const summary = lines.filter(l => /\bok\b.*\d+\.\d+s/i.test(l) || /^ok\s/i.test(l));
    const emitted = summary.length ? summary.join('\n') : `✓ go test — ok (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  const kept = lines.filter(l => (
    /^--- FAIL:|^FAIL\s|\.go:\d+:|\bok\b|\bFAIL\b/i.test(l)
    // Panics carry the failing test + goroutine trace; without these only
    // the bare `--- FAIL:` survives with zero cause.
    || /panic:|\[signal |^goroutine \d+/.test(l)
  )).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 30).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
