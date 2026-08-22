'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { wilsonInterval } = require('../src/equivalence');
const lib = require('../benchmark/external-eval-lib');
const runner = require('../benchmark/external-eval');

function validTask(overrides = {}) {
  return {
    id: 't1',
    source: 'independent',
    origin: 'https://example.org/bench/t1',
    prompt: 'fix the failing test',
    tests: { pass: 'echo ok', fail: 'echo ko' },
    frozenVersions: { rtk: 'abc123', corpus: 'corpus-1-x', harness: '0.3.0' },
    notes: 'n',
    ...overrides,
  };
}

// --- Manifest validation ---------------------------------------------------

test('manifest accepts an array of complete tasks', () => {
  const v = lib.validateTasksManifest([validTask(), validTask({ id: 't2' })]);
  assert.equal(v.ok, true);
  assert.equal(v.tasks.length, 2);
});

test('manifest accepts the {tasks: []} wrapper shape', () => {
  const v = lib.validateTasksManifest({ tasks: [validTask()] });
  assert.equal(v.ok, true);
});

test('manifest rejects non-array garbage', () => {
  for (const bad of [null, undefined, {}, { tasks: 'nope' }, 42]) {
    assert.equal(lib.validateTasksManifest(bad).ok, false);
  }
});

test('manifest rejects duplicate ids', () => {
  const v = lib.validateTasksManifest([validTask(), validTask()]);
  assert.equal(v.ok, false);
  assert.match(v.errors.join('\n'), /duplicate id 't1'/);
});

test('manifest rejects missing ids and empty ids', () => {
  const v = lib.validateTasksManifest([{ ...validTask(), id: undefined }, { ...validTask(), id: '   ' }]);
  assert.equal(v.ok, false);
  assert.equal(v.errors.filter((e) => /missing id/.test(e)).length, 2);
});

test('manifest rejects tasks missing frozenVersions pins, tests or provenance', () => {
  const noPin = validTask({ id: 'no-pin', frozenVersions: { rtk: 'a', corpus: 'b' } });
  const noTests = validTask({ id: 'no-tests', tests: {} });
  const noOrigin = validTask({ id: 'no-origin', origin: undefined, url: null });
  const noSource = validTask({ id: 'no-source', source: '' });
  const v = lib.validateTasksManifest([noPin, noTests, noOrigin, noSource]);
  assert.equal(v.ok, false);
  const joined = v.errors.join('\n');
  assert.match(joined, /frozenVersions\.harness pin missing/);
  assert.match(joined, /missing tests pass\/fail commands/);
  assert.match(joined, /missing url or origin/);
  assert.match(joined, /missing source/);
});

test('internal sources are accepted but never counted independent', () => {
  const t = validTask({ source: 'internal-sample' });
  const v = lib.validateTasksManifest([t]);
  assert.equal(v.ok, true);
  assert.equal(lib.isIndependentTask(t), false);
  assert.equal(lib.isIndependentTask(validTask()), true);
});

// --- Deterministic randomization -------------------------------------------

test('same seed yields identical shuffle; different seed differs', () => {
  const arr = Array.from({ length: 24 }, (_, i) => `item-${i}`);
  const a = lib.shuffleWithSeed(arr, 1234);
  const b = lib.shuffleWithSeed(arr, 1234);
  const c = lib.shuffleWithSeed(arr, 5678);
  assert.deepEqual(a.order, b.order);
  assert.notDeepEqual(a.order, c.order);
  assert.deepEqual([...arr], Array.from({ length: 24 }, (_, i) => `item-${i}`));
  assert.deepEqual([...a.order].sort(), [...arr].sort());
  assert.equal(a.seed, 1234);
});

test('assignArmOrder is seed-deterministic and covers both arms', () => {
  const items = Array.from({ length: 40 }, (_, i) => i);
  const first = lib.assignArmOrder(items, 99).map((x) => x.first);
  const again = lib.assignArmOrder(items, 99).map((x) => x.first);
  assert.deepEqual(first, again);
  assert.ok(first.includes('raw') && first.includes('rtk'));
});

