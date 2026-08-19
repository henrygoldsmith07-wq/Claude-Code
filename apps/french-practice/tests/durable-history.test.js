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

test('last-10 session storage migrates to an uncapped canonical history', async () => {
  globalThis.localStorage = memoryStorage();
  const legacy = Array.from({ length: 10 }, (_, i) => ({ id: `legacy-${i}`, scenarioId: 'cafe', date: `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` }));
  globalThis.localStorage.setItem('fp.sessions', JSON.stringify(legacy));
  const storage = await import(`../src/lib/storage.js?history-test=${Date.now()}`);

  assert.equal(storage.getSessions().length, 10);
  assert.equal(JSON.parse(globalThis.localStorage.getItem(storage.KEYS.sessionHistory)).length, 10);
  assert.equal(JSON.parse(globalThis.localStorage.getItem(storage.KEYS.migrations))['sessions.last-10-to-full-history.v1'].imported, 10);

  storage.saveSession({ id: 'new-session', scenarioId: 'market', turns: 3 });
  assert.equal(storage.getSessions().length, 11);
  assert.equal(JSON.parse(globalThis.localStorage.getItem('fp.sessions')).length, 11);
  assert.equal(storage.getSessions().at(-1).id, 'new-session');
});

test('each review stores a rich event and feeds vocabulary gaps into the learner model', async () => {
  globalThis.localStorage = memoryStorage();
  const storage = await import(`../src/lib/storage.js?review-event-test=${Date.now()}`);

  storage.rateCard('bonjour', 'again', { mode: 'productive', skill: 'vocabulary', itemLabel: 'bonjour', elapsedMs: 1200, source: 'test' });
  const [event] = storage.getReviewEvents();
  assert.equal(event.kind, 'review');
  assert.equal(event.itemLabel, 'bonjour');
  assert.equal(event.rating, 'again');
  assert.equal(event.mode, 'productive');
  assert.equal(event.correct, false);
  assert.equal(event.elapsedMs, 1200);

  let gap = storage.getLearnerErrors({ includeResolved: true, limit: 10 }).find((entry) => entry.key === 'item:bonjour');
  assert.equal(gap.category, 'vocabulary');
  assert.equal(gap.errorCount, 1);

  storage.rateCard('bonjour', 'good', { mode: 'productive', skill: 'vocabulary', itemLabel: 'bonjour' });
  storage.rateCard('bonjour', 'good', { mode: 'productive', skill: 'vocabulary', itemLabel: 'bonjour' });
  gap = storage.getLearnerErrors({ includeResolved: true, limit: 10 }).find((entry) => entry.key === 'item:bonjour');
  assert.equal(gap.status, 'resolved');
  assert.equal(gap.successCount, 2);
  assert.equal(storage.getStudyEvents().filter((event) => event.type === 'review').length, 3);
});
