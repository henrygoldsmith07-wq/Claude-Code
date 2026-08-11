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

const VERSION = '0.3.0';

function commandLabel(argv) {
  return argv.slice(0, 2).join(' ') || argv[0];
}

function parseFlags(argv) {
  const flags = {
    json: false, explain: false, raw: false, redact: true, stats: false, stdin: false,
    level: null, aggressive: false, conservative: false, balanced: false,
    dryRun: false, preset: null, contextWindow: null, otel: false,
  };
  const rest = [];
  for (const a of argv) {
    if (a === '--json') flags.json = true;
    else if (a === '--explain') flags.explain = true;
    else if (a === '--raw') flags.raw = true;
    else if (a === '--no-redact') flags.redact = false;
    else if (a === '--stats') flags.stats = true;
    else if (a === '--stdin') flags.stdin = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--otel') flags.otel = true;
    else if (a === '--aggressive') flags.aggressive = true;
    else if (a === '--conservative') flags.conservative = true;
    else if (a === '--balanced') flags.balanced = true;
    else if (a.startsWith('--level=')) flags.level = a.split('=')[1];
    else if (a.startsWith('--preset=')) flags.preset = a.split('=')[1];
    else if (a.startsWith('--context-window=')) flags.contextWindow = parseInt(a.split('=')[1], 10);
    else if (a.startsWith('--window=')) flags.contextWindow = parseInt(a.split('=')[1], 10);
    else rest.push(a);
  }
  return { flags, rest };
}

