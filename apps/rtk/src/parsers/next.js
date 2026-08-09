'use strict';

/**
 * Next.js build parser.
 * Success: keep the route table header + built / compiled summary.
 * Failure: keep error / failed-to-compile blocks, type errors, and the error count.
 */

const NEXT_SUCCESS_RE = /^(Route|○|●|λ|ƒ|├|└|Creating an optimized|Collecting page data|Generating static|Finalizing page|Compiled successfully|✓ Compiled|Build completed)/i;
const NEXT_ERROR_RE = /Failed to compile|Type error|Error:|error -|Module not found|Can't resolve|Failed to collect page data/i;
const NEXT_SUMMARY_RE = /Creating an optimized|Compiled successfully|✓ Compiled|Build completed|Collecting page data|Generating static|Finalizing/i;

const name = 'next';

const rules = [
  { re: NEXT_ERROR_RE, keep: true, reason: 'next: build error' },
  { re: NEXT_SUCCESS_RE, keep: true, reason: 'next: build summary/route' },
  { re: /error/i, keep: true, reason: 'next: error line' },
  { re: /warning/i, keep: false, reason: 'next: warning — dropped on success' },
];

function filter(output, exitCode) {
  const lines = output.split('\n').filter((l) => l.length > 0);
  if (exitCode === 0) {
    const kept = lines.filter((l) => NEXT_SUCCESS_RE.test(l) || NEXT_SUMMARY_RE.test(l));
    const emitted = kept.length ? kept.join('\n') : `✓ next build — succeeded (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
  }
  // On failure keep errors + any context line that looks like a file reference
  const kept = lines.filter((l) => NEXT_ERROR_RE.test(l) || /error/i.test(l) || /^\s*at\s|\.\/|\.tsx?:\d+:\d+/.test(l));
  const summary = lines.filter((l) => NEXT_SUMMARY_RE.test(l));
  const merged = [...kept, ...summary.filter((l) => !kept.includes(l))];
  // Order by original position
  merged.sort((a, b) => lines.indexOf(a) - lines.indexOf(b));
  const emitted = (merged.length ? merged : lines.slice(-30)).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}

module.exports = { name, rules, filter };
