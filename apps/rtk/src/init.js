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
Run \`rtk gain\` any time to see cumulative token savings.
`;

function init(cwd) {
  fs.mkdirSync(path.join(cwd, '.rtk'), { recursive: true });

  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const content = fs.existsSync(claudeMdPath) ? fs.readFileSync(claudeMdPath, 'utf8') : '';

  if (content.includes(MARKER)) {
    console.log('[ok] rtk already initialized (CLAUDE.md unchanged)');
    return;
  }

  fs.writeFileSync(claudeMdPath, content + SNIPPET);
  console.log('[ok] Added rtk instructions to CLAUDE.md');
}

module.exports = { init, MARKER };
