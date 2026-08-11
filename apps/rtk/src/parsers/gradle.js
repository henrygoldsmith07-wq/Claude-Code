'use strict';
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
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const status = lines.find(l => /BUILD SUCCESSFUL/i.test(l));
    const emitted = status ? status.trim() : `✓ gradle — BUILD SUCCESSFUL (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter(l => /FAILURE:|FAILED|error:|BUILD (SUCCESSFUL|FAILED)|Task :.*FAILED|e:.*:\d+:\d+/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(40,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
