// Tests for scripts/check-codeowners.mjs — the CODEOWNERS gate.
//
// The script runs its CLI at import, so tests use the exported pure helpers
// only: parseCodeowners, toRegExp, compileRules, driftWarnings,
// coverageErrors and the mustBeOwned list. No filesystem, no git.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mustBeOwned,
  parseCodeowners,
  toRegExp,
  compileRules,
  driftWarnings,
  coverageErrors,
} from './check-codeowners.mjs';

test('parseCodeowners reads patterns, owners and line numbers, skipping comments and blanks', () => {
  const { rules, parseErrors } = parseCodeowners(
    [
      '# a comment',
      '',
      '*                        @user',
      '/.github/                @user @org/team',
      'apps/foo/**.test.js      @org/team', // deliberate oddity: owners parsed on whitespace
    ].join('\n'),
  );
  assert.equal(rules.length, 3);
  assert.deepEqual(rules[0], { pattern: '*', owners: ['@user'], line: 3 });
  assert.deepEqual(rules[1], { pattern: '/.github/', owners: ['@user', '@org/team'], line: 4 });
  assert.equal(rules[2].line, 5);
  assert.deepEqual(parseErrors, []);
});

test('parseCodeowners strips CRLF so a Windows checkout cannot hide comment lines', () => {
  const { rules, parseErrors } = parseCodeowners('* @user\r\n# trailing comment\r\n');
  assert.deepEqual(rules, [{ pattern: '*', owners: ['@user'], line: 1 }]);
  assert.deepEqual(parseErrors, []);
});

test('parseCodeowners rejects rules with no owner and malformed owner handles', () => {
  const { parseErrors } = parseCodeowners(
    [
      'orphan/pattern',
      'apps/x @Bad Handle',
      'apps/y @-leading',
      'apps/z @ok-name @team/sub_team.ok',
    ].join('\n'),
  );
  assert.equal(parseErrors.length, 3);
  assert.match(parseErrors[0], /:1: rule "orphan\/pattern" has no owner/);
  assert.match(parseErrors[1], /"Handle" is not a valid/, 'the token after the space is checked, not the first one');
  assert.match(parseErrors[2], /@-leading/);
  // @team/sub_team.ok is accepted: dots, underscores and dashes inside a team slug.
  assert.ok(!parseErrors.some((e) => e.includes('@team/sub_team.ok')));
});

test('parseCodeowners reports an empty CODEOWNERS as an error', () => {
  const { parseErrors } = parseCodeowners('# nothing but comments\n\n');
  assert.deepEqual(parseErrors, ['CODEOWNERS defines no rules']);
});

// GitHub's documented CODEOWNERS semantics the compiler has to match.
test('file patterns match at any depth; anchored ones only at the root', () => {
  assert.equal(toRegExp('*.md').test('README.md'), true);
  assert.equal(toRegExp('*.md').test('apps/x/README.md'), true);
  assert.equal(toRegExp('package-lock.json').test('apps/revise/package-lock.json'), true);
  assert.equal(toRegExp('*.md').test('src/README.mdx'), false, 'the extension is anchored at a dot');
});

test('anchored patterns do not match deeper paths sharing a prefix', () => {
  assert.equal(toRegExp('/README.md').test('README.md'), true);
  assert.equal(toRegExp('/README.md').test('apps/x/README.md'), false);
  assert.equal(toRegExp('/apps/foo/').test('apps/foo'), true, 'a dir rule owns the directory itself');
  assert.equal(toRegExp('/apps/foo/').test('apps/foo/index.html'), true);
  assert.equal(toRegExp('/apps/foo/').test('apps/foobar'), false);
});

test('** segments match any number of directories, including none', () => {
  assert.equal(toRegExp('**/*.ts').test('c.ts'), true);
  assert.equal(toRegExp('**/*.ts').test('a/b/c.ts'), true);
  assert.equal(toRegExp('**/supabase/').test('apps/x/supabase'), true);
  assert.equal(toRegExp('**/supabase/').test('apps/x/supabase/migrations/001.sql'), true);
  assert.equal(toRegExp('**/supabase/migrations/').test('supabase/migrations'), true);
  assert.equal(toRegExp('**/supabase/migrations/').test('deep/nested/supabase/migrations'), true);
  assert.equal(toRegExp('**/supabase/').test('apps/x/supabase-ish'), false);
});

test('special regex characters in a pattern are escaped, not interpreted', () => {
  assert.equal(toRegExp('a.b/file(1).ts').test('a.b/file(1).ts'), true);
  assert.equal(toRegExp('a.b/file(1).ts').test('axb/file1ts'), false);
  assert.equal(toRegExp('c++/x').test('c++/x'), true);
  assert.equal(toRegExp('a?b').test('axb'), true, '? is a single-character glob');
  assert.equal(toRegExp('a?b').test('ab'), false);
});

// Regression: the dir-only suffix used to be '/.*$', which required a path
// *inside* the directory — so a rule like '/apps/ecosystem-shell/' never
// matched the directory itself and the drift check could not see it.
test('a dir-only rule matches the bare directory path (trailing slash is not a restriction)', () => {
  assert.equal(toRegExp('/apps/ecosystem-shell/').test('apps/ecosystem-shell'), true);
  assert.equal(toRegExp('packages/theme/').test('packages/theme'), true);
  assert.equal(toRegExp('packages/theme/').test('packages/themeforest'), false);
});

test('compileRules resolves ownership by last matching rule', () => {
  const { rules } = parseCodeowners(['* @default', '/apps/revise/ @revise-own', '/apps/revise/src/data/supabase.ts @data-own'].join('\n'));
  const { ownerOf } = compileRules(rules);
  assert.equal(ownerOf('apps/revise/src/other.ts').pattern, '/apps/revise/');
  assert.equal(ownerOf('apps/revise/src/data/supabase.ts').pattern, '/apps/revise/src/data/supabase.ts');
  assert.equal(ownerOf('README.md').pattern, '*');
});

test('driftWarnings skip the catch-all and flag stale patterns', () => {
  const { rules } = parseCodeowners(['* @default', '/gone-app/ @someone', '/apps/revise/ @someone'].join('\n'));
  const { compiled } = compileRules(rules);
  const warnings = driftWarnings(compiled, ['apps/revise/index.html']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /:2: "\/gone-app\/" matches no tracked file/);
  assert.deepEqual(driftWarnings(compiled, []), [], 'no tracked files -> the drift check is skipped entirely');
});

test('coverageErrors insist on explicit rules for the sensitive paths', () => {
  const { rules } = parseCodeowners(['* @default', '/apps/revise/ @own'].join('\n'));
  const { compiled } = compileRules(rules);
  const errors = coverageErrors(compiled, ['apps/revise/.env.example', 'CLAUDE.md']);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^CLAUDE\.md: only the catch-all "\*" rule matches/);
  assert.deepEqual(coverageErrors(compiled, ['apps/revise/.env.example']), []);
  const { rules: specificRules } = parseCodeowners('/apps/revise/ @own');
  const { compiled: specificCompiled } = compileRules(specificRules);
  const unmatched = coverageErrors(specificCompiled, ['orphan/path.ts']);
  assert.match(unmatched[0], /no CODEOWNERS rule matches/);
});

test('the shipped sensitive-path list covers the gates that make this repo reviewable', () => {
  for (const required of ['.github/workflows/engineering.yml', 'scripts/engineering-gates.mjs', 'CLAUDE.md', 'vercel.json', 'apps/registry.json']) {
    assert.ok(mustBeOwned.includes(required), `${required} must stay guarded`);
  }
});
