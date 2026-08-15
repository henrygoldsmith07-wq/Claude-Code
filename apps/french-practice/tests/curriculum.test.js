import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CURRICULUM_PACKS, allEntries, entriesByCefr, nextCurriculumWords, vocabCountByCefr } from '../src/lib/vocab.js';
import { GRAMMAR_TOPICS, getGrammarTopic } from '../src/lib/grammar.js';
import { LEVELS } from '../src/lib/cefr.js';
import { CURRICULUM_GRAMMAR_TOPICS } from '../src/lib/grammar-curriculum.js';
import { C1_GRAMMAR_TOPICS } from '../src/lib/grammar-c1.js';

describe('curriculum vocabulary', () => {
  it('bands every level A1–C1', () => {
    const counts = vocabCountByCefr();
    for (const level of LEVELS) {
      assert.ok(counts[level] >= 50, `${level} has only ${counts[level]} banded words`);
    }
  });

  it('has one pack per level', () => {
    assert.equal(CURRICULUM_PACKS.length, LEVELS.length);
    const levels = CURRICULUM_PACKS.map((p) => p.cefr);
    assert.deepEqual(levels, LEVELS);
  });

  it('has no duplicate ids across the whole library', () => {
    const ids = allEntries().map((e) => e.id);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    assert.deepEqual(dupes, [], `duplicate entry ids: ${dupes.slice(0, 5).join(', ')}`);
  });

  it('every curriculum card is complete', () => {
    for (const pack of CURRICULUM_PACKS) {
      for (const e of pack.entries) {
        assert.ok(e.fr, `${e.id} missing French`);
        assert.ok(e.en, `${e.id} missing English`);
        assert.ok(e.example, `${e.id} missing example`);
        assert.ok(e.exampleEn, `${e.id} missing example translation`);
        assert.equal(e.cefr, pack.cefr, `${e.id} banded ${e.cefr} in the ${pack.cefr} pack`);
        assert.ok(e.freq >= 1 && e.freq <= 5, `${e.id} frequency out of range`);
      }
    }
  });

  it('uses ASCII ids so they survive storage round-trips', () => {
    for (const pack of CURRICULUM_PACKS) {
      for (const e of pack.entries) {
        assert.ok(/^[\x20-\x7E]+$/.test(e.id), `${e.id} is not ASCII`);
      }
    }
  });

  it('the example sentence actually uses the word it teaches', () => {
    const strip = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const misses = [];
    for (const pack of CURRICULUM_PACKS) {
      for (const e of pack.entries) {
        // Take the head word, dropping articles and any "/ alternative" form.
        const head = strip(e.fr).replace(/^(le |la |les |l'|un |une |se |s')/, '').split(/[\s/]/)[0];
        if (head.length < 4) continue; // too short to match reliably
        const stem = head.slice(0, Math.max(4, head.length - 2));
        if (!strip(e.example).includes(stem)) misses.push(`${e.id} (${e.fr})`);
      }
    }
    // Verb forms conjugate, so a few legitimate misses are expected — but a
    // large number would mean the examples drifted from the entries.
    assert.ok(misses.length < 25, `${misses.length} examples do not use their word: ${misses.slice(0, 8).join(', ')}`);
  });

  it('serves the next unseen words for a level', () => {
    const known = new Set(entriesByCefr().A1.slice(0, 10).map((e) => e.id));
    const next = nextCurriculumWords('A1', known, 5);
    assert.equal(next.length, 5);
    for (const e of next) {
      assert.ok(!known.has(e.id));
      assert.equal(e.cefr, 'A1');
    }
  });

  it('returns nothing for a level with no banded content', () => {
    assert.deepEqual(nextCurriculumWords('C2', new Set(), 5), []);
  });
});

describe('curriculum grammar', () => {
  const NEW_TOPICS = [...CURRICULUM_GRAMMAR_TOPICS, ...C1_GRAMMAR_TOPICS];

  it('adds the points the library was missing', () => {
    for (const id of ['etre-avoir', 'imparfait', 'subjonctif-passe', 'concession', 'modalisation']) {
      assert.ok(getGrammarTopic(id), `${id} not registered`);
    }
  });

  it('has no duplicate topic ids', () => {
    const ids = GRAMMAR_TOPICS.map((t) => t.id);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    assert.deepEqual(dupes, []);
  });

  it('every new topic is a complete lesson', () => {
    for (const t of NEW_TOPICS) {
      assert.ok(t.title && t.summary, `${t.id} missing title/summary`);
      assert.ok(t.explanation?.rule?.length > 80, `${t.id} rule is too thin`);
      assert.ok(t.explanation.examples.length >= 3, `${t.id} needs examples`);
      assert.ok(t.explanation.watchOut, `${t.id} has no watch-out`);
      assert.ok(t.drills.length >= 4, `${t.id} needs drills`);
      assert.ok(t.build.length >= 2, `${t.id} needs sentence building`);
      assert.ok(t.quiz.length >= 4, `${t.id} needs a quiz`);
    }
  });

  it('every drill and quiz question has a valid answer and an explanation', () => {
    for (const t of NEW_TOPICS) {
      for (const q of [...t.drills, ...t.quiz]) {
        assert.ok(q.options.length >= 2, `${t.id}: "${q.q}" needs options`);
        assert.ok(q.answer >= 0 && q.answer < q.options.length, `${t.id}: "${q.q}" bad answer index`);
        assert.ok(q.why?.length > 5, `${t.id}: "${q.q}" has no explanation`);
      }
    }
  });

  it('every example is translated', () => {
    for (const t of NEW_TOPICS) {
      for (const ex of t.explanation.examples) {
        assert.ok(ex.fr && ex.en, `${t.id} has an untranslated example`);
      }
      for (const b of t.build) {
        assert.ok(b.fr && b.en, `${t.id} has an untranslated build sentence`);
      }
    }
  });

  it('bands every new topic within A1–C1', () => {
    for (const t of NEW_TOPICS) {
      assert.ok(LEVELS.includes(t.cefr), `${t.id} has level ${t.cefr}`);
    }
  });

  it('the C1 band is no longer empty', () => {
    const c1 = GRAMMAR_TOPICS.filter((t) => t.cefr === 'C1');
    assert.ok(c1.length >= 9, `only ${c1.length} C1 topics`);
  });

  it('marks the literary tenses as recognition-only', () => {
    const subj = getGrammarTopic('subjonctif-imparfait');
    assert.match(subj.explanation.watchOut, /never produce it/i);
  });
});
