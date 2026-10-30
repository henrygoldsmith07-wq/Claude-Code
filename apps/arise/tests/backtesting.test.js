// Tests for apps/arise/src/lib/backtesting.js — the point-in-time replay engine.
//
// A backtest is an ordered replay: at each historical point only prior
// sessions are visible as inputs and later rows act purely as outcomes. The
// fixtures below are a deterministic synthetic history (no randomness, no
// wall clock, no network) small enough to keep the suite offline and fast.
//
// Covers: dataset validation, leakage safety (append-only invariance), sample
// gating for empirical calibration, the four evaluation families, and the
// analysis-only exports the benchmark harness consumes.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCHMARK_FORMAT_VERSION,
  backtestHistory,
  validateBenchmarkDataset,
  calibrateHistory,
} from '../src/lib/backtesting.js';

// A 12-week deterministic dumbbell-bench progression with a deliberate stall,
// one noisy/low-readiness week and one missed scheduled session.
function session(id, dateISO, blocks, extra = {}) {
  return { id, dateISO, blocks, ...extra };
}

function block(exerciseId, sets, reps = '8–12') {
  return { exerciseId, reps, sets };
}

function set(reps, weightKg, rpe = 7) {
  return { reps: String(reps), weightKg: String(weightKg), rpe: String(rpe) };
}

const history = [
  session('log-01', '2026-01-05', [block('bench-press-dumbbell', [set(8, 20), set(8, 20)])], { scheduleSessionId: 'plan-01' }),
  session('log-02', '2026-01-08', [block('push-up', [set(12, 0), set(10, 0)])], { scheduleSessionId: 'plan-02' }),
  session('log-03', '2026-01-12', [block('bench-press-dumbbell', [set(9, 22.5), set(8, 22.5)])], { scheduleSessionId: 'plan-03' }),
  session('log-04', '2026-01-15', [block('push-up', [set(14, 0), set(12, 0)])], { scheduleSessionId: 'plan-04' }),
  session('log-05', '2026-01-19', [block('bench-press-dumbbell', [set(10, 25), set(9, 25)])], { scheduleSessionId: 'plan-05' }),
  session('log-06', '2026-01-22', [block('push-up', [set(15, 0), set(13, 0)])], { scheduleSessionId: 'plan-06' }),
  // Stall: identical best e1RM three sessions running. Logged against a make-up
  // id so plan-07 (the 2026-01-26 slot) never counts as completed.
  session('log-07', '2026-01-26', [block('bench-press-dumbbell', [set(9, 25), set(8, 25)], '6–8')], { scheduleSessionId: 'plan-06b' }),
  // Low-readiness noisy week.
  session('log-08', '2026-01-29', [block('bench-press-dumbbell', [set(6, 22.5), set(5, 22.5)])], { scheduleSessionId: 'plan-08', durationMinutes: 12, note: 'exhausted, cut it short' }),
  session('log-09', '2026-02-02', [block('push-up', [set(15, 0), set(14, 0)])], { scheduleSessionId: 'plan-09' }),
  // plan-07 stays missed: nothing is ever logged against it.
  session('log-10', '2026-02-05', [block('bench-press-dumbbell', [set(9, 25), set(9, 25)])], { scheduleSessionId: 'plan-10' }),
  session('log-11', '2026-02-09', [block('bench-press-dumbbell', [set(10, 27.5), set(9, 27.5)])], { scheduleSessionId: 'plan-11' }),
  session('log-12', '2026-02-12', [block('push-up', [set(16, 0), set(15, 0)])], { scheduleSessionId: 'plan-12' }),
];

const dataset = {
  formatVersion: BENCHMARK_FORMAT_VERSION,
  kind: 'synthetic',
  metadata: { name: 'unit-fixture', synthetic: true, realTrainingValidation: false },
  profile: { availableEquipment: ['dumbbells', 'bench'] },
  readinessLog: [
    { dateISO: '2026-01-05', score: 76 },
    { dateISO: '2026-01-12', score: 74 },
    { dateISO: '2026-01-19', score: 72 },
    { dateISO: '2026-01-26', score: 70 },
    { dateISO: '2026-01-29', score: 25 },
    { dateISO: '2026-02-02', score: 22 },
    { dateISO: '2026-02-05', score: 24 },
    { dateISO: '2026-02-09', score: 68 },
    { dateISO: '2026-02-12', score: 72 },
  ],
  schedule: {
    programId: 'unit-backtest',
    sessions: [
      { id: 'plan-01', dateISO: '2026-01-05', title: 'A' },
      { id: 'plan-02', dateISO: '2026-01-08', title: 'B' },
      { id: 'plan-03', dateISO: '2026-01-12', title: 'C' },
      { id: 'plan-04', dateISO: '2026-01-15', title: 'D' },
      { id: 'plan-05', dateISO: '2026-01-19', title: 'E' },
      { id: 'plan-06', dateISO: '2026-01-22', title: 'F' },
      { id: 'plan-07', dateISO: '2026-01-26', title: 'G' }, // never completed
      { id: 'plan-08', dateISO: '2026-01-29', title: 'H' },
      { id: 'plan-09', dateISO: '2026-02-02', title: 'I' },
      { id: 'plan-10', dateISO: '2026-02-05', title: 'J' },
      { id: 'plan-11', dateISO: '2026-02-09', title: 'K' },
      { id: 'plan-12', dateISO: '2026-02-12', title: 'L' },
    ],
  },
  history,
};

