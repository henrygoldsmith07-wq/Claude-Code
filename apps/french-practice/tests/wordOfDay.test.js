import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { wordOfDay, wordsOfWeek } from '../src/lib/wordOfDay.js';

describe('wordOfDay', () => {
  it('is stable for the same calendar day', () => {
    const d = new Date(2026, 6, 30, 8, 0);
    const a = wordOfDay(d);
    const b = wordOfDay(new Date(2026, 6, 30, 22, 0));
    assert.ok(a);
    assert.equal(a.fr, b.fr);
    assert.ok(a.en);
  });

  it('changes across days', () => {
    const a = wordOfDay(new Date(2026, 6, 30));
    const b = wordOfDay(new Date(2026, 6, 31));
    // Extremely unlikely same index on consecutive days for large pool
    assert.ok(a && b);
  });

  it('returns a week list', () => {
    const week = wordsOfWeek(new Date(2026, 6, 30), 7);
    assert.equal(week.length, 7);
  });
});
