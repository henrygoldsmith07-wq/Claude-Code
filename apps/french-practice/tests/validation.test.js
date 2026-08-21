import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makePlacementValidationEntry, placementValidationMetrics } from '../src/lib/placementValidation.js';
import { makeProgressionEntry, progressionValidationMetrics, buildTransferCheck } from '../src/lib/progressionValidation.js';
import { makeCorpusEntry, corpusMetrics, corpusInterRaterMetrics } from '../src/lib/writingSpeakingCorpus.js';
import { assistanceMetrics, makeAssistanceEvent } from '../src/lib/assistanceValidation.js';
import { auditContentItem, auditLibrary } from '../src/lib/contentCalibration.js';
import {
  validateTurnEvaluation, validateWritingFeedback, normalizeCorrectionsDetailed,
} from '../src/lib/aiValidate.js';

describe('placement validation infrastructure', () => {
  it('stores known level + placement result + ability + interval + items', () => {
    const entry = makePlacementValidationEntry({
      knownLevel: 'B1', placedLevel: 'B1', theta: 0.2, se: 0.45, itemsAsked: 12, rater: 'Ms Dupont', source: 'DELF B1'
    });
    assert.ok(entry);
    assert.equal(entry.knownLevel, 'B1');
    assert.equal(entry.placedLevel, 'B1');
    assert.equal(entry.theta, 0.2);
    assert.equal(entry.se, 0.45);
    assert.equal(entry.itemsAsked, 12);
    assert.equal(entry.exact, 1);
    assert.equal(entry.withinOne, 1);
  });

  it('starts empty and refuses to fabricate', () => {
    const m = placementValidationMetrics([]);
    assert.equal(m.n, 0);
    assert.equal(m.status, 'no-data');
    assert.match(m.message, /No externally validated/);
  });

  it('measures exact and within-one agreement', () => {
    const entries = [
      makePlacementValidationEntry({ knownLevel: 'A1', placedLevel: 'A1', theta: -2, se: 0.5, itemsAsked: 10 }),
      makePlacementValidationEntry({ knownLevel: 'B1', placedLevel: 'B2', theta: 0.9, se: 0.5, itemsAsked: 12 }),
      makePlacementValidationEntry({ knownLevel: 'C1', placedLevel: 'A1', theta: -1.5, se: 0.6, itemsAsked: 14 }),
    ];
    const m = placementValidationMetrics(entries);
    assert.equal(m.n, 3);
    assert.ok(m.exactAgreement < 0.5);
    assert.ok(m.withinOneAgreement >= 0.66);
    assert.ok(typeof m.meanAbilityError === 'number');
    assert.ok(typeof m.calibration === 'number');
  });

  it('rejects invalid levels', () => {
    assert.equal(makePlacementValidationEntry({ knownLevel: 'Z9', placedLevel: 'B1', theta: 0, se: 0.5, itemsAsked: 10 }), null);
  });
});

describe('progression-gate validation', () => {
  it('requires unseen tasks, not just app mastery', () => {
    const e = makeProgressionEntry({ from: 'A2', to: 'B1', unseen: { reading: 82, listening: 75, grammar: 70 } });
    assert.ok(e);
    assert.equal(e.from, 'A2');
    assert.equal(e.to, 'B1');
  });

  it('reports no-data when empty', () => {
    const m = progressionValidationMetrics([]);
    assert.equal(m.status, 'no-data');
    assert.match(m.message, /No held-out/);
  });

  it('computes per-skill pass rates', () => {
    const entries = [
      makeProgressionEntry({ from: 'A1', to: 'A2', unseen: { reading: 80, listening: 60 } }),
      makeProgressionEntry({ from: 'A1', to: 'A2', unseen: { reading: 90, speaking: 75 } }),
    ];
    const m = progressionValidationMetrics(entries);
    assert.equal(m.n, 2);
    assert.ok(m.perSkill.reading.mean > 80);
    assert.equal(m.perSkill.reading.passRate, 1);
  });

  it('rejects entries with no unseen scores', () => {
    assert.equal(makeProgressionEntry({ from: 'B1', to: 'B2', unseen: {} }), null);
  });
});

