'use strict';

/**
 * External-benchmark harness — pure helpers. No spawning, no filesystem.
 * Statistical machinery is reused from src/equivalence.js (Wilson, TOST,
 * McNemar); model tiers from src/providers.js; pricing from src/tokens.js.
 *
 * The harness evaluates raw-vs-RTK on independently-sourced coding-agent
 * tasks across model tiers and agent frameworks. A task may only support an
 * EXTERNAL claim when its `source` is 'independent'; anything else
 * ('internal', 'internal-sample', ...) is flagged separately and can never be
 * described as external evidence in the summary.
 */

const { wilsonInterval, tostPaired, mcnemarExact } = require('../src/equivalence');
const { MODEL_REGISTRY, TIER_ORDER } = require('../src/providers');

let COST_TABLE = {};
try { ({ COST_TABLE } = require('../src/tokens')); } catch { /* pricing optional */ }

const ARMS = ['raw', 'rtk'];
const FAILURE_TAXONOMY = ['timeout', 'crash', 'wrong-fix', 'no-fix', 'infinite-loop', 'tool-misuse', 'context-overflow', 'other'];

// ---------------------------------------------------------------------------
// Manifest validation
// ---------------------------------------------------------------------------

/**
 * Validates a tasks manifest (array or {tasks: []}).
 * Schema per task: {id, source, url|origin, taskDir|prompt,
 * tests {pass, fail}, frozenVersions {rtk, corpus, harness}, notes}.
 * `source` must be a non-empty string; only 'independent' supports external
 * claims — every other value is counted as internal in summaries.
 */
function validateTasksManifest(input) {
  const list = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray(input.tasks) ? input.tasks : null;
  if (!list) return { ok: false, tasks: [], errors: ['manifest must be an array or {tasks: [...]}'] };
  const errors = [];
  const seen = new Set();
  const tasks = [];
  list.forEach((t, i) => {
    const at = `tasks[${i}]`;
    if (!t || typeof t !== 'object' || Array.isArray(t)) { errors.push(`${at}: not an object`); return; }
    if (typeof t.id !== 'string' || !t.id.trim()) { errors.push(`${at}: missing id`); return; }
    if (seen.has(t.id)) { errors.push(`${at}: duplicate id '${t.id}'`); return; }
    seen.add(t.id);
    if (typeof t.source !== 'string' || !t.source.trim()) errors.push(`${t.id}: missing source ('independent' required for external claims)`);
    if (!t.url && !t.origin) errors.push(`${t.id}: missing url or origin`);
    if (!t.taskDir && !t.prompt) errors.push(`${t.id}: missing taskDir or prompt`);
    const tests = t.tests;
    const testsOk = tests && typeof tests === 'object' && !Array.isArray(tests)
      ? typeof tests.pass === 'string' && !!tests.pass.trim() && typeof tests.fail === 'string' && !!tests.fail.trim()
      : typeof tests === 'string' && !!tests.trim();
    if (!testsOk) errors.push(`${t.id}: missing tests pass/fail commands`);
    const fv = t.frozenVersions || {};
    for (const key of ['rtk', 'corpus', 'harness']) {
      if (!fv[key] || typeof fv[key] !== 'string') errors.push(`${t.id}: frozenVersions.${key} pin missing`);
    }
    tasks.push({ ...t });
  });
  return { ok: errors.length === 0, tasks, errors };
}

/** True when a task's provenance supports external claims. */
function isIndependentTask(task) { return !!task && task.source === 'independent'; }

// ---------------------------------------------------------------------------
// Deterministic randomization
// ---------------------------------------------------------------------------

/** mulberry32 — same PRNG as benchmark/paired.js so seeds are interchangeable. */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates under a seed. Returns {order, seed}; the input is not mutated. */
function shuffleWithSeed(arr, seed) {
  const rand = mulberry32(seed);
  const order = arr.slice();
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, seed: seed >>> 0 };
}

/** Per-pair arm assignment (which arm runs first) derived from the same seed. */
function assignArmOrder(items, seed) {
  const rand = mulberry32(seed ^ 0x9E3779B9);
  return items.map((item) => ({ item, first: rand() < 0.5 ? 'raw' : 'rtk' }));
}

// ---------------------------------------------------------------------------
// Blind-judging scrubber
// ---------------------------------------------------------------------------

const FRAMEWORK_MARKERS = ['claude-code', 'claude code', 'codex-cli', 'deepseek-harness', 'opencode', 'claude', 'codex', 'deepseek'];
const VENDOR_WORDS = ['anthropic', 'openai', 'sonnet', 'haiku', 'opus', 'gemini', 'turbo'];

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function baseScrubTokens() {
  const tokens = new Set(['rtk', 'filtered', 'raw']);
  for (const m of MODEL_REGISTRY) {
    tokens.add(String(m.id).toLowerCase());
    if (m.costKey) tokens.add(String(m.costKey).toLowerCase());
  }
  for (const w of VENDOR_WORDS) tokens.add(w);
  for (const w of FRAMEWORK_MARKERS) tokens.add(w);
  return [...tokens].sort((a, b) => b.length - a.length);
}
const BASE_SCRUB_TOKENS = baseScrubTokens();

