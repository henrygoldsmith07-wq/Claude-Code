// Tests for apps/arise/src/lib/telemetry.js — the consent-gated local event log.
//
// The module touches localStorage only inside its functions, so each test
// installs a private stub on globalThis and removes it afterwards. No jsdom,
// no network, no filesystem.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KEY,
  EVENT_LIMIT,
  recordEvent,
  getEventHistory,
  replaceEventHistory,
  mergeEventHistory,
  clearTelemetry,
  workoutCompletionStats,
  recommendationAcceptanceStats,
  loggingTimeStats,
  telemetrySummary,
} from '../src/lib/telemetry.js';
import { KEY as STORE_KEY } from '../src/lib/store.js';

function installStorage(initial = {}) {
  const backing = new Map(Object.entries(initial));
  const storage = {
    getItem: (k) => (backing.has(k) ? backing.get(k) : null),
    setItem: (k, v) => { backing.set(k, String(v)); },
    removeItem: (k) => { backing.delete(k); },
    clear: () => backing.clear(),
  };
  globalThis.localStorage = storage;
  return { storage, backing, restore: () => { delete globalThis.localStorage; } };
}

const CONSENT = JSON.stringify({ version: 6, preferences: { telemetryEnabled: true } });
const NO_CONSENT = JSON.stringify({ version: 6, preferences: { telemetryEnabled: false } });

test('recordEvent is a no-op without telemetry consent (essential events excepted)', () => {
  const t = installStorage({ [STORE_KEY]: NO_CONSENT });
  try {
    assert.equal(recordEvent('session:start'), null);
    assert.equal(recordEvent('session:start', {}, { essential: true })?.type, 'session:start');
    assert.deepEqual(getEventHistory().map((e) => e.type), ['session:start']);
  } finally { t.restore(); }
});

test('recordEvent pins identity after the payload spread', () => {
  const t = installStorage({ [STORE_KEY]: CONSENT });
  try {
    const e = recordEvent('session:complete', { id: 'spoofed', type: 'recommendation:shown', at: 'yesterday' });
    assert.notEqual(e.id, 'spoofed');
    assert.equal(e.type, 'session:complete');
    assert.equal(typeof e.at, 'string');
    assert.equal(Number.isNaN(Date.parse(e.at)), false);
  } finally { t.restore(); }
});

// Regression: normaliseEvents used to spread the stored event over the pinned
// identity fields, so a payload containing id:null overwrote the generated
// fallback id and every such event deduped to the single id `null`.
test('legacy/imported events with a null id keep distinct fallback ids', () => {
  const t = installStorage({ [STORE_KEY]: CONSENT });
  try {
    replaceEventHistory([
      { type: 'session:start', id: null, at: '2026-01-01T00:00:00Z', sessionId: 's1' },
      { type: 'session:complete', id: null, at: '2026-01-02T00:00:00Z', sessionId: 's1' },
    ]);
    const events = getEventHistory();
    assert.equal(events.length, 2, 'two events with id:null must not dedup to one row');
    const ids = new Set(events.map((e) => e.id));
    assert.equal(ids.size, 2, 'fallback ids must be distinct');
    for (const id of ids) assert.equal(typeof id, 'string');
    assert.equal(events[0].type, 'session:start');
  } finally { t.restore(); }
});

test('normalise drops non-object rows and rows without a string type', () => {
  const t = installStorage({ [STORE_KEY]: CONSENT });
  try {
    replaceEventHistory([null, 5, 'x', { at: 1 }, { type: 'session:start' }]);
    assert.equal(getEventHistory().length, 1);
  } finally { t.restore(); }
});

test('a missing schemaVersion in a stale payload is backfilled, a given one is kept', () => {
  const t = installStorage({ [STORE_KEY]: CONSENT });
  try {
    replaceEventHistory([{ type: 'a' }, { type: 'b', schemaVersion: 3 }]);
    const [a, b] = getEventHistory();
    assert.equal(a.schemaVersion, 1);
    assert.equal(b.schemaVersion, 3);
  } finally { t.restore(); }
});

test('mergeEventHistory dedups by id and keeps the newest tail of the capped log', () => {
  const t = installStorage({ [STORE_KEY]: CONSENT });
  try {
    replaceEventHistory([
      { id: 'a', type: 'session:start' },
      { id: 'b', type: 'session:start' },
    ]);
    mergeEventHistory([
      { id: 'b', type: 'session:start' }, // duplicate id — merged away
      { id: 'c', type: 'session:start' },
    ]);
    const ids = getEventHistory().map((e) => e.id);
    assert.deepEqual(ids, ['a', 'b', 'c']);
  } finally { t.restore(); }
});

test('the event log is capped at EVENT_LIMIT entries', () => {
  const t = installStorage({ [STORE_KEY]: CONSENT });
  try {
    replaceEventHistory(Array.from({ length: EVENT_LIMIT + 50 }, (_, i) => ({ id: `e${i}`, type: 'x' })));
    const events = getEventHistory();
    assert.equal(events.length, EVENT_LIMIT);
    assert.equal(events[0].id, 'e50', 'oldest rows are evicted, not newest');
    assert.equal(events.at(-1).id, `e${EVENT_LIMIT + 49}`);
  } finally { t.restore(); }
});

test('clearTelemetry removes both the current and the legacy key', () => {
  const t = installStorage();
  try {
    t.backing.set(KEY, '{"events":[]}');
    t.backing.set('arise.telemetry.v1', '{"events":[]}');
    clearTelemetry();
    assert.equal(t.backing.has(KEY), false);
    assert.equal(t.backing.has('arise.telemetry.v1'), false);
  } finally { t.restore(); }
});

