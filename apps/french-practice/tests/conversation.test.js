import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  absorbSession, applySteer, closeThread, correctionToDrill, defaultSteer, describeSteer,
  dueDrills, dueThreads, forgetFact, getFact, getMemory, grammarToRecycle, markGrammarElicited,
  markVocabUsed, memoryBrief, noteTopic, openThread, parseSteer, partnerDirective, queueCorrections,
  queueGrammar, queueVocab, recordRetry, recyclingDirective, rememberFact, saveMemory, scaffolding,
  vocabToRecycle,
} from '../src/lib/conversation.js';

// An in-memory storage double so none of this touches localStorage.
const makeStorage = () => {
  const map = new Map();
  return { get: (k) => map.get(k) ?? null, set: (k, v) => map.set(k, v) };
};

const empty = () => getMemory(makeStorage());

describe('facts', () => {
  it('replaces rather than accumulates contradictions', () => {
    let m = rememberFact(empty(), 'job', 'nurse');
    m = rememberFact(m, 'job', 'teacher');
    assert.equal(getFact(m, 'job'), 'teacher');
    assert.equal(m.facts.filter((f) => f.key === 'job').length, 1);
  });

  it('never evicts identity facts to make room', () => {
    let m = rememberFact(empty(), 'name', 'Alys');
    for (let i = 0; i < 80; i += 1) m = rememberFact(m, `misc${i}`, `value ${i}`);
    assert.equal(getFact(m, 'name'), 'Alys');
  });

  it('forgets on request', () => {
    const m = forgetFact(rememberFact(empty(), 'city', 'Cardiff'), 'city');
    assert.equal(getFact(m, 'city'), null);
  });

  it('ignores empty writes', () => {
    assert.equal(rememberFact(empty(), 'job', '').facts.length, 0);
    assert.equal(rememberFact(empty(), '', 'x').facts.length, 0);
  });
});

describe('topics and threads', () => {
  it('counts repeat topics rather than duplicating them', () => {
    let m = noteTopic(empty(), 'cycling');
    m = noteTopic(m, 'cycling');
    assert.equal(m.topics.length, 1);
    assert.equal(m.topics[0].times, 2);
  });

  it('only surfaces threads that are due', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    let m = openThread(empty(), { id: 'exam', summary: 'GCSE speaking next week', due: future });
    assert.equal(dueThreads(m).length, 0);
    m = openThread(m, { id: 'trip', summary: 'trip to Lyon' }); // no due date = always due
    assert.equal(dueThreads(m).length, 1);
    m = closeThread(m, 'trip');
    assert.equal(dueThreads(m).length, 0);
  });

  it('builds a brief that stays short', () => {
    let m = rememberFact(empty(), 'name', 'Alys');
    m = rememberFact(m, 'city', 'Cardiff');
    for (let i = 0; i < 12; i += 1) m = noteTopic(m, `topic ${i}`);
    const brief = memoryBrief(m);
    assert.match(brief, /Alys/);
    assert.match(brief, /Already discussed/);
    assert.ok(brief.length < 600, `brief too long: ${brief.length}`);
  });

  it('is empty for a new learner', () => {
    assert.equal(memoryBrief(empty()), '');
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const storage = makeStorage();
    saveMemory(rememberFact(getMemory(storage), 'name', 'Rhys'), storage);
    assert.equal(getFact(getMemory(storage), 'name'), 'Rhys');
  });

  it('survives corrupt stored data', () => {
    const storage = makeStorage();
    storage.set('fp.conversationMemory', '{not json');
    const m = getMemory(storage);
    assert.deepEqual(m.facts, []);
    assert.ok(Array.isArray(m.recycle.corrections));
  });
});