/**
 * Removes every arm/model/framework identifier from free text so a judge
 * cannot tell which condition produced it. Handles '[rtk]' log prefixes,
 * registry ids/cost keys/labels and framework markers; all become '[AGENT]'.
 * Non-identifying content is preserved verbatim.
 */
function scrubForBlindJudging(text, identity = {}) {
  let out = String(text).replace(/\[rtk\]/gi, '[AGENT]');
  const extra = [identity.arm, identity.model, identity.framework]
    .filter(Boolean).map((s) => String(s).toLowerCase());
  const tokens = [...new Set([...BASE_SCRUB_TOKENS, ...extra])].sort((a, b) => b.length - a.length);
  for (const tok of tokens) {
    out = out.replace(new RegExp(`\\b${escapeRe(tok)}\\b`, 'gi'), '[AGENT]');
  }
  return out.replace(/\[\s*AGENT\s*\]\s*(?:\[\s*AGENT\s*\]\s*)+/gi, '[AGENT] ');
}

// ---------------------------------------------------------------------------
// Metrics aggregation
// ---------------------------------------------------------------------------

/** Reads a metric from run.metrics with fallback to the top-level record. */
function metricOf(run, key) {
  const m = run && run.metrics;
  if (m && m[key] !== undefined) return m[key];
  return run ? run[key] : undefined;
}

function aggregateMetrics(runs) {
  const n = runs.length;
  const failureModes = Object.fromEntries(FAILURE_TAXONOMY.map((f) => [f, 0]));
  let successes = 0;
  let testPasses = 0;
  let retries = 0;
  let toolCalls = 0;
  let wallClockMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let contextTokens = 0;
  let costUsd = 0;
  for (const run of runs) {
    const success = !!metricOf(run, 'success');
    if (success) successes += 1;
    if (!!metricOf(run, 'testPass')) testPasses += 1;
    retries += Number(metricOf(run, 'retries')) || 0;
    toolCalls += Number(metricOf(run, 'toolCalls')) || 0;
    wallClockMs += Number(metricOf(run, 'wallClockMs')) || 0;
    inputTokens += Number(metricOf(run, 'inputTokens')) || 0;
    outputTokens += Number(metricOf(run, 'outputTokens')) || 0;
    contextTokens += Number(metricOf(run, 'contextTokens')) || 0;
    costUsd += Number(metricOf(run, 'costUsd')) || 0;
    const mode = metricOf(run, 'failureMode');
    if (!success) failureModes[FAILURE_TAXONOMY.includes(mode) ? mode : 'other'] += 1;
  }
  const mean = (x) => (n ? x / n : 0);
  return {
    n,
    successes,
    testPasses,
    successRate: n ? successes / n : 0,
    testPassRate: n ? testPasses / n : 0,
    meanRetries: mean(retries),
    meanToolCalls: mean(toolCalls),
    meanWallClockMs: mean(wallClockMs),
    meanInputTokens: mean(inputTokens),
    meanOutputTokens: mean(outputTokens),
    meanContextTokens: mean(contextTokens),
    totalCostUsd: costUsd,
    failureModes,
  };
}

/** Wilson interval delegated to src/equivalence.js (single implementation). */
function wilsonCI(successes, n) {
  return wilsonInterval(successes, n);
}

/**
 * Raw-vs-RTK comparison: per-arm aggregates with Wilson CIs plus a paired
 * TOST equivalence verdict (and McNemar difference test) over shared taskIds.
 * Fully machine-readable; safe to JSON.stringify into summary.json.
 */
