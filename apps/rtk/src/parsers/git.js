'use strict';
const name = 'git';
const MAX_LINES = 60;
const rules = [
  { re: /CONFLICT|error:|fatal:|conflict in/i, keep: true, reason: 'git: conflict/error' },
  { re: /Auto-merging|Merge conflict/i, keep: true, reason: 'git: merge status' },
  { re: /^diff --git|^@@/i, keep: true, reason: 'git: diff header' },
  { re: /^[+-][^ +-]/, keep: true, reason: 'git: diff change' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    // Keep branch/status summary, drop long diff dumps unless they contain conflicts
    const hasConflict = lines.some(l => /CONFLICT|conflict/i.test(l));
    if (hasConflict) {
      const kept = lines.filter(l => /CONFLICT|Auto-merging|diff --git|@@|^[+-][^ +-]/i.test(l)).slice(0,maxLines);
      return { emitted: kept.join('\n'), parser: name, lines: kept.length, rawLines: lines.length };
    }
    const summary = lines.slice(0, Math.min(10, maxLines));
    const emitted = summary.length ? summary.join('\n') : `✓ git — ok (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
  }
  const kept = lines.filter(l => /CONFLICT|error:|fatal:|conflict in|Auto-merging|diff --git|@@|^[+-][^ +-]|at\s+.*:\d+:\d+/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
