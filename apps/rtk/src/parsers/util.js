'use strict';

/**
 * Shared helpers for per-tool parsers.
 * Every parser used to copy-paste this logic with drift: CRLF output left a
 * `\r` glued to the last token of each line (breaking FAIL/error regexes on
 * Windows CI), tail-fallback sizes were inconsistent, `lines:` was sometimes
 * hardcoded to 1, and some parsers returned an empty emit with no tail
 * fallback at all. Centralizing keeps the result shape uniform.
 */

// Ruff-style rule codes: E501, F401 but also multi-letter families like
// TID252, SIM117, PLR2004. `[A-Z]\d{3}` missed all of those.
const RULE_CODE_RE = /\b[A-Z]{1,4}\d{2,4}\b/;

function splitLines(output) {
  return String(output).replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length > 0);
}

function tailFallback(kept, lines, n = 20) {
  if (kept.length) return kept;
  return lines.slice(-Math.min(n, lines.length));
}

function result(emitted, parserName, rawLines) {
  const text = emitted || '';
  return { emitted: text, parser: parserName, lines: text ? text.split('\n').length : 0, rawLines };
}

module.exports = { splitLines, tailFallback, result, RULE_CODE_RE };
