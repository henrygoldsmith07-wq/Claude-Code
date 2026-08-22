'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = '<!-- rtk:init -->';
const SNIPPET = `
${MARKER}
## Token-saving commands (rtk)
Route noisy or log-heavy commands through \`rtk\` instead of running them directly:
- Tests/builds: \`rtk err <command>\` — one line on success, only failing details on failure (15+ parsers: vitest/jest, tsc, next, eslint, pytest, ruff, mypy, cargo, go test, gradle/maven, docker, k8s, terraform, npm/yarn/pnpm, git, GHA).
- Anything else verbose (git, find, grep, cat, ls, etc.): \`rtk <command>\` — same output, long runs truncated.
- Pipe mode: \`cat log | rtk err --stdin --json\` or \`rtk err --stdin < log\` — composable in shell pipelines, streaming-safe.
- Config: \`.rtk/config.json\` or \`.rtkrc.json\` (repo-local) and \`~/.config/rtk/config.json\` (global). Keys: \`aggressiveness\` (conservative|balanced|aggressive), \`contextWindow\` (0-10), \`preset\` (claude-code|codex|cursor), \`preservation\` (user file:line patterns that are never dropped).
- Agent presets: \`rtk err --preset=claude-code\` (also \`RTK_PRESET\` env or \`config.preset\`) tunes defaults for Claude Code vs Codex etc.
- Dry-run: \`rtk err --dry-run <command>\` shows parser/level/preset without running.
- Tokens: \`rtk gain\` and \`rtk err --stats --json\` report tokenizer-accurate tokens (o200k_base when js-tiktoken installed) + $ saved.
- Completion: \`rtk completion <bash|zsh|fish>\` — also supports \`--preset\`, \`--context-window\`, \`--dry-run\`, \`--otel\`.
Run \`rtk gain\` any time to see cumulative token savings. Claude Code / Codex / Freebuff: this repo prefers \`rtk err\` for test/build tool calls and \`rtk\` for verbose listings — stats in \`.rtk/stats.json\`, raw logs in \`.rtk/raw/\`.
`;

function ensureGitignore(cwd) {
  const giPath = path.join(cwd, '.gitignore');
  try {
    const content = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
    const lines = content.split('\n').map((l) => l.trim());
    if (!lines.includes('.rtk/')) {
      // `--raw` writes full UNREDACTED output into .rtk/raw/ — a fresh clone
      // of an initialized repo must never commit that.
      fs.writeFileSync(giPath, content + (content.endsWith('\n') || !content ? '' : '\n') + '.rtk/\n');
      return true;
    }
  } catch {}
  return false;
}

function init(cwd) {
  let failed = false;
  try {
    fs.mkdirSync(path.join(cwd, '.rtk'), { recursive: true });
    const configPath = path.join(cwd, '.rtk', 'config.json');
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({ aggressiveness: 'balanced', contextWindow: 2, structural: { json: true, diff: true, stack: true, dedup: true, ndjson: true, xml: true, sarif: true, annotations: true } }, null, 2));
    }
  } catch (e) {
    console.error(`[rtk] could not write .rtk/config: ${e.message}`);
    failed = true;
  }
  // Also ensure .rtk/plugins dir exists (for plugin discovery)
  try { fs.mkdirSync(path.join(cwd, '.rtk', 'plugins'), { recursive: true }); } catch {}

  if (ensureGitignore(cwd)) console.log('[ok] Added .rtk/ to .gitignore');

  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  let content = '';
  try {
    content = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';
  } catch {}
  if (content.includes(MARKER)) {
    console.log('[ok] rtk already initialized (CLAUDE.md unchanged, config ensured)');
    if (failed) process.exitCode = 1;
    return;
  }
  try {
    fs.writeFileSync(claudeMdPath, content + SNIPPET);
    console.log('[ok] Added rtk instructions to CLAUDE.md');
  } catch (e) {
    // CLAUDE.md may exist as a directory or the tree may be read-only —
    // previously this crashed with a raw stack trace after partial setup.
    console.error(`[rtk] failed to update CLAUDE.md: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  // Native integrations: Codex + Freebuff hints (AGENTS.md)
  const agentsPath = path.join(cwd, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    try { fs.writeFileSync(agentsPath, `# Agents\n\nThis repo uses \`rtk\` for token-saving tool calls. See \`CLAUDE.md\` rtk section.\n`); } catch {}
  }
  const codexPath = path.join(cwd, '.codex', 'config.toml');
  try {
    if (!fs.existsSync(codexPath)) {
      fs.mkdirSync(path.join(cwd, '.codex'), { recursive: true });
      fs.writeFileSync(codexPath, '# Codex — prefer rtk for test/build tool calls\n# rtk err npm test  # filtered\n# rtk err --json --stats npm test  # machine-readable\n');
    }
  } catch {}
  if (failed) process.exitCode = 1;
}

module.exports = { init, MARKER };
