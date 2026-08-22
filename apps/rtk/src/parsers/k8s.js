'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'k8s';
const MAX_LINES = 60;
const rules = [
  { re: /error:|Error from server|CrashLoopBackOff|ImagePullBackOff|Failed/i, keep: true, reason: 'k8s: error' },
  { re: /NAMESPACE|NAME\s+READY|Events:/i, keep: true, reason: 'k8s: table header' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const header = lines.filter(l => /NAMESPACE|NAME\s+READY|Events:/i.test(l)).slice(0,3);
    const emitted = header.length ? header.join('\n') : `✓ kubectl — ok (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  // Keep pod names (first column of describe/get output) so the failure
  // line identifies WHICH pod is in CrashLoopBackOff.
  const kept = lines.filter(l => (
    /error:|Error from server|CrashLoopBackOff|ImagePullBackOff|Failed|NAMESPACE|Events:/i.test(l)
    || /^\S+\s+\d+\/\d+\s+(?:Running|Pending|CrashLoopBackOff|Error)\b/.test(l)
  )).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 30).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
