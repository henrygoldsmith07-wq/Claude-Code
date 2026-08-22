'use strict';

const { splitLines, tailFallback, result } = require('./util');

const name = 'eslint';
const rules = [
  { re: /error/i, keep: true, reason: 'eslint: error' },
  { re: /warning/i, keep: true, reason: 'eslint: warning' },
  { re: /✖|problem.*\(.*\)/i, keep: true, reason: 'eslint: summary' },
  { re: /:\d+:\d+.*\b(error|warning)\b/i, keep: true, reason: 'eslint: file:line diag' },
];
const MAX_LINES = 60;

// ESLint prints the file path on its own line above its diagnostics:
//   src/app.ts
//     1:1  error  Unexpected var  no-var
// Dropping path-only lines orphaned every diagnostic from its file.
function looksLikeFilePath(l) {
  return /^(?:[A-Za-z]:)?[\w./\\-]+\.(?:js|jsx|ts|tsx|mjs|cjs|vue|svelte|astro)$/.test(l.trim());
}

function filter(output, exitCode, opts = {}) {
  const maxLines = opts.maxLines ?? MAX_LINES;
  const lines = splitLines(output);
  if (exitCode === 0) {
    const summary = lines.find(l => /error|warning|problem/i.test(l));
    const emitted = summary ? summary.trim() : `✓ eslint — no problems (${lines.length} lines suppressed)`;
    return result(emitted, name, lines.length);
  }
  const keepIdx = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (/error|warning|✖|\d+:\d+|problem/i.test(lines[i])) {
      if (i > 0 && looksLikeFilePath(lines[i - 1])) keepIdx.add(i - 1);
      keepIdx.add(i);
    }
  }
  const kept = [...keepIdx].sort((a, b) => a - b).map((i) => lines[i]);
  const emitted = tailFallback(kept.slice(0, maxLines), lines, 30).join('\n');
  return result(emitted, name, lines.length);
}
module.exports = { name, rules, filter, MAX_LINES };
