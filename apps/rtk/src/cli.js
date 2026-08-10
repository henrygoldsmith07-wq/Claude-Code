'use strict';

const { runCommand } = require('./run');
const { truncate } = require('./truncate');
const { record, load, formatGain } = require('./stats');
const { init } = require('./init');
const { pickParser } = require('./parsers');
const { redact } = require('./redact');
const { writeRaw } = require('./raw');
const { explainLines, formatExplain } = require('./explain');
const { loadConfig, VALID_LEVELS } = require('./config');
const { applyStructural } = require('./structural');
const { completionScript } = require('./completion');

const VERSION = '0.2.0';

function commandLabel(argv) {
  return argv.slice(0, 2).join(' ') || argv[0];
}

function parseFlags(argv) {
  const flags = { json: false, explain: false, raw: false, redact: true, stats: false, stdin: false, level: null, aggressive: false, conservative: false, balanced: false };
  const rest = [];
  for (const a of argv) {
    if (a === '--json') flags.json = true;
    else if (a === '--explain') flags.explain = true;
    else if (a === '--raw') flags.raw = true;
    else if (a === '--no-redact') flags.redact = false;
    else if (a === '--stats') flags.stats = true;
    else if (a === '--stdin') flags.stdin = true;
    else if (a === '--aggressive') flags.aggressive = true;
    else if (a === '--conservative') flags.conservative = true;
    else if (a === '--balanced') flags.balanced = true;
    else if (a.startsWith('--level=')) flags.level = a.split('=')[1];
    else rest.push(a);
  }
  return { flags, rest };
}

function printHelp() {
  console.log(`rtk v${VERSION} — cut tool-call output down to what an LLM agent actually needs

Usage:
  rtk init                          add rtk instructions to ./CLAUDE.md
  rtk err [--json] [--explain] [--raw] [--no-redact] [--stats] [--level=conservative|balanced|aggressive] [--stdin] <command>
                                    run <command>; one-line summary on success,
                                    only the failing details on failure
  rtk gain [--json]                 show cumulative token savings
  rtk completion <bash|zsh|fish>    print shell completion script
  rtk version                       print version
  rtk [--json] [--raw] [--stats] [--stdin] <command>
                                    run <command>; long output truncated (head/tail)
  echo \"\$output\" | rtk err --stdin --json   pipe mode (reads stdin instead of running a command)

Flags:
  --json        emit structured JSON { parser, rawChars, emittedChars, reductionPct, exitCode, output }
  --explain     per-line retention trace (why each line was kept or dropped)
  --raw         also write the full unfiltered output to .rtk/raw/<timestamp>__<cmd>.log
  --no-redact   disable secret redaction (default: on)
  --stats       include { rawLines, emittedLines, tokensSaved } in --json
  --level=X     aggressiveness: conservative | balanced | aggressive (also: config .rtk/config.json, env RTK_AGGRESSIVENESS)
  --aggressive / --conservative / --balanced  shorthand for --level
  --stdin       read output from stdin instead of running a command (pipe composability)

Config file (.rtk/config.json or .rtkrc.json):
  { \"aggressiveness\": \"balanced\", \"truncate\": { \"headLines\": 20 }, \"structural\": { \"json\": true, \"diff\": true, \"stack\": true, \"dedup\": true } }

Examples:
  rtk err npm test
  rtk err --json npm test
  rtk err --explain npm test
  rtk err --raw npm test
  rtk err --level=conservative npm test
  cat build.log | rtk err --stdin --json
  rtk git status
  rtk gain
  rtk gain --json

Tips:
  \u2022 Prefer \`rtk err\` for test/build commands so pass noise disappears.
  \u2022 Stats live in .rtk/stats.json (nearest ancestor or current dir); raw logs in .rtk/raw/.
  \u2022 Pipe mode and stdin/stdout make rtk composable in shell pipelines.
`);
}

function resolveLevel(flags, cfg) {
  if (flags.level && VALID_LEVELS.includes(flags.level)) return flags.level;
  if (flags.aggressive) return 'aggressive';
  if (flags.conservative) return 'conservative';
  if (flags.balanced) return 'balanced';
  return cfg.aggressiveness;
}