test('mulberry32 matches benchmark/paired.js sequence', () => {
  const rand = lib.mulberry32(42);
  const seq = [rand(), rand(), rand()];
  let s = 42;
  const next = () => {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  assert.deepEqual(seq, [next(), next(), next()]);
});

// --- Blind-judging scrubber --------------------------------------------------

test('scrubber removes every identifier class', () => {
  const dirty = [
    '[rtk] compressed 70% of tool tokens',
    'ran under claude-code with model gpt-4o-mini',
    'the RAW arm vs FILTERED arm vs RTK arm',
    'codex and opencode and deepseek-harness agents',
    'Anthropic Claude 3 Haiku, GPT-3.5-Turbo, Gemini Flash',
    'rtk filtered output retained needles',
  ].join('\n');
  const clean = lib.scrubForBlindJudging(dirty, { arm: 'rtk', model: 'gpt-4o-mini', framework: 'claude-code' });
  for (const tell of ['rtk', 'filtered', 'raw arm', 'claude', 'codex', 'opencode', 'deepseek', 'gpt-4o', 'gpt-3.5', 'haiku', 'gemini', 'anthropic']) {
    assert.ok(!clean.toLowerCase().includes(tell), `scrubbed text still contains '${tell}':\n${clean}`);
  }
});

test('scrubber preserves non-identifying content', () => {
  const out = lib.scrubForBlindJudging('Fixed billing.ts:14 discount math; all 12 tests pass.', {});
  assert.ok(out.includes('billing.ts:14'));
  assert.ok(out.includes('all 12 tests pass'));
});

test('scrubber handles custom identities and repeated placeholders', () => {
  const out = lib.scrubForBlindJudging('custom-model wrote [rtk] [rtk] twice', { model: 'CUSTOM-MODEL' });
  assert.ok(!/custom-model/i.test(out));
  assert.equal((out.match(/\[AGENT\]/gi) || []).length >= 1, true);
  assert.ok(!/\[\s*AGENT\s*\]\s*\[\s*AGENT\s*\]/i.test(out.replace(/\[AGENT\] $/, '')));
});

// --- Metrics aggregation -----------------------------------------------------

function fixtureRun(overrides = {}) {
  return {
    taskId: overrides.taskId || 't1',
    success: overrides.success ?? false,
    metrics: {
      testPass: overrides.testPass ?? false,
      retries: overrides.retries ?? 0,
      toolCalls: overrides.toolCalls ?? 0,
      wallClockMs: overrides.wallClockMs ?? 0,
      inputTokens: overrides.inputTokens ?? 0,
      outputTokens: overrides.outputTokens ?? 0,
      contextTokens: overrides.contextTokens ?? 0,
      costUsd: overrides.costUsd ?? 0,
      failureMode: overrides.failureMode ?? null,
    },
  };
}

test('aggregateMetrics computes exact means, rates and cost total', () => {
  const runs = [
    fixtureRun({ taskId: 'a', success: true, retries: 1, toolCalls: 4, wallClockMs: 1000, inputTokens: 100, outputTokens: 50, costUsd: 0.01 }),
    fixtureRun({ taskId: 'b', success: false, retries: 3, toolCalls: 8, wallClockMs: 3000, inputTokens: 300, outputTokens: 150, costUsd: 0.03, failureMode: 'timeout' }),
  ];
  const agg = lib.aggregateMetrics(runs);
  assert.equal(agg.n, 2);
  assert.equal(agg.successes, 1);
  assert.equal(agg.successRate, 0.5);
  assert.equal(agg.testPassRate, 0);
  assert.equal(agg.meanRetries, 2);
  assert.equal(agg.meanToolCalls, 6);
  assert.equal(agg.meanWallClockMs, 2000);
  assert.equal(agg.meanInputTokens, 200);
  assert.equal(agg.meanOutputTokens, 100);
  assert.equal(agg.totalCostUsd, 0.04);
});

test('failure modes enforce the taxonomy enum; unknown maps to other', () => {
  const runs = [
    fixtureRun({ failureMode: 'timeout' }),
    fixtureRun({ failureMode: 'context-overflow' }),
    fixtureRun({ failureMode: 'mystery-mode' }),
    fixtureRun({}),
  ];
  const agg = lib.aggregateMetrics(runs);
  assert.deepEqual(Object.keys(agg.failureModes).sort(), [...lib.FAILURE_TAXONOMY].sort());
  assert.equal(agg.failureModes.timeout, 1);
  assert.equal(agg.failureModes['context-overflow'], 1);
  assert.equal(agg.failureModes.other, 2);
  assert.equal(agg.failureModes.crash, 0);
});

test('empty run set aggregates to zeros without dividing by zero', () => {
  const agg = lib.aggregateMetrics([]);
  assert.equal(agg.n, 0);
  assert.equal(agg.successRate, 0);
  assert.equal(agg.meanWallClockMs, 0);
});

// --- Statistical comparison ----------------------------------------------------

test('wilsonCI delegates to src/equivalence.js', () => {
  assert.deepEqual(lib.wilsonCI(14, 14), wilsonInterval(14, 14));
  const ci = lib.wilsonCI(0, 10);
  assert.equal(ci.lower, 0);
  assert.ok(ci.upper > 0 && ci.upper < 0.35);
});

test('compareArms returns CIs plus TOST/McNemar fields over paired taskIds', () => {
  const rawRuns = [
    fixtureRun({ taskId: 'a', success: true }),
    fixtureRun({ taskId: 'b', success: true }),
    fixtureRun({ taskId: 'c', success: false, failureMode: 'timeout' }),
    fixtureRun({ taskId: 'd', success: false }),
  ];
  const rtkRuns = [
    fixtureRun({ taskId: 'a', success: true }),
    fixtureRun({ taskId: 'b', success: false, failureMode: 'wrong-fix' }),
    fixtureRun({ taskId: 'c', success: false }),
    fixtureRun({ taskId: 'd', success: false }),
  ];
  const cmp = lib.compareArms(rawRuns, rtkRuns);
  assert.ok(cmp.raw.wilson.lower <= cmp.raw.wilson.point && cmp.raw.wilson.point <= cmp.raw.wilson.upper);
  assert.ok(cmp.rtk.wilson.lower <= cmp.rtk.wilson.point && cmp.rtk.wilson.point <= cmp.rtk.wilson.upper);
  assert.equal(cmp.pairs.n, 4);
  assert.equal(cmp.pairs.a, 1);
  assert.equal(cmp.pairs.b, 1);
  assert.equal(cmp.pairs.c, 0);
  assert.equal(cmp.pairs.discordant, 1);
  assert.equal(cmp.tost.equivalent, false);
  assert.equal(typeof cmp.tost.margin, 'number');
  assert.equal(typeof cmp.mcnemar.p, 'number');
  assert.ok(['equivalent', 'not-demonstrated', 'no-paired-data'].includes(cmp.verdict));
  assert.ok(Math.abs(cmp.difference.point - (-0.25)) < 1e-9);
});

test('compareArms with disjoint taskIds reports no paired data', () => {
  const cmp = lib.compareArms(
    [fixtureRun({ taskId: 'x', success: true })],
    [fixtureRun({ taskId: 'y', success: true })],
  );
  assert.equal(cmp.verdict, 'no-paired-data');
  assert.equal(cmp.pairs.n, 0);
});

// --- Transcript heuristics -------------------------------------------------------

test('estimateRetries counts repeated identical commands as estimates', () => {
  const lines = [
    '$ npm test',
    'some agent narration',
    '> npm test',
    '$ npm test',
    '$ npm run lint',
    '$ npm test',
  ];
  assert.equal(lib.estimateRetries(lines), 3);
  assert.equal(lib.estimateRetries(['just prose']), 0);
  assert.equal(lib.estimateRetries([]), 0);
});

test('countToolCalls matches marker styles across frameworks', () => {
  const lines = [
    '[tool] read_file(src/index.ts)',
    'plain narration line',
    '⏺ bash -lc "npm test"',
    '{"type":"function_call","name":"edit"}',
    'Tool use: grep',
    'another plain line',
  ];
  assert.equal(lib.countToolCalls(lines), 4);
});

// --- Cost ------------------------------------------------------------------------

test('computeCost prices known models and flags unknown ones', () => {
  const known = lib.computeCost(1_000_000, 500_000, { id: 'gpt-4o', costKey: 'gpt-4o' });
  assert.equal(known.estimated, false);
  assert.ok(Math.abs(known.usd - (2.5 + 5)) < 1e-9);
  const unknown = lib.computeCost(12345, 6789, { id: 'definitely-not-priced', costKey: 'nope' });
  assert.deepEqual(unknown, { usd: 0, estimated: true, priceKey: null });
});

// --- Command resolution -------------------------------------------------------------

test('resolveCommand substitutes placeholders; custom templates win', () => {
  const builtIn = lib.resolveCommand('claude-code', { model: 'm1', task: 'T', outdir: '/o' }, null);
  assert.ok(builtIn.includes('m1') && builtIn.includes('/o'));
  const custom = lib.resolveCommand('generic', { model: 'm1', task: 'T', outdir: '/o' }, 'run.sh {model} {task} {outdir}');
  assert.equal(custom, 'run.sh m1 T /o');
  assert.throws(() => lib.resolveCommand('generic', { model: 'm', task: 't', outdir: 'o' }, null));
});

// --- Plan matrix ----------------------------------------------------------------------

function tinyTasks(n) {
  return Array.from({ length: n }, (_, i) => validTask({ id: `p${i}`, source: 'internal-sample' }));
}

const MEDIUM_MODEL = [{ id: 'gpt-4o-mini', provider: 'openai', tier: 'medium' }];

test('plan matrix is tasks x arms x models x frameworks', () => {
  const plan = runner.buildPlan({
    tasks: tinyTasks(3),
    arms: ['raw', 'rtk'],
    models: MEDIUM_MODEL,
    frameworks: ['claude-code', 'codex'],
    availability: {},
  });
  assert.equal(plan.counts.total, 12);
  assert.equal(plan.rows.length, 12);
  assert.equal(plan.rows.filter((r) => r.available).length, 0);
  const combos = new Set(plan.rows.map((r) => `${r.taskId}|${r.arm}|${r.model}|${r.framework}`));
  assert.equal(combos.size, 12);
});

test('plan matrix marks available rows when probed and mock never available', () => {
  const plan = runner.buildPlan({
    tasks: tinyTasks(1),
    arms: ['raw', 'rtk'],
    models: [{ id: 'mock', provider: 'mock', tier: 'small' }],
    frameworks: ['generic'],
    availability: { generic: true },
  });
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.rows.every((r) => r.available === false), true);
});