test('legacy events load before current ones and survive the merge into the new key', () => {
  const t = installStorage({
    'arise.telemetry.v1': JSON.stringify({ events: [{ id: 'old-1', type: 'session:start' }] }),
    [STORE_KEY]: CONSENT,
  });
  try {
    assert.deepEqual(getEventHistory().map((e) => e.id), ['old-1']);
    recordEvent('session:complete');
    const ids = getEventHistory().map((e) => e.id);
    assert.deepEqual(ids, ['old-1', ids[1]], 'legacy row stays ahead of the new one');
    assert.ok(Number.isFinite(Date.parse(getEventHistory()[1].at)));
    // recordEvent merges the legacy tail into the v2 payload; it does not
    // delete the legacy key (clearTelemetry owns that), so a re-read must not
    // duplicate the legacy row (dedup by id keeps it at one).
    assert.equal(t.backing.has('arise.telemetry.v1'), true, 'legacy key is left in place for clearTelemetry');
    assert.deepEqual(getEventHistory().map((e) => e.id), ids, 'no duplicate from the still-present legacy key');
  } finally { t.restore(); }
});

test('corrupt localStorage payloads fall back to empty rather than throwing', () => {
  const t = installStorage({ [KEY]: '{not json' });
  try {
    assert.deepEqual(getEventHistory(), []);
    assert.equal(telemetrySummary().totalEvents, 0);
  } finally { t.restore(); }
});

test('workoutCompletionStats counts unique sessions and excludes abandoned from completion', () => {
  const events = [
    { type: 'session:start', sessionId: 's1' },
    { type: 'session:complete', sessionId: 's1' },
    { type: 'session:start', sessionId: 's2' },
    { type: 'session:start', sessionId: 's2' }, // duplicate start — one session
    { type: 'session:abandon', sessionId: 's2' },
    { type: 'session:start', sessionId: 's3' }, // still open — not terminal
  ];
  const stats = workoutCompletionStats(events);
  assert.equal(stats.started, 3);
  assert.equal(stats.completed, 1);
  assert.equal(stats.abandoned, 1);
  assert.equal(stats.completionRate, Math.round((1 / 3) * 100) / 100);
  assert.equal(stats.abandonmentRate, Math.round((1 / 2) * 100) / 100);
});

test('workoutCompletionStats falls back to raw rows when sessions carry no ids', () => {
  const stats = workoutCompletionStats([
    { type: 'session:start' },
    { type: 'session:start' },
    { type: 'session:complete' },
    { type: 'session:complete' },
    { type: 'session:abandon' },
  ]);
  assert.equal(stats.started, 2);
  assert.equal(stats.completed, 2);
  assert.equal(stats.abandoned, 1);
  assert.equal(stats.completionRate, 1);
  assert.equal(stats.abandonmentRate, Math.round((1 / 3) * 100) / 100);
});

test('workoutCompletionStats reports null rates with no history', () => {
  assert.equal(workoutCompletionStats([]).completionRate, null);
  assert.equal(workoutCompletionStats([]).abandonmentRate, null);
  assert.equal(workoutCompletionStats([]).started, 0);
});

test('recommendationAcceptanceStats uses shown as its denominator', () => {
  const stats = recommendationAcceptanceStats([
    { type: 'recommendation:shown' },
    { type: 'recommendation:shown' },
    { type: 'recommendation:shown' },
    { type: 'recommendation:accepted' },
    { type: 'recommendation:dismissed' },
    { type: 'recommendation:accepted' }, // accepted without a shown row still counts
  ]);
  assert.equal(stats.shown, 3);
  assert.equal(stats.accepted, 2);
  assert.equal(stats.dismissed, 1);
  assert.equal(stats.acceptanceRate, Math.round((2 / 3) * 100) / 100);
});

test('loggingTimeStats computes mean, median and p90 over non-negative durations', () => {
  const stats = loggingTimeStats([
    { elapsedMs: 5000 },
    { elapsedMs: 10000 },
    { elapsedMs: 20000 },
    { elapsedMs: -3 }, // invalid — ignored
    { elapsedMs: 'nope' }, // invalid — ignored
    {}, // missing — ignored
  ]);
  assert.equal(stats.n, 3);
  assert.equal(stats.medianMs, 10000);
  assert.equal(stats.meanMs, Math.round((5000 + 10000 + 20000) / 3));
  assert.equal(stats.p90Ms, 20000);
  assert.equal(stats.under10sPct, Math.round((2 / 3) * 100));
});

test('loggingTimeStats returns nulls when there is nothing to aggregate', () => {
  assert.deepEqual(loggingTimeStats([]), { n: 0, meanMs: null, medianMs: null, p90Ms: null, under10sPct: null });
  assert.equal(loggingTimeStats([{ elapsedMs: 'x' }]).n, 0);
});

test('telemetrySummary reads the consented log and reports the store schema version', () => {
  const t = installStorage({ [STORE_KEY]: CONSENT });
  try {
    recordEvent('session:start', { sessionId: 's1' });
    const summary = telemetrySummary();
    assert.equal(summary.totalEvents, 1);
    assert.equal(summary.schemaVersion, 6);
    assert.equal(summary.completion.started, 1);
    assert.deepEqual(Object.keys(summary), ['completion', 'recommendation', 'logging', 'totalEvents', 'schemaVersion']);
  } finally { t.restore(); }
});