function printHelp() {
  console.log(`rtk v${VERSION} — cut tool-call tokens, keep the signal

Usage:
  rtk init                          add rtk instructions to ./CLAUDE.md
  rtk err [--json] [--explain] [--raw] [--no-redact] [--stats] [--level=...] [--preset=...] [--dry-run] [--stdin] <command>
                                    run <command>; one-line summary on success, only failing details on failure
  rtk gain [--json]                 show cumulative token savings (tokenizer-accurate + cost)
  rtk completion <bash|zsh|fish>    print shell completion script
  rtk version                       print version
  rtk [--json] [--raw] [--stats] [--stdin] <command>
                                    run <command>; long output truncated (head/tail)
  echo \"\\$output\" | rtk err --stdin --json   pipe mode

Flags:
  --json        structured JSON { parser, rawChars, emittedChars, tokens, reductionPct, exitCode, output }
  --explain     per-line retention trace (why each line was kept or dropped) — richer with scores
  --raw         also write full unfiltered output to .rtk/raw/<timestamp>__<cmd>.log
  --no-redact   disable secret redaction (default: on)
  --stats       include { rawLines, emittedLines, tokens, tokensSaved, costSaved, latencyMs } in --json
  --level=X     conservative | balanced | aggressive (also: .rtk/config.json, env RTK_AGGRESSIVENESS)
  --aggressive / --conservative / --balanced  shorthand for --level
  --stdin       read output from stdin instead of running a command
  --dry-run     show what rtk would do without running the command
  --preset=X    agent preset: claude-code | codex | cursor | generic (also: env RTK_PRESET, config.preset)
  --context-window=N  lines of context around each error (also: config.contextWindow, env RTK_CONTEXT_WINDOW)
  --otel        force OTel/metrics emission for this run (also: config.otel.enabled, env OTEL_EXPORTER_OTLP_ENDPOINT)

Config file (.rtk/config.json or .rtkrc.json, also ~/.config/rtk/config.json):
  { \"aggressiveness\": \"balanced\", \"contextWindow\": 2, \"preset\": \"claude-code\",
    \"truncate\": { \"headLines\": 20 }, \"structural\": { \"json\": true, \"ndjson\": true, \"xml\": true, \"sarif\": true },
    \"preservation\": [{ \"pattern\": \"my-error\", \"reason\": \"keep my errors\" }], \"plugins\": [\"./my-parser.js\"] }

Examples:
  rtk err npm test
  rtk err --json --stats npm test
  rtk err --explain npm test
  rtk err --dry-run npm test
  rtk err --preset=codex --context-window=3 npm test
  cat build.log | rtk err --stdin --json
  rtk gain --json

Tips:
  • Prefer \`rtk err\` for test/build commands so pass noise disappears.
  • Stats live in .rtk/stats.json (nearest ancestor or current dir); raw logs in .rtk/raw/.
  • Token counts use js-tiktoken o200k_base (≈ GPT-4o) when installed, else chars/4 fallback.
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
    // Enrich with tokenizer info when --json
    if (wantJson) {
      try {
        const { encodingName, costForTokens } = require('./tokens');
        const enc = encodingName();
        // add cost summary
        let totalRaw = 0, totalEmitted = 0;
        for (const v of Object.values(data.commands)) { totalRaw += v.rawChars || 0; totalEmitted += v.emittedChars || 0; }
        const savedTokensApprox = Math.round((totalRaw - totalEmitted) / 4);
        data.tokenizer = enc;
        data.costSaved = { gpt4o: costForTokens(savedTokensApprox, 'gpt-4o'), generic: costForTokens(savedTokensApprox, 'generic') };
      } catch {}
      console.log(JSON.stringify(data, null, 2));
    } else console.log(formatGain(data));
    return;
  }

  // Config and level resolution
  const cwd = process.cwd();
  let { config: baseConfig } = loadConfig(cwd);
  // Preset resolution (flag > env > config)
  try {
    const { resolvePreset, applyPreset } = require('./presets');
    const presetName = globalFlags.preset || process.env.RTK_PRESET || baseConfig.preset;
    const preset = resolvePreset(presetName, process.env.RTK_PRESET, baseConfig.preset);
    if (preset) baseConfig = applyPreset(baseConfig, preset);
  } catch {}
  // Context window override
  if (globalFlags.contextWindow != null && !isNaN(globalFlags.contextWindow)) {
    baseConfig.contextWindow = Math.max(0, Math.min(10, Math.round(globalFlags.contextWindow)));
  }
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
    if (globalFlags.dryRun) flags.dryRun = true;
    if (globalFlags.preset) flags.preset = globalFlags.preset;
    if (globalFlags.contextWindow != null) flags.contextWindow = globalFlags.contextWindow;
    if (globalFlags.otel) flags.otel = true;

    let finalLevel = resolveLevel(flags, { aggressiveness: effLevel });
    let { config } = loadConfig(cwd);
    // apply preset again for err subcommand
    try {
      const { resolvePreset, applyPreset } = require('./presets');
      const presetName = flags.preset || globalFlags.preset || process.env.RTK_PRESET || config.preset;
      const preset = resolvePreset(presetName, process.env.RTK_PRESET, config.preset);
      if (preset) config = applyPreset(config, preset);
    } catch {}
    if (flags.contextWindow != null && !isNaN(flags.contextWindow)) config.contextWindow = Math.max(0, Math.min(10, Math.round(flags.contextWindow)));
    config.aggressiveness = finalLevel;
    if (finalLevel === 'conservative') {
      config.truncate.headLines = Math.max(config.truncate.headLines, 30);
      config.truncate.tailLines = Math.max(config.truncate.tailLines, 10);
    } else if (finalLevel === 'aggressive') {
      config.truncate.headLines = Math.min(config.truncate.headLines, 12);
      config.truncate.tailLines = Math.min(config.truncate.tailLines, 3);
    }
    // OTel flag
    if (flags.otel) config.otel = { ...(config.otel || {}), enabled: true };

    // Dry-run: do not execute
    if (flags.dryRun) {
      const proposedParser = pickParser(flags.stdin ? ['npm', 'test'] : (rest.length ? rest : ['npm', 'test']), null);
      const payload = {
        dryRun: true,
        parser: proposedParser.name,
        level: finalLevel,
        contextWindow: config.contextWindow,
        preset: config.preset || null,
        command: flags.stdin ? 'stdin' : (rest.join(' ') || '(no command)'),
        configPath: loadConfig(cwd).path,
        wouldRedact: flags.redact,
        wouldWriteRaw: flags.raw,
      };
      if (flags.json) console.log(JSON.stringify(payload, null, 2));
      else {
        console.log(`[rtk dry-run] parser=${payload.parser} level=${payload.level} preset=${payload.preset || 'none'} contextWindow=${payload.contextWindow}`);
        console.log(`[rtk dry-run] command: ${payload.command}`);
        if (payload.configPath) console.log(`[rtk dry-run] config: ${payload.configPath}`);
        console.log(`[rtk dry-run] redact=${payload.wouldRedact} raw=${payload.wouldWriteRaw}`);
      }
      return;
    }

    let output;
    let exitCode;
    let label;
    const startMs = Date.now();

    if (flags.stdin) {
      const fs = require('fs');
      let stdin = '';
      if (!process.stdin.isTTY) {
        try { stdin = fs.readFileSync(0, 'utf8'); } catch { stdin = ''; }
      }
      output = stdin;
      exitCode = /FAIL|Error|error TS\d+|Failed to compile|::error::|BUILD (FAILURE|FAILED)/i.test(output) ? 1 : 0;
      label = 'stdin';
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

    // ANSI stripping + safe decode before parsing (preserves error lines)
    try {
      const { stripAnsi, safeDecode } = require('./ansi');
      output = safeDecode(output);
      // Keep original for raw logs; stripped version for parsing
      var outputStripped = stripAnsi(output);
    } catch { var outputStripped = output; }

    const rawChars = outputStripped.length;
    let parser = flags.stdin ? pickParser(['npm', 'test'], outputStripped) : pickParser(rest.length ? rest : ['npm', 'test'], outputStripped);
    let effectiveParser = parser;
    if (flags.stdin) {
      // pickParser already sniffed; keep it
      effectiveParser = parser;
    }
    // Plugin override: if any plugin matches argv, prefer it
    let pluginParser = null;
    try {
      const { loadPlugins } = require('./plugins');
      const plugins = loadPlugins(cwd, config);
      for (const p of plugins) {
        if (typeof p.detect === 'function' && p.detect(flags.stdin ? ['stdin'] : rest, outputStripped)) { pluginParser = p; break; }
        if (!p.detect && p.name && outputStripped.includes(p.name)) { pluginParser = p; break; }
      }
      if (pluginParser) effectiveParser = pluginParser;
    } catch {}

    // User preservation rules: augment effectiveParser.rules for explain and also ensure filtering keeps them
    let preservationRules = [];
    try {
      const { loadPreservationRules } = require('./plugins');
      preservationRules = loadPreservationRules(cwd, config);
    } catch {}

    // Tokenizer + latency
    let countTokens, encodingName, costForTokens;
    try { ({ countTokens, encodingName, costForTokens } = require('./tokens')); } catch { countTokens = (s)=>Math.round(String(s).length/4); encodingName=()=>'chars/4'; costForTokens=()=>0; }
    const rawTokens = countTokens(outputStripped);

    // Filter
    let filtered;
    try {
      const maxLines = (config.parsers[effectiveParser.name] && config.parsers[effectiveParser.name].maxLines) || 60;
      filtered = effectiveParser.filter(outputStripped, exitCode, { maxLines, contextWindow: config.contextWindow, preservationRules });
    } catch (e) {
      filtered = { emitted: outputStripped.split('\n').slice(-30).join('\n'), parser: effectiveParser.name };
    }
    let emitted = filtered.emitted;
    // Structural pass on failure: use original stripped output for document-level transforms
    if (exitCode !== 0) {
      const lines = emitted.split('\n').filter(Boolean);
      const structured = applyStructural(lines, outputStripped, config);
      if (structured && structured.length) emitted = structured.join('\n');
    }
    // Also ensure preservation rules are applied post-structural: if any preservation line was dropped, add it
    if (preservationRules.length && exitCode !== 0) {
      const emittedSet = new Set(emitted.split('\n').map(l=>l.trim()));
      const missing = [];
      const srcLines = outputStripped.split('\n');
      for (const r of preservationRules) {
        for (const line of srcLines) if (r.re.test(line) && !emittedSet.has(line.trim())) missing.push(line);
      }
      if (missing.length) emitted = emitted + '\n' + missing.slice(0, 20).join('\n');
    }

    // Context window expansion via prioritize (causal context)
    if (config.contextWindow > 0 && exitCode !== 0) {
      try {
        const { prioritizeLines } = require('./prioritize');
        const srcLines = outputStripped.split('\n');
        // Build keep set from emitted lines
        const emittedSet = new Set(emitted.split('\n').map(l=>l.trim()).filter(Boolean));
        const keepIdx = new Set();
        srcLines.forEach((l, i) => { if (emittedSet.has(l.trim())) keepIdx.add(i); });
        if (keepIdx.size) {
          const { withContext } = require('./prioritize');
          const expanded = withContext(srcLines, keepIdx, config.contextWindow);
          // Only expand if not already huge
          if (expanded.length <= (config.parsers[effectiveParser.name]?.maxLines || 60) * 1.2) {
            emitted = expanded.map(i=>srcLines[i]).join('\n');
          }
        }
      } catch {}
    }

    let redactedCore = emitted;
    const { text: redactedText, redactions } = redact(redactedCore, { enabled: flags.redact });
    redactedCore = redactedText;

    const rawLines = outputStripped.split('\n').length;
    const emittedLines = redactedCore ? redactedCore.split('\n').length : 0;
    const emittedTokens = countTokens(redactedCore);
    const tokensSaved = Math.max(0, rawTokens - emittedTokens);
    const costSaved = costForTokens ? costForTokens(tokensSaved, 'gpt-4o') : 0;
    const latencyMs = Date.now() - startMs;
    const tokenizer = encodingName ? encodingName() : 'chars/4';

    // OTel emission
    try {
      const { emitMetrics } = require('./otel');
      emitMetrics({ cwd, parser: effectiveParser.name, rawChars, emittedChars: redactedCore.length, tokensSaved, durationMs: latencyMs, exitCode, config });
    } catch {}

    if (flags.explain && flags.json) {
      const lines = outputStripped.split('\n').filter((l) => l.length > 0);
      let explained = explainLines(lines, (effectiveParser.rules || []).concat(preservationRules.map(r=>({re:r.re, keep:r.keep, reason:r.reason}))));
      // Enrich explain with semantic scores when available
      try {
        const { scoreLine } = require('./prioritize');
        explained = explained.map(e => ({ ...e, score: scoreLine(e.line) }));
      } catch {}
      const rawInfo = flags.raw ? writeRaw(cwd, label, output) : null;
      const payload = {
        parser: effectiveParser.name,
        command: flags.stdin ? 'stdin' : rest.join(' '),
        exitCode,
        rawChars,
        emittedChars: redactedCore.length,
        reductionPct: rawChars ? Math.round((1 - redactedCore.length / rawChars) * 100) : 0,
        rawTokens,
        emittedTokens,
        tokensSaved,
        costSaved,
        costSavedFormatted: costForTokens ? require('./tokens').formatCost(costSaved) : undefined,
        tokenizer,
        latencyMs,
        latencyFormatted: `${latencyMs}ms`,
        contextWindow: config.contextWindow,
        preset: config.preset || null,
        redacted: redactions.length > 0,
        redactions,
        rawLog: rawInfo ? rawInfo.path : null,
        output: redactedCore,
        explain: explained,
      };
      if (flags.stats) Object.assign(payload, { rawLines, emittedLines, level: finalLevel });
      console.log(JSON.stringify(payload));
      record(cwd, flags.stdin ? 'stdin' : label, rawChars, redactedCore.length);
      process.exitCode = exitCode;
      return;
    }

    if (flags.explain) {
      const lines = outputStripped.split('\n').filter((l) => l.length > 0);
      let explained = explainLines(lines, (effectiveParser.rules || []).concat(preservationRules.map(r=>({re:r.re, keep:r.keep, reason:r.reason}))));
      try {
        const { scoreLine } = require('./prioritize');
        explained = explained.map(e => ({ ...e, score: scoreLine(e.line) }));
      } catch {}
      const trace = formatExplain(explained);
      console.log(redactedCore + '\n\n' + trace);
      if (flags.stats) console.error(`[rtk] stats: raw ${rawChars} chars / ${rawLines} lines → emitted ${redactedCore.length} chars / ${emittedLines} lines (~${tokensSaved} tokens saved, ${require('./tokens').formatCost ? require('./tokens').formatCost(costSaved) : ''}) level=${finalLevel} preset=${config.preset||'none'} window=${config.contextWindow} tok=${tokenizer} ${latencyMs}ms`);
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
        rawTokens,
        emittedTokens,
        tokensSaved,
        costSaved,
        tokenizer,
        latencyMs,
        contextWindow: config.contextWindow,
        preset: config.preset || null,
        redacted: redactions.length > 0,
        redactions,
        rawLog: rawPath,
        output: redactedCore,
      };
      if (flags.stats) Object.assign(payload, { rawLines, emittedLines, tokensSaved, costSaved, tokenizer, latencyMs, level: finalLevel });
      console.log(JSON.stringify(payload));
    } else {
      if (redactedCore) console.log(redactedCore);
      if (flags.stats) console.error(`[rtk] stats: ${rawChars}→${redactedCore.length} chars (${rawChars ? Math.round((1 - redactedCore.length / rawChars) * 100) : 0}% saved, ~${tokensSaved} tokens ${tokenizer}, ${require('./tokens').formatCost ? require('./tokens').formatCost(costSaved) : ''} saved, ${rawLines}→${emittedLines} lines, ${latencyMs}ms) level=${finalLevel}`);
      if (rawPath) console.error(`[rtk] raw log: ${rawPath}`);
    }
    record(cwd, flags.stdin ? 'stdin' : label, rawChars, redactedCore.length);
    process.exitCode = exitCode;
    return;
  }

  // Plain `rtk <command>` — truncate (+ stdin pipe)
  const commandArgv = afterGlobal;
  if (globalFlags.stdin && !commandArgv.length) {
    const fs = require('fs');
    let stdin = '';
    if (!process.stdin.isTTY) { try { stdin = fs.readFileSync(0, 'utf8'); } catch { stdin = ''; } }
    if (stdin.includes('\u0000')) stdin = stdin.replace(/\u0000/g, '[NUL]');
    try { const { stripAnsi, safeDecode } = require('./ansi'); stdin = safeDecode(stripAnsi(stdin)); } catch {}
    const { emitted: truncated, truncated: didTruncate } = truncate(stdin, baseConfig.truncate);
    const { text: redacted, redactions } = redact(truncated, { enabled: globalFlags.redact });
    const rawInfo = globalFlags.raw ? writeRaw(cwd, 'stdin', stdin) : null;
    let countTokens, encodingName;
    try { ({ countTokens, encodingName } = require('./tokens')); } catch { countTokens = (s)=>Math.round(String(s).length/4); encodingName=()=>'chars/4'; }
    const rawTokens = countTokens(stdin);
    const emittedTokens = countTokens(redacted);
    if (globalFlags.json) {
      console.log(JSON.stringify({ parser: 'truncate', command: 'stdin', exitCode: 0, rawChars: stdin.length, emittedChars: redacted.length, rawTokens, emittedTokens, tokensSaved: Math.max(0, rawTokens-emittedTokens), tokenizer: encodingName(), truncated: didTruncate, redacted: redactions.length > 0, redactions, rawLog: rawInfo ? rawInfo.path : null, output: redacted }));
    } else {
      process.stdout.write(redacted.endsWith('\n') ? redacted : `${redacted}\n`);
      if (rawInfo) console.error(`[rtk] raw log: ${rawInfo.path}`);
      if (globalFlags.stats) console.error(`[rtk] stats: ${stdin.length}→${redacted.length} chars (~${Math.max(0, rawTokens-emittedTokens)} tokens ${encodingName()} saved)`);
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
  if (globalFlags.dryRun) {
    const payload = { dryRun: true, parser: 'truncate', level: effLevel, command: commandArgv.join(' '), configPath: loadConfig(cwd).path };
    if (mergeJson) console.log(JSON.stringify(payload, null, 2));
    else console.log(`[rtk dry-run] truncate level=${effLevel} command: ${payload.command}`);
    return;
  }

  const { output, exitCode } = runCommand(commandArgv);
  let safeOutput = output.includes('\u0000') ? output.replace(/\u0000/g, '[NUL]') : output;
  try { const { stripAnsi, safeDecode } = require('./ansi'); safeOutput = safeDecode(stripAnsi(safeOutput)); } catch {}
  const { emitted: truncated, truncated: didTruncate } = truncate(safeOutput, baseConfig.truncate);
  const { text: redacted, redactions } = redact(truncated, { enabled: mergeRedact });
  const emitted = redacted;
  const rawInfo = mergeRaw ? writeRaw(cwd, commandLabel(commandArgv), safeOutput) : null;
  const rawPath = rawInfo ? rawInfo.path : null;

  if (mergeJson) {
    let countTokens, encodingName;
    try { ({ countTokens, encodingName } = require('./tokens')); } catch { countTokens=(s)=>Math.round(String(s).length/4); encodingName=()=>'chars/4'; }
    const rawTokens = countTokens(safeOutput);
    const emittedTokens = countTokens(emitted);
    const payload = { parser: 'truncate', command: commandArgv.join(' '), exitCode, rawChars: safeOutput.length, emittedChars: emitted.length, rawTokens, emittedTokens, tokensSaved: Math.max(0, rawTokens-emittedTokens), tokenizer: encodingName(), truncated: didTruncate, redacted: redactions.length > 0, redactions, rawLog: rawPath, output: emitted };
    if (wantStats) Object.assign(payload, { rawLines: safeOutput.split('\n').length, emittedLines: emitted.split('\n').length, tokensSaved: Math.max(0, rawTokens-emittedTokens), level: effLevel });
    console.log(JSON.stringify(payload));
  } else {
    process.stdout.write(emitted.endsWith('\n') ? emitted : `${emitted}\n`);
    if (wantStats) {
      let ct, en;
      try { ({ countTokens: ct, encodingName: en } = require('./tokens')); } catch { ct=(s)=>Math.round(String(s).length/4); en=()=>'chars/4'; }
      const saved = Math.max(0, ct(safeOutput)-ct(emitted));
      console.error(`[rtk] stats: ${safeOutput.length}→${emitted.length} chars (~${saved} tokens ${en()} saved)`);
    }
    if (rawPath) console.error(`[rtk] raw log: ${rawPath}`);
  }
  record(cwd, commandLabel(commandArgv), safeOutput.length, emitted.length);
  process.exitCode = exitCode;
}

module.exports = { main, commandLabel, VERSION, parseFlags };
