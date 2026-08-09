import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CULTURE_SECTIONS,
  CULTURE_ENTRIES,
  CULTURE_QUIZ,
  getSectionEntries,
  cultureTipOfDay,
  searchCulture,
  cultureSectionStats,
} from '../src/lib/culture.js';

describe('culture catalogue', () => {
  it('has expanded sections and entries', () => {
    assert.ok(CULTURE_SECTIONS.length >= 12);
    assert.ok(CULTURE_ENTRIES.length >= 70);
    assert.ok(CULTURE_QUIZ.length >= 12);
  });

  it('every entry belongs to a known section', () => {
    const ids = new Set(CULTURE_SECTIONS.map((s) => s.id));
    for (const entry of CULTURE_ENTRIES) {
      assert.ok(ids.has(entry.section), `unknown section ${entry.section} on ${entry.id}`);
      assert.ok(entry.title && entry.body && entry.tip, entry.id);
    }
  });

  it('every section has at least four notes', () => {
    for (const s of cultureSectionStats()) {
      assert.ok(s.count >= 4, `${s.id} has only ${s.count}`);
    }
  });

  it('search finds known topics', () => {
    const hits = searchCulture('bonjour');
    assert.ok(hits.some((h) => h.id === 'etiquette-bonjour'));
  });

  it('daily tip is stable for a day', () => {
    const d = new Date(2026, 6, 30, 9, 0);
    assert.equal(cultureTipOfDay(d).id, cultureTipOfDay(new Date(2026, 6, 30, 21, 0)).id);
  });

  it('getSectionEntries filters', () => {
    const food = getSectionEntries('food');
    assert.ok(food.length >= 4);
    assert.ok(food.every((e) => e.section === 'food'));
  });
});
