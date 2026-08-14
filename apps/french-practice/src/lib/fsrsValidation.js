// Do these FSRS parameters actually describe *this* learner's French?
//
// The published FSRS-4.5 weights were fitted on general review logs — mostly
// mixed-subject Anki decks — not on language learning, and not on one person.
// Every review this app schedules already records the prediction it made at
// the time (`retr`) alongside what actually happened (`rating`), so the data
// to check them is sitting in localStorage. Nothing read it until now.
//
// What this module will and will not claim:
//  - A proper scoring rule (log loss, Brier) and a calibration curve, so
//    "the model says 90%, you actually recall 74%" is a statement with a
//    number behind it.
//  - Weights fitted by coordinate descent on the learner's own reviews, but
//    only ever *recommended* when they beat the defaults on a held-out split
//    the fit never saw. A better training score is not evidence.
//  - Nothing at all below a sample floor. Twelve reviews cannot tell you your
//    forgetting curve, and a confident number from twelve reviews is worse
//    than an admitted gap.
//
// Pure, deterministic, offline: the same input always gives the same answer,
// so a reported improvement is reproducible.

import {
  DEFAULT_W, initialDifficulty, initialStability, nextDifficulty, nextStability,
  retrievability,
} from './fsrs.js';

const DAY = 86400000;
const GRADE = { again: 1, hard: 2, good: 3, easy: 4 };

/** Enough reviews to say anything at all. Below this every figure is null. */
export const MIN_SAMPLES = 50;
/** Enough reviews to trust a fitted parameter set over the published one. */
export const MIN_FIT_SAMPLES = 200;

/* ---------- Turning stored cards into review sequences ---------- */

/**
 * Every card's reviews in order, as { at, grade } — the shape a replay needs.
 * Cards with a single review carry no information about forgetting (there is
 * no elapsed gap to have forgotten across), so they are dropped.
 */
export function reviewSequences(srs = {}) {
  const out = [];
  for (const [key, entry] of Object.entries(srs || {})) {
    const history = Array.isArray(entry?.history) ? entry.history : [];
    const reviews = history
      .filter((h) => h && h.at && GRADE[h.rating])
      .map((h) => ({ at: new Date(h.at).getTime(), grade: GRADE[h.rating] }))
      .filter((h) => Number.isFinite(h.at))
      .sort((a, b) => a.at - b.at);
    if (reviews.length < 2) continue;
    out.push({ key, mode: key.includes('::productive') ? 'productive' : 'receptive', reviews });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Replay one card under a candidate parameter set, yielding a prediction and an
 * outcome per review *after the first* — the first review has no prior state to
 * predict from, it only establishes one.
 */
export function replaySequence(reviews, w = DEFAULT_W) {
  const samples = [];
  let S = null;
  let D = null;
  let last = null;
  for (const review of reviews) {
    if (S === null) {
      S = initialStability(review.grade, w);
      D = initialDifficulty(review.grade, w);
      last = review.at;
      continue;
    }
    const days = Math.max(0, (review.at - last) / DAY);
    const predicted = retrievability(S, days);
    samples.push({ predicted, recalled: review.grade > 1 ? 1 : 0, days, grade: review.grade });
    const nS = review.grade === 1
      ? Math.max(0.1, nextStability(S, D, predicted, 1, w))
      : nextStability(S, D, predicted, review.grade, w);
    D = nextDifficulty(D, review.grade, w);
    S = Number.isFinite(nS) && nS > 0 ? nS : 0.1;
    last = review.at;
  }
  return samples;
}

/** Every prediction/outcome pair across the whole collection. */
export function samplesFrom(srs, w = DEFAULT_W) {
  return reviewSequences(srs).flatMap((card) =>
    replaySequence(card.reviews, w).map((s) => ({ ...s, key: card.key, mode: card.mode })));
}

/* ---------- Scoring rules ---------- */

const EPS = 1e-9;
const clamp01 = (p) => Math.min(1 - EPS, Math.max(EPS, p));
const round = (n, dp = 4) => (Number.isFinite(n) ? Math.round(n * 10 ** dp) / 10 ** dp : null);

/** Mean negative log likelihood. Lower is better; this is what the fit minimises. */
export function logLoss(samples) {
  if (!samples.length) return null;
  const total = samples.reduce((sum, s) => {
    const p = clamp01(s.predicted);
    return sum + (s.recalled ? -Math.log(p) : -Math.log(1 - p));
  }, 0);
  return round(total / samples.length);
}

/** Mean squared error of the probability. Lower is better. */
export function brierScore(samples) {
  if (!samples.length) return null;
  const total = samples.reduce((sum, s) => sum + (s.predicted - s.recalled) ** 2, 0);
  return round(total / samples.length);
}

/**
 * The reliability curve: within each band of predicted recall, what share was
 * actually recalled. This is the honest picture — a model can have a decent
 * average score while being badly wrong at the high end, which for a scheduler
 * is exactly where being wrong costs you.
 */
export function calibration(samples, bins = 5) {
  const width = 1 / bins;
  const rows = Array.from({ length: bins }, (_, i) => ({
    from: round(i * width, 2),
    to: round((i + 1) * width, 2),
    n: 0,
    predicted: 0,
    actual: 0,
  }));
  for (const s of samples) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor(s.predicted / width)));
    rows[idx].n += 1;
    rows[idx].predicted += s.predicted;
    rows[idx].actual += s.recalled;
  }
  return rows
    .filter((r) => r.n > 0)
    .map((r) => ({
      from: r.from,
      to: r.to,
      n: r.n,
      predicted: round(r.predicted / r.n, 3),
      actual: round(r.actual / r.n, 3),
      gap: round(r.actual / r.n - r.predicted / r.n, 3),
    }));
}

