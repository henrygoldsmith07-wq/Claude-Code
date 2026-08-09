import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage shim
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createPath, retakePlacement, getPath } = await import('../src/lib/path.js');

describe('retakePlacement', () => {
  beforeEach(() => store.clear());

  it('keeps completed lessons when CEFR changes', () => {
    const first = createPath('travel', 'A2');
    first.completed = { 'tr1.0': { date: '2026-07-01' } };
    first.unitIndex = 1;
    first.lessonIndex = 2;
    const next = retakePlacement('travel', 'B1', first);
    assert.equal(next.cefr, 'B1');
    assert.equal(next.goal, 'travel');
    assert.deepEqual(next.completed, { 'tr1.0': { date: '2026-07-01' } });
    assert.equal(next.unitIndex, 1);
    assert.equal(next.lessonIndex, 2);
    assert.ok(next.lastPlacementAt);
    assert.equal(getPath().cefr, 'B1');
  });

  it('creates fresh path when none exists', () => {
    const path = retakePlacement('school', 'A1', null);
    assert.equal(path.goal, 'school');
    assert.equal(path.cefr, 'A1');
    assert.equal(path.unitIndex, 0);
  });
});
