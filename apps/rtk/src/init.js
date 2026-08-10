'use strict';

const fs = require('fs');
const path = require('path');

const MARKER = '<!-- rtk:init -->';
const SNIPPET = `
${MARKER}
## Token-saving commands (rtk)
Route noisy or log-heavy commands through \`rtk\` instead of running them directly:
- Tests/builds: \`rtk err <command>\` — prints one line on success, only the failing details on failure.
- Anything else verbose (git, find, grep, cat, ls, etc.): \`rtk <command>\` — same output, long runs truncated.
- Pipe mode: \`cat log | rtk err --stdin --json\` or \`rtk err --stdin < log\` — composable in shell pipelines.
- Config: \`.rtk/config.json\` or \`.rtkrc.json\` with \`{ "aggressiveness": "conservative|balanced|aggressive" }\` (also \`RTK_AGGRESSIVENESS\` env).
Run \`rtk gain\` any time to see cumulative token savings. \`rtk completion <bash|zsh|fish>\` for shell completion.
Claude Code / Codex / Freebuff: this repo prefers \`rtk err\` for test/build tool calls and \`rtk\` for verbose listings — stats in \`.rtk/stats.json\`, raw logs in \`.rtk/raw/\`.
`;

function init(cwd) {
  fs.mkdirSync(path.join(cwd, '.rtk'), { recursive: true });
  // default config if missing
  const configPath = path.join(cwd, '.rtk', 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ aggressiveness: 'balanced', structural: { json: true, diff: true, stack: true, dedup: true } }, null, 2));
  }

  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const content = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';

  if (content.includes(MARKER)) {
    console.log('[ok] rtk already initialized (CLAUDE.md unchanged, config ensured)');
    return;
  }

  fs.writeFileSync(claudeMdPath, content + SNIPPET);
  console.log('[ok] Added rtk instructions to CLAUDE.md');
}

module.exports = { init, MARKER };
