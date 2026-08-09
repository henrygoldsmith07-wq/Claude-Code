import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAMMAR_TOPICS,
  GRAMMAR_TOPIC_IDS,
  getGrammarTopic,
  grammarTopicOfDay,
  grammarStatsByCefr,
} from '../src/lib/grammar.js';

describe('grammar library', () => {
  it('has a large expanded catalogue', () => {
    assert.ok(GRAMMAR_TOPICS.length >= 35, `only ${GRAMMAR_TOPICS.length} topics`);
    assert.equal(GRAMMAR_TOPIC_IDS.length, new Set(GRAMMAR_TOPIC_IDS).size);
  });

  it('every topic has learn / drill / build / quiz content', () => {
    for (const t of GRAMMAR_TOPICS) {
      assert.ok(t.id && t.cefr && t.title, t.id);
      assert.ok(t.explanation?.rule, t.id);
      assert.ok((t.drills?.length || 0) >= 3, `${t.id} drills`);
      assert.ok((t.build?.length || 0) >= 1, `${t.id} build`);
      assert.ok((t.quiz?.length || 0) >= 3, `${t.id} quiz`);
      for (const d of t.drills) {
        assert.ok(d.options?.length >= 2 && d.answer >= 0 && d.answer < d.options.length, t.id);
      }
    }
  });

  it('covers A1 through C1', () => {
    const by = grammarStatsByCefr();
    assert.ok(by.A1 >= 3);
    assert.ok(by.A2 >= 4);
    assert.ok(by.B1 >= 5);
    assert.ok(by.B2 >= 5);
    assert.ok((by.C1 || 0) + (by.C2 || 0) >= 2);
  });

  it('looks up topics and daily tip', () => {
    assert.equal(getGrammarTopic('present')?.title.includes('présent') || getGrammarTopic('present')?.id, 'present' && true);
    assert.ok(getGrammarTopic('present'));
    const tip = grammarTopicOfDay(new Date(2026, 6, 30));
    assert.ok(tip?.id);
    assert.equal(tip.id, grammarTopicOfDay(new Date(2026, 6, 30, 23)).id);
  });

  it('includes new expansion topics', () => {
    for (const id of ['y-en', 'si-clauses', 'double-pronoms', 'passe-simple', 'registres', 'depuis-pendant']) {
      assert.ok(getGrammarTopic(id), `missing ${id}`);
    }
  });
});
