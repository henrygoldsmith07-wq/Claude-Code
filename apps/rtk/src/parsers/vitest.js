'use strict';

/**
 * Vitest/Jest-aware parser.
 * Success: keep only the summary + duration.
 * Failure: keep FAIL headers, assertion lines, stack frames, and the totals/duration,
 *          discard passing noise. Preserve every critical-info line (fails, errors, stacks, totals).
 */

const SUMMARY_RE = /(?:Test Files|Tests|Suites|Snapshots|Duration|Time)[^:\n]*:?[^\n]*\d+[^\n]*/i;
const SUMMARY_LINE_RE = /^\s*(?:Test Files|Tests|Suites|Snapshots|Duration|Time|Start at|Coverage)\b/i;
const FAIL_HEADER_RE = /^\s*FAIL\b|^\s*×\s|^\s*✕\s|^\s*✖\s|^FAIL\s/i;
const ERROR_RE = /AssertionError|Expected|Received|Error:|TypeError|ReferenceError|FAIL|ERR_[A-Z_]+|❯|●\s|not to be|toBe\(|toEqual\(|TIMEOUT|Timeout/i;
const STACK_RE = /^\s*at\s.+:\d+:\d+|^\s*❯\s|node_modules\/vitest|src\/.+:\d+/;
const DURATION_RE = /Duration|Time:/i;

const MAX_LINES = 60;

const name = 'vitest';

const rules = [
  { re: FAIL_HEADER_RE, keep: true, reason: 'vitest: FAIL header' },
  { re: ERROR_RE, keep: true, reason: 'vitest: assertion/error line' },
  { re: STACK_RE, keep: true, reason: 'vitest: stack frame' },
  { re: SUMMARY_LINE_RE, keep: true, reason: 'vitest: summary/duration line' },
];

function successLines(lines) {
  const kept = [];
  for (const l of lines) {
    if (SUMMARY_LINE_RE.test(l) || DURATION_RE.test(l)) kept.push(l);
  }
  if (kept.length) return kept;
  // Fallback: the last summary-ish line
  const summary = lines.find((l) => /passed|passing/i.test(l));
  if (summary) return [summary.trim()];
  return [`✓ passed (${lines.length} lines suppressed)`];
}

function failureLines(lines) {
  const kept = [];
  for (const l of lines) {
    if (FAIL_HEADER_RE.test(l) || ERROR_RE.test(l) || STACK_RE.test(l) || SUMMARY_LINE_RE.test(l)) {
      kept.push(l);
    }
  }
  if (kept.length) return kept.slice(0, MAX_LINES);
  return lines.slice(-20);
}

function filter(output, exitCode) {
  const lines = output.split('\n').filter((l) => l.length > 0);
  if (exitCode === 0) {
    const emitted = successLines(lines).join('\n');
    return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
  }
  const emitted = failureLines(lines).join('\n') || lines.slice(-20).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}

module.exports = { name, rules, filter, successLines, failureLines };
