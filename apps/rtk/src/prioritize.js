'use strict';

// Semantic error prioritization + causal context + cross-command dedup + configurable windows.
// Usage: prioritizeLines(linesWithMeta, { window: 2, maxLines, dedupAcross: Map })

const FILE_REF_RE = /(?:^|\s)([A-Za-z0-9_./-]+\.(?:ts|js|tsx|jsx|py|rs|go|java|kt|tf|yaml|yml|json|toml)):(\d+)(?::(\d+))?/;
const SEVERITY = {
  error: 100,
  fail: 90,
  assertion: 85,
  typeError: 80,
  reference: 75,
  warn: 50,
  info: 10,
  noise: 0,
};

function scoreLine(line) {
  const raw = line;
  const t = raw.trim();
  if (!t) return SEVERITY.noise;
  if (/^FAIL\b| FAIL /i.test(raw) || /\bFAILED\b/i.test(raw)) return SEVERITY.fail;
  if (/error TS\d+/i.test(raw) || /Type error:/i.test(raw) || /\berror\b.*TS\d+/i.test(raw)) return SEVERITY.typeError;
  if (/AssertionError|Expected:|Received:|toEqual|toBe\(/.test(raw)) return SEVERITY.assertion;
  if (/^.+:\d+:\d+\s*-\s*error/i.test(raw) || /\bError:/i.test(raw)) return SEVERITY.error;
  if (FILE_REF_RE.test(raw) && /error|fail/i.test(raw)) return SEVERITY.error;
  if (FILE_REF_RE.test(raw)) return SEVERITY.reference;
  if (/\bWARN(ING)?\b/i.test(raw)) return SEVERITY.warn;
  if (/at\s+.+:\d+:\d+/.test(raw) || /❯/.test(raw)) return SEVERITY.reference;
  if (/passed|ok\b/i.test(raw)) return SEVERITY.info;
  return SEVERITY.noise;
}

function withContext(lines, keepIdxSet, windowSize) {
  const out = new Set(keepIdxSet);
  for (const idx of keepIdxSet) {
    for (let d = 1; d <= windowSize; d++) {
      if (idx - d >= 0) out.add(idx - d);
      if (idx + d < lines.length) out.add(idx + d);
    }
  }
  return [...out].sort((a, b) => a - b);
}

function prioritizeLines(lines, opts = {}) {
  const windowSize = opts.window ?? 2;
  const maxLines = opts.maxLines ?? 60;
  const scored = lines.map((line, i) => ({ i, line, score: scoreLine(line) }));
  // Sort by score desc, then original order for tie
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  // Collect top until maxLines, always include highest scored + totals
  const keep = new Set();
  for (const s of scored) {
    if (keep.size >= maxLines) break;
    if (s.score >= SEVERITY.reference || s.score >= SEVERITY.warn) keep.add(s.i);
  }
  // If nothing scored high (e.g. unknown tool), fallback to tail
  if (!keep.size) {
    const tail = Math.min(lines.length, maxLines);
    for (let i = lines.length - tail; i < lines.length; i++) keep.add(i);
    return { indices: [...keep].sort((a,b)=>a-b), scored };
  }
  const expanded = withContext(lines, keep, windowSize);
  // Cap after expansion: drop lowest-scored among expanded if over max
  if (expanded.length > maxLines) {
    const keepSet = new Set(expanded);
    const expandedScored = scored.filter(s => keepSet.has(s.i));
    expandedScored.sort((a,b) => b.score - a.score || a.i - b.i);
    const top = new Set(expandedScored.slice(0, maxLines).map(s => s.i));
    return { indices: [...top].sort((a,b)=>a-b), scored };
  }
  return { indices: expanded, scored };
}

// Cross-command dedup: given array of { label, lines }, drop lines already seen in earlier commands
function crossCommandDedup(commandOutputs, opts = {}) {
  const seen = new Set();
  const threshold = opts.threshold ?? 1; // exact trim match
  void threshold;
  const result = [];
  for (const entry of commandOutputs) {
    const { label, lines } = entry;
    const unique = [];
    const dropped = [];
    for (const line of lines) {
      const key = line.trim();
      if (!key) { unique.push(line); continue; }
      if (seen.has(key)) dropped.push(line);
      else { seen.add(key); unique.push(line); }
    }
    result.push({ label, lines: unique, droppedCount: dropped.length });
  }
  return result;
}

module.exports = { scoreLine, withContext, prioritizeLines, crossCommandDedup, SEVERITY, FILE_REF_RE };
