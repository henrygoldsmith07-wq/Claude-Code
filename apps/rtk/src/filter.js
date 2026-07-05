'use strict';

const SUMMARY_PATTERN = /\b\d+\s*(passed|passing|tests?\s+passed)\b/i;
const FAILURE_PATTERN = /FAIL|Error|✗|✖|AssertionError|Expected:|Received:|❯|^\s*at\s.+:\d+:\d+/;
const TOTALS_PATTERN = /Test Files|Tests\s+\d/;
const MAX_FAILURE_LINES = 30;

function extractSummaryLine(lines) {
  const match = lines.find((line) => SUMMARY_PATTERN.test(line));
  return match ? match.trim() : null;
}

function extractFailureLines(lines) {
  const matched = lines.filter((line) => FAILURE_PATTERN.test(line)).slice(0, MAX_FAILURE_LINES);
  const totals = lines.filter((line) => TOTALS_PATTERN.test(line) && !matched.includes(line));
  return [...matched, ...totals];
}

function filterErr(output, exitCode) {
  const rawChars = output.length;
  const lines = output.split('\n').filter((line) => line.length > 0);

  if (exitCode === 0) {
    const summary = extractSummaryLine(lines);
    const emitted = summary ? `✓ ${summary}` : `✓ passed (${lines.length} lines suppressed)`;
    return { emitted, rawChars, emittedChars: emitted.length };
  }

  const failureLines = extractFailureLines(lines);
  const emitted = failureLines.length ? failureLines.join('\n') : lines.slice(-15).join('\n');
  return { emitted, rawChars, emittedChars: emitted.length };
}

module.exports = { filterErr };