function main(argv) {
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

  if (sub === 'completion') {
    const shell = (restRaw[0] || '').toLowerCase();
    if (!shell || !['bash', 'zsh', 'fish'].includes(shell)) {
      console.error('Usage: rtk completion <bash|zsh|fish>');
      process.exitCode = 1;
      return;
    }
    process.stdout.write(completionScript(shell));
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

  // Config and level resolution
  const cwd = process.cwd();
  const { config: baseConfig } = loadConfig(cwd);
  // allow global level flags to override
  const effLevel = resolveLevel(globalFlags, baseConfig);

  if (sub === 'err') {
    const { flags, rest } = parseFlags(restRaw);
    if (globalFlags.json) flags.json = true;
    if (globalFlags.raw) flags.raw = true;
    if (globalFlags.explain) flags.explain = true;
    if (!globalFlags.redact) flags.redact = false;
    if (globalFlags.stats) flags.stats = true;
    if (globalFlags.stdin) flags.stdin = true;
    if (globalFlags.aggressive) flags.aggressive = true;
    if (globalFlags.conservative) flags.conservative = true;
    if (globalFlags.balanced) flags.balanced = true;
    if (globalFlags.level) flags.level = globalFlags.level;

    const finalLevel = resolveLevel(flags, { aggressiveness: effLevel });
    // rebuild effective config with final level
    const { config } = loadConfig(cwd);
    config.aggressiveness = finalLevel;
    // re-apply level tuning if not already
    if (finalLevel === 'conservative') {
      config.truncate.headLines = Math.max(config.truncate.headLines, 30);
      config.truncate.tailLines = Math.max(config.truncate.tailLines, 10);
    } else if (finalLevel === 'aggressive') {
      config.truncate.headLines = Math.min(config.truncate.headLines, 12);
      config.truncate.tailLines = Math.min(config.truncate.tailLines, 3);
    }

    let output;
    let exitCode;
    let label;

    if (flags.stdin) {
      // Pipe mode: read from stdin, exitCode 1 unless caller passes --exit-code? Default: infer from content
      const fs = require('fs');
      let stdin = '';
      if (!process.stdin.isTTY) {
        try { stdin = fs.readFileSync(0, 'utf8'); } catch { stdin = ''; }
      }
      output = stdin;
      // Heuristic exit: if output looks failed, treat as 1 so parsers keep failure lines
      exitCode = /FAIL|Error|error TS\d+|Failed to compile/i.test(output) ? 1 : 0;
      label = 'stdin';
      // Binary safety: replace null bytes
      if (output.includes('\u0000')) output = output.replace(/\u0000/g, '[NUL]');
    } else {
      if (!rest.length) {
        console.error('rtk err: missing command. Example: rtk err npm test  (or: cat log | rtk err --stdin)');
        process.exitCode = 1;
        return;
      }
      const res = runCommand(rest);
      output = res.output;
      exitCode = res.exitCode;
      label = commandLabel(rest);
      if (output.includes('\u0000')) output = output.replace(/\u0000/g, '[NUL]');
    }

    const rawChars = output.length;
    const parser = flags.stdin ? pickParser(['npm', 'test']) : pickParser(rest.length ? rest : ['npm', 'test']);
    // If stdin mode, try to be smarter: sniff output shape to pick parser
    let effectiveParser = parser;
    if (flags.stdin) {
      if (/error TS\d+/i.test(output)) effectiveParser = require('./parsers/tsc');
      else if (/Failed to compile|Compiled successfully/i.test(output)) effectiveParser = require('./parsers/next');
      else if (/FAIL|AssertionError|vitest|jest/i.test(output)) effectiveParser = require('./parsers/vitest');
    }
    const filtered = effectiveParser.filter(output, exitCode);
    // Structural pass on failure (conservative: only when exitCode != 0)
    let emitted = filtered.emitted;
    if (exitCode !== 0) {
      const lines = emitted.split('\n').filter(Boolean);
      const structured = applyStructural(lines, output, config);
      if (structured && structured.length) emitted = structured.join('\n');
    }
    let redactedCore = emitted;
    const { text: redactedText, redactions } = redact(redactedCore, { enabled: flags.redact });
    redactedCore = redactedText;

    const rawLines = output.split('\n').length;
    const emittedLines = redactedCore ? redactedCore.split('\n').length : 0;
    const tokensSaved = Math.round((rawChars - redactedCore.length) / 4);

    if (flags.explain && flags.json) {
      const lines = output.split('\n').filter((l) => l.length > 0);
      const explained = explainLines(lines, effectiveParser.rules || []);
      const rawInfo = flags.raw ? writeRaw(cwd, label, output) : null;
      const payload = {
        parser: effectiveParser.name,
        command: flags.stdin ? 'stdin' : rest.join(' '),
        exitCode,
        rawChars,
        emittedChars: redactedCore.length,
        reductionPct: rawChars ? Math.round((1 - redactedCore.length / rawChars) * 100) : 0,
        redacted: redactions.length > 0,
        redactions,
        rawLog: rawInfo ? rawInfo.path : null,
        output: redactedCore,
        explain: explained,
      };
      if (flags.stats) Object.assign(payload, { rawLines, emittedLines, tokensSaved, level: finalLevel });
      console.log(JSON.stringify(payload));
      record(cwd, flags.stdin ? 'stdin' : label, rawChars, redactedCore.length);
      process.exitCode = exitCode;
      return;
    }

    if (flags.explain) {
      const lines = output.split('\n').filter((l) => l.length > 0);
      const explained = explainLines(lines, effectiveParser.rules || []);
      const trace = formatExplain(explained);
      console.log(redactedCore + '\n\n' + trace);
      if (flags.stats) console.error(`[rtk] stats: raw ${rawChars} chars / ${rawLines} lines → emitted ${redactedCore.length} chars / ${emittedLines} lines (~${tokensSaved} tokens saved) level=${finalLevel}`);
      if (flags.raw) writeRaw(cwd, label, output);
      record(cwd, flags.stdin ? 'stdin' : label, rawChars, redactedCore.length);
      process.exitCode = exitCode;
      return;
    }

    const rawInfo = flags.raw ? writeRaw(cwd, label, output) : null;
    const rawPath = rawInfo ? rawInfo.path : null;

    if (flags.json) {
      const payload = {
        parser: effectiveParser.name,
        command: flags.stdin ? 'stdin' : rest.join(' '),
        exitCode,
        rawChars,
        emittedChars: redactedCore.length,
        reductionPct: rawChars ? Math.round((1 - redactedCore.length / rawChars) * 100) : 0,
        redacted: redactions.length > 0,
        redactions,
        rawLog: rawPath,
        output: redactedCore,
      };
      if (flags.stats) Object.assign(payload, { rawLines, emittedLines, tokensSaved, level: finalLevel });
      console.log(JSON.stringify(payload));
    } else {
      if (redactedCore) console.log(redactedCore);
      if (flags.stats) console.error(`[rtk] stats: ${rawChars}→${redactedCore.length} chars (${rawChars ? Math.round((1 - redactedCore.length / rawChars) * 100) : 0}% saved, ~${tokensSaved} tokens, ${rawLines}→${emittedLines} lines) level=${finalLevel}`);
      if (rawPath) console.error(`[rtk] raw log: ${rawPath}`);
    }
    record(cwd, flags.stdin ? 'stdin' : label, rawChars, redactedCore.length);
    process.exitCode = exitCode;
    return;
  }

  // Plain `rtk <command>` — truncate (+ stdin pipe)
  const commandArgv = afterGlobal;
  // If --stdin and no command, read stdin as truncate source
  if (globalFlags.stdin && !commandArgv.length) {
    const fs = require('fs');
    let stdin = '';
    if (!process.stdin.isTTY) { try { stdin = fs.readFileSync(0, 'utf8'); } catch { stdin = ''; } }
    if (stdin.includes('\u0000')) stdin = stdin.replace(/\u0000/g, '[NUL]');
    const { emitted: truncated, truncated: didTruncate } = truncate(stdin, baseConfig.truncate);
    const { text: redacted, redactions } = redact(truncated, { enabled: globalFlags.redact });
    const rawInfo = globalFlags.raw ? writeRaw(cwd, 'stdin', stdin) : null;
    if (globalFlags.json) {
      console.log(JSON.stringify({ parser: 'truncate', command: 'stdin', exitCode: 0, rawChars: stdin.length, emittedChars: redacted.length, truncated: didTruncate, redacted: redactions.length > 0, redactions, rawLog: rawInfo ? rawInfo.path : null, output: redacted }));
    } else {
      process.stdout.write(redacted.endsWith('\n') ? redacted : `${redacted}\n`);
      if (rawInfo) console.error(`[rtk] raw log: ${rawInfo.path}`);
      if (globalFlags.stats) console.error(`[rtk] stats: ${stdin.length}→${redacted.length} chars`);
    }
    record(cwd, 'stdin', stdin.length, redacted.length);
    return;
  }
  if (!commandArgv.length) {
    printHelp();
    return;
  }
  const mergeJson = globalFlags.json;
  const mergeRaw = globalFlags.raw;
  const mergeRedact = globalFlags.redact;
  const wantStats = globalFlags.stats;

  const { output, exitCode } = runCommand(commandArgv);
  let safeOutput = output.includes('\u0000') ? output.replace(/\u0000/g, '[NUL]') : output;
  const { emitted: truncated, truncated: didTruncate } = truncate(safeOutput, baseConfig.truncate);
  const { text: redacted, redactions } = redact(truncated, { enabled: mergeRedact });
  const emitted = redacted;
  const rawInfo = mergeRaw ? writeRaw(cwd, commandLabel(commandArgv), safeOutput) : null;
  const rawPath = rawInfo ? rawInfo.path : null;

  if (mergeJson) {
    const payload = { parser: 'truncate', command: commandArgv.join(' '), exitCode, rawChars: safeOutput.length, emittedChars: emitted.length, truncated: didTruncate, redacted: redactions.length > 0, redactions, rawLog: rawPath, output: emitted };
    if (wantStats) Object.assign(payload, { rawLines: safeOutput.split('\n').length, emittedLines: emitted.split('\n').length, tokensSaved: Math.round((safeOutput.length - emitted.length) / 4), level: effLevel });
    console.log(JSON.stringify(payload));
  } else {
    process.stdout.write(emitted.endsWith('\n') ? emitted : `${emitted}\n`);
    if (wantStats) console.error(`[rtk] stats: ${safeOutput.length}→${emitted.length} chars (~${Math.round((safeOutput.length - emitted.length) / 4)} tokens saved)`);
    if (rawPath) console.error(`[rtk] raw log: ${rawPath}`);
  }
  record(cwd, commandLabel(commandArgv), safeOutput.length, emitted.length);
  process.exitCode = exitCode;
}

module.exports = { main, commandLabel, VERSION, parseFlags };
