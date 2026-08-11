'use strict';

/**
 * Generic fallback parser — the original filter logic, kept as a proper parser.
 * Powers `rtk <cmd>` (truncation path) and unknown tools via `rtk err`.
 */

const SUMMARY_RE = /\b\d+\s*(passed|passing|tests?\s+passed|failed|failing)\b/i;
const FAILURE_RE = /FAIL|Error|error|✗|✖|×|AssertionError|Expected:|Received:|❯|●\s|TIMEOUT|Timeout|not to be|toBe\(|toEqual\(|^[\s]*at\s.+:\d+:\d+|diff --git|^@@|^[+-]|"level"\s*:\s*"error"/;
const TOTALS_RE = /Test Files|Tests\s+\d|Suites:|Snapshots:|Time:/;
const MAX_LINES = 40;

const name = 'generic';

const rules = [
  { re: FAILURE_RE, keep: true, reason: 'generic: failure/error line' },
  { re: TOTALS_RE, keep: true, reason: 'generic: totals/duration line' },
];

function filter(output, exitCode) {
  const lines = output.split('\n').filter((l) => l.length > 0);
  if (exitCode === 0) {
    const summary = lines.find((l) => SUMMARY_RE.test(l));
    const emitted = summary ? `✓ ${summary.trim()}` : `✓ passed (${lines.length} lines suppressed)`;
    return { emitted, parser: name, lines: 1, rawLines: lines.length };
  }
  const matched = lines.filter((l) => FAILURE_RE.test(l)).slice(0, MAX_LINES);
  const totals = lines.filter((l) => TOTALS_RE.test(l) && !matched.includes(l));
  // Ensure diff headers are kept even when capped by MAX_LINES
  const diffHeaders = lines.filter((l) => /^diff --git|^@@|^--- |^\+\+\+ /.test(l) && !matched.includes(l)).slice(0, 12);
  const kept = [...matched, ...totals, ...diffHeaders];
  const emitted = kept.length ? kept.join('\n') : lines.slice(-15).join('\n');
  return { emitted, parser: name, lines: emitted.split('\n').length, rawLines: lines.length };
}

module.exports = { name, rules, filter };
