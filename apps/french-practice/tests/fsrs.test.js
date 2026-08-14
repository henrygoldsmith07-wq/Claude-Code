import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initFsrs, initialDifficulty, initialStability, migrateFromSm2,
  rateFsrs, retrievability, fsrsRetention, isProductiveUnlocked,
} from '../src/lib/fsrs.js';
import { retentionNow, curvePoints } from '../src/lib/memory.js';

const DAY = 86400000;
const T0 = Date.parse('2026-01-01T00:00:00Z');
const reviewedAt = (t) => ({ ...initFsrs(), lastReviewed: new Date(t).toISOString() });

describe('retrievability', () => {
  it('is the 90%-at-one-stability curve', () => {
    // S is defined as the days until recall falls to 90%.
    assert.equal(Math.round(retrievability(10, 10) * 100) / 100, 0.9);
    assert.equal(retrievability(10, 0), 1);
    assert.ok(retrievability(10, 20) < retrievability(10, 10));
    assert.equal(retrievability(0, 5), 0);
  });
});

describe('difficulty moves the right way', () => {
  it('forgetting a card makes it harder, not easier', () => {
    // This was inverted: "again" used to *lower* difficulty. Since stability
    // growth scales with (11-D), that gave the most-failed cards the longest
    // intervals in the deck.
    const after = rateFsrs(reviewedAt(T0), 'again', T0 + DAY);
    assert.ok(after.D > 5, `expected D above the 5 it started at, got ${after.D}`);
  });

  it('finding a card easy makes it easier', () => {
    const after = rateFsrs(reviewedAt(T0), 'easy', T0 + DAY);
    assert.ok(after.D < 5, `expected D below the 5 it started at, got ${after.D}`);
  });

  it('drives a repeatedly failed card to the hard ceiling', () => {
    let card = reviewedAt(T0);
    for (let i = 0; i < 6; i++) card = rateFsrs(card, 'again', T0 + (i + 1) * DAY);
    assert.equal(card.D, 10);
  });

  it('never leaves the 1..10 band', () => {
    for (const rating of ['again', 'hard', 'good', 'easy']) {
      let card = reviewedAt(T0);
      for (let i = 0; i < 30; i++) card = rateFsrs(card, rating, T0 + (i + 1) * DAY);
      assert.ok(card.D >= 1 && card.D <= 10, `${rating} left D at ${card.D}`);
    }
  });
});

describe('a first review uses the per-grade starting weights', () => {
  it('starts stability from the grade, not a flat default', () => {
    // w[0..3] were dead: every card began at S=1 whatever the learner answered.
    const easy = rateFsrs(initFsrs(), 'easy', T0);
    const good = rateFsrs(initFsrs(), 'good', T0);
    const hard = rateFsrs(initFsrs(), 'hard', T0);
    assert.equal(easy.S, initialStability(4));
    assert.equal(good.S, initialStability(3));
    assert.equal(hard.S, initialStability(2));
    assert.ok(easy.S > good.S && good.S > hard.S);
  });

  it('starts difficulty from the grade too', () => {
    const missed = rateFsrs(initFsrs(), 'again', T0);
    const easy = rateFsrs(initFsrs(), 'easy', T0);
    assert.equal(missed.D, initialDifficulty(1));
    assert.ok(missed.D > easy.D, 'missing a card first time should start it harder');
  });

  it('sends a missed first card back to today', () => {
    assert.equal(rateFsrs(initFsrs(), 'again', T0).interval, 0);
  });
});

