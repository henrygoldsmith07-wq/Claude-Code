'use strict';

const { spawnSync } = require('child_process');

// On Windows, Node refuses to spawn .cmd/.bat shims (npm, npx, tsc, yarn…)
// without a shell since the 2024 CVE fix — the spawn fails with ENOENT and
// `status` comes back null. Retry those through cmd.exe with quoting.
function needsShell(cmd) {
  if (process.platform !== 'win32') return false;
  return /\.(cmd|bat)$/i.test(cmd) || ['npm', 'npx', 'yarn', 'pnpm', 'bun', 'tsc', 'eslint', 'prettier'].includes(cmd);
}

function runCommand(argv) {
  const [cmd, ...args] = argv;
  let result = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  if ((result.error || result.status === null) && needsShell(cmd)) {
    const quote = (a) => (/\s|"/.test(a) ? `"${a.replace(/"/g, '""')}"` : a);
    result = spawnSync('cmd.exe', ['/d', '/s', '/c', [cmd, ...args].map(quote).join(' ')], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 64,
    });
  }
  if (result.error) {
    // Previously a failed spawn produced empty output + exit 1 with zero
    // diagnostics; surface what actually went wrong.
    console.error(`[rtk] failed to spawn "${cmd}": ${result.error.message}`);
    return { output: '', exitCode: 127 };
  }
  // Normalize stdout to end with a newline before appending stderr — gluing
  // them together corrupted line-based parsing when stdout had no trailing \n.
  const stdout = result.stdout ? String(result.stdout).replace(/\n?$/, '\n') : '';
  const output = stdout + (result.stderr || '');
  const exitCode = result.status === null ? 1 : result.status;
  return { output, exitCode };
}

module.exports = { runCommand };
