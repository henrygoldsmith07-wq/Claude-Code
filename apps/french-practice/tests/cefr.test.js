import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRAMMAR_INVENTORY, LEVELS, assistancePolicy, conversationTargets, coverageReport,
  grammarUpTo, isAtLeast, levelIndex, nextLevel, profileFor, promotionGate, resolveTopicId,
} from '../src/lib/cefr.js';
import { GRAMMAR_TOPICS } from '../src/lib/grammar.js';
import { vocabCountByCefr } from '../src/lib/vocab.js';

describe('level ordering', () => {
  it('orders the ladder and clamps at the ends', () => {
    assert.ok(levelIndex('B2') > levelIndex('A2'));
    assert.equal(nextLevel('C2'), 'C2');
    assert.ok(isAtLeast('B1', 'A2'));
    assert.ok(!isAtLeast('A2', 'B1'));
  });

  it('describes C2 rather than falling over on it', () => {
    const p = profileFor('C2');
    assert.ok(p.canDo.length > 0);
    assert.ok(p.vocabTarget > profileFor('C1').vocabTarget);
  });

  it('targets grow monotonically up the ladder', () => {
    for (let i = 1; i < LEVELS.length; i += 1) {
      const prev = profileFor(LEVELS[i - 1]);
      const cur = profileFor(LEVELS[i]);
      assert.ok(cur.vocabTarget > prev.vocabTarget, `${LEVELS[i]} vocab target`);
      assert.ok(cur.grammarTarget >= prev.grammarTarget, `${LEVELS[i]} grammar target`);
      assert.ok(cur.conversationTurns >= prev.conversationTurns, `${LEVELS[i]} turns`);
    }
  });
});

describe('grammar inventory', () => {
  it('accumulates lower levels', () => {
    const upToB1 = grammarUpTo('B1');
    assert.ok(upToB1.includes('present'));       // A1
    assert.ok(upToB1.includes('conditionnel'));  // B1
    assert.ok(!upToB1.includes('subjonctif-passe')); // B2
  });

  it('every shipped syllabus point resolves to a real topic', () => {
    const have = new Set(GRAMMAR_TOPICS.map((t) => t.id));
    const unresolved = [];
    for (const level of LEVELS) {
      for (const id of GRAMMAR_INVENTORY[level]) {
        if (!resolveTopicId(id, have)) unresolved.push(`${level}:${id}`);
      }
    }
    assert.deepEqual(unresolved, [], 'syllabus points with no lesson');
  });

  it('reports full coverage against the shipped library', () => {
    const report = coverageReport({ grammarTopics: GRAMMAR_TOPICS, vocabByLevel: vocabCountByCefr() });
    assert.equal(report.grammarCoverage, 100);
    for (const row of report.rows) assert.ok(row.complete, `${row.level} incomplete`);
  });

  it('reports gaps honestly when content is missing', () => {
    const report = coverageReport({ grammarTopics: ['present'], vocabByLevel: {} });
    assert.ok(report.grammarCoverage < 100);
    assert.ok(report.rows[0].grammarGaps.length > 0);
  });
});

describe('promotionGate', () => {
  const full = { vocabKnown: 99999, grammarMastered: 99, speakingAvg: 95, checkpointsPassed: 5 };

  it('needs every signal, not just one', () => {
    const onlyVocab = promotionGate('A1', { ...full, grammarMastered: 0, speakingAvg: 0, checkpointsPassed: 0 });
    assert.equal(onlyVocab.ready, false);
    assert.ok(onlyVocab.missing.length >= 3);
  });

  it('passes when all four are met, and names the next level', () => {
    const gate = promotionGate('A1', full);
    assert.equal(gate.ready, true);
    assert.equal(gate.to, 'A2');
    assert.equal(gate.progress, 1);
  });

  it('reports partial progress between 0 and 1', () => {
    const gate = promotionGate('B1', { vocabKnown: 1250, grammarMastered: 16, speakingAvg: 70, checkpointsPassed: 0 });
    assert.ok(gate.progress > 0 && gate.progress < 1);
  });
});

describe('assistancePolicy', () => {
  it('fades help as the level rises', () => {
    const a1 = assistancePolicy('A1', 0.5);
    const c1 = assistancePolicy('C1', 0.5);
    assert.ok(c1.fade > a1.fade);
    assert.equal(a1.captions, 'always');
    assert.equal(c1.captions, 'off');
    assert.ok(a1.starters > c1.starters);
    assert.equal(a1.simplifyPartner, true);
    assert.equal(c1.simplifyPartner, false);
  });

  it('holds help longer for a struggling learner at the same level', () => {
    const struggling = assistancePolicy('B1', 0);
    const confident = assistancePolicy('B1', 1);
    assert.ok(struggling.fade < confident.fade);
  });

  it('never leaves the 0..1 range', () => {
    for (const level of [...LEVELS, 'C2']) {
      for (const c of [-1, 0, 0.5, 1, 2]) {
        const p = assistancePolicy(level, c);
        assert.ok(p.fade >= 0 && p.fade <= 1, `${level} ${c} → ${p.fade}`);
      }
    }
  });
});

describe('conversationTargets', () => {
  it('gives longer conversations at higher levels', () => {
    assert.ok(conversationTargets('C1').turns > conversationTargets('A1').turns);
    assert.ok(conversationTargets('C1').maxWords > conversationTargets('A1').maxWords);
    assert.ok(conversationTargets('B2').estimatedMinutes >= 3);
  });
});