describe('scheduling', () => {
  it('lengthens the interval as a card is recalled', () => {
    let card = initFsrs();
    let at = T0;
    const intervals = [];
    for (let i = 0; i < 5; i++) {
      card = rateFsrs(card, 'good', at);
      intervals.push(card.interval);
      at += card.interval * DAY;
    }
    for (let i = 1; i < intervals.length; i++) {
      assert.ok(intervals[i] > intervals[i - 1], `intervals went backwards: ${intervals}`);
    }
  });

  it('charges the hard penalty once, not twice', () => {
    // w[15] already shrinks stability for "hard"; the interval was then
    // multiplied by a further 0.6 on top of it.
    const grown = { ...initFsrs(), S: 20, D: 5, reps: 4, lastReviewed: new Date(T0).toISOString() };
    const hard = rateFsrs(grown, 'hard', T0 + 20 * DAY);
    assert.equal(hard.interval, Math.max(1, Math.round(hard.S)));
  });

  it('keeps a lapse for today and counts it', () => {
    const grown = { ...initFsrs(), S: 20, D: 5, reps: 4, lapses: 1, lastReviewed: new Date(T0).toISOString() };
    const lapse = rateFsrs(grown, 'again', T0 + 20 * DAY);
    assert.equal(lapse.interval, 0);
    assert.equal(lapse.lapses, 2);
    assert.equal(lapse.reps, 0);
    assert.ok(lapse.S < grown.S, 'a lapse must not grow stability');
  });

  it('records each review so the parameters can be checked later', () => {
    let card = rateFsrs(initFsrs(), 'good', T0);
    card = rateFsrs(card, 'again', T0 + 3 * DAY);
    assert.equal(card.history.length, 2);
    assert.ok(card.history[1].retr >= 0 && card.history[1].retr <= 1);
    assert.equal(card.history[1].rating, 'again');
  });
});

describe('SM-2 migration', () => {
  it('carries an old card across without losing its schedule', () => {
    const sm2 = { interval: 12, ease: 2.5, reps: 4, lapses: 1, due: '2026-02-01T00:00:00.000Z', lastReviewed: '2026-01-20T00:00:00.000Z' };
    const moved = migrateFromSm2(sm2);
    assert.equal(moved.S, 12);
    assert.equal(moved.reps, 4);
    assert.equal(moved.lapses, 1);
    assert.ok(moved.D >= 1 && moved.D <= 10);
  });

  it('leaves an FSRS card alone and handles nothing at all', () => {
    const already = { S: 4, D: 6 };
    assert.equal(migrateFromSm2(already), already);
    assert.equal(migrateFromSm2(null).S, initFsrs().S);
  });

  it('treats a harder old card as harder', () => {
    const easyCard = migrateFromSm2({ interval: 10, ease: 2.8 });
    const hardCard = migrateFromSm2({ interval: 10, ease: 1.8 });
    assert.ok(hardCard.D > easyCard.D);
  });
});

describe('one forgetting curve, everywhere', () => {
  it('the revision hub agrees with the scheduler', () => {
    // These disagreed: the hub read 61% where the scheduler read 95%.
    const card = { S: 10, lastReviewed: new Date(T0).toISOString() };
    const hub = retentionNow(card, T0 + 5 * DAY);
    const scheduler = fsrsRetention(card, T0 + 5 * DAY);
    assert.equal(Math.round(hub * 1000), Math.round(scheduler * 1000));
    assert.ok(hub > 0.9, `expected a strong card, got ${hub}`);
  });

  it('reads a legacy SM-2 row through the same curve', () => {
    const legacy = { interval: 10, lastReviewed: new Date(T0).toISOString() };
    assert.equal(
      Math.round(retentionNow(legacy, T0 + 10 * DAY) * 100) / 100,
      0.9,
    );
  });

  it('has nothing to say about a card never reviewed', () => {
    assert.equal(retentionNow(null), null);
    assert.equal(retentionNow({ S: 5 }), null);
  });

  it('draws the curve it quotes', () => {
    const pts = curvePoints(10, 10).split(' ');
    const [, lastY] = pts[pts.length - 1].split(',').map(Number);
    // At t = S the curve must sit at 90% recall, i.e. 10% down the box.
    assert.equal(Math.round(lastY), 10);
  });
});

describe('receptive before productive', () => {
  it('opens productive practice only once recognition has stuck', () => {
    assert.equal(isProductiveUnlocked({ chat: { reps: 1 } }, 'chat'), false);
    assert.equal(isProductiveUnlocked({ chat: { reps: 2 } }, 'chat'), true);
    assert.equal(isProductiveUnlocked({}, 'chat'), false);
  });
});
