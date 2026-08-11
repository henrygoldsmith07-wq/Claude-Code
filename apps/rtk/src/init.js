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

function init(cwd) {
  fs.mkdirSync(path.join(cwd, '.rtk'), { recursive: true });
  const configPath = path.join(cwd, '.rtk', 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ aggressiveness: 'balanced', contextWindow: 2, structural: { json: true, diff: true, stack: true, dedup: true, ndjson: true, xml: true, sarif: true, annotations: true } }, null, 2));
  }
  // Also ensure .rtk/plugins dir exists (for plugin discovery)
  try { fs.mkdirSync(path.join(cwd, '.rtk', 'plugins'), { recursive: true }); } catch {}

  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const content = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';
  if (content.includes(MARKER)) {
    console.log('[ok] rtk already initialized (CLAUDE.md unchanged, config ensured)');
    return;
  }
  fs.writeFileSync(claudeMdPath, content + SNIPPET);
  console.log('[ok] Added rtk instructions to CLAUDE.md');

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
}

module.exports = { init, MARKER };
