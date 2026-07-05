'use strict';

const { runCommand } = require('./run');
const { filterErr } = require('./filter');
const { truncate } = require('./truncate');
const { record, load, formatGain } = require('./stats');
const { init } = require('./init');

function commandLabel(argv) {
  return argv.slice(0, 2).join(' ') || argv[0];
}

function printHelp() {
  console.log(`rtk — cut tool-call output down to what an LLM agent actually needs

Usage:
  rtk init          add rtk usage instructions to ./CLAUDE.md
  rtk err <command> run <command>; print a one-line summary on success,
                    only the failing details on failure
  rtk gain          show cumulative token savings across all commands run
  rtk <command>     run <command>; long output is truncated (head/tail)

Examples:
  rtk err npm test
  rtk git status
  rtk find . -name "*.js"
`);
}

function main(argv) {
  const [sub, ...rest] = argv;

  if (!sub || sub === '--help' || sub === '-h') {
    printHelp();
    return;
  }

  if (sub === 'init') {
    init(process.cwd());
    return;
  }

  if (sub === 'gain') {
    console.log(formatGain(load(process.cwd())));
    return;
  }

  if (sub === 'err') {
    if (!rest.length) {
      printHelp();
      process.exitCode = 1;
      return;
    }
    const { output, exitCode } = runCommand(rest);
    const { emitted, rawChars, emittedChars } = filterErr(output, exitCode);
    console.log(emitted);
    record(process.cwd(), commandLabel(rest), rawChars, emittedChars);
    process.exitCode = exitCode;
    return;
  }

  const { output, exitCode } = runCommand(argv);
  const { emitted } = truncate(output);
  process.stdout.write(emitted.endsWith('\n') ? emitted : `${emitted}\n`);
  record(process.cwd(), commandLabel(argv), output.length, emitted.length);
  process.exitCode = exitCode;
}

module.exports = { main, commandLabel };
