// Tests for apps/arise/src/lib/sync.js — the optional cross-device sync layer.
//
// syncUp/syncDown mirror export/import over a pluggable { pull, push } adapter,
// so every test runs offline with in-memory adapters. The merge helpers are
// pure and share fixtures with the export.test.js round-trips.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeSyncAdapter,
  syncUp,
  syncDown,
  mergeStoresWithConflicts,
  portableExport,
  portableImport,
} from '../src/lib/sync.js';
import { STORE_SCHEMA_VERSION } from '../src/lib/store.js';

function memoryAdapter(remote = null, log = []) {
  return {
    pull: async () => remote,
    push: async (payload) => { log.push(payload); return true; },
  };
}

const baseStore = {
  version: STORE_SCHEMA_VERSION,
  onboarding: null,
  activeSchedule: null,
  activeWorkout: null,
  history: [],
  preferences: {},
  readinessLog: [],
  programHistory: [],
  eventHistory: [],
};

test('makeSyncAdapter accepts a pull-only or push-only adapter but not an empty one', async () => {
  const pullOnly = makeSyncAdapter({ pull: async () => null });
  assert.equal(typeof pullOnly.pull, 'function');
  assert.equal(pullOnly.push, undefined);
  await assert.doesNotReject(() => makeSyncAdapter({ push: async () => true }).push());
  assert.throws(() => makeSyncAdapter({}), /needs at least one of pull/);
  assert.throws(() => makeSyncAdapter(), /needs at least one of pull/);
});

test('syncUp pushes the export payload and returns it', async () => {
  const log = [];
  const store = { ...baseStore, history: [{ id: 'a', dateISO: '2026-01-01', blocks: [] }] };
  const payload = await syncUp(store, memoryAdapter(null, log));
  assert.equal(log.length, 1);
  assert.equal(payload, log[0]);
  assert.equal(payload.app, 'arise');
  assert.equal(payload.data.history[0].id, 'a');
});

test('syncUp without a push adapter still builds the payload; without a store it fails loudly', async () => {
  const payload = await syncUp({ ...baseStore });
  assert.equal(payload.app, 'arise');
  await assert.rejects(() => syncUp(null, memoryAdapter()), /needs the current store/);
  await assert.rejects(() => syncUp({ ...baseStore }, { push: 'not-a-function' }), /adapter.push must be a function/);
});

test('syncDown with no adapter or an empty remote is a no-op', async () => {
  const current = { ...baseStore, history: [{ id: 'a', dateISO: '2026-01-01', blocks: [] }] };
  assert.equal(await syncDown(current, null), current);
  assert.equal(await syncDown(current, memoryAdapter(null)), current);
  assert.equal(await syncDown(current, memoryAdapter('')), current);
});

test('syncDown merge pulls the remote payload and merges by id', async () => {
  const remote = JSON.stringify({
    app: 'arise',
    version: 3,
    data: { ...baseStore, history: [{ id: 'b', dateISO: '2026-01-02', blocks: [] }] },
  });
  const current = { ...baseStore, history: [{ id: 'a', dateISO: '2026-01-01', blocks: [] }] };
  const merged = await syncDown(current, memoryAdapter(remote));
  assert.deepEqual(merged.history.map((h) => h.id), ['a', 'b']);
});

test('syncDown accepts a pull that returns an already-parsed object', async () => {
  const remote = { app: 'arise', data: { ...baseStore, history: [{ id: 'b', dateISO: '2026-01-02', blocks: [] }] } };
  const merged = await syncDown({ ...baseStore }, memoryAdapter(remote));
  assert.deepEqual(merged.history.map((h) => h.id), ['b']);
});

test('syncDown rejects an unknown strategy before touching the adapter', async () => {
  const current = { ...baseStore };
  // The typo'd strategy name used to be treated as "merge"; now it fails loudly.
  await assert.rejects(() => syncDown(current, memoryAdapter('{"app":"arise"}'), 'replase'), /unknown strategy/);
  // The adapter must not even be consulted: a broken pull stays unexercised.
  await assert.rejects(
    () => syncDown(current, { pull: async () => { throw new Error('pull should not run'); } }, 'nonsense'),
    /unknown strategy/,
  );
  await assert.rejects(() => syncDown(current, { pull: async () => null }, 42), /unknown strategy/);
  await assert.rejects(() => syncDown(current, { pull: 'nope' }), /adapter.pull must be a function/);
});

