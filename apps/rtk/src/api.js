'use strict';

/**
 * Stable programmatic API for embedding rtk (CI systems, agent harnesses,
 * plugins that compose rather than replace). Contract:
 *  - API_VERSION increases only on breaking changes to this module's surface.
 *  - filterOutput never throws on bad input; failures degrade to raw output.
 */

const API_VERSION = 1;

let _parsers;
function parsers() {
  if (!_parsers) _parsers = require('./parsers');
  return _parsers;
}

/**
 * Filter one output buffer.
 * @param {object} opts
 *   output        string (required)
 *   exitCode      number (default 1)
 *   argv          string[] — command argv used for tool detection
 *   parserName    string — force a parser from PARSERS (skips detection)
 *   level         'conservative'|'balanced'|'aggressive' (default 'balanced')
 *   maxLines      number — per-parser cap override
 *   contextWindow number — causal-context expansion 0..10 (default 0)
 *   redactSecrets boolean (default true)
 * @returns {{ output: string, parser: string, rawChars, emittedChars,
 *             tokens?: {raw, emitted}, meta: {apiVersion, degraded:boolean} }}
 */
function filterOutput(opts = {}) {
  const output = typeof opts.output === 'string' ? opts.output : '';
  const exitCode = typeof opts.exitCode === 'number' ? opts.exitCode : 1;
  const meta = { apiVersion: API_VERSION, degraded: false };
  if (!output) return { output: '', parser: opts.parserName || 'generic', rawChars: 0, emittedChars: 0, meta };

  let config = { parsers: {}, structural: {} };
  try { config = require('./config').loadConfig(process.cwd()).config; } catch {}

  const P = parsers();
  let parser;
  try {
    parser = opts.parserName ? P.PARSERS[opts.parserName] : P.pickParser(opts.argv || [], output);
    if (!parser) parser = P.PARSERS.generic;
  } catch {
    parser = P.PARSERS.generic;
    meta.degraded = true;
  }

  let emitted;
  try {
    const level = ['conservative', 'balanced', 'aggressive'].includes(opts.level) ? opts.level : 'balanced';
    const maxLines = opts.maxLines != null
      ? Math.max(1, Math.round(opts.maxLines))
      : ((config.parsers[parser.name] && config.parsers[parser.name].maxLines) || 60);
    const filtered = parser.filter(output, exitCode, { maxLines, contextWindow: opts.contextWindow || 0 });
    emitted = filtered.emitted;
    if (exitCode !== 0) {
      const structured = applyStructuralSafe(emitted, output, config);
      if (structured) emitted = structured;
    }
    // Level-aware cap pass (aggressive squeezes harder than parser default)
    const capByLevel = { conservative: Infinity, balanced: maxLines * 2, aggressive: maxLines };
    const cap = capByLevel[level];
    if (cap !== Infinity) {
      const lines = emitted.split('\n');
      if (lines.length > cap) emitted = [...lines.slice(0, Math.floor(cap * 0.8)), `… ${lines.length - cap} lines omitted …`, ...lines.slice(-Math.ceil(cap * 0.2))].join('\n');
    }
  } catch {
    emitted = output.split('\n').slice(-30).join('\n');
    meta.degraded = true;
  }

  let text = emitted;
  let redactions = [];
  if (opts.redactSecrets !== false) {
    try {
      const r = require('./redact').redact(text, { enabled: true });
      text = r.text;
      redactions = r.redactions;
    } catch {}
  }

  const result = {
    output: text,
    parser: parser.name,
    rawChars: output.length,
    emittedChars: text.length,
    meta,
  };
  if (redactions.length) result.redactions = redactions;
  try {
    const { countTokens } = require('./tokens');
    result.tokens = { raw: countTokens(output), emitted: countTokens(text) };
  } catch {
    result.tokens = { raw: Math.round(output.length / 4), emitted: Math.round(text.length / 4) };
  }
  return result;
}

function applyStructuralSafe(emitted, original, config) {
  try {
    const { applyStructural } = require('./structural');
    const lines = emitted.split('\n').filter(Boolean);
    const out = applyStructural(lines, original, config);
    return out && out.length ? out.join('\n') : null;
  } catch {
    return null;
  }
}

module.exports = { API_VERSION, filterOutput, pickParser: () => parsers().pickParser, listParsers: () => parsers().listParsers() };