/**
 * Expected calibration error: the average gap between promise and delivery,
 * weighted by how many reviews sit in each band. One number for "how far off
 * is the model", in probability points.
 */
export function calibrationError(samples) {
  if (!samples.length) return null;
  const rows = calibration(samples, 10);
  const total = rows.reduce((sum, r) => sum + r.n * Math.abs(r.gap), 0);
  return round(total / samples.length);
}

/**
 * How the model does at the retention it actually schedules for. FSRS aims
 * every interval at 90% recall, so systematic error up here is the difference
 * between a deck that holds and one that quietly rots.
 */
export function highConfidenceGap(samples, threshold = 0.85) {
  const high = samples.filter((s) => s.predicted >= threshold);
  if (!high.length) return { n: 0, predicted: null, actual: null, gap: null };
  const predicted = high.reduce((sum, s) => sum + s.predicted, 0) / high.length;
  const actual = high.reduce((sum, s) => sum + s.recalled, 0) / high.length;
  return { n: high.length, predicted: round(predicted, 3), actual: round(actual, 3), gap: round(actual - predicted, 3) };
}

/**
 * The full verdict on a parameter set. Returns `ready: false` with the count
 * still to go rather than a number computed from too little data.
 */
export function evaluateParameters(srs, w = DEFAULT_W, { minSamples = MIN_SAMPLES } = {}) {
  const samples = samplesFrom(srs, w);
  if (samples.length < minSamples) {
    return { ready: false, n: samples.length, needed: minSamples - samples.length };
  }
  return {
    ready: true,
    n: samples.length,
    logLoss: logLoss(samples),
    brier: brierScore(samples),
    calibrationError: calibrationError(samples),
    calibration: calibration(samples),
    atScheduledRetention: highConfidenceGap(samples),
  };
}

/* ---------- Fitting the parameters to this learner ---------- */

/** Bounds keep a search from wandering somewhere the formulas stop meaning anything. */
const BOUNDS = [
  [0.1, 10], [0.1, 10], [0.1, 20], [0.1, 40],   // initial stability per grade
  [1, 10], [0.1, 3], [0.1, 3], [0, 1],          // difficulty
  [0, 4], [0, 1], [0, 4],                       // stability growth
  [0.1, 6], [0, 1], [0, 1], [0, 4],             // post-lapse stability
  [0.05, 1], [1, 6],                            // hard / easy multipliers
];

/**
 * Split by card, not by review. Splitting mid-card would let the fit see a
 * card's later reviews while being tested on its earlier ones, and the score
 * would flatter itself.
 */
export function splitSequences(sequences, holdOut = 0.3) {
  const cut = Math.max(1, Math.round(sequences.length * (1 - holdOut)));
  return { train: sequences.slice(0, cut), test: sequences.slice(cut) };
}

const scoreOf = (sequences, w) => {
  const samples = sequences.flatMap((c) => replaySequence(c.reviews, w));
  return { loss: logLoss(samples), n: samples.length };
};

/**
 * Coordinate descent: walk one weight at a time, keep a step only if it lowers
 * training log loss. Deterministic, bounded, and cheap enough to run on device.
 * Not a global optimum — it is a better starting point than "assume the
 * published numbers describe you", which is the claim being tested.
 */
export function fitParameters(srs, {
  base = DEFAULT_W, rounds = 3, holdOut = 0.3, minSamples = MIN_FIT_SAMPLES, minGain = 0.01,
} = {}) {
  const sequences = reviewSequences(srs);
  const all = sequences.flatMap((c) => replaySequence(c.reviews, base));
  if (all.length < minSamples) {
    return { ready: false, n: all.length, needed: minSamples - all.length };
  }
  const { train, test } = splitSequences(sequences, holdOut);
  if (!train.length || !test.length) {
    return { ready: false, n: all.length, needed: 0, reason: 'not enough distinct cards to hold any back' };
  }

  let best = [...base];
  let bestLoss = scoreOf(train, best).loss;
  for (let round_ = 0; round_ < rounds; round_ += 1) {
    const scale = 0.5 / (round_ + 1);
    for (let i = 0; i < best.length; i += 1) {
      const [lo, hi] = BOUNDS[i];
      const step = Math.max(1e-3, Math.abs(best[i]) * scale || scale);
      for (const candidate of [best[i] - step, best[i] + step]) {
        const value = Math.min(hi, Math.max(lo, candidate));
        if (value === best[i]) continue;
        const trial = [...best];
        trial[i] = value;
        const { loss } = scoreOf(train, trial);
        if (loss != null && loss < bestLoss) {
          bestLoss = loss;
          best = trial;
        }
      }
    }
  }

  // The only score that counts: cards the search never touched.
  const baseline = scoreOf(test, base);
  const fitted = scoreOf(test, best);
  const gain = baseline.loss != null && fitted.loss != null
    ? round((baseline.loss - fitted.loss) / baseline.loss, 4)
    : null;
  const better = gain != null && gain >= minGain;
  return {
    ready: true,
    n: all.length,
    cards: sequences.length,
    weights: best.map((v) => round(v, 4)),
    trainLoss: round(bestLoss),
    heldOut: { baseline: baseline.loss, fitted: fitted.loss, n: fitted.n },
    gain,
    // Anything under the margin is noise, and says so rather than shipping a
    // new set of numbers on the strength of a rounding difference.
    recommended: better ? best.map((v) => round(v, 4)) : null,
    verdict: better
      ? `Fitted weights cut held-out log loss by ${Math.round(gain * 100)}%.`
      : 'The published weights already describe these reviews as well as a fit does.',
  };
}
