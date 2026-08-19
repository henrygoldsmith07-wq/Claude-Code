import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { initFsrs, rateFsrs } from '../src/lib/fsrs.js';
import {
  assistanceFading, accentVariety, conversationDifficultyProgression, correctionFrequencyPolicy,
  delayedErrorRecycling, grammarNoveltyEstimate, knownVocabularyCoverage, knownVocabularyEstimate,
  listeningDifficultyLadder, naturalSpeechExpansion, retentionCalibration, selectComprehensibleInput,
  sentenceComplexityEstimate, speechRateAdaptation,
} from '../src/lib/learningAdaptation.js';

const NOW = Date.parse('2026-08-18T12:00:00Z');

describe('learning adaptation', () => {
  it('counts repeated, retained vocabulary as known and keeps first exposures uncertain', () => {
    const first = rateFsrs(initFsrs(), 'good', NOW - 86400000);
    const known = rateFsrs(first, 'good', NOW);
    const result = knownVocabularyEstimate([
      { id: 'pain', fr: 'le pain', freq: 1 },
      { id: 'gare', fr: 'la gare', freq: 1 },
    ], { pain: known, gare: first }, { now: NOW });
    assert.equal(result.knownCount, 1);
    assert.ok(result.uncertainWords.includes('la gare'));
    assert.ok(result.coverage > 0.4 && result.coverage < 1);
  });

  it('selects a small new-word frontier and reports lexical coverage', () => {
    const result = selectComprehensibleInput({
      level: 'A2',
      entries: [
        { id: 'known', fr: 'le pain', freq: 1 },
        { id: 'new-1', fr: 'la gare', freq: 1 },
        { id: 'new-2', fr: 'le quai', freq: 2 },
        { id: 'new-3', fr: 'le billet', freq: 3 },
      ],
      srs: { known: rateFsrs(rateFsrs(initFsrs(), 'good', NOW - 2 * 86400000), 'good', NOW) },
      newWordLimit: 2,
    });
    assert.deepEqual(result.newWords, ['la gare', 'le quai']);
    assert.equal(knownVocabularyCoverage('Je prends le pain à la gare.', result.knownWords).known, 1);
    assert.match(result.directive, /no more than 2/);
  });

  it('distinguishes simple sentences from subordinate, connector-heavy ones', () => {
    const simple = sentenceComplexityEstimate('Je prends le train.');
    const complex = sentenceComplexityEstimate('Même si je suis fatigué, je prendrai le train parce que je dois arriver avant que la réunion commence.');
    assert.ok(complex.score > simple.score);
    assert.ok(complex.subordination >= 2);
    assert.equal(simple.band, 'A1');
  });

  it('prioritises both unseen grammar and recurring grammar errors', () => {
    const result = grammarNoveltyEstimate({
      topics: ['present', 'subjonctif', 'articles'],
      grammarProgress: { present: { attempts: 3, best: 92 }, articles: { attempts: 1, best: 60 } },
      errorModel: [{ mode: 'grammar', key: 'articles', priority: 8, errorCount: 3, status: 'active' }],
    });
    assert.ok(result.unseenTopicIds.includes('subjonctif'));
    assert.equal(result.targetTopicIds[0], 'articles');
    assert.ok(result.reinforceTopicIds.includes('articles'));
  });

  it('raises the listening stage only with enough strong evidence and keeps it capped by level', () => {
    const result = listeningDifficultyLadder({
      level: 'A2',
      srs: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`w${i}`, { reps: 2 }])),
      entries: [],
      metrics: [{ skill: 'listening', score: 95 }, { skill: 'listening', score: 90 }],
    });
    assert.equal(result.stage, 3);
    assert.equal(result.speakerCount, 1);
    assert.ok(result.accents.length >= 1);
    assert.match(result.directive, /Listening stage 3/);
    assert.equal(accentVariety({ stage: 5, history: ['fr-fr'] }).unseen.length > 0, true);
  });

  it('fades help and lets the learner choose correction timing', () => {
    const beginner = assistanceFading({ level: 'A1', confidence: 0.2 });
    const independent = assistanceFading({ level: 'C1', confidence: 0.9, successStreak: 5, retention: 0.95 });
    assert.ok(independent.fade > beginner.fade);
    assert.equal(correctionFrequencyPolicy({ preference: 'end' }).timing, 'delayed');
    assert.equal(correctionFrequencyPolicy({ preference: 'off' }).scope, 'none');
    assert.match(correctionFrequencyPolicy({ preference: 'every-turn' }).directive, /every real error/);
  });

  it('adapts speech rate and conversation level within bounded steps', () => {
    assert.ok(speechRateAdaptation({ level: 'A2', score: 45 }).rate < speechRateAdaptation({ level: 'A2', score: 90 }).rate);
    const harder = conversationDifficultyProgression({
      level: 'B1',
      sessions: [
        { report: { average_scores: { overall: 90 } } },
        { report: { average_scores: { overall: 88 } } },
      ],
    });
    assert.equal(harder.targetLevel, 'B2');
    assert.equal(harder.delta, 1);
  });

  it('delays error recycling until the scheduled retest', () => {
    const result = delayedErrorRecycling([
      { mode: 'grammar', key: 'articles', status: 'active', lastErrorAt: new Date(NOW - 2 * 86400000).toISOString(), errorCount: 1, successCount: 0 },
      { mode: 'grammar', key: 'subjonctif', status: 'active', nextReviewAt: new Date(NOW + 86400000).toISOString(), lastErrorAt: new Date(NOW).toISOString() },
    ], { now: NOW });
    assert.equal(result.due.length, 1);
    assert.equal(result.due[0].key, 'articles');
    assert.equal(result.upcoming[0].key, 'subjonctif');
  });

  it('keeps retention calibration provisional until the requested evidence floor', () => {
    const first = rateFsrs(initFsrs(), 'good', NOW - 2 * 86400000);
    const srs = { pain: rateFsrs(first, 'good', NOW) };
    assert.equal(retentionCalibration(srs, { minSamples: 2 }).ready, false);
    const ready = retentionCalibration(srs, { minSamples: 1 });
    assert.equal(ready.ready, true);
    assert.equal(ready.curve.length, 1);
  });

  it('expands natural speech in level-sized steps', () => {
    assert.ok(naturalSpeechExpansion('B2').features.some((feature) => /idiom/i.test(feature)));
    assert.ok(naturalSpeechExpansion('A1').features.every((feature) => !/fast|irony/i.test(feature)));
  });
});