function compareArms(rawRuns = [], rtkRuns = []) {
  const raw = aggregateMetrics(rawRuns);
  const rtk = aggregateMetrics(rtkRuns);
  const rawByTask = new Map(rawRuns.map((r) => [r.taskId, r]));
  const pairs = [];
  for (const r of rtkRuns) {
    const rawRun = rawByTask.get(r.taskId);
    if (rawRun) pairs.push({ raw: !!metricOf(rawRun, 'success'), rtk: !!metricOf(r, 'success') });
  }
  const counts = { a: 0, b: 0, c: 0, d: 0 };
  for (const p of pairs) {
    if (p.raw && p.rtk) counts.a += 1;
    else if (p.raw) counts.b += 1;
    else if (p.rtk) counts.c += 1;
    else counts.d += 1;
  }
  const tost = tostPaired(pairs);
  const mcnemar = mcnemarExact(counts.b, counts.c);
  const verdict = pairs.length === 0 ? 'no-paired-data' : tost.equivalent ? 'equivalent' : 'not-demonstrated';
  return {
    raw: { ...raw, wilson: wilsonCI(raw.successes, raw.n) },
    rtk: { ...rtk, wilson: wilsonCI(rtk.successes, rtk.n) },
    difference: {
      point: rtk.successRate - raw.successRate,
      lower: tost.lower,
      upper: tost.upper,
      margin: tost.margin,
    },
    pairs: { n: pairs.length, ...counts, discordant: counts.b + counts.c },
    tost,
    mcnemar,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Transcript heuristics — ESTIMATES, not ground truth
// ---------------------------------------------------------------------------

const COMMAND_LINE_RE = /^\s*(?:[$>#]\s*|(?:npm|npx|node|pnpm|yarn|git|pytest|python|cargo|make|go)\b)/i;

/**
 * ESTIMATE of retry count from transcript lines: repeated identical command
 * invocations beyond the first. Real agents retry via API turns this parser
 * cannot see; treat as a floor, never as exact telemetry.
 */
function estimateRetries(transcriptLines) {
  const counts = new Map();
  for (const rawLine of transcriptLines || []) {
    const line = String(rawLine).trim();
    if (!line || !COMMAND_LINE_RE.test(line)) continue;
    const cmd = line.replace(/^\s*(?:[$>#]\s*)/, '').trim().toLowerCase();
    if (!cmd) continue;
    counts.set(cmd, (counts.get(cmd) || 0) + 1);
  }
  let retries = 0;
  for (const c of counts.values()) retries += Math.max(0, c - 1);
  return retries;
}

const TOOL_CALL_RE = /(\[tool(?:_call)?\]|tool_use|tool use|function_call|⏺|╭─|calling tool|running command)/i;

/**
 * ESTIMATE of tool-call count from transcript lines by marker matching.
 * Marker sets differ per framework; unmarked calls are invisible here.
 */
function countToolCalls(transcriptLines) {
  return (transcriptLines || []).filter((l) => TOOL_CALL_RE.test(String(l))).length;
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

/**
 * Cost from token counts via src/tokens COST_TABLE (keyed by model id then
 * costKey). Unknown models return usd: 0 with estimated: true — never invent
 * a price.
 */
function computeCost(tokensIn, tokensOut, model) {
  const candidates = [
    model && typeof model === 'object' ? model.costKey : undefined,
    model && typeof model === 'object' ? model.id : model,
  ].filter(Boolean);
  for (const key of candidates) {
    const row = COST_TABLE[key];
    if (row) {
      return {
        usd: ((Number(tokensIn) || 0) * row.input + (Number(tokensOut) || 0) * row.output) / 1_000_000,
        estimated: false,
        priceKey: key,
      };
    }
  }
  return { usd: 0, estimated: true, priceKey: null };
}

// ---------------------------------------------------------------------------
// Framework adapters — declarative registry + pure resolution helpers.
// Spawning happens only in external-eval.js; everything here is testable.
// ---------------------------------------------------------------------------

const FRAMEWORKS = {
  'claude-code': { bin: 'claude', template: 'claude -p "{task}" --model {model} --output-format text > "{outdir}/transcript.txt"' },
  codex: { bin: 'codex', template: 'codex exec --model {model} "{task}" > "{outdir}/transcript.txt"' },
  opencode: { bin: 'opencode', template: 'opencode run --model {model} "{task}" > "{outdir}/transcript.txt"' },
  'deepseek-harness': { bin: 'deepseek', template: 'deepseek-harness --model {model} --task "{task}" --out "{outdir}"' },
  generic: { bin: null, template: null },
};

/**
 * Resolves the execution command for one attempt. A custom template wins and
 * may use {model}, {task}, {outdir}; built-ins additionally expose {bin}.
 */
function resolveCommand(framework, vars, customTemplate) {
  const template = customTemplate || (FRAMEWORKS[framework] || {}).template;
  if (!template) throw new Error(`framework '${framework}' needs --framework-cmd '{model}/{task}/{outdir} template'`);
  return template
    .replaceAll('{bin}', (FRAMEWORKS[framework] || {}).bin || '')
    .replaceAll('{model}', vars.model)
    .replaceAll('{outdir}', vars.outdir)
    .replaceAll('{task}', vars.task);
}

module.exports = {
  ARMS,
  FAILURE_TAXONOMY,
  FRAMEWORKS,
  TIER_ORDER,
  validateTasksManifest,
  isIndependentTask,
  mulberry32,
  shuffleWithSeed,
  assignArmOrder,
  scrubForBlindJudging,
  aggregateMetrics,
  wilsonCI,
  compareArms,
  estimateRetries,
  countToolCalls,
  computeCost,
  resolveCommand,
};