describe('writing/speaking corpus', () => {
  it('stores learner response + task + both AI and human sides', () => {
    const e = makeCorpusEntry({
      mode: 'writing', prompt: 'Décris ta maison', response: 'Ma maison est grande.', aiScore: 72, aiCorrections: '<s>grand</s> <mark>grande</mark>', humanScore: 70, humanCorrections: '<s>grand</s> <mark>grande</mark>', criterion: 'accuracy', rater: 'M. Leroy'
    });
    assert.ok(e);
    assert.equal(e.mode, 'writing');
    assert.equal(e.paired, true);
  });

  it('starts empty', () => {
    const m = corpusMetrics([]);
    assert.equal(m.n, 0);
    assert.equal(m.status, 'no-data');
  });

  it('measures score agreement once paired', () => {
    const entries = [
      makeCorpusEntry({ mode: 'speaking', prompt: 'Q1', response: 'Bonjour', aiScore: 80, humanScore: 82, criterion: 'pronunciation' }),
      makeCorpusEntry({ mode: 'speaking', prompt: 'Q2', response: 'Au revoir', aiScore: 60, humanScore: 90, criterion: 'pronunciation' }),
    ];
    const m = corpusMetrics(entries);
    assert.ok(typeof m.scores.meanAbsoluteError === 'number');
  });

  it('flags double-marked entries and reports inter-rater agreement', () => {
    const single = makeCorpusEntry({ mode: 'writing', prompt: 'P', response: 'R', aiScore: 70, humanScore: 72, rater: 'A' });
    assert.equal(single.doubleMarked, false);
    const double = makeCorpusEntry({ mode: 'writing', prompt: 'P', response: 'R', aiScore: 70, humanScore: 72, rater: 'A', humanScore2: 74, rater2: 'B' });
    assert.equal(double.doubleMarked, true);

    const m = corpusInterRaterMetrics([
      double,
      makeCorpusEntry({ mode: 'writing', prompt: 'P', response: 'R', aiScore: 82, humanScore: 80, rater: 'A', humanScore2: 50, rater2: 'B' }),
    ]);
    assert.equal(m.n, 2);
    assert.equal(m.status, 'provisional');
    assert.equal(m.exactAgreement, 0);
    assert.equal(m.within5, 0.5);
    assert.ok(typeof m.kappa === 'number');
  });

  it('reports no-data for inter-rater until a second mark exists', () => {
    const m = corpusInterRaterMetrics([
      makeCorpusEntry({ mode: 'writing', prompt: 'P', response: 'R', aiScore: 70, humanScore: 72 }),
    ]);
    assert.equal(m.status, 'no-data');
    assert.match(m.message, /second qualified rater/);
  });

  it('counts paired and double-marked items in the corpus summary', () => {
    const m = corpusMetrics([
      makeCorpusEntry({ mode: 'writing', prompt: 'P1', response: 'R1', aiScore: 70, humanScore: 72 }),
      makeCorpusEntry({ mode: 'speaking', prompt: 'P2', response: 'R2', aiScore: 60, humanScore: 61, humanScore2: 63 }),
    ]);
    assert.equal(m.paired, 2);
    assert.equal(m.doubleMarked, 1);
    assert.equal(m.byMode.speaking, 1);
  });
});

describe('assistance fading validation', () => {
  it('tracks with vs without support', () => {
    const events = [
      makeAssistanceEvent({ skill: 'reading', support: 'with', score: 85, hintsUsed: 2 }),
      makeAssistanceEvent({ skill: 'reading', support: 'without', score: 70 }),
    ];
    const m = assistanceMetrics(events);
    assert.equal(m.n, 2);
    assert.ok(m.gap != null);
  });

  it('detects dependence', () => {
    const events = Array.from({ length: 10 }, () => makeAssistanceEvent({ skill: 'listening', support: 'with', score: 90 }))
      .concat(Array.from({ length: 10 }, () => makeAssistanceEvent({ skill: 'listening', support: 'without', score: 45 })));
    const m = assistanceMetrics(events);
    assert.equal(m.dependent, true);
  });

  it('reports no-data when empty', () => {
    const m = assistanceMetrics([]);
    assert.equal(m.status, 'no-data');
  });
});

describe('content calibration', () => {
  it('audits by frequency, complexity, grammar, speech rate', () => {
    const a = auditContentItem({ id: 't1', cefr: 'A1', text: 'Bonjour, je m’appelle Marie. J’habite à Paris.', speechRate: 0.85 });
    assert.equal(a.cefr, 'A1');
    assert.ok(a.metrics.complexity);
    assert.ok(typeof a.metrics.speechRateDelta === 'number');
  });

  it('flags drift', () => {
    const lib = auditLibrary([
      { id: 'a1-good', cefr: 'A1', text: 'Je mange une pomme.', speechRate: 0.85 },
      { id: 'a1-hard', cefr: 'A1', text: 'Nonobstant les vicissitudes inhérentes à la condition humaine, force est de constater que la modalisation eût été préférable.', speechRate: 1.1 },
    ]);
    assert.ok(lib.flagged.length >= 1);
  });
});

