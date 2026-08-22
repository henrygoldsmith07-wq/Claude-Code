'use strict';

// ANSI escape handling + encoding safety.
// - stripAnsi: removes SGR/CSI/OSC sequences so parsers see plain text.
// - safeDecode: repairs lone surrogates / replacement chars that would throw.

// CSI: ESC [ + parameter bytes (0x30-0x3F: digits ; ? < = >) + optional
// non-space intermediates + final byte (0x40-0x7E). Space intermediates are
// deliberately NOT accepted: a greedy variant swallowed the first character
// after a broken escape (`ESC[31 FAIL` → `AIL …`), hiding the failure marker.
// The final byte is the full 0x40-0x7E range — narrowing it to [A-Za-z] left
// legal finals like `~` (ESC[200~ bracketed paste, ESC[3~ Del) and `@` (ICH)
// unstripped, corrupting downstream line-start matching.
// Broken escapes fall through to the lone-ESC cleanup below, which strips
// only the ESC and keeps the text (a stray `[31 ` beats a lost FAIL).
const CSI_RE = /\u001b\[[0-9;?<>=]*[\x40-\x7E]/;
const OSC_RE = /\u001b\].*?(?:\u0007|\u001b\\)/;
const LONE_ESC_RE = /\u001b(?:[MNOD78=>c]|\[[A-Za-z])/;
const ANSI_RE = new RegExp(`${CSI_RE.source}|${OSC_RE.source}|${LONE_ESC_RE.source}`, 'g');
const TRAILING_ESC_RE = /\u001b\[[0-9;]*$/;

function stripAnsi(s) {
  if (!s || s.indexOf('\u001b') === -1) return s;
  let out = String(s).replace(ANSI_RE, '');
  // Broken/truncated escape at end (e.g. "\u001b[31" with no terminator) — strip it.
  out = out.replace(TRAILING_ESC_RE, '');
  // Lone ESC
  out = out.replace(/\u001b/g, '');
  return out;
}

function hasAnsi(s) {
  return typeof s === 'string' && s.indexOf('\u001b') !== -1;
}

// Replace unpaired surrogates (which JSON.stringify would mangle) with �
function safeDecode(s) {
  if (typeof s !== 'string') return String(s ?? '');
  // Fast path: no surrogates
  if (s.indexOf('\uFFFD') === -1 && !/[\uD800-\uDFFF]/.test(s)) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) { out += s[i] + s[i + 1]; i++; }
      else out += '\uFFFD';
    } else if (c >= 0xDC00 && c <= 0xDFFF) out += '\uFFFD';
    else out += s[i];
  }
  return out;
}

module.exports = { stripAnsi, hasAnsi, safeDecode, ANSI_RE };
