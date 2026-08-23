#!/usr/bin/env node
/**
 * CODEOWNERS check.
 *
 * A CODEOWNERS file fails silently. A pattern that matches nothing, or an
 * owner GitHub cannot resolve, produces no error anywhere in the UI - the path
 * is simply left unguarded. This script makes that failure loud.
 *
 * It enforces three things:
 *   1. Syntax: every rule is `<pattern> <@owner>...` and owners look like
 *      GitHub handles or @org/team slugs.
 *   2. Coverage: the security- and architecture-sensitive paths this repo
 *      cares about resolve to an explicit rule, not merely to the `*` default.
 *   3. Drift: patterns that no longer match any tracked file are reported as
 *      warnings, so stale rules get cleaned up rather than quietly rotting.
 *
 * Exit 1 on failure (CI-friendly).
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const codeownersPath = path.join(root, '.github', 'CODEOWNERS');
const rel = '.github/CODEOWNERS';

const errors = [];
const warnings = [];

if (!existsSync(codeownersPath)) {
  console.error(`Missing ${rel}`);
  process.exit(1);
}

/**
 * Paths that exist to be guarded. If one of these stops resolving to an
 * explicit rule, the protection story has a hole and this check fails.
 */
const mustBeOwned = [
  '.github/workflows/engineering.yml',
  'scripts/engineering-gates.mjs',
  'CLAUDE.md',
  '.mcp.json',
  'vercel.json',
  '.nvmrc',
  'apps/registry.json',
  'packages/theme/package.json',
  'apps/daily-debate/supabase/migrations/001_initial_schema.sql',
  'apps/food-shopping-os/scripts/migrations/001-initial-backend.mjs',
  'apps/food-shopping-os/src/server/auth.js',
  'apps/food-shopping-os/src/middleware.js',
  'apps/revise/src/data/supabase.ts',
  'apps/revise/.env.example',
];

const rules = [];
readFileSync(codeownersPath, 'utf8')
  .split('\n')
  .forEach((raw, i) => {
    // Strip a trailing CR first: `.` never matches \r and `$` (without /m)
    // will not anchor before one, so on CRLF checkouts the comment stripper
    // below would silently keep whole comment lines and parse them as rules.
    const line = raw.replace(/\r$/, '').replace(/#.*$/, '').trim();
    if (!line) return;
    const [pattern, ...owners] = line.split(/\s+/);
    if (!owners.length) {
      errors.push(`${rel}:${i + 1}: rule "${pattern}" has no owner`);
      return;
    }
    for (const owner of owners) {
      if (!/^@[A-Za-z0-9][A-Za-z0-9-]*(\/[A-Za-z0-9._-]+)?$/.test(owner)) {
        errors.push(`${rel}:${i + 1}: "${owner}" is not a valid @user or @org/team`);
      }
    }
    rules.push({ pattern, owners, line: i + 1 });
  });

if (!rules.length) errors.push('CODEOWNERS defines no rules');

const escape = (segment) =>
  segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');

/**
 * Compile one gitignore-style CODEOWNERS pattern to a RegExp.
 *
 * Segments are handled individually so that a leading `**` is recognised
 * before the trailing-slash directory form. Reading it the other way round
 * treats `**` as a literal directory name and the rule matches nothing.
 */
const toRegExp = (pattern) => {
  let body = pattern;
  const anchored = body.startsWith('/');
  if (anchored) body = body.slice(1);
  const dirOnly = body.endsWith('/');
  if (dirOnly) body = body.slice(0, -1);

  const parts = [];
  const segments = body.split('/');
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**') {
      parts.push(last ? '.*' : '(?:[^/]+/)*');
      return;
    }
    parts.push(escape(segment));
    if (!last) parts.push('/');
  });

  // An unanchored pattern may start at any directory depth, which is how
  // `package-lock.json` covers every app's lockfile.
  const prefix = anchored ? '^' : '^(?:.*/)?';
  // A directory rule owns everything beneath it; a file rule owns the file,
  // and also its contents when the path turns out to be a directory.
  const suffix = dirOnly ? '/.*$' : '(?:/.*)?$';
  return new RegExp(`${prefix}${parts.join('')}${suffix}`);
};

const compiled = rules.map((rule) => ({ ...rule, re: toRegExp(rule.pattern) }));

/** Last matching rule wins, exactly as GitHub resolves ownership. */
const ownerOf = (file) => {
  let match = null;
  for (const rule of compiled) if (rule.re.test(file)) match = rule;
  return match;
};

for (const file of mustBeOwned) {
  const match = ownerOf(file);
  if (!match) {
    errors.push(`${file}: no CODEOWNERS rule matches`);
  } else if (match.pattern === '*') {
    errors.push(`${file}: only the catch-all "*" rule matches; add an explicit rule`);
  }
}

let tracked = [];
try {
  tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  warnings.push('git ls-files unavailable; skipping pattern-drift check');
}

if (tracked.length) {
  for (const rule of compiled) {
    if (rule.pattern === '*') continue;
    if (!tracked.some((file) => rule.re.test(file))) {
      warnings.push(`${rel}:${rule.line}: "${rule.pattern}" matches no tracked file`);
    }
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\nCODEOWNERS check failed: ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `CODEOWNERS check passed: ${rules.length} rules, ${mustBeOwned.length} sensitive paths explicitly owned, ${warnings.length} warning(s).`,
);
