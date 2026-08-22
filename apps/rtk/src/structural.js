'use strict';

/**
 * Structural helpers used by parsers in err mode when exitCode != 0.
 * Each helper is conservative: it preserves every error/warn file:line.
 * Opt-out via config.structural.*  New: ndjson, xml, sarif, annotations.
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
  const trimmed = output.trim();
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) return null;
  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { return null; }
  if (parsed === null || typeof parsed !== 'object') return null;
  function prune(v) {
    if (Array.isArray(v)) {
      const arr = v.map(prune).filter((x) => x !== undefined);
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
  const compact = JSON.stringify(pruned);
  if (compact.length >= JSON.stringify(parsed).length) return null;
  const pretty = JSON.stringify(pruned, null, 2);
  // Deep nesting makes 2-space indent bloat quadratically; keep the pruned
  // compact form when pretty-printing would be meaningfully larger (memory).
  return pretty.length > compact.length * 1.5 ? compact : pretty;
}

// NDJSON: many JSON lines (e.g. jsonl logs). Compress per-line.
function compressNdjson(output) {
  const lines = output.split('\n');
  if (lines.length < 2) return null;
  // Parse each line once up front and reuse — re-parsing in the emit loop,
  // plus a full stringify per line just to substring-test for errors, made
  // this quadratic on large NDJSON logs.
  const parsedLines = new Array(lines.length);
  let jsonLines = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try { parsedLines[i] = JSON.parse(lines[i]); jsonLines++; } catch { /* not json */ }
  }
  if (jsonLines < Math.max(2, Math.min(lines.length * 0.6, lines.length - 1))) return null;
  const out = [];
  let omittedInRun = 0;
  function flushRun() {
    if (omittedInRun > 0) { out.push(`… ${omittedInRun} json lines omitted …`); omittedInRun = 0; }
  }
  // Keep errors, cap long runs of ok lines
  let okRun = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) { flushRun(); out.push(l); continue; }
    const parsed = parsedLines[i];
    if (!parsed) { flushRun(); out.push(l); continue; }
    // Heuristic: error-ish json is always kept (test the raw line — the
    // keys themselves are often the signal, e.g. "errorCount":1)
    const isError = /error|fail|warn/i.test(l);
    if (isError) {
      if (okRun > 6) { out.push(`… ${okRun - 6} ok lines omitted …`); okRun = 0; }
      else if (okRun > 0) { /* keep tail of run */ }
      // Render compact error json, prune empties
      let pruned = parsed;
      try { const pretty = compressJson(l); if (pretty) pruned = JSON.parse(pretty); } catch {}
      out.push(JSON.stringify(pruned));
      okRun = 0;
    } else {
      okRun++;
      if (okRun <= 3) out.push(l);
      else if (okRun === 4) { /* hold */ }
      else { /* collapse */ }
    }
  }
  if (okRun > 3) {
    const extra = okRun - 3;
    out.push(`… ${extra} ok json lines omitted …`);
  }
  if (out.length >= lines.length * 0.9) return null;
  return out.join('\n');
}

// XML / JUnit: keep <failure> / <error> / <testcase> with failures, collapse long success runs
function compressXml(output) {
  if (!/<\?xml|<\w+[^>]*>/.test(output)) return null;
  const hasJUnit = /<testsuite|<testcase|<failure|<error|\bJUnit/i.test(output);
  if (!hasJUnit && !/<failure|<error/i.test(output)) return null;
  // Keep failure/error blocks + nearest testcase wrapper; collapse success testcase runs
  const lines = output.split('\n');
  const kept = [];
  const pushedIdx = new Set();
  let successRun = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFailureLine = /<failure|<error/i.test(line);
    const isTestcase = /<testcase/i.test(line);
    const isSuccessCase = isTestcase && !isFailureLine && !/<failure|<error/i.test(lines.slice(i, Math.min(i+6, lines.length)).join('\n'));
    if (isFailureLine) {
      if (successRun > 6) kept.push(`  … ${successRun - 6} passing testcases omitted …`);
      successRun = 0;
      // Include context: previous testcase line if near. Track by index —
      // value-based `includes` both went quadratic and swallowed a second
      // occurrence of identical content from a different testcase.
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 8);
      for (let j = start; j < end; j++) {
        if (!pushedIdx.has(j)) { pushedIdx.add(j); kept.push(lines[j]); }
      }
      i += 7;
    } else if (isSuccessCase) {
      successRun++;
      if (successRun <= 3) { kept.push(line); pushedIdx.add(i); }
    } else {
      if (successRun > 6) { kept.push(`  … ${successRun - 6} passing testcases omitted …`); successRun = 0; }
      else if (successRun > 0 && successRun <= 6) { /* keep pending */ }
      // Keep class/testsuite headers
      if (/^<\?xml|<testsuite|<testsuites/i.test(line.trim())) { kept.push(line); pushedIdx.add(i); }
      else if (!isSuccessCase) { kept.push(line); pushedIdx.add(i); }
    }
  }
  if (successRun > 3) kept.push(`  … ${successRun - 3} passing testcases omitted …`);
  if (kept.length >= lines.length * 0.9) return null;
  return kept.join('\n');
}