describe('type-safe schemas for AI structured outputs', () => {
  const good = { reply: 'Salut !', corrections: 'ok', scores: { grammar: 80, naturalness: 80, relevance: 80, fluency: 80, overall: 80 } };

  it('accepts a well-formed turn evaluation', () => {
    const r = validateTurnEvaluation(good);
    assert.equal(r.ok, true);
    assert.equal(r.scores.overall, 80);
  });

  it('rejects an empty reply instead of rendering a blank turn', () => {
    const r = validateTurnEvaluation({ ...good, reply: '  ' });
    assert.equal(r.ok, false);
    assert.match(r.error, /reply/);
  });

  it('rejects a missing overall score', () => {
    const r = validateTurnEvaluation({ reply: 'x', corrections: '', scores: {} });
    assert.equal(r.ok, false);
    assert.match(r.error, /overall/);
  });

  it('falls back missing sub-scores to overall rather than zero', () => {
    const r = validateTurnEvaluation({ reply: 'x', corrections: '', scores: { overall: 66 } });
    assert.equal(r.ok, true);
    assert.equal(r.scores.grammar, 66);
    assert.equal(r.scores.fluency, 66);
  });

  it('rejects out-of-range scores', () => {
    assert.equal(validateTurnEvaluation({ ...good, scores: { ...good.scores, overall: 999 } }).ok, false);
  });

  it('validates writing feedback shape and coerces scores', () => {
    assert.equal(validateWritingFeedback({ corrections: 'a', strengths: [], suggestions: [], scores: { grammar: 70, overall: 75 } }).ok, true);
    const bad = validateWritingFeedback({ corrections: 'a', strengths: 'nope', suggestions: [], scores: { overall: 50 } });
    assert.equal(bad.ok, false);
    const noScores = validateWritingFeedback({ corrections: 'a', strengths: [], suggestions: [], scores: {} });
    assert.equal(noScores.ok, false);
  });

  it('normalises corrections_detailed and maps bad levels to uncertain', () => {
    const out = normalizeCorrectionsDetailed([
      { original: 'je suis 20 ans', correction: "j'ai 20 ans", level: 'definite_error', note: 'avoir for age' },
      { original: 'x', correction: 'y', level: 'bogus' },
      { original: '', correction: 'dropped' },
      'not an object',
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].level, 'definite_error');
    assert.equal(out[1].level, 'uncertain');
  });
});

describe('transfer-check builder (post-promotion unseen tasks)', () => {
  const banks = {
    reading: [
      { id: 'r-a2-1', cefr: 'A2' }, { id: 'r-b1-1', cefr: 'B1' }, { id: 'r-seen', cefr: 'B1' },
    ],
    listening: [{ id: 'l-b1-1', cefr: 'B1' }],
    grammar: [{ id: 'g-b1-1', cefr: 'B1' }, { id: 'g-c1-skip', cefr: 'C1' }],
  };

  it('picks unseen items at or below the new level, one per skill', () => {
    const t = buildTransferCheck({ level: 'B1', banks, excludeIds: ['r-seen'] });
    assert.equal(t.level, 'B1');
    // Default perSkill=1; the closest item under the cap wins deterministically
    assert.deepEqual(t.tasks.reading.map((i) => i.id), ['r-b1-1']);
    assert.deepEqual(t.tasks.listening.map((i) => i.id), ['l-b1-1']);
    // C1 item is above the new level — never used to validate a B1 promotion
    assert.deepEqual(t.tasks.grammar.map((i) => i.id), ['g-b1-1']);
    assert.ok(!t.missing.includes('reading'));
  });

  it('reports skills with no unseen material as missing', () => {
    const t = buildTransferCheck({ level: 'A2', banks: { reading: [{ id: 'r-b2', cefr: 'B2' }] } });
    assert.equal(t.total, 0);
    assert.ok(t.missing.includes('reading'));
    assert.ok(t.missing.includes('speaking'));
  });

  it('honours the exclusion list and perSkill count', () => {
    const t = buildTransferCheck({
      level: 'B1',
      banks: { vocabulary: [{ id: 'v1', cefr: 'A2' }, { id: 'v2', cefr: 'B1' }, { id: 'v3', cefr: 'B1' }] },
      excludeIds: ['v1'],
      perSkill: 2,
    });
    assert.equal(t.tasks.vocabulary.length, 2);
    assert.ok(!t.tasks.vocabulary.some((i) => i.id === 'v1'));
  });

  it('rejects an invalid level', () => {
    const t = buildTransferCheck({ level: 'Z9', banks });
    assert.equal(t.total, 0);
    assert.equal(t.error, 'invalid level');
  });
});