describe('steering', () => {
  it('returns null for ordinary conversation', () => {
    assert.equal(parseSteer("J'ai mangé une pomme ce matin."), null);
    assert.equal(parseSteer(''), null);
    assert.equal(parseSteer(null), null);
  });

  it('parses pace, strictness, register and topic', () => {
    assert.ok(parseSteer('can you speak slower please').ids.includes('slower'));
    assert.ok(parseSteer('be stricter with me').ids.includes('stricter'));
    assert.ok(parseSteer('on se tutoie ?').ids.includes('informal'));
    assert.equal(parseSteer("let's talk about cycling").topic, 'cycling');
    assert.equal(parseSteer('parlons de la politique française.').topic, 'la politique française');
  });

  it('applies steers cumulatively and stays in range', () => {
    let steer = defaultSteer('B1');
    for (let i = 0; i < 20; i += 1) steer = applySteer(steer, parseSteer('slower'));
    assert.ok(steer.pace >= 0.6, `pace ran away to ${steer.pace}`);
    for (let i = 0; i < 40; i += 1) steer = applySteer(steer, parseSteer('faster'));
    assert.ok(steer.pace <= 1.4);
  });

  it('moves complexity without leaving the ladder', () => {
    let steer = defaultSteer('A1');
    for (let i = 0; i < 10; i += 1) steer = applySteer(steer, parseSteer('harder'));
    assert.equal(steer.complexity, 'C2');
    for (let i = 0; i < 20; i += 1) steer = applySteer(steer, parseSteer('simpler'));
    assert.equal(steer.complexity, 'A1');
  });

  it('describes what it did, for the UI', () => {
    assert.match(describeSteer(parseSteer('slower and be stricter')), /slower/);
    assert.equal(describeSteer(null), null);
  });
});

describe('scaffolding', () => {
  it('follows the level curve when the learner has not steered', () => {
    assert.equal(scaffolding('A1', 0.5).captions, 'always');
    assert.equal(scaffolding('C1', 0.5).captions, 'off');
  });

  it('lets an explicit steer override the level default', () => {
    const forced = scaffolding('A1', 0.5, { ...defaultSteer('A1'), translations: 'off' });
    assert.equal(forced.translation, 'off');
    assert.equal(forced.captions, 'off');
  });
});

describe('partnerDirective', () => {
  it('folds level, steer and memory into one instruction', () => {
    let m = rememberFact(empty(), 'name', 'Alys');
    m = openThread(m, { id: 'exam', summary: 'GCSE speaking next week' });
    const directive = partnerDirective({ level: 'B2', confidence: 0.6, memory: m });
    assert.match(directive, /CEFR B2/);
    assert.match(directive, /Alys/);
    assert.match(directive, /GCSE speaking/);
    assert.match(directive, /at least \d+ exchanges/);
  });

  it('asks for longer conversations at higher levels', () => {
    const a1 = partnerDirective({ level: 'A1' });
    const c1 = partnerDirective({ level: 'C1' });
    const turns = (s) => Number(s.match(/at least (\d+) exchanges/)[1]);
    assert.ok(turns(c1) > turns(a1));
  });

  it('honours a request for no English', () => {
    const steer = applySteer(defaultSteer('A1'), parseSteer('no english please'));
    assert.match(partnerDirective({ level: 'A1', steer }), /Never translate/);
  });

  it('switches register on request', () => {
    const steer = applySteer(defaultSteer('B1'), parseSteer('on se tutoie'));
    assert.match(partnerDirective({ level: 'B1', steer }), /«tu»/);
  });
});

describe('correction recycling', () => {
  const correction = { wrong: "j'ai allé", right: 'je suis allé', why: 'aller takes être', topicId: 'passe-compose' };

  it('turns a correction into a drill that needs more than one pass', () => {
    const drill = correctionToDrill(correction);
    assert.equal(drill.needed, 2);
    assert.equal(drill.passed, 0);
    assert.equal(drill.topicId, 'passe-compose');
  });

  it('ignores malformed corrections', () => {
    assert.equal(correctionToDrill({ wrong: 'x' }), null);
    assert.equal(correctionToDrill(null), null);
  });

  it('dedupes identical corrections across sessions', () => {
    let m = queueCorrections(empty(), [correction]);
    m = queueCorrections(m, [correction]);
    assert.equal(m.recycle.corrections.length, 1);
  });

  it('retires a drill only after the required passes', () => {
    let m = queueCorrections(empty(), [correction]);
    const id = m.recycle.corrections[0].id;
    m = recordRetry(m, id, true);
    assert.equal(m.recycle.corrections.length, 1, 'one pass is recognition, not repair');
    m = recordRetry(m, id, true);
    assert.equal(m.recycle.corrections.length, 0);
  });

  it('resets progress on a failed retry', () => {
    let m = queueCorrections(empty(), [correction]);
    const id = m.recycle.corrections[0].id;
    m = recordRetry(m, id, true);
    m = recordRetry(m, id, false);
    assert.equal(m.recycle.corrections[0].passed, 0);
  });

  it('serves the least-practised drills first', () => {
    let m = queueCorrections(empty(), [
      correction,
      { wrong: 'le maison', right: 'la maison', why: 'gender' },
    ]);
    m = recordRetry(m, m.recycle.corrections[0].id, true);
    assert.equal(dueDrills(m)[0].passed, 0);
  });
});

