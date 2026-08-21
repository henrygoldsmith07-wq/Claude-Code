import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makePlacementValidationEntry, placementValidationMetrics } from '../src/lib/placementValidation.js';
import { makeProgressionEntry, progressionValidationMetrics } from '../src/lib/progressionValidation.js';
import { makeCorpusEntry, corpusMetrics } from '../src/lib/writingSpeakingCorpus.js';
import { assistanceMetrics, makeAssistanceEvent } from '../src/lib/assistanceValidation.js';
import { auditContentItem, auditLibrary } from '../src/lib/contentCalibration.js';
import { validateTurnEvaluation, validateWritingFeedback, validateRelayChatResponse } from '../src/lib/schemas.ts';

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
  it('validates turn evaluation shape', () => {
    const ok = validateTurnEvaluation({ reply: 'Salut !', corrections: 'ok', scores: { grammar: 80, naturalness: 80, relevance: 80, fluency: 80, overall: 80 } });
    assert.equal(ok.ok, true);
    const bad = validateTurnEvaluation({ reply: '', corrections: '', scores: { grammar: 999, naturalness: 80, relevance: 80, fluency: 80, overall: 80 } });
    assert.equal(bad.ok, false);
  });

  it('validates relay chat response', () => {
    assert.equal(validateRelayChatResponse({ choices: [{ message: { content: 'hi' } }] }), true);
    assert.equal(validateRelayChatResponse({ choices: [] }), false);
  });

  it('validates writing feedback', () => {
    const ok = validateWritingFeedback({ corrections: 'a', strengths: [], suggestions: [] });
    assert.equal(ok.ok, true);
  });
});
