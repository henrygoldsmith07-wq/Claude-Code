'use strict';

/**
 * TypeScript (tsc --noEmit) parser.
 * Keeps only file:line:col + error TSxxxx + message lines.
 * Collapses clean builds to one line.
 */

const TSC_ERROR_RE = /^.+:\d+:\d+\s*-\s*error\s+TS\d+/i;
const TSC_FOUND_RE = /Found \d+ error/i;
const TSC_WATCH_RE = /Watching for file changes|File change detected/i;

const name = 'tsc';

const rules = [
  { re: TSC_ERROR_RE, keep: true, reason: 'tsc: error location' },
  { re: TSC_FOUND_RE, keep: true, reason: 'tsc: error count' },
  { re: TSC_WATCH_RE, keep: false, reason: 'tsc: watch chatter — dropped' },
  { re: /error TS/i, keep: true, reason: 'tsc: diagnostic' },
];

function filter(output, exitCode) {
  const lines = output.split('\n').filter((l) => l.length > 0);
  if (exitCode === 0) {
    // Clean build — keep the count if present, otherwise synthesize
    const found = lines.find((l) => TSC_FOUND_RE.test(l));
    const emitted = found ? found.trim() : `✓ tsc — no errors (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const kept = lines.filter((l) => TSC_ERROR_RE.test(l) || /error TS/i.test(l) || TSC_FOUND_RE.test(l));
  // Keep one line of context after each error (indented hint / code frame)
  const withContext = [];
  for (let i = 0; i < lines.length; i++) {
    if (TSC_ERROR_RE.test(lines[i])) {
      withContext.push(lines[i]);
      if (lines[i + 1] && /^\s/.test(lines[i + 1])) withContext.push(lines[i + 1]);
    }
  }
  const merged = [...new Set([...kept, ...withContext])];
  // Preserve input order
  merged.sort((a, b) => lines.indexOf(a) - lines.indexOf(b));
  const emitted = (merged.length ? merged : lines.slice(-30)).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}

module.exports = { name, rules, filter };
