'use strict';

// Lightweight OTel/metrics hook: if OTEL_EXPORTER_OTLP_ENDPOINT or RTK_OTEL is set,
// emit a span-like JSON line to stderr or to a file. No deps, never blocks.

const fs = require('fs');
const path = require('path');

function emitMetrics({ cwd, parser, rawChars, emittedChars, tokensSaved, durationMs, exitCode, config }) {
  const enabled = !!(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.RTK_OTEL || (config && config.otel && config.otel.enabled));
  if (!enabled) return;
  const payload = {
    name: 'rtk.filter',
    timestamp: new Date().toISOString(),
    attributes: {
      'rtk.parser': parser,
      'rtk.rawChars': rawChars,
      'rtk.emittedChars': emittedChars,
      'rtk.tokensSaved': tokensSaved,
      'rtk.durationMs': durationMs,
      'rtk.exitCode': exitCode,
      'rtk.reductionPct': rawChars ? Math.round((1 - emittedChars / rawChars) * 100) : 0,
      'rtk.aggressiveness': (config && config.aggressiveness) || 'balanced',
    },
  };
  const dest = (config && config.otel && config.otel.file) || process.env.RTK_OTEL_FILE;
  const line = JSON.stringify(payload);
  if (dest) {
    try { fs.mkdirSync(path.dirname(path.resolve(cwd, dest)), { recursive: true }); fs.appendFileSync(path.resolve(cwd, dest), line + '\n'); } catch {}
  } else {
    // OTLP stub: write to stderr so collectors can scrape; do not write to stdout (that's for filtered output)
    try { process.stderr.write(`[rtk:otel] ${line}\n`); } catch {}
  }
}

module.exports = { emitMetrics };
