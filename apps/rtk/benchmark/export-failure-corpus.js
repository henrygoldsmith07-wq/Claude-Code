'use strict';

/**
 * Export a sanitized public bundle of the RTK failure corpus.
 *
 * Reads benchmark/failures/*.json (raw succeeded, RTK failed), redacts secrets
 * via src/redact.js, strips absolute local paths (C:\Users\..., /home/...,
 * temp dirs), and writes:
 *   <out>/failure-corpus.json
 *   <out>/failure-corpus.md
 *
 * Refuses to write (exit 1) if any exported entry still matches
 * /(C:\\Users|\/home\/)/i after sanitization — fail loud, never leak.
 *
 * Usage: node benchmark/export-failure-corpus.js [--out <dir>]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { redact } = require('../src/redact');
const { getCorpusVersion } = require('../src/provenance');

const FAILURES_DIR = path.join(__dirname, 'failures');
const DEFAULT_OUT_DIR = path.join(__dirname, 'public');
const SAMPLE_LIMIT = 2000;

// Spec gate: nothing matching these may survive into the public bundle.
const LEAK_RE = /(C:\\Users|\/home\/)/i;

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip absolute local paths: C:\Users\..., /home/..., /tmp/... and whatever
 * this machine reports as its temp directories. Replacements are literal so a
 * path fragment can never reassemble across fields.
 */
