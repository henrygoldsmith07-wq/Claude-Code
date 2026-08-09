'use strict';

/**
 * Redact secrets from output before emitting to LLM context.
 * Conservative, string-based — never blocks, never throws.
 */

const PATTERNS = [
  // Generic key=value / key: value with long secret-looking value
  {
    re: /((?:api[_-]?key|secret|token|password|passwd|pwd|auth[_-]?token|access[_-]?token|github[_-]?token|gh[_-]?token|npm[_-]?token|bearer)\s*[:=]\s*)(["']?)([A-Za-z0-9_\-./+]{8,})\2/gi,
    replace: '$1$2[REDACTED]$2',
    reason: 'key-value secret',
  },
  // Bearer / Token header style
  {
    re: /(bearer\s+)[A-Za-z0-9_\-./+]{16,}/gi,
    replace: '$1[REDACTED]',
    reason: 'bearer token',
  },
  // AWS keys
  {
    re: /AKIA[0-9A-Z]{16}/g,
    replace: '[REDACTED-AWS-KEY]',
    reason: 'aws-access-key',
  },
  {
    re: /aws_secret_access_key\s*[:=]\s*["']?[A-Za-z0-9/+=]{20,}["']?/gi,
    replace: 'aws_secret_access_key=[REDACTED]',
    reason: 'aws-secret',
  },
  // GitHub classic / fine-grained PAT
  {
    re: /gh[pousr]_[A-Za-z0-9_]{20,}/g,
    replace: '[REDACTED-GITHUB-TOKEN]',
    reason: 'github-token',
  },
  // npm tokens (npm_xxx)
  {
    re: /npm_[A-Za-z0-9]{20,}/g,
    replace: '[REDACTED-NPM-TOKEN]',
    reason: 'npm-token',
  },
  // Slack tokens
  {
    re: /xox[bpras]-[A-Za-z0-9-]{10,}/g,
    replace: '[REDACTED-SLACK-TOKEN]',
    reason: 'slack-token',
  },
  // Stripe
  {
    re: /sk_(live|test)_[A-Za-z0-9]{10,}/g,
    replace: '[REDACTED-STRIPE-KEY]',
    reason: 'stripe-key',
  },
  // Generic long hex / base64 that looks like a secret when labeled
  // Already covered above; keep conservative — do not redact random hashes in stack traces.
];

function redact(text, { enabled = true } = {}) {
  if (!enabled || !text) return { text, redactions: [] };
  let out = text;
  const redactions = [];
  for (const p of PATTERNS) {
    let m;
    // Use a copy to count before replace
    const before = out;
    out = out.replace(p.re, p.replace);
    if (out !== before) {
      // Count occurrences in original
      const count = (before.match(new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : p.re.flags + 'g')) || []).length;
      if (count) redactions.push({ pattern: p.reason, count });
    }
    // Reset lastIndex for global regexes reused
    if (p.re.global) p.re.lastIndex = 0;
  }
  return { text: out, redactions };
}

module.exports = { redact, PATTERNS };