test('plan CLI subprocess prints 12-row matrix offline with zero CLIs assumed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-eval-test-'));
  const tasksFile = path.join(dir, 'tasks.jsonl');
  fs.writeFileSync(tasksFile, tinyTasks(3).map((t) => JSON.stringify(t)).join('\n'));
  const res = cp.spawnSync(process.execPath, [
    path.join(__dirname, '..', 'benchmark', 'external-eval.js'),
    '--tasks', tasksFile,
    '--arm', 'both',
    '--model', 'gpt-4o-mini',
    '--framework', 'claude-code,codex',
    '--framework-cmd', 'noop {model} {task} {outdir}',
    '--plan',
  ], { encoding: 'utf8', timeout: 30000 });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /12 runs \(3 tasks x 2 arms x 1 models x 2 frameworks\)/);
  assert.equal(res.stdout.split('\n').filter((l) => /^p\d\t/.test(l)).length, 12);
  fs.rmSync(dir, { recursive: true, force: true });
});

// --- Sample generation + provenance ------------------------------------------------------

test('--gen-sample writes 12 clearly-marked internal-sample placeholder tasks', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-eval-gen-'));
  const file = path.join(dir, 'sample.jsonl');
  runner.genSample(file);
  const tasks = runner.loadTasks(file);
  assert.equal(tasks.length, 12);
  assert.ok(tasks.every((t) => t.source === 'internal-sample'));
  assert.ok(tasks.every((t) => !lib.isIndependentTask(t)));
  assert.ok(tasks.every((t) => /SYNTHETIC PLACEHOLDER/.test(t.prompt)));
  assert.ok(tasks.every((t) => t.frozenVersions.rtk && t.frozenVersions.corpus && t.frozenVersions.harness));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('run records carry provenance commit/version fields and seed', () => {
  const record = runner.buildRunRecord({
    task: validTask(),
    arm: 'rtk',
    model: { id: 'gpt-4o-mini', tier: 'medium', provider: 'openai', contextWindow: 128000 },
    framework: 'generic',
    attempt: 3,
    metrics: { success: true },
    transcriptPath: '/tmp/x.txt',
    seed: 7,
  });
  assert.equal(record.taskId, 't1');
  assert.equal(record.arm, 'rtk');
  assert.equal(record.attempt, 3);
  assert.equal(record.provenance.seed, 7);
  assert.equal(typeof record.provenance.rtkCommit, 'string');
  assert.ok(record.provenance.rtkCommit.length > 0);
  assert.match(record.provenance.corpusVersion, /^corpus-|unknown|empty/);
  assert.match(record.provenance.benchmarkVersion, /^\d+\.\d+\.\d+|unknown/);
  const fv = record.provenance.frozenVersions;
  assert.ok(fv.rtk && fv.corpus && fv.harness);
});

test('honesty banner refuses external wording without independent tasks', () => {
  const internalOnly = runner.honestyBanner(tinyTasks(3));
  assert.match(internalOnly, /NOT external evidence/);
  assert.match(internalOnly, /3 internal\/synthetic, 0 independent/);
  const mixed = runner.honestyBanner([...tinyTasks(2), validTask({ source: 'independent', id: 'ind1' })]);
  assert.match(mixed, /1 independent/);
  assert.match(mixed, /2 internal\/synthetic/);
  assert.doesNotMatch(mixed, /refused/i);
});

test('summary markdown includes CI columns and the banner', () => {
  const cmp = lib.compareArms(
    [fixtureRun({ taskId: 'a', success: true })],
    [fixtureRun({ taskId: 'a', success: true })],
  );
  const md = runner.renderSummaryMd(cmp, {
    generatedAt: '2026-01-01T00:00:00Z', seed: 1, frameworks: ['generic'], models: ['mock'],
    banner: runner.honestyBanner(tinyTasks(1)),
  });
  assert.match(md, /Wilson 95% CI/);
  assert.match(md, /HONESTY BANNER/);
  assert.match(md, /Verdict:/);
});
