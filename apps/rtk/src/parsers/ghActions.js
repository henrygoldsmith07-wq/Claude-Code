'use strict';
const name = 'gha';
const MAX_LINES = 60;
const rules = [
  { re: /::error::|::warning::/i, keep: true, reason: 'gha: annotation' },
  { re: /Error:.*exit code|Process completed with exit code/i, keep: true, reason: 'gha: process failed' },
  { re: /##\[error\]/i, keep: true, reason: 'gha: azure error' },
  { re: /at\s+.*:\d+:\d+/i, keep: true, reason: 'gha: stack' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const summary = lines.filter(l => /::group::|passed|completed/i.test(l)).slice(-3);
    const emitted = summary.length ? summary.join('\n') : `✓ actions — passed (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
  }
  const kept = lines.filter(l => /::error::|::warning::|Error:.*exit code|##\[error\]|at\s+.*:\d+:\d+/i.test(l)).slice(0,maxLines);
  // Also keep failed job marker context (1 line before error)
  const extra = [];
  for (let i=0;i<lines.length;i++) if (/::error::|##\[error\]|Error:.*exit code/i.test(lines[i]) && i>0) extra.push(lines[i-1]);
  const merged = [...new Set([...kept, ...extra.slice(0,10)])].sort((a,b)=>lines.indexOf(a)-lines.indexOf(b));
  const emitted = (merged.length?merged:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