test('validateBenchmarkDataset accepts the fixture and rejects real malformed shapes', () => {
  const ok = validateBenchmarkDataset(dataset);
  assert.equal(ok.valid, true, ok.issues.join('; '));
  assert.equal(ok.formatVersion, BENCHMARK_FORMAT_VERSION);
  assert.equal(ok.kind, 'synthetic');

  const badDate = validateBenchmarkDataset({ formatVersion: 1, history: [{ dateISO: 'not-a-date', blocks: [] }] });
  assert.equal(badDate.valid, false);
  assert.ok(badDate.issues.some((i) => i.includes('dateISO')));

  const badBlocks = validateBenchmarkDataset({ formatVersion: 1, history: [{ dateISO: '2026-01-01', blocks: 'nope' }] });
  assert.equal(badBlocks.valid, false);
  assert.ok(badBlocks.issues.some((i) => i.includes('blocks')));

  const badKind = validateBenchmarkDataset({ formatVersion: 1, kind: 'fabricated', history: [] });
  assert.equal(badKind.valid, false);
  assert.ok(badKind.issues.some((i) => i.includes('kind must be synthetic or real-history')));
});

test('backtestHistory runs the full replay over the synthetic fixture', () => {
  const result = backtestHistory(dataset);
  assert.equal(result.leakageSafe, true);
  assert.ok(result.comparisons >= 5, `expected several comparable blocks, got ${result.comparisons}`);
  assert.ok(result.metrics.loadRecommendationError);
  assert.ok(result.metrics.repRecommendationError);
  assert.ok(result.metrics.progressionTiming);
  assert.ok(result.metrics.completionProbability);
  assert.ok(result.metrics.plateauClassification);
  assert.ok(result.metrics.fatigueClassification);
  assert.ok(result.metrics.deloadRecommendation);
  for (const dimension of ['exercise', 'availableHistory', 'trainingAge', 'equipment', 'consistency', 'repRange', 'movementType']) {
    assert.ok(result.strata[dimension], `missing stratum dimension ${dimension}`);
  }
  assert.ok(result.observations.length === result.comparisons);
});

test('invalid datasets are rejected before any replay happens', () => {
  const result = backtestHistory({ formatVersion: 2, history: [] });
  assert.equal(result.status, 'invalid');
  assert.equal(result.comparisons, 0);
  assert.deepEqual(result.observations, []);
  assert.equal(result.leakageSafe, true);
  assert.ok(result.validation.issues.length > 0);
});

test('an appended future never changes an already-generated recommendation', () => {
  const base = backtestHistory({ ...dataset, history: history.slice(0, 5), schedule: null, readinessLog: dataset.readinessLog.slice(0, 4) });
  const replay = backtestHistory({ ...dataset, history, schedule: null });
  const firstRow = base.observations[0];
  const replayRow = replay.observations.find((row) => row.asOfDateISO === firstRow.asOfDateISO && row.exerciseId === firstRow.exerciseId);
  assert.ok(replayRow, 'the first comparable row must exist in both replays');
  assert.deepEqual(replayRow.recommendation, firstRow.recommendation, 'future rows must not leak into earlier advice');
  assert.equal(replayRow.reconstruction.visibleSessions, firstRow.reconstruction.visibleSessions);
  assert.equal(replayRow.reconstruction.visibleReadinessEntries, firstRow.reconstruction.visibleReadinessEntries);
});

test('sparse strata stay on priors instead of being presented as calibrated evidence', () => {
  const result = backtestHistory({
    ...dataset,
    schedule: null,
    config: { backtest: { minimumComparisons: 1, minimumStratumSamples: 999 } },
  });
  assert.equal(result.status, 'calibrated', 'the comparison gate is met by the rows themselves');
  assert.equal(result.calibration.empiricalReplacementCount, 0);
  assert.equal(result.calibration.source, 'priors');
  assert.ok(result.observations.every((row) => row.calibration.completionProbability.source === 'prior'));
});

test('a dense stratum with enough samples earns an empirical replacement', () => {
  // One exercise only, and a per-stratum gate low enough that its history rows
  // aggregate into a sample-backed estimate.
  const singleExercise = {
    ...dataset,
    schedule: null,
    history: history.filter((s) => s.blocks[0].exerciseId === 'bench-press-dumbbell'),
    config: {
      backtest: {
        ...DEFAULT_BACKTEST_OVERRIDES,
        minimumComparisons: 1,
        minimumStratumSamples: 3,
      },
    },
  };
  const result = backtestHistory(singleExercise);
  assert.ok(result.comparisons >= 3);
  const empirical = result.calibration.empiricalEstimates.filter((e) => e.n >= 3);
  assert.ok(empirical.length > 0, 'expected at least one stratum above the sample gate');
  assert.equal(result.calibration.source, 'mixed');
  assert.ok(result.calibration.empiricalEstimates.every((e) => e.source === 'empirical'));
});

