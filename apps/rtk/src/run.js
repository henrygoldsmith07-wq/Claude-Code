'use strict';

const { spawnSync } = require('child_process');

function runCommand(argv) {
  const [cmd, ...args] = argv;
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  const output = (result.stdout || '') + (result.stderr || '');
  const exitCode = result.status === null ? 1 : result.status;
  return { output, exitCode };
}

module.exports = { runCommand };
