'use strict';

// ANSI escape handling + encoding safety.
// - stripAnsi: removes SGR/CSI/OSC sequences so parsers see plain text.
// - safeDecode: repairs lone surrogates / replacement chars that would throw.

const ANSI_RE = /\u001b\[[0-9;]*[A-Za-z]|\u001b\].*?(?:\u0007|\u001b\\)|\u001b\[[^A-Za-z]*[A-Za-z]|\u001b\([A-Z]/g;
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
