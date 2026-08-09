'use strict';

function classifyLine(line, rules) {
  for (const r of rules) {
    if (r.re.test(line)) return { kept: r.keep, reason: r.reason };
  }
  return { kept: false, reason: 'no rule matched — dropped' };
}

function explainLines(lines, rules) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const { kept, reason } = classifyLine(line, rules);
    out.push({ i: i + 1, kept, reason, line });
  }
  return out;
}

function formatExplain(explained) {
  const kept = explained.filter((e) => e.kept).length;
  const dropped = explained.length - kept;
  const lines = [
    `rtk --explain — per-line retention trace (${kept} kept / ${dropped} dropped / ${explained.length} total)`,
    '  K  #  reason                              line (truncated to 140 chars)',
    '  ────────────────────────────────────────────────────────────────────────────',
  ];
  for (const e of explained) {
    const k = e.kept ? '✓' : '·';
    const num = String(e.i).padStart(4, ' ');
    const reason = (e.reason || '').padEnd(30, ' ').slice(0, 30);
    const preview = e.line.slice(0, 140);
    lines.push(`  ${k} ${num}  ${reason}  ${preview}`);
  }
  return lines.join('\n');
}

module.exports = { classifyLine, explainLines, formatExplain };
