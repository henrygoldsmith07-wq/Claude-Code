'use strict';

// Tokenizer: js-tiktoken with per-model-family encodings, default o200k_base (GPT-4o family).
// Lazy-loaded so `rtk --help`, `rtk init`, `rtk gain` stay <30ms.
// No native build, pure JS. Falls back to chars/4 if dep missing or WASM fails.

let enc = null;
let encName = null;
let attempted = false;
let loadError = null;

/**
 * Tokenizer families measurable with js-tiktoken (OpenAI lineage). Anthropic and
 * Gemini ship proprietary tokenizers, so their savings are estimated via the
 * o200k_base proxy (see COST_TABLE); the ratio is broadly stable across encodings.
 */
const TOKENIZER_FAMILIES = [
  { id: 'o200k', encoding: 'o200k_base', label: 'GPT-4o / GPT-4.1 / o1 family', models: 'gpt-4o, gpt-4o-mini, o1' },
  { id: 'cl100k', encoding: 'cl100k_base', label: 'GPT-4 / GPT-3.5 family', models: 'gpt-4, gpt-3.5-turbo' },
  { id: 'p50k', encoding: 'p50k_base', label: 'Codex / code models', models: 'code-davinci-002' },
  { id: 'r50k', encoding: 'r50k_base', label: 'GPT-3 / text-davinci family', models: 'text-davinci-003' },
  { id: 'gpt2', encoding: 'gpt2', label: 'GPT-2 base', models: 'gpt-2' },
];

const _familyCaches = new Map(); // familyId -> { enc, name, error } (undefined error = loaded)

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

function ensureFamilyEnc(familyId) {
  const cached = _familyCaches.get(familyId);
  if (cached) return cached.enc;
  const row = TOKENIZER_FAMILIES.find((f) => f.id === familyId);
  if (!row) return ensureEnc(); // unknown family falls back to default
  try {
    const { Tiktoken } = require('js-tiktoken');
    const ranks = require(`js-tiktoken/ranks/${row.encoding}`);
    const familyEnc = new Tiktoken(ranks);
    _familyCaches.set(familyId, { enc: familyEnc, name: row.encoding });
    return familyEnc;
  } catch (e) {
    _familyCaches.set(familyId, { enc: null, error: String((e && e.message) || e) });
    return null;
  }
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

/** Token count for a specific model-family encoding (o200k/cl100k/p50k/r50k/gpt2). */
function countTokensForFamily(text, familyId) {
  const s = text == null ? '' : String(text);
  const familyEnc = ensureFamilyEnc(familyId);
  if (familyEnc) {
    try { return familyEnc.encode(s).length; } catch { /* fallback */ }
  }
  return Math.round(s.length / 4);
}

/** Per-family load status: { id, encoding, label, available, error }. */
function familiesInfo() {
  ensureEnc();
  return TOKENIZER_FAMILIES.map((f) => {
    const cache = _familyCaches.get(f.id);
    const familyEnc = cache ? cache.enc : ensureFamilyEnc(f.id);
    return { id: f.id, encoding: f.encoding, label: f.label, models: f.models, available: familyEnc !== null, error: cache ? cache.error : undefined };
  });
}

const COST_TABLE = {
  'gpt-4o': { input: 2.50, output: 10.00, blended: 2.50 },
  'gpt-4o-mini': { input: 0.15, output: 0.60, blended: 0.15 },
  'gpt-4': { input: 30.00, output: 60.00, blended: 30.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50, blended: 0.50 },
  'code-davinci-002': { input: 0.12, output: 0.12, blended: 0.12 },
  'text-davinci-003': { input: 2.00, output: 2.00, blended: 2.00 },
  'claude-3.5-sonnet': { input: 3.00, output: 15.00, blended: 3.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25, blended: 0.25 },
  'gemini-1.5-pro': { input: 1.25, output: 5.00, blended: 1.25 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30, blended: 0.075 },
  generic: { input: 1.00, output: 4.00, blended: 1.00 },
};

// Family id -> headline model for $ reporting in the multi-family benchmark.
const FAMILY_HEADLINE_MODEL = {
  o200k: 'gpt-4o',
  cl100k: 'gpt-4',
  p50k: 'code-davinci-002',
  r50k: 'text-davinci-003',
  gpt2: 'gpt-3.5-turbo',
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

module.exports = { countTokens, countTokensForFamily, familiesInfo, TOKENIZER_FAMILIES, FAMILY_HEADLINE_MODEL, isTokenizerAvailable, encodingName, tokenizerInfo, COST_TABLE, costForTokens, formatCost };
