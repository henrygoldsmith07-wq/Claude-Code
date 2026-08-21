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

test('second marks require a different rater and set doubleMarked', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?second-mark-test=${Date.now()}`);

  const entry = storage.recordCorpusEntry({
    mode: 'speaking', prompt: 'Au marché', response: 'Je voudrais des pommes', aiScore: 64,
  });
  // First mark
  storage.updateCorpusHumanMark(entry.id, { humanScore: 70, humanCorrections: '<s>voudrais</s>', rater: 'Mme Roux' });
  // Second mark by the same rater is rejected — agreement against itself is meaningless
  assert.equal(storage.updateCorpusSecondMark(entry.id, { humanScore2: 70, rater2: 'Mme Roux' }), null);
  const marked = storage.updateCorpusSecondMark(entry.id, { humanScore2: 74, rater2: 'M. Leroy' });
  assert.ok(marked);
  assert.equal(marked.doubleMarked, true);
  assert.equal(marked.consensus, '72'); // mean of the two raters

  const metrics = storage.getCorpusMetrics();
  assert.equal(metrics.doubleMarked, 1);
  assert.ok(metrics.interRater);
});

test('intelligibility benchmark store starts empty and only accepts valid labelled samples', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?benchmark-test=${Date.now()}`);

  assert.deepEqual(storage.getIntelligibilityBenchmark(), []);

  // Invalid labels are refused, not coerced
  assert.equal(storage.recordBenchmarkSample({ target: 'Bonjour', transcript: 'Bonjour', humanMean: 9 }), null);
  assert.equal(storage.recordBenchmarkSample({ target: '', transcript: 'x', humanMean: 3 }), null);

  const made = storage.recordBenchmarkSample({
    id: 'bench-001', target: 'Je voudrais un café', transcript: 'Je voudrai un café',
    humanMean: 4, raters: ['L1', 'L2', 'L3'],
  });
  assert.ok(made);
  assert.equal(made.humanMean, 4);
  assert.deepEqual(storage.getIntelligibilityBenchmark().map((s) => s.id), ['bench-001']);

  // Re-import with the same id replaces rather than duplicates
  storage.recordBenchmarkSample({ id: 'bench-001', target: 'x', transcript: 'y', humanMean: 2 });
  assert.equal(storage.getIntelligibilityBenchmark().length, 1);
});
