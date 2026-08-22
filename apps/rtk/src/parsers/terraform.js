'use strict';
const { splitLines, tailFallback, result } = require('./util');

const name = 'terraform';
const MAX_LINES = 80;
const rules = [
  { re: /Error:/i, keep: true, reason: 'terraform: Error' },
  { re: /on .*\.tf line \d+/i, keep: true, reason: 'terraform: file:line' },
  { re: /Apply complete!|Plan:.*to add/i, keep: true, reason: 'terraform: plan summary' },
];
function filter(output, exitCode, opts={}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode===0) {
    const summary = lines.find(l => /Apply complete!|Plan:/i.test(l));
    const emitted = summary ? summary.trim() : `✓ terraform — ok (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  // Terraform errors are boxed blocks (╷ │ … ╵) carrying the resource
  // address (`with aws_instance.web`) and the quoted source snippet —
  // dropping box lines kept only the headline and discarded both.
  const kept = lines.filter(l => (
    /Error:|on .*\.tf line \d+|Apply complete!|Plan:/i.test(l) || /^\s*[│╷╵|]/.test(l)
  )).slice(0,maxLines);
  const emitted = tailFallback(kept, lines, 40).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
