'use strict';
const name = 'docker';
const MAX_LINES = 60;
const rules = [
  { re: /ERROR|error:.*failed|failed to/i, keep: true, reason: 'docker: error' },
  { re: /Step \d+\/\d+.*-->|#\d+ \[/i, keep: true, reason: 'docker: build step' },
  { re: /Successfully built|Successfully tagged/i, keep: true, reason: 'docker: success' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const ok = lines.find(l => /Successfully built|Successfully tagged|DONE \d+/i.test(l));
    const emitted = ok ? ok.trim() : `✓ docker — done (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /ERROR|error:.*failed|failed to|Step \d+\/\d+/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
