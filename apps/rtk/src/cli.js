'use strict';

const { runCommand } = require('./run');
const { truncate } = require('./truncate');
const { record, load, formatGain } = require('./stats');
const { init } = require('./init');
const { pickParser } = require('./parsers');
const { redact } = require('./redact');
const { writeRaw } = require('./raw');
const { explainLines, formatExplain } = require('./explain');

const VERSION = '0.2.0';

function commandLabel(argv) {
  return argv.slice(0, 2).join(' ') || argv[0];
}

function parseFlags(argv) {
  const flags = { json: false, explain: false, raw: false, redact: true };
  const rest = [];
  for (const a of argv) {
    if (a === '--json') flags.json = true;
    else if (a === '--explain') flags.explain = true;
    else if (a === '--raw') flags.raw = true;
    else if (a === '--no-redact') flags.redact = false;
    else rest.push(a);
  }
  return { flags, rest };
}

function printHelp() {
  console.log(`rtk v${VERSION} — cut tool-call output down to what an LLM agent actually needs

Usage:
  rtk init                          add rtk instructions to ./CLAUDE.md
  rtk err [--json] [--explain] [--raw] [--no-redact] <command>
                                    run <command>; one-line summary on success,
                                    only the failing details on failure
  rtk gain [--json]                 show cumulative token savings
  rtk version                       print version
  rtk [--json] [--raw] <command>    run <command>; long output truncated (head/tail)

Flags (rtk err / plain rtk):
  --json        emit structured JSON { parser, rawChars, emittedChars, reductionPct, exitCode, output }
  --explain     print a per-line retention trace (why each line was kept or dropped)
  --raw         also write the full unfiltered output to .rtk/raw/<timestamp>__<cmd>.log
  --no-redact   disable secret redaction (default: on)

Examples:
  rtk err npm test
  rtk err --json npm test
  rtk err --explain npm test
  rtk err --raw npm test
  rtk git status
  rtk gain
  rtk gain --json

Tips:
  • Prefer \`rtk err\` for test/build commands so pass noise disappears.
  • Stats live in .rtk/stats.json (nearest ancestor or current dir); raw logs in .rtk/raw/.
`);
}

function main(argv) {
  // 1. Global flags before subcommand: rtk --json gain, rtk --raw err ...
  const { flags: globalFlags, rest: afterGlobal } = parseFlags(argv);
  const [sub, ...restRaw] = afterGlobal;

  if (!sub || sub === '--help' || sub === '-h' || sub === 'help') {
    printHelp();
    return;
  }

  if (sub === '--version' || sub === '-v' || sub === 'version') {
    if (globalFlags.json) console.log(JSON.stringify({ version: VERSION }));
    else console.log(`rtk ${VERSION}`);
    return;
  }

  if (sub === 'init') {
    init(process.cwd());
    return;
  }

  if (sub === 'gain') {
    const wantJson = globalFlags.json || restRaw.includes('--json');
    const data = load(process.cwd());
    if (wantJson) console.log(JSON.stringify(data, null, 2));
    else console.log(formatGain(data));
    return;
  }

  if (sub === 'err') {
    const { flags, rest } = parseFlags(restRaw);
    // merge global flags
    if (globalFlags.json) flags.json = true;
    if (globalFlags.raw) flags.raw = true;
    if (globalFlags.explain) flags.explain = true;
    if (!globalFlags.redact) flags.redact = false;

    if (!rest.length) {
      console.error('rtk err: missing command. Example: rtk err npm test');
      process.exitCode = 1;
      return;
    }

    const { output, exitCode } = runCommand(rest);
    const rawChars = output.length;
    const parser = pickParser(rest);
    const filtered = parser.filter(output, exitCode);
    let emittedCore = filtered.emitted;
    const { text: redactedCore, redactions } = redact(emittedCore, { enabled: flags.redact });
    emittedCore = redactedCore;

    // --explain + --json: structured explain
    if (flags.explain && flags.json) {
      const lines = output.split('\n').filter((l) => l.length > 0);
      const explained = explainLines(lines, parser.rules || []);
      const rawInfo = flags.raw ? writeRaw(process.cwd(), commandLabel(rest), output) : null;
      console.log(JSON.stringify({
        parser: parser.name,
        command: rest.join(' '),
        exitCode,
        rawChars,
        emittedChars: filtered.emitted.length,
        reductionPct: rawChars ? Math.round((1 - filtered.emitted.length / rawChars) * 100) : 0,
        redacted: redactions.length > 0,
        redactions,
        rawLog: rawInfo ? rawInfo.path : null,
        output: filtered.emitted,
        explain: explained,
      }));
      record(process.cwd(), commandLabel(rest), rawChars, filtered.emitted.length);
      process.exitCode = exitCode;
      return;
    }

    if (flags.explain) {
      const lines = output.split('\n').filter((l) => l.length > 0);
      const explained = explainLines(lines, parser.rules || []);
      const trace = formatExplain(explained);
      console.log(emittedCore + '\n\n' + trace);
      if (flags.raw) writeRaw(process.cwd(), commandLabel(rest), output);
      record(process.cwd(), commandLabel(rest), rawChars, filtered.emitted.length);
      process.exitCode = exitCode;
      return;
    }

    const rawInfo = flags.raw ? writeRaw(process.cwd(), commandLabel(rest), output) : null;
    const rawPath = rawInfo ? rawInfo.path : null;

    if (flags.json) {
      console.log(JSON.stringify({
        parser: parser.name,
        command: rest.join(' '),
        exitCode,
        rawChars,
        emittedChars: filtered.emitted.length,
        reductionPct: rawChars ? Math.round((1 - filtered.emitted.length / rawChars) * 100) : 0,
        redacted: redactions.length > 0,
        redactions,
        rawLog: rawPath,
        output: emittedCore,
      }));
    } else {
      if (emittedCore) console.log(emittedCore);
      if (rawPath) console.error(`[rtk] raw log: ${rawPath}`);
    }
    record(process.cwd(), commandLabel(rest), rawChars, filtered.emitted.length);
    process.exitCode = exitCode;
    return;
  }

  // Plain `rtk <command>` — truncate
  const commandArgv = afterGlobal; // already flags-stripped
  if (!commandArgv.length) {
    printHelp();
    return;
  }
  const mergeJson = globalFlags.json;
  const mergeRaw = globalFlags.raw;
  const mergeRedact = globalFlags.redact;

  const { output, exitCode } = runCommand(commandArgv);
  const { emitted: truncated, truncated: didTruncate } = truncate(output);
  const { text: redacted, redactions } = redact(truncated, { enabled: mergeRedact });
  const emitted = redacted;
  const rawInfo = mergeRaw ? writeRaw(process.cwd(), commandLabel(commandArgv), output) : null;
  const rawPath = rawInfo ? rawInfo.path : null;

  if (mergeJson) {
    console.log(JSON.stringify({
      parser: 'truncate',
      command: commandArgv.join(' '),
      exitCode,
      rawChars: output.length,
      emittedChars: emitted.length,
      truncated: didTruncate,
      redacted: redactions.length > 0,
      redactions,
      rawLog: rawPath,
      output: emitted,
    }));
  } else {
    process.stdout.write(emitted.endsWith('\n') ? emitted : `${emitted}\n`);
    if (rawPath) console.error(`[rtk] raw log: ${rawPath}`);
  }
  record(process.cwd(), commandLabel(commandArgv), output.length, emitted.length);
  process.exitCode = exitCode;
}

module.exports = { main, commandLabel, VERSION, parseFlags };
