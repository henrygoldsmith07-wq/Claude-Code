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

test('Le Studio keeps durable sessions and per-review Pulse events', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?pulse-test=${Date.now()}`);
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
