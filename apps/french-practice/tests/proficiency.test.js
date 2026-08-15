import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIMENSIONS, bandFor, globalScore, grammarScore, listeningScore, nextFocus,
  proficiency, recencyWeight, speakingScore, vocabularyScore, weightedMean, writingScore,
} from '../src/lib/proficiency.js';

const DAY = 86400000;
const now = Date.UTC(2026, 0, 1);
const daysAgo = (d) => new Date(now - d * DAY).toISOString();

describe('weights', () => {
  it('sum to one', () => {
    const total = DIMENSIONS.reduce((a, d) => a + d.weight, 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
  });
});

describe('recency', () => {
  it('halves every 45 days', () => {
    assert.ok(Math.abs(recencyWeight(daysAgo(0), now) - 1) < 0.01);
    assert.ok(Math.abs(recencyWeight(daysAgo(45), now) - 0.5) < 0.01);
    assert.ok(recencyWeight(daysAgo(180), now) < 0.1);
  });

  it('weights recent evidence above stale evidence', () => {
    const mean = weightedMean([
      { score: 100, at: daysAgo(0) },
      { score: 0, at: daysAgo(180) },
    ], now);
    assert.ok(mean > 80, `stale evidence dominated: ${mean}`);
  });

  it('returns null rather than zero for no records', () => {
    assert.equal(weightedMean([], now), null);
    assert.equal(weightedMean(null, now), null);
  });
});

describe('sub-scores degrade to unknown, never to zero', () => {
  it('vocabulary with no reviews is unknown', () => {
    assert.equal(vocabularyScore({ srs: {}, level: 'A1' }).score, null);
  });

  it('grammar with no attempts is unknown', () => {
    assert.equal(grammarScore({ topicScores: {}, level: 'A1' }).score, null);
  });

  it('listening and writing with no metrics are unknown', () => {
    assert.equal(listeningScore({ metrics: [] }, now).score, null);
    assert.equal(writingScore({ metrics: [] }, now).score, null);
  });

  it('a learner with no evidence gets no score, not a zero', () => {
    const result = proficiency({ level: 'A1' }, now);
    assert.equal(result.score, null);
    assert.equal(result.confidence, 0);
    assert.equal(result.missing.length, DIMENSIONS.length);
    assert.ok(result.note.length > 0);
  });
});

describe('vocabulary counting', () => {
  it('only counts cards that survived two reviews', () => {
    const srs = {
      a: { reps: 1 },                          // seen once — not known
      b: { reps: 2, lastRating: 'good' },      // known
      c: { reps: 5, lastRating: 'good' },      // known and strong
      d: { reps: 3, lastRating: 'again' },     // lapsed — not known
    };
    const result = vocabularyScore({ srs, level: 'A1' });
    assert.equal(result.known, 2);
    assert.equal(result.strong, 1);
  });

  it('never exceeds 100 even with a huge deck', () => {
    const srs = {};
    for (let i = 0; i < 5000; i += 1) srs[`w${i}`] = { reps: 9, lastRating: 'good' };
    assert.ok(vocabularyScore({ srs, level: 'A1' }).score <= 100);
  });
});

describe('grammar counting', () => {
  it('counts only topics mastered at 80+', () => {
    const topicScores = { a: { best: 90 }, b: { best: 79 }, c: 85, d: 40 };
    assert.equal(grammarScore({ topicScores, level: 'A1' }).mastered, 2);
  });
});

describe('composite', () => {
  it('renormalises over the dimensions that have evidence', () => {
    const partial = proficiency({
      level: 'A1',
      srs: { a: { reps: 3, lastRating: 'good' } },
      sessions: [{ score: 80, at: daysAgo(1) }],
    }, now);
    assert.ok(partial.score !== null);
    assert.ok(partial.missing.includes('listening'));
    assert.ok(partial.missing.includes('writing'));
    assert.ok(partial.confidence < 1, 'missing evidence must lower confidence');
  });

  it('names the weakest and strongest components', () => {
    const result = proficiency({
      level: 'A1',
      srs: Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`w${i}`, { reps: 4, lastRating: 'good' }])),
      sessions: [{ score: 20, at: daysAgo(1) }],
    }, now);
    assert.equal(result.weakest, 'speaking');
    assert.equal(result.strongest, 'vocabulary');
  });

  it('scores 0..100 whatever the inputs', () => {
    const result = proficiency({
      level: 'A1',
      srs: { a: { reps: 9, lastRating: 'good' } },
      sessions: [{ score: 500, at: daysAgo(1) }],
    }, now);
    assert.ok(result.score >= 0);
  });
});

describe('bands and global scale', () => {
  it('describes the score within the level, not across the ladder', () => {
    assert.match(bandFor(95, 'A2'), /A2 complete/);
    assert.match(bandFor(10, 'B2'), /Starting B2/);
    assert.equal(bandFor(null, 'A1'), null);
  });

  it('the global scale never resets on promotion', () => {
    assert.ok(globalScore(5, 'B1') > globalScore(95, 'A2'));
    assert.equal(globalScore(null, 'A1'), null);
  });
});

describe('nextFocus', () => {
  it('asks for evidence when there is none', () => {
    assert.match(nextFocus(proficiency({ level: 'A1' }, now)), /evidence/i);
  });

  it('points at a missing dimension before ranking the present ones', () => {
    const result = proficiency({
      level: 'A1',
      srs: { a: { reps: 3, lastRating: 'good' } },
    }, now);
    assert.match(nextFocus(result), /no .* evidence yet/i);
  });
});

describe('speaking', () => {
  it('accepts either score or overall on a session record', () => {
    assert.equal(speakingScore({ sessions: [{ overall: 70, at: daysAgo(1) }] }, now).score, 70);
    assert.equal(speakingScore({ sessions: [{ score: 70, at: daysAgo(1) }] }, now).score, 70);
  });

  it('ignores unscored sessions', () => {
    const result = speakingScore({ sessions: [{ at: daysAgo(1) }, { score: 60, at: daysAgo(1) }] }, now);
    assert.equal(result.samples, 1);
  });
});