// SARIF: JSON with runs[].results[] — keep only rule failures
function compressSarif(output) {
  let parsed;
  try { parsed = JSON.parse(output.trim()); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.runs)) return null;
  const hasSarif = parsed.version && parsed.runs;
  if (!hasSarif) return null;
  const out = JSON.parse(JSON.stringify(parsed));
  for (const run of out.runs) {
    if (!Array.isArray(run.results)) continue;
    const origLen = run.results.length;
    const failures = run.results.filter(r => {
      const lvl = (r.level || '').toLowerCase();
      return lvl === 'error' || lvl === 'warning' || !lvl;
    });
    if (failures.length < origLen) {
      run.results = failures.length > 30
        ? [...failures.slice(0, 15), { _omitted: `… ${failures.length - 20} results omitted …` }, ...failures.slice(-5)]
        : failures;
      run._rtkSarifNote = `${origLen - failures.length} non-error results omitted; ${failures.length} failures kept`;
    }
    // Drop tool.driver notifications, keep tool
    if (run.tool && run.tool.driver && run.tool.driver.notifications) delete run.tool.driver.notifications;
  }
  const pretty = JSON.stringify(out, null, 2);
  if (pretty.length >= output.length * 0.95) return null;
  return pretty;
}

// GitHub annotation output: ::error::, ::warning::, ::notice::
function compressAnnotations(output) {
  if (!/::(error|warning|notice).*::/i.test(output)) return null;
  const lines = output.split('\n');
  const kept = lines.filter(l => /::(error|warning|notice).*::/i.test(l) || /::(group|endgroup)::/i.test(l) || /Error:|Failed/i.test(l));
  if (!kept.length) return null;
  // Keep surrounding group context for each annotation + critical Error/Failed lines nearby
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (/::(error|warning|notice).*::/i.test(lines[i])) {
      if (i > 0 && /::group::/.test(lines[i-1])) out.push(lines[i-1]);
      out.push(lines[i]);
      // Keep immediate next line if it is a stack frame or a critical process failure line
      if (i + 1 < lines.length && (/at\s+.*:\d+:\d+/.test(lines[i+1]) || /Error:.*exit code/i.test(lines[i+1]))) out.push(lines[i+1]);
      // Also keep the next Error: line within 2 lines if it is the process completion marker
      if (i + 2 < lines.length && /Error:.*exit code/i.test(lines[i+2]) && !out.includes(lines[i+2])) out.push(lines[i+2]);
    }
  }
  // Ensure any Error:.*exit code or Process completed lines are never lost
  for (const l of kept) {
    if (/Error:.*exit code|Process completed with exit code/i.test(l) && !out.includes(l)) out.push(l);
  }
  // Deduplicate while preserving order, then restore original input order.
  // Precompute first-occurrence indices once — `indexOf` per comparison was
  // O(n²) on large CI logs and unstable for duplicate lines.
  const seen = new Set();
  const deduped = out.filter(l => { const k=l.trim(); if(seen.has(k)) return false; seen.add(k); return true; });
  const firstIdx = new Map();
  for (let i = lines.length - 1; i >= 0; i--) firstIdx.set(lines[i], i);
  deduped.sort((a, b) => (firstIdx.get(a) ?? -1) - (firstIdx.get(b) ?? -1));
  const merged = deduped.length ? deduped : kept;
  if (merged.length >= lines.length * 0.9) return null;
  // Final safety: if kept has an Error:.*exit code line missing from merged, use kept
  const hasCritical = kept.some(l => /Error:.*exit code/i.test(l));
  const mergedHasCritical = merged.some(l => /Error:.*exit code/i.test(l));
  if (hasCritical && !mergedHasCritical) return kept.join('\n');
  return merged.join('\n');
}

function compressDiff(lines) {
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
  // Document-level transforms (return early if they apply)
  if (s.sarif !== false) {
    const sarif = compressSarif(output);
    if (sarif) return sarif.split('\n');
  }
  if (s.xml !== false) {
    const xml = compressXml(output);
    if (xml) return xml.split('\n');
  }
  if (s.annotations !== false) {
    const ann = compressAnnotations(output);
    if (ann) return ann.split('\n');
  }
  if (s.ndjson !== false) {
    const nd = compressNdjson(output);
    if (nd) return nd.split('\n');
  }
  if (s.json !== false) {
    const jsonCompressed = compressJson(output);
    if (jsonCompressed) return jsonCompressed.split('\n');
  }
  return cur;
}

module.exports = { dedupLines, compressStack, compressJson, compressDiff, compressNdjson, compressXml, compressSarif, compressAnnotations, applyStructural };