function stripLocalPaths(text) {
  let out = String(text == null ? '' : text);
  out = out.replace(/[A-Za-z]:\\+Users\\+[^\s"'`,;)\]}<>]*/gi, '[LOCAL-PATH]');
  out = out.replace(/\/home\/[^\s"'`,;)\]}<>]*/g, '[LOCAL-PATH]');
  out = out.replace(/\/tmp\/[^\s"'`,;)\]}<>]*/g, '[LOCAL-PATH]');
  const tmps = new Set([os.tmpdir(), process.env.TEMP, process.env.TMP].filter(Boolean));
  for (const t of tmps) {
    out = out.split(t).join('[LOCAL-PATH]');
    out = out.split(t.replace(/\\/g, '/')).join('[LOCAL-PATH]');
  }
  return out.split('%TEMP%').join('[TEMP]').split('%TMP%').join('[TEMP]');
}

/** Redact secrets first, then strip local paths. Never throws. */
function sanitizeText(text) {
  let out = String(text == null ? '' : text);
  try { out = redact(out).text; } catch { /* redact is conservative by design */ }
  return stripLocalPaths(out);
}

function clip(s, n) {
  return s.length > n ? `${s.slice(0, n)}\n... [truncated]` : s;
}

function sanitizeEntry(entry) {
  const e = entry || {};
  const needles = Array.isArray(e.missingNeedles)
    ? e.missingNeedles.map((n) => sanitizeText(n))
    : [];
  return {
    id: e.id != null ? String(e.id) : 'unknown',
    tool: e.tool != null ? String(e.tool) : 'unknown',
    category: String(e.classification || e.category || 'unknown'),
    rawSucceeded: e.rawSucceeded !== undefined ? !!e.rawSucceeded : true,
    rtkFailed: e.rtkFailed !== undefined ? !!e.rtkFailed : true,
    minimalRepro: {
      missingNeedles: needles,
      raw: clip(sanitizeText(e.rawSample || ''), SAMPLE_LIMIT),
      rtk: clip(sanitizeText(e.rtkSample || ''), SAMPLE_LIMIT),
    },
    addedAt: e.capturedAt || e.addedAt || null,
  };
}

/** Depth-first walk over every string leaf of a JSON-ish value. */
function walkStrings(value, fn) {
  if (typeof value === 'string') fn(value);
  else if (Array.isArray(value)) for (const v of value) walkStrings(v, fn);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) walkStrings(v, fn);
}

function entryHasLeak(entry) {
  let leak = false;
  walkStrings(entry, (s) => { if (!leak && LEAK_RE.test(s)) leak = true; });
  if (!leak) {
    // Belt and braces: JSON.stringify doubles backslashes, so test the encoded form too.
    leak = /(C:\\\\Users|\/home\/)/i.test(JSON.stringify(entry));
  }
  return leak;
}

function buildPublicBundle(entries) {
  const sanitized = (Array.isArray(entries) ? entries : []).map(sanitizeEntry);
  const offenders = sanitized.filter(entryHasLeak).map((e) => e.id);
  return {
    ok: offenders.length === 0,
    offenders,
    entries: sanitized,
  };
}

function loadEntries(failuresDir) {
  const dir = failuresDir || FAILURES_DIR;
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

function renderMarkdown(bundle) {
  const lines = [];
  lines.push('# RTK public failure corpus');
  lines.push('');
  lines.push(`Sanitized export: ${bundle.entries.length} confirmed failure(s) where the raw tool output allowed progress but RTK-filtered output did not.`);
  lines.push('');
  if (!bundle.entries.length) {
    lines.push('> Registry is empty.');
    return lines.join('\n') + '\n';
  }
  lines.push('| ID | Tool | Category | Added |');
  lines.push('| --- | --- | --- | --- |');
  for (const e of bundle.entries) {
    lines.push(`| ${e.id} | ${e.tool} | ${e.category} | ${e.addedAt || '-'} |`);
  }
  lines.push('');
  lines.push('## Minimal repros');
  for (const e of bundle.entries) {
    const repro = e.minimalRepro || {};
    lines.push('');
    lines.push(`### ${e.id} (${e.category})`);
    lines.push('');
    if ((repro.missingNeedles || []).length) {
      lines.push(`Missing needles: ${repro.missingNeedles.join(' | ')}`);
      lines.push('');
    }
    lines.push('```');
    lines.push(String(repro.raw || '(no sample)').replace(/`{3,}/g, '[TICKS]'));
    lines.push('```');
  }
  lines.push('');
  return lines.join('\n') + '\n';
}

function writePublicBundle(outDir, bundle, meta = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const doc = {
    generatedAt: meta.now || null,
    corpusVersion: meta.corpusVersion || null,
    count: bundle.entries.length,
    entries: bundle.entries,
  };
  const jsonPath = path.join(outDir, 'failure-corpus.json');
  const mdPath = path.join(outDir, 'failure-corpus.md');
  fs.writeFileSync(jsonPath, JSON.stringify(doc, null, 2) + '\n');
  fs.writeFileSync(mdPath, renderMarkdown(bundle));
  return { jsonPath, mdPath };
}

/**
 * CLI body, separated from argv parsing so tests can drive it against fixture
 * directories without spawning processes. Returns the intended exit code.
 */
function run(argv = [], opts = {}) {
  const failuresDir = opts.failuresDir || FAILURES_DIR;
  let outDir = opts.outDir || DEFAULT_OUT_DIR;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') { i += 1; outDir = argv[i] || DEFAULT_OUT_DIR; }
    else if (a.startsWith('--out=')) outDir = a.slice('--out='.length) || DEFAULT_OUT_DIR;
    else throw new Error(`unknown flag: ${a}`);
  }

  const entries = loadEntries(failuresDir);
  if (!entries.length) {
    console.log(`[export-failure-corpus] registry is empty (${failuresDir} has no parsable *.json entries) - nothing to publish.`);
    return 0;
  }

  const bundle = buildPublicBundle(entries);
  if (!bundle.ok) {
    console.error(`[export-failure-corpus] refusing to publish: ${bundle.offenders.length} entr${bundle.offenders.length === 1 ? 'y' : 'ies'} still match ${LEAK_RE} after sanitization: ${bundle.offenders.map((id) => `"${id}"`).join(', ')}`);
    return 1;
  }

  const written = writePublicBundle(outDir, bundle, { corpusVersion: safeCorpusVersion() });
  console.log(`[export-failure-corpus] published ${bundle.entries.length} entr${bundle.entries.length === 1 ? 'y' : 'ies'}:`);
  console.log(`  ${written.jsonPath}`);
  console.log(`  ${written.mdPath}`);
  return 0;
}

function safeCorpusVersion() {
  try { return getCorpusVersion(); } catch { return 'unknown'; }
}

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}

module.exports = {
  LEAK_RE,
  stripLocalPaths,
  sanitizeText,
  sanitizeEntry,
  buildPublicBundle,
  entryHasLeak,
  loadEntries,
  renderMarkdown,
  writePublicBundle,
  run,
};
