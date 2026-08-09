import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SITUATIONS,
  EXAM,
  getSituation,
  examBand,
  situationPhraseCount,
  situationStats,
  situationTipOfDay,
  searchSituations,
} from '../src/lib/realworld.js';

describe('real-world catalogue', () => {
  it('has expanded situations and phrases', () => {
    assert.ok(SITUATIONS.length >= 25, `only ${SITUATIONS.length} situations`);
    assert.ok(situationPhraseCount() >= 180, `only ${situationPhraseCount()} phrases`);
    assert.ok(EXAM.questions.length >= 18);
  });

  it('every situation has id, title, emoji and enough phrases', () => {
    const ids = new Set();
    for (const s of SITUATIONS) {
      assert.ok(s.id && s.title && s.emoji, JSON.stringify(s.id));
      assert.ok(s.phrases?.length >= 6, `${s.id} has only ${s.phrases?.length} phrases`);
      assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
      ids.add(s.id);
      for (const p of s.phrases) {
        assert.ok(p.fr && p.en, `${s.id} phrase incomplete`);
      }
    }
  });

  it('exam answers are in range', () => {
    for (const q of EXAM.questions) {
      assert.ok(Array.isArray(q.options) && q.options.length >= 2, q.q);
      assert.ok(q.answer >= 0 && q.answer < q.options.length, q.q);
      assert.ok(q.why && q.skill, q.q);
    }
  });

  it('getSituation and stats', () => {
    assert.equal(getSituation('restaurant')?.scenarioId, 'bistro');
    assert.equal(getSituation('nope'), undefined);
    const stats = situationStats();
    assert.equal(stats.length, SITUATIONS.length);
    assert.ok(stats.some((s) => s.hasRoleplay));
  });

  it('search finds known phrases', () => {
    const hits = searchSituations('addition');
    assert.ok(hits.some((h) => h.situationId === 'restaurant'));
    assert.equal(searchSituations('').length, 0);
  });

  it('daily tip is stable for a day', () => {
    const d = new Date(2026, 6, 30, 9, 0);
    assert.equal(situationTipOfDay(d).id, situationTipOfDay(new Date(2026, 6, 30, 21, 0)).id);
    assert.ok(situationTipOfDay(d).fr);
  });

  it('examBand thresholds', () => {
    assert.equal(examBand(95).band, 'C1');
    assert.equal(examBand(75).band, 'B2');
    assert.equal(examBand(55).band, 'B1');
    assert.equal(examBand(35).band, 'A2');
    assert.equal(examBand(10).band, 'A1');
  });
});
