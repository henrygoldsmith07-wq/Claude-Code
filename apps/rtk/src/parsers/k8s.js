'use strict';
const name = 'k8s';
const MAX_LINES = 60;
const rules = [
  { re: /error:|Error from server|CrashLoopBackOff|ImagePullBackOff|Failed/i, keep: true, reason: 'k8s: error' },
  { re: /NAMESPACE|NAME\s+READY|Events:/i, keep: true, reason: 'k8s: table header' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = output.split('\n').filter(l=>l.length>0);
  if (exitCode===0) {
    const header = lines.filter(l => /NAMESPACE|NAME\s+READY|Events:/i.test(l)).slice(0,3);
    const emitted = header.length ? header.join('\n') : `✓ kubectl — ok (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
  }
  const kept = lines.filter(l => /error:|Error from server|CrashLoopBackOff|ImagePullBackOff|Failed|NAMESPACE|Events:/i.test(l)).slice(0,maxLines);
  const emitted = (kept.length?kept:lines.slice(-Math.min(30,maxLines))).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}
module.exports = { name, rules, filter, MAX_LINES };
