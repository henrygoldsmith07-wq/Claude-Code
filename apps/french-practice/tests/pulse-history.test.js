import assert from 'node:assert/strict';
import { test } from 'node:test';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('Le Studio keeps durable sessions and per-review Pulse events, behind the opt-in', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?pulse-test=${Date.now()}`);
  storage.setPulseOptIn(true);
  for (let i = 0; i < 12; i += 1) storage.saveSession({ id: `session-${i}`, scenarioId: 'cafe', turns: 4 });
  assert.equal(storage.getSessions().length, 12);

  storage.rateCard('bonjour', 'good', { elapsedMs: 900, skill: 'vocab' });
  storage.rateCard('merci', 'again', { elapsedMs: 1400, skill: 'grammar' });
  assert.equal(storage.getReviewEvents().length, 2);

  const envelope = JSON.parse(globalThis.localStorage.getItem('fp.pulse-history.v2'));
  assert.equal(envelope.schemaVersion, 2);
  assert.equal(envelope.source, 'le-studio-french');
  assert.equal(envelope.records.length, 14);
  assert.equal(envelope.records.filter((record) => record.kind === 'review').length, 2);
});

test('Pulse sharing is off by default, so no mirror is written', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?pulse-gate=${Date.now()}`);
  assert.equal(storage.readPulseOptIn(), false);
  storage.saveSession({ id: 'session-1', scenarioId: 'cafe', turns: 4 });
  assert.equal(globalThis.localStorage.getItem('fp.pulse-history.v2'), null);
});

test('revoking Pulse sharing deletes the mirror and stops future writes', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?pulse-revoke=${Date.now()}`);
  storage.setPulseOptIn(true);
  storage.saveSession({ id: 'session-1', scenarioId: 'cafe', turns: 4 });
  assert.ok(globalThis.localStorage.getItem('fp.pulse-history.v2'));

  storage.setPulseOptIn(false);
  assert.equal(globalThis.localStorage.getItem('fp.pulse-opt-in'), null);
  assert.equal(globalThis.localStorage.getItem('fp.pulse-history.v2'), null);

  storage.saveSession({ id: 'session-2', scenarioId: 'cafe', turns: 4 });
  assert.equal(globalThis.localStorage.getItem('fp.pulse-history.v2'), null);
});

test('the opt-in accepts only the explicit on-value', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?pulse-value=${Date.now()}`);
  assert.equal(storage.readPulseOptIn(), false);
  storage.setPulseOptIn(true);
  assert.equal(storage.readPulseOptIn(), true);
  globalThis.localStorage.setItem('fp.pulse-opt-in', '0');
  assert.equal(storage.readPulseOptIn(), false);
});