test('calibrateHistory returns only the calibration summary', () => {
  const calibration = calibrateHistory({ ...dataset, schedule: null, config: { backtest: { minimumComparisons: 1, minimumStratumSamples: 999 } } });
  assert.equal(calibration.source, 'priors');
  assert.deepEqual(calibration.empiricalEstimates, []);
  assert.equal(calibrateHistory({ formatVersion: 2, history: [] }).source, 'priors', 'an invalid dataset falls back to priors');
});

test('completion probability is banded and Brier scores stay inside [0, 1]', () => {
  const result = backtestHistory(dataset);
  const completion = result.metrics.completionProbability;
  assert.ok(completion.n > 0);
  assert.ok(completion.brier >= 0 && completion.brier <= 1);
  assert.ok(completion.meanPredicted >= 0 && completion.meanPredicted <= 1);
  for (const bin of completion.calibrationBins) {
    assert.ok(bin.meanPredicted >= bin.lower && bin.meanPredicted <= bin.upper);
    assert.equal(bin.n, bin.observedRate === null ? 0 : bin.n);
  }
});

test('fatigue rows keep their forecast inputs separable from the scored outcome', () => {
  const result = backtestHistory(dataset);
  assert.ok(result.fatigueObservations.length > 0);
  for (const row of result.fatigueObservations) {
    assert.ok(row.probability >= 0 && row.probability <= 1);
    assert.equal(typeof row.predictedBad, 'boolean');
    assert.equal(typeof row.actualBad, 'boolean');
    assert.ok(row.brier >= 0 && row.brier <= 1);
  }
});

test('deload observations separate the recommendation from the observed cut', () => {
  const result = backtestHistory(dataset);
  assert.ok(result.deloadObservations.length > 0);
  for (const row of result.deloadObservations) {
    assert.equal(typeof row.recommended, 'boolean');
    assert.ok(row.observedCut === null || typeof row.observedCut === 'boolean');
    assert.ok(row.effectiveAfterCut === null || typeof row.effectiveAfterCut === 'boolean');
    assert.ok(row.decision);
  }
  assert.ok(result.metrics.deloadRecommendation.n === result.deloadObservations.length);
});

test('missed-session recovery is measured against the schedule when one is provided', () => {
  const result = backtestHistory(dataset);
  const recovery = result.metrics.missedSessionRecovery;
  assert.equal(recovery.available, true);
  assert.ok(recovery.n > 0, 'plan-07 is never completed, so a recovery row must exist');
  assert.ok(result.recoveryObservations.every((row) => row.oldestId === 'plan-07'));
  assert.ok(result.recoveryObservations.every((row) => row.followed === (row.actualNextId === 'plan-07')));
});

test('recovery evaluation is honest about a missing schedule', () => {
  const result = backtestHistory({ ...dataset, schedule: null });
  assert.equal(result.metrics.missedSessionRecovery.available, false);
  assert.equal(result.metrics.missedSessionRecovery.n, 0);
  assert.match(result.metrics.missedSessionRecovery.note, /schedule/);
});

test('an array input is accepted and read as a bare real-history dataset', () => {
  const result = backtestHistory(history);
  assert.equal(result.validation.valid, true);
  assert.ok(result.observations.length > 0);
  assert.equal(result.coverage.scheduleProvided, false);
  assert.deepEqual(result.coverage.exercises, ['bench-press-dumbbell', 'push-up']);
});

test('the plateau family is scored only where an outcome is observable', () => {
  const result = backtestHistory(dataset);
  for (const row of result.plateauObservations) {
    assert.equal(typeof row.predicted, 'string');
    assert.ok(['genuine', 'bad-sessions', 'progressing'].includes(row.actual));
    assert.ok(['genuine', 'bad-sessions', 'progressing', 'mixed'].includes(row.predicted));
  }
  assert.ok(result.metrics.plateauClassification.n === result.plateauObservations.length);
});

// Shared minimal override so the dense-stratum test does not depend on the
// default priors' gates.
const DEFAULT_BACKTEST_OVERRIDES = {
  minimumComparisons: 5,
  minimumStratumSamples: 8,
  maxOutcomeHorizonExposures: 2,
  progressionTolerancePct: 0.005,
  assistanceToleranceKg: 0.1,
  loadTolerancePct: 0.05,
  repTolerance: 1,
  plateauFutureGainPct: 0.015,
  recoveryReboundPct: 0.02,
  observedDeloadCutRatio: 0.75,
  observedDeloadWindowDays: 7,
  historyBands: { coldMax: 3, developingMax: 8 },
  completion: { priorProbability: 0.7, decisionCutoff: 0.5 },
  fatigue: { priorProbability: 0.2, riskCutoff: 0.5, readinessRiskDelta: 0.25, clusterRiskDelta: 0.25 },
  consistency: { windowDays: 56, highMedianGapDays: 7, mediumMedianGapDays: 14 },
};
