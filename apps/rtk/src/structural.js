'use strict';

/**
 * Structural helpers used by parsers in err mode when exitCode != 0.
 * Each helper is conservative: it preserves every error/warn file:line.
 * They are opt-out via config.structural.*
 */

function dedupLines(lines) {
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    const key = l.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

function compressStack(lines) {
  // Collapse repeated internal frames and node_modules noise; keep user frames.
  const out = [];
  let droppedInternal = 0;
  for (const l of lines) {
    const isInternal = /node:internal|node_modules\/(vitest|jest|typescript)\//.test(l);
    const isUserFrame = /^\s*at\s+.*\.(ts|js|tsx|jsx):\d+:\d+/.test(l);
    if (isInternal && !isUserFrame) { droppedInternal++; continue; }
    if (droppedInternal) {
      out.push(`  … ${droppedInternal} internal frame(s) omitted …`);
      droppedInternal = 0;
    }
    out.push(l);
  }
  if (droppedInternal) out.push(`  … ${droppedInternal} internal frame(s) omitted …`);
  return out;
}

function compressJson(output) {
  // Schema-aware JSON compression: if the output is a single JSON object/array, pretty-print
  // and drop null/empty fields that are never fix-critical; keep errors/warnings verbatim.
  const trimmed = output.trim();
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) return null;
  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { return null; }
  if (parsed === null || typeof parsed !== 'object') return null;

  function prune(v) {
    if (Array.isArray(v)) {
      const arr = v.map(prune).filter((x) => x !== undefined);
      // cap very long arrays but keep first/last evidence
      if (arr.length > 30) {
        const head = arr.slice(0, 15);
        const tail = arr.slice(-5);
        return [...head, `… ${arr.length - 20} items omitted …`, ...tail];
      }
      return arr;
    }
    if (v && typeof v === 'object') {
      const out = {};
      for (const [k, val] of Object.entries(v)) {
        if (val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          // keep error-ish keys even when empty-ish
          if (!/error|fail|warn|message|reason/i.test(k)) continue;
        }
        const pruned = prune(val);
        if (pruned !== undefined) out[k] = pruned;
      }
      return out;
    }
    if (typeof v === 'string' && v.length > 400) return v.slice(0, 400) + '\u2026 [truncated]';
    return v;
  }

  const pruned = prune(parsed);
  const pretty = JSON.stringify(pruned, null, 2);
  // Small objects: allow modest expansion from pretty-print; still compress if we pruned or capped
  const didWork = JSON.stringify(pruned).length < JSON.stringify(parsed).length;
  if (!didWork && pretty.length >= trimmed.length * 0.95) return null;
  return pretty;
}

function compressDiff(lines) {
  // Diff compression: collapse long unchanged hunks, keep context +-3 around changes.
  const isDiffHeader = /^diff --git|^@@|^--- |^\+\+\+ /;
  const isChange = /^[+-][^ +-]/;
  let hasDiff = false;
  for (const l of lines) if (isDiffHeader.test(l) || isChange.test(l)) { hasDiff = true; break; }
  if (!hasDiff) return null;

  const out = [];
  let unchangedRun = [];
  function flushUnchanged() {
    if (!unchangedRun.length) return;
    if (unchangedRun.length <= 6) out.push(...unchangedRun);
    else {
      out.push(...unchangedRun.slice(0, 3), ` … ${unchangedRun.length - 6} unchanged lines omitted …`, ...unchangedRun.slice(-3));
    }
    unchangedRun = [];
  }
  for (const l of lines) {
    if (isDiffHeader.test(l) || isChange.test(l)) {
      flushUnchanged();
      out.push(l);
    } else if (/^ /.test(l)) {
      unchangedRun.push(l);
    } else {
      flushUnchanged();
      out.push(l);
    }
  }
  flushUnchanged();
  if (out.length >= lines.length * 0.9) return null;
  return out;
}

function applyStructural(lines, output, config) {
  let cur = lines.slice();
  const s = (config && config.structural) || {};
  if (s.dedup !== false) cur = dedupLines(cur);
  if (s.stack !== false) cur = compressStack(cur);
  if (s.diff !== false) {
    const compressed = compressDiff(cur);
    if (compressed) cur = compressed;
  }
  // JSON is document-level; handle separately
  if (s.json !== false) {
    const jsonCompressed = compressJson(output);
    if (jsonCompressed) return jsonCompressed.split('\n');
  }
  return cur;
}

module.exports = { dedupLines, compressStack, compressJson, compressDiff, applyStructural };