test('syncDown surfaces unreadable remotes with the import errors, not a crash', async () => {
  await assert.rejects(() => syncDown({ ...baseStore }, memoryAdapter('not json')), /Not valid JSON/);
  await assert.rejects(
    () => syncDown({ ...baseStore }, memoryAdapter(JSON.stringify({ app: 'revise', data: { history: [] } }))),
    /not for Arise/,
  );
  await assert.rejects(
    () => syncDown({ ...baseStore }, memoryAdapter(JSON.stringify({ app: 'arise', data: { version: 99, history: [] } }))),
    /newer than this app supports/,
  );
});

test('syncDown replace adopts the remote store wholesale at the current schema version', async () => {
  const remote = JSON.stringify({
    app: 'arise',
    data: { ...baseStore, history: [{ id: 'b', dateISO: '2026-01-02', blocks: [] }] },
  });
  const current = { ...baseStore, history: [{ id: 'a', dateISO: '2026-01-01', blocks: [] }] };
  const replaced = await syncDown(current, memoryAdapter(remote), 'replace');
  assert.deepEqual(replaced.history.map((h) => h.id), ['b']);
  assert.equal(replaced.version, STORE_SCHEMA_VERSION);
});

test('mergeStoresWithConflicts resolves per-session conflicts by savedAt (last write wins)', () => {
  const current = {
    ...baseStore,
    history: [{ id: 'x', dateISO: '2026-01-01', savedAt: '2026-01-01T10:00:00Z', blocks: [] }],
  };
  const imported = {
    ...baseStore,
    history: [{ id: 'x', dateISO: '2026-01-01', savedAt: '2026-01-02T10:00:00Z', blocks: [{ exerciseId: 'push-up', sets: [] }] }],
  };
  const merged = mergeStoresWithConflicts(current, imported);
  assert.equal(merged.history[0].blocks.length, 1);
});

test('an imported row without savedAt loses to a current row with one', () => {
  const current = {
    ...baseStore,
    history: [{ id: 'x', dateISO: '2026-01-01', savedAt: '2026-01-01T10:00:00Z', blocks: [] }],
  };
  const imported = {
    ...baseStore,
    history: [{ id: 'x', dateISO: '2026-01-01', blocks: [{ exerciseId: 'push-up', sets: [] }] }],
  };
  const merged = mergeStoresWithConflicts(current, imported);
  assert.equal(merged.history[0].blocks.length, 0);
});

// Regression: the conflict comparator used to Date.parse(h.savedAt ||
// h.dateISO), and a hand-edited entry with savedAt 'null'/'garbage' produced
// NaN; NaN >= NaN is false, so the branch never fired and the CURRENT row
// always won regardless of recency. Both sides are now timestamped via a
// guarded helper that never returns NaN.
test('garbage timestamps decide ties deterministically instead of NaN-vetoing the imported row', () => {
  const stale = { id: 'x', dateISO: '2026-01-01', savedAt: 'garbage', blocks: [] };
  const fresh = { id: 'x', dateISO: '2026-01-02', savedAt: 'garbage', blocks: [{ exerciseId: 'push-up', sets: [] }] };
  const merged = mergeStoresWithConflicts({ ...baseStore, history: [stale] }, { ...baseStore, history: [fresh] });
  assert.equal(merged.history[0].blocks.length, 1, 'equal-garbage falls back to dateISO, where the import is newer');
  const mergedOtherWay = mergeStoresWithConflicts({ ...baseStore, history: [fresh] }, { ...baseStore, history: [stale] });
  assert.equal(mergedOtherWay.history[0].blocks.length, 1, 'and the newer dateISO still wins from either side');
});

test('entries missing savedAt and dateISO are timestamped as oldest, not crashing the merge', () => {
  const current = { ...baseStore, history: [{ id: 'a', blocks: [] }, { id: 'b', dateISO: '2026-01-02', blocks: [] }] };
  const imported = { ...baseStore, history: [{ id: 'a', blocks: [{ exerciseId: 'push-up', sets: [] }] }] };
  const merged = mergeStoresWithConflicts(current, imported);
  assert.equal(merged.history.length, 2);
  assert.equal(merged.history[0].blocks.length, 1, 'the no-date row sorts first (oldest), not NaN-first');
  assert.equal(merged.history[0].id, 'a');
});

