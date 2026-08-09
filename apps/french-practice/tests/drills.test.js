import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAnswer,
  scoreGuess,
  buildDrillPool,
  allSituationPhrases,
  drillXp,
} from '../src/lib/drills.js';

describe('phrase drills', () => {
  it('normalizes accents and punctuation', () => {
    assert.equal(normalizeAnswer("L'addition, s'il vous plaît !"), "l'addition s'il vous plait");
    assert.equal(normalizeAnswer('  Bonjour  '), 'bonjour');
  });

  it('scores exact and near matches', () => {
    const exact = scoreGuess("L'addition, s'il vous plaît.", "L'addition, s'il vous plaît.");
    assert.equal(exact.ok, true);
    assert.equal(exact.exact, true);

    const near = scoreGuess("L'addition s'il vous plait", "L'addition, s'il vous plaît.");
    assert.equal(near.ok, true);

    const bad = scoreGuess('bonjour', "L'addition, s'il vous plaît.");
    assert.equal(bad.ok, false);
  });

  it('builds a non-empty pool from situations', () => {
    assert.ok(allSituationPhrases().length >= 100);
    const pool = buildDrillPool({ mode: 'restaurant', limit: 5, seed: 42 });
    assert.equal(pool.length, 5);
    assert.ok(pool.every((p) => p.fr && p.en));
    // Same seed → same order
    const pool2 = buildDrillPool({ mode: 'restaurant', limit: 5, seed: 42 });
    assert.deepEqual(pool.map((p) => p.id), pool2.map((p) => p.id));
  });

  it('starred mode uses provided lines', () => {
    const starred = [{ id: 'a', fr: 'Bonjour', en: 'Hello', source: 'Test' }];
    const pool = buildDrillPool({ mode: 'starred', starred, limit: 3, seed: 1 });
    assert.equal(pool.length, 1);
    assert.equal(pool[0].fr, 'Bonjour');
  });

  it('drillXp rewards full clears', () => {
    assert.ok(drillXp(10, 10) > drillXp(8, 10));
    assert.equal(drillXp(0, 0), 0);
  });
});
