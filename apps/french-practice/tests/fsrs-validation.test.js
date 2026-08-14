import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_W, rateFsrs, initFsrs } from '../src/lib/fsrs.js';
import {
  MIN_SAMPLES, brierScore, calibration, calibrationError, evaluateParameters,
  fitParameters, highConfidenceGap, logLoss, replaySequence, reviewSequences,
  samplesFrom, splitSequences,
} from '../src/lib/fsrsValidation.js';
import { retentionPredictionVsActual } from '../src/lib/learnerValidation.js';

const DAY = 86400000;
const T0 = Date.parse('2026-01-01T00:00:00Z');

/** A deterministic pseudo-random stream, so every run sees the same learner. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/**
 * Simulate a learner whose real memory follows R = 0.9^(t/trueS). Cards are
 * reviewed on the schedule the app gives them, and recalled or not according to
 * that true curve — so the recorded history is exactly what the app would store.
 */
function simulate({ cards = 60, reviews = 8, trueStability = 10, seed = 7 } = {}) {
  const rand = rng(seed);
  const srs = {};
  for (let c = 0; c < cards; c += 1) {
    let entry = initFsrs();
    let at = T0 + c * 60000;
    for (let r = 0; r < reviews; r += 1) {
      const elapsed = entry.lastReviewed ? (at - new Date(entry.lastReviewed).getTime()) / DAY : 0;
      const trueRecall = Math.pow(0.9, elapsed / trueStability);
      const recalled = rand() < trueRecall;
      entry = rateFsrs(entry, recalled ? 'good' : 'again', at);
      at += Math.max(1, entry.interval) * DAY;
    }
    srs[`card-${c}`] = entry;
  }
  return srs;
}

describe('turning stored reviews into evidence', () => {
  it('reads each card’s reviews in order', () => {
    const srs = simulate({ cards: 3, reviews: 5 });
    const sequences = reviewSequences(srs);
    assert.equal(sequences.length, 3);
    for (const card of sequences) {
      const times = card.reviews.map((r) => r.at);
      assert.deepEqual(times, [...times].sort((a, b) => a - b));
      assert.equal(card.mode, 'receptive');
    }
  });

  it('labels productive cards by their key', () => {
    const srs = simulate({ cards: 1, reviews: 4 });
    const moved = { 'card-0::productive': srs['card-0'] };
    assert.equal(reviewSequences(moved)[0].mode, 'productive');
  });

  it('ignores cards with nothing to learn from', () => {
    assert.deepEqual(reviewSequences({ a: { history: [] } }), []);
    assert.deepEqual(reviewSequences({ a: { history: [{ at: '2026-01-01', rating: 'good' }] } }), []);
    assert.deepEqual(reviewSequences({}), []);
    assert.deepEqual(reviewSequences(null), []);
  });

  it('skips the first review, which predicts nothing', () => {
    const reviews = [
      { at: T0, grade: 3 },
      { at: T0 + 3 * DAY, grade: 3 },
      { at: T0 + 10 * DAY, grade: 1 },
    ];
    const samples = replaySequence(reviews);
    assert.equal(samples.length, 2);
    assert.equal(samples[0].recalled, 1);
    assert.equal(samples[1].recalled, 0);
    for (const s of samples) assert.ok(s.predicted > 0 && s.predicted <= 1);
  });

  it('predicts less recall the longer the gap', () => {
    const soon = replaySequence([{ at: T0, grade: 3 }, { at: T0 + DAY, grade: 3 }]);
    const late = replaySequence([{ at: T0, grade: 3 }, { at: T0 + 30 * DAY, grade: 3 }]);
    assert.ok(late[0].predicted < soon[0].predicted);
  });
});

describe('scoring rules', () => {
  it('rewards confident and right, punishes confident and wrong', () => {
    const right = [{ predicted: 0.95, recalled: 1 }];
    const wrong = [{ predicted: 0.95, recalled: 0 }];
    assert.ok(logLoss(right) < logLoss(wrong));
    assert.ok(brierScore(right) < brierScore(wrong));
  });

  it('is perfect only when the probabilities are', () => {
    assert.equal(brierScore([{ predicted: 1, recalled: 1 }, { predicted: 0, recalled: 0 }]), 0);
    assert.ok(logLoss([{ predicted: 0.5, recalled: 1 }]) > 0);
  });

  it('has nothing to say about no reviews', () => {
    assert.equal(logLoss([]), null);
    assert.equal(brierScore([]), null);
    assert.equal(calibrationError([]), null);
  });
});

describe('calibration', () => {
  it('reports promise against delivery per band', () => {
    const samples = [
      ...Array.from({ length: 10 }, () => ({ predicted: 0.9, recalled: 1 })),
      ...Array.from({ length: 10 }, () => ({ predicted: 0.3, recalled: 0 })),
    ];
    const rows = calibration(samples, 5);
    const high = rows.find((r) => r.to === 1);
    const low = rows.find((r) => r.from === 0.2);
    assert.equal(high.n, 10);
    assert.equal(high.actual, 1);
    assert.equal(low.actual, 0);
  });

  it('measures a model that promises more than it delivers', () => {
    // Says 90%, delivers 50% — badly overconfident, and the number shows it.
    const samples = Array.from({ length: 100 }, (_, i) => ({ predicted: 0.9, recalled: i % 2 }));
    assert.ok(calibrationError(samples) > 0.35, 'expected a large calibration error');
    const gap = highConfidenceGap(samples);
    assert.equal(gap.n, 100);
    assert.ok(gap.gap < -0.35, 'recall should fall well short of the promise');
  });

  it('is near zero when the model tells the truth', () => {
    const samples = Array.from({ length: 100 }, (_, i) => ({ predicted: 0.9, recalled: i % 10 === 0 ? 0 : 1 }));
    assert.ok(Math.abs(calibrationError(samples)) < 0.02);
  });

  it('says so when nothing sits in the high band', () => {
    assert.deepEqual(
      highConfidenceGap([{ predicted: 0.2, recalled: 0 }]),
      { n: 0, predicted: null, actual: null, gap: null },
    );
  });
});