describe('vocabulary recycling', () => {
  it('queues only words the learner does not already know', () => {
    const m = queueVocab(empty(), [
      { fr: 'le chômage', en: 'unemployment', id: 'x1' },
      { fr: 'le pain', en: 'bread', id: 'known' },
    ], new Set(['known']));
    assert.equal(m.recycle.vocab.length, 1);
    assert.equal(m.recycle.vocab[0].fr, 'le chômage');
  });

  it('does not queue the same word twice', () => {
    let m = queueVocab(empty(), [{ fr: 'le chômage', id: 'x1' }]);
    m = queueVocab(m, [{ fr: 'le chômage', id: 'x1' }]);
    assert.equal(m.recycle.vocab.length, 1);
  });

  it('retires a word after three natural re-encounters', () => {
    let m = queueVocab(empty(), [{ fr: 'le chômage', id: 'x1' }]);
    for (let i = 0; i < 3; i += 1) m = markVocabUsed(m, ['le chômage']);
    assert.equal(m.recycle.vocab.length, 0);
  });

  it('serves least-used words first', () => {
    let m = queueVocab(empty(), [{ fr: 'un', id: 'a' }, { fr: 'deux', id: 'b' }]);
    m = markVocabUsed(m, ['un']);
    assert.equal(vocabToRecycle(m)[0].fr, 'deux');
  });
});

describe('grammar recycling', () => {
  it('ranks by how often the point was missed', () => {
    let m = queueGrammar(empty(), ['subjonctif', 'passe-compose']);
    m = queueGrammar(m, ['subjonctif']);
    assert.equal(grammarToRecycle(m)[0].topicId, 'subjonctif');
    assert.equal(grammarToRecycle(m)[0].misses, 2);
  });

  it('drops a point once it has been elicited enough', () => {
    let m = queueGrammar(empty(), ['subjonctif']);
    for (let i = 0; i < 3; i += 1) m = markGrammarElicited(m, ['subjonctif']);
    assert.equal(m.recycle.grammar.length, 0);
  });

  it('builds a directive from both queues', () => {
    let m = queueVocab(empty(), [{ fr: 'le chômage', id: 'x' }]);
    m = queueGrammar(m, ['subjonctif']);
    const directive = recyclingDirective(m);
    assert.match(directive, /le chômage/);
    assert.match(directive, /subjonctif/);
  });

  it('produces nothing when there is nothing to recycle', () => {
    assert.equal(recyclingDirective(empty()), '');
  });
});

describe('absorbSession', () => {
  it('does all the end-of-conversation housekeeping in one call', () => {
    const m = absorbSession(empty(), {
      topic: 'le travail',
      corrections: [{ wrong: "j'ai allé", right: 'je suis allé' }],
      newWords: [{ fr: 'le chômage', id: 'x1' }],
      grammarMisses: ['passe-compose'],
    });
    assert.equal(m.topics.length, 1);
    assert.equal(m.recycle.corrections.length, 1);
    assert.equal(m.recycle.vocab.length, 1);
    assert.equal(m.recycle.grammar.length, 1);
  });

  it('is a no-op on an empty session', () => {
    const m = absorbSession(empty(), {});
    assert.equal(m.topics.length, 0);
    assert.equal(m.recycle.corrections.length, 0);
  });
});
