'use strict';

// Tokenizer: js-tiktoken o200k_base (GPT-4o family) with chars/4 fallback.
// Lazy-loaded so `rtk --help`, `rtk init`, `rtk gain` stay <30ms.
// No native build, pure JS. Falls back to chars/4 if dep missing or WASM fails.

let enc = null;
let encName = null;
let attempted = false;
let loadError = null;

function ensureEnc() {
  if (attempted) return enc;
  attempted = true;
  try {
    const { Tiktoken } = require('js-tiktoken');
    const o200k = require('js-tiktoken/ranks/o200k_base');
    enc = new Tiktoken(o200k);
    encName = 'o200k_base';
  } catch (e) {
    loadError = String((e && e.message) || e);
    enc = null;
    encName = 'chars/4';
  }
  return enc;
}

function countTokens(text) {
  const s = text == null ? '' : String(text);
  const e = ensureEnc();
  if (e) {
    try { return e.encode(s).length; } catch { /* fallback */ }
  }
  return Math.round(s.length / 4);
}

function isTokenizerAvailable() {
  ensureEnc();
  return enc !== null;
}

function encodingName() {
  ensureEnc();
  return encName || 'chars/4';
}

function tokenizerInfo() {
  ensureEnc();
  return { available: enc !== null, encoding: encName || 'chars/4', attempted, error: loadError };
}

const COST_TABLE = {
  'gpt-4o': { input: 2.50, output: 10.00, blended: 2.50 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, blended: 0.15 },
  'claude-3.5-sonnet': { input: 3.00, output: 15.00, blended: 3.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25, blended: 0.25 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00, blended: 1.25 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30, blended: 0.075 },
  generic: { input: 1.00, output: 4.00, blended: 1.00 },
};

function costForTokens(tokens, model) {
  const row = COST_TABLE[model] || COST_TABLE.generic;
  return tokens * (row.blended / 1_000_000);
}

function formatCost(dollars) {
  if (dollars === 0) return '$0.00';
  if (dollars < 0.01) return `$${dollars.toFixed(4)}`;
  if (dollars < 1) return `$${dollars.toFixed(3)}`;
  return `$${dollars.toFixed(2)}`;
}

module.exports = { countTokens, isTokenizerAvailable, encodingName, tokenizerInfo, COST_TABLE, costForTokens, formatCost };