describe('evaluating the published parameters', () => {
  it('refuses to score too small a sample', () => {
    const result = evaluateParameters(simulate({ cards: 2, reviews: 3 }));
    assert.equal(result.ready, false);
    assert.ok(result.needed > 0);
    assert.equal(result.logLoss, undefined);
  });

  it('scores a real body of reviews', () => {
    const result = evaluateParameters(simulate({ cards: 60, reviews: 8 }));
    assert.equal(result.ready, true);
    assert.ok(result.n >= MIN_SAMPLES);
    assert.ok(result.logLoss > 0);
    assert.ok(result.brier >= 0 && result.brier <= 1);
    assert.ok(Array.isArray(result.calibration) && result.calibration.length > 0);
    assert.ok(result.calibration.every((row) => row.n > 0));
  });

  it('detects a learner who forgets faster than the defaults assume', () => {
    // True stability of 3 days against a scheduler pacing for far longer: the
    // model should be caught promising recall the learner does not deliver.
    const fast = evaluateParameters(simulate({ cards: 80, reviews: 8, trueStability: 3, seed: 11 }));
    const steady = evaluateParameters(simulate({ cards: 80, reviews: 8, trueStability: 30, seed: 11 }));
    assert.equal(fast.ready, true);
    assert.equal(steady.ready, true);
    assert.ok(
      fast.calibrationError > steady.calibrationError,
      `fast-forgetting learner should be worse calibrated (${fast.calibrationError} vs ${steady.calibrationError})`,
    );
  });
});

describe('fitting parameters to one learner', () => {
  it('will not fit from too little data', () => {
    const result = fitParameters(simulate({ cards: 4, reviews: 4 }));
    assert.equal(result.ready, false);
    assert.ok(result.needed > 0);
  });

  it('holds cards back from the fit rather than splitting mid-card', () => {
    const sequences = reviewSequences(simulate({ cards: 10, reviews: 5 }));
    const { train, test } = splitSequences(sequences, 0.3);
    assert.equal(train.length + test.length, sequences.length);
    const trainKeys = new Set(train.map((c) => c.key));
    assert.ok(test.every((c) => !trainKeys.has(c.key)), 'a card must not appear on both sides');
  });

  it('judges itself only on cards it never saw', () => {
    const result = fitParameters(simulate({ cards: 120, reviews: 8, seed: 3 }));
    assert.equal(result.ready, true);
    assert.equal(result.weights.length, DEFAULT_W.length);
    assert.ok(result.heldOut.n > 0);
    assert.ok(result.trainLoss > 0);
    assert.ok(typeof result.verdict === 'string' && result.verdict.length > 0);
  });

  it('recommends nothing when the gain is only noise', () => {
    const result = fitParameters(simulate({ cards: 120, reviews: 8, seed: 3 }), { minGain: 0.99 });
    assert.equal(result.recommended, null);
    assert.match(result.verdict, /already describe/);
  });

  it('keeps every fitted weight inside its bounds', () => {
    const result = fitParameters(simulate({ cards: 120, reviews: 8, seed: 5 }));
    for (const w of result.weights) assert.ok(Number.isFinite(w) && w > 0, `bad weight ${w}`);
    assert.ok(result.weights[15] <= 1, 'the hard multiplier must not exceed 1');
  });

  it('gives the same answer twice', () => {
    const srs = simulate({ cards: 120, reviews: 8, seed: 9 });
    assert.deepEqual(fitParameters(srs).weights, fitParameters(srs).weights);
  });
});

describe('prediction against outcome', () => {
  it('waits for enough reviews instead of guessing', () => {
    const result = retentionPredictionVsActual(simulate({ cards: 2, reviews: 3 }), []);
    assert.equal(result.accuracy, null);
    assert.ok(result.needed > 0);
  });

  it('scores real outcomes, not the card’s current standing', () => {
    const result = retentionPredictionVsActual(simulate({ cards: 60, reviews: 8 }), []);
    assert.ok(result.accuracy >= 0 && result.accuracy <= 1);
    assert.ok(result.n >= MIN_SAMPLES);
    assert.ok(result.logLoss > 0);
    assert.equal(typeof result.calibrationError, 'number');
  });

  it('can tell a well-scheduled learner from a badly-scheduled one', () => {
    const good = retentionPredictionVsActual(simulate({ cards: 80, reviews: 8, trueStability: 30, seed: 4 }), []);
    const bad = retentionPredictionVsActual(simulate({ cards: 80, reviews: 8, trueStability: 2, seed: 4 }), []);
    assert.ok(bad.logLoss > good.logLoss, `expected worse log loss for the fast forgetter (${bad.logLoss} vs ${good.logLoss})`);
  });
});

describe('samples carry their card', () => {
  it('keeps the key and mode so weak areas can be traced', () => {
    const samples = samplesFrom(simulate({ cards: 5, reviews: 5 }));
    assert.ok(samples.length > 0);
    for (const s of samples) {
      assert.match(s.key, /^card-\d+$/);
      assert.equal(s.mode, 'receptive');
      assert.ok(s.days >= 0);
    }
  });
});
