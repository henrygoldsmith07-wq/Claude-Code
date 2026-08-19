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

test('migrates the old recent-session window and keeps the full history', async () => {
  globalThis.localStorage = memoryStorage();
  const legacy = Array.from({ length: 10 }, (_, i) => ({
    id: `legacy-${i}`,
    date: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
    scenarioId: 'cafe',
  }));
  globalThis.localStorage.setItem('fp.sessions', JSON.stringify(legacy));
  const storage = await import(`../src/lib/storage.js?evidence-history=${Date.now()}`);

  assert.equal(storage.getSessions().length, 10);
  assert.equal(storage.getSessionHistoryMeta().migration, 'last-10-to-durable');
  storage.saveSession({ id: 'new-session', scenarioId: 'market' });
  assert.equal(storage.getSessions().length, 11);
  assert.equal(storage.getSessions().at(-1).id, 'new-session');
  assert.equal(storage.getSessionHistoryMeta().retention, 'unbounded');
});

test('stores per-review evidence and recycles gaps across modes', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?evidence-model=${Date.now()}`);

  storage.rateCard('bonjour', 'again', { mode: 'receptive', label: 'bonjour', elapsedMs: 800 });
  storage.rateCard('bonjour', 'good', { mode: 'receptive', label: 'bonjour', elapsedMs: 600 });
  const reviews = storage.getReviewEvents();
  assert.equal(reviews.length, 2);
  assert.equal(reviews[0].mode, 'vocabulary');
  assert.equal(reviews[0].reviewMode, 'receptive');
  assert.equal(reviews[0].rating, 'again');
  assert.equal(reviews[1].correct, true);

  storage.recordGrammarError('present');
  storage.recordGrammarError('present');
  storage.recordGrammarQuiz('present', 90);
  storage.recordListeningGap('track-1:0', { label: 'Choose the train', score: 40 });
  storage.recordPronunciationGap('overall', { label: 'Sentence clarity', score: 0 });

  const model = storage.getLearnerErrorModel();
  const vocabulary = model.find((entry) => entry.mode === 'vocabulary' && entry.key === 'bonjour');
  const grammar = model.find((entry) => entry.mode === 'grammar' && entry.key === 'present');
  assert.equal(vocabulary.status, 'recovering');
  assert.equal(vocabulary.successCount, 1);
  assert.deepEqual(vocabulary.recycleModes, ['vocabulary', 'speaking']);
  assert.equal(grammar.errorCount, 2);
  assert.equal(grammar.successCount, 1);
  assert.ok(model.some((entry) => entry.mode === 'listening'));
  assert.ok(model.some((entry) => entry.mode === 'pronunciation'));

  const summary = storage.getErrorModelSummary();
  assert.equal(summary.byMode.vocabulary, 1);
  assert.equal(summary.byMode.grammar, 1);
  assert.equal(summary.byMode.listening, 1);
  assert.equal(summary.byMode.pronunciation, 1);
  assert.ok(storage.getCrossModePracticeQueue().some((entry) => entry.key === 'bonjour'));
  assert.ok(storage.getReviewEvents().length >= 7);
});
