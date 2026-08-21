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

test('corpus, assistance log and last placement persist through storage', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?validation-store-test=${Date.now()}`);

  // Corpus: AI side recorded at feedback time, human mark paired later.
  const entry = storage.recordCorpusEntry({
    mode: 'writing',
    prompt: 'Décris ta maison',
    response: 'Ma maison est grande.',
    aiScore: 72,
    aiCorrections: '<s>grand</s> <mark>grande</mark>',
    criterion: 'accuracy',
  });
  assert.ok(entry);
  assert.equal(entry.paired, false);
  const updated = storage.updateCorpusHumanMark(entry.id, { humanScore: 70, humanCorrections: '<s>grand</s> <mark>grande</mark>', rater: 'M. Leroy' });
  assert.equal(updated.paired, true);
  const metrics = storage.getCorpusMetrics();
  assert.equal(metrics.n, 1);
  assert.equal(metrics.scores.n, 1);
  assert.ok(Number.isFinite(metrics.scores.meanAbsoluteError));

  // Assistance log: with/without events feed the dependence check.
  for (let i = 0; i < 10; i += 1) {
    storage.recordAssistanceEvent({ skill: 'listening', support: 'with', score: 90, hintsUsed: 2 });
  }
  for (let i = 0; i < 10; i += 1) {
    storage.recordAssistanceEvent({ skill: 'listening', support: 'without', score: 45 });
  }
  const asst = storage.getAssistanceMetrics();
  assert.equal(asst.n, 20);
  assert.equal(asst.dependent, true);

  // Last placement round-trips for teacher pairing.
  assert.equal(storage.getLastPlacement(), null);
  storage.saveLastPlacement({ level: 'B1', theta: 0.2, se: 0.45, itemsAsked: 12, confidence: 0.7, range: 'A2–B2' });
  const last = storage.getLastPlacement();
  assert.equal(last.level, 'B1');
  assert.equal(last.theta, 0.2);
  assert.equal(last.itemsAsked, 12);

  // Placement validation pairs persist and feed the metrics getter.
  storage.recordPlacementValidation({
    knownLevel: 'B1', placedLevel: 'B1', theta: 0.2, se: 0.45, itemsAsked: 12,
    rater: 'Ms Dupont', source: 'DELF B1',
  });
  const pv = storage.getPlacementValidationMetrics();
  assert.equal(pv.n, 1);
  assert.equal(pv.exactAgreement, 1);
});
