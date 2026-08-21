'use strict';

// Classify why RTK lost a case that raw had.
// Categories from spec: filename lost, context removed, incorrect deduplication,
// parser bug, stack trace over-compressed, ordering changed, important warning
// removed, malformed transformation, unknown

function classifyFailure({ missingNeedles, rawOutput, rtkOutput, rawLines, rtkLines }) {
  const missing = (missingNeedles || []).join(' ');
  const missingLower = missing.toLowerCase();
  const raw = String(rawOutput || '');
  const rtk = String(rtkOutput || '');

  // Filename lost: missing contains file:line pattern
  if (/[\w./\\-]+\.(?:ts|js|tsx|jsx|py|rs|go|java|kt|tf):\d+/.test(missing) || /src\//.test(missingLower) && /:\d+/.test(missing)) {
    return 'filename lost';
  }
  // Stack trace over-compressed: missing contains at ...:line:col or ❯
  if (/at\s+.*:\d+:\d+|❯/.test(missing) || /stack/i.test(missingLower)) {
    return 'stack trace over-compressed';
  }
  // Context removed: Expected/Received etc.
  if (/expected|received|assert/i.test(missingLower)) {
    return 'context removed';
  }
  // Important warning removed
  if (/warning|warn/i.test(missingLower)) {
    return 'important warning removed';
  }
  // Ordering changed: needles exist in rtk but in different order? Check if all substrings exist but pair marked failed — already handled via missing check, so unknown unless we detect order.
  // For now detect via checking if rtk contains all missing substrings out of order? Simpler to check if raw and rtk both contain needles but rtk failed due to order: not applicable.
  // Incorrect deduplication: duplicate lines collapsed that were actually distinct (check if raw has duplicate lines that rtk deduped)
  if (rtk.length < raw.length * 0.1 && missing.length > 0) {
    // Heuristic: heavy dedup caused loss
    const dupLines = raw.split('\n').filter(l=>l.trim()).length - new Set(raw.split('\n').map(l=>l.trim())).size;
    if (dupLines > 20) return 'incorrect deduplication';
  }
  // Parser bug: emitted much smaller than raw and missing critical
  if (rtkLines != null && rawLines != null && rtkLines < rawLines * 0.05) return 'parser bug';
  // Malformed transformation: rtk output contains truncation markers but missing needle near truncation
  if (rtk.includes('…') || rtk.includes('omitted') || rtk.includes('[truncated]')) {
    if (missingLower.includes('error') || missingLower.includes('fail')) return 'malformed transformation';
  }
  // Ordering changed: check if both raw and rtk contain all needles but order differs? Need more info; classify as unknown for now if not matched.
  return 'unknown';
}

module.exports = { classifyFailure };