test('merged history is ordered chronologically even when inputs arrive in reverse', () => {
  const current = {
    ...baseStore,
    history: [
      { id: 'c', dateISO: '2026-01-03', blocks: [] },
      { id: 'a', dateISO: '2026-01-01', blocks: [] },
    ],
  };
  const imported = { ...baseStore, history: [{ id: 'b', dateISO: '2026-01-02', blocks: [] }] };
  const merged = mergeStoresWithConflicts(current, imported);
  assert.deepEqual(merged.history.map((h) => h.id), ['a', 'b', 'c']);
});

test('preferences keep explicit current values and adopt keys only the import has', () => {
  const current = { ...baseStore, preferences: { units: 'kg', telemetryEnabled: true } };
  const imported = { ...baseStore, preferences: { units: 'lb', autoRest: false } };
  const merged = mergeStoresWithConflicts(current, imported);
  assert.equal(merged.preferences.units, 'kg');
  assert.equal(merged.preferences.telemetryEnabled, true);
  assert.equal(merged.preferences.autoRest, false);
});

test('event history merges by id and readiness rows keep one row per date+at key', () => {
  const current = {
    ...baseStore,
    eventHistory: [{ id: 'e1', at: '2026-01-01T00:00:00Z' }, { id: 'e2', at: '2026-01-03T00:00:00Z' }],
    readinessLog: [{ dateISO: '2026-01-01', at: '09:00', score: 3 }],
  };
  const imported = {
    ...baseStore,
    eventHistory: [{ id: 'e2', at: '2026-01-03T00:00:00Z' }, { id: 'e3', at: '2026-01-02T00:00:00Z' }],
    readinessLog: [{ dateISO: '2026-01-01', at: '09:00', score: 4 }, { dateISO: '2026-01-02', at: '10:00', score: 2 }],
  };
  const merged = mergeStoresWithConflicts(current, imported);
  assert.deepEqual(merged.eventHistory.map((e) => e.id), ['e1', 'e3', 'e2']);
  assert.equal(merged.readinessLog.length, 2, 'the identical dateISO+at row is not duplicated');
  assert.deepEqual(merged.readinessLog.map((r) => r.dateISO), ['2026-01-01', '2026-01-02']);
});

test('programHistory dedups on programId+version and the merged version never regresses', () => {
  const current = { ...baseStore, programHistory: [{ programId: 'p1', version: 1 }] };
  const imported = { ...baseStore, version: 4, programHistory: [{ programId: 'p1', version: 1 }, { programId: 'p2', version: 1 }] };
  const merged = mergeStoresWithConflicts(current, imported);
  assert.deepEqual(merged.programHistory, [{ programId: 'p1', version: 1 }, { programId: 'p2', version: 1 }]);
  assert.equal(merged.version, STORE_SCHEMA_VERSION, 'a newer import cannot raise it, but it never drops below the schema');
});

test('the merged result keeps the current store identity on onboarding/schedule/health', () => {
  const current = {
    ...baseStore,
    onboarding: { goal: 'strength' },
    activeSchedule: { programId: 'p1' },
    healthSummary: { steps: 1000 },
  };
  const merged = mergeStoresWithConflicts(current, { ...baseStore });
  assert.deepEqual(merged.onboarding, { goal: 'strength' });
  assert.deepEqual(merged.activeSchedule, { programId: 'p1' });
  assert.deepEqual(merged.healthSummary, { steps: 1000 });
  const adopted = mergeStoresWithConflicts({ ...baseStore }, current);
  assert.deepEqual(adopted.onboarding, { goal: 'strength' }, 'missing current fields are adopted from the import');
});

test('portableExport round-trips through portableImport in merge and replace', () => {
  const store = { ...baseStore, history: [{ id: 'a', dateISO: '2026-01-01', blocks: [] }], preferences: { units: 'kg' } };
  const payload = portableExport(store);
  const imported = portableImport(JSON.stringify(payload), { ...baseStore, history: [{ id: 'b', dateISO: '2026-01-02', blocks: [] }] });
  assert.deepEqual(imported.history.map((h) => h.id), ['a', 'b']);
  const replaced = portableImport(JSON.stringify(payload), { ...baseStore, history: [{ id: 'b', dateISO: '2026-01-02', blocks: [] }] }, 'replace');
  assert.deepEqual(replaced.history.map((h) => h.id), ['a']);
  assert.throws(() => portableImport(JSON.stringify(payload), { ...baseStore }, 'replase'), /unknown strategy/);
  assert.throws(() => portableImport('not json', { ...baseStore }), /Not valid JSON/);
});
