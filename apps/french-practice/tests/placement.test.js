import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_BANK, abilityToLevel, answerItem, bankStats, estimateAbility, pCorrect,
  placementResultFrom, runPlacement, selectItem, startPlacement,
} from '../src/lib/placement.js';

// A learner of known ability, answering probabilistically. Seeded so the suite
// is deterministic — a flaky placement test would be worse than none.
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const simulate = (trueTheta, rand) => (item) =>
  (rand() < pCorrect(trueTheta, item.difficulty) ? item.answer : (item.answer + 1) % item.options.length);

describe('item bank', () => {
  it('has unique ids and covers every level', () => {
    const ids = ITEM_BANK.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate item ids');
    const stats = bankStats();
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) {
      assert.ok(stats.byLevel[level] >= 5, `${level} has too few items`);
    }
  });

  it('every item has a valid answer index', () => {
    for (const i of ITEM_BANK) {
      assert.ok(i.answer >= 0 && i.answer < i.options.length, `${i.id} answer out of range`);
      assert.ok(i.options.length >= 2, `${i.id} needs options`);
    }
  });

  it('difficulty tracks the declared level', () => {
    const centres = { A1: -2, A2: -1, B1: 0, B2: 1, C1: 2, C2: 3 };
    for (const i of ITEM_BANK) {
      assert.ok(Math.abs(i.difficulty - centres[i.cefr]) <= 0.5, `${i.id} difficulty ${i.difficulty} is far from its ${i.cefr} band`);
    }
  });
});

describe('adaptive selection', () => {
  it('picks the item closest to the current ability estimate', () => {
    const state = { ...startPlacement(), theta: 2 };
    const chosen = selectItem(state);
    assert.ok(Math.abs(chosen.difficulty - 2) <= 0.6, `chose ${chosen.id} at ${chosen.difficulty}`);
  });

  it('never repeats an item', () => {
    let state = startPlacement();
    const seen = new Set();
    for (let i = 0; i < 15; i += 1) {
      const item = selectItem(state);
      assert.ok(!seen.has(item.id), 'repeated item');
      seen.add(item.id);
      state = answerItem(state, item, item.answer);
    }
  });

  it('moves the estimate up on correct answers and down on wrong ones', () => {
    let up = startPlacement();
    let down = startPlacement();
    for (let i = 0; i < 5; i += 1) {
      const a = selectItem(up);
      up = answerItem(up, a, a.answer);
      const b = selectItem(down);
      down = answerItem(down, b, (b.answer + 1) % b.options.length);
    }
    assert.ok(up.theta > 0, `expected rising estimate, got ${up.theta}`);
    assert.ok(down.theta < 0, `expected falling estimate, got ${down.theta}`);
  });
});

describe('ability estimation', () => {
  it('recovers a known ability with little bias', () => {
    for (const truth of [-2, -1, 0, 1, 2]) {
      const rand = seededRandom(truth + 7);
      let total = 0;
      const runs = 60;
      for (let i = 0; i < runs; i += 1) {
        total += runPlacement(simulate(truth, rand)).theta;
      }
      const bias = total / runs - truth;
      assert.ok(Math.abs(bias) < 0.35, `bias at θ=${truth} was ${bias.toFixed(2)}`);
    }
  });

  it('inflates the error when the ceiling was never found', () => {
    const allRight = estimateAbility([
      { difficulty: 0, correct: true }, { difficulty: 1, correct: true }, { difficulty: 2, correct: true },
    ]);
    assert.ok(allRight.se >= 0.9, 'a perfect run should not claim precision');
    assert.ok(allRight.theta > 2, 'ability sits above the hardest item passed');

    const allWrong = estimateAbility([
      { difficulty: 0, correct: false }, { difficulty: -1, correct: false },
    ]);
    assert.ok(allWrong.theta < -1);
    assert.ok(allWrong.se >= 0.9);
  });

  it('clamps ability to the scale', () => {
    const extreme = estimateAbility(Array.from({ length: 10 }, () => ({ difficulty: 3, correct: true })));
    assert.ok(extreme.theta <= 4);
  });
});

describe('result reporting', () => {
  it('stops on the standard-error rule or the item budget', () => {
    const rand = seededRandom(3);
    let state = startPlacement();
    while (!state.done) {
      const item = selectItem(state);
      if (!item) break;
      state = answerItem(state, item, simulate(0.5, rand)(item));
    }
    assert.ok(state.asked.length >= state.config.minItems);
    assert.ok(state.asked.length <= state.config.maxItems);
  });

  it('reports a range, not a false point estimate', () => {
    const rand = seededRandom(11);
    const result = runPlacement(simulate(0, rand));
    assert.ok(result.range.length > 0);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.equal(abilityToLevel(result.theta), result.level);
  });

  it('breaks skills out so the first study plan has something to aim at', () => {
    const rand = seededRandom(5);
    const result = runPlacement(simulate(1, rand));
    assert.ok(Object.keys(result.bySkill).length >= 2);
    for (const s of Object.values(result.bySkill)) {
      assert.ok(s.pct >= 0 && s.pct <= 100);
    }
  });

  it('honours a seed level from onboarding', () => {
    const seeded = startPlacement({ seedLevel: 'B2' });
    assert.equal(seeded.theta, 1);
    const first = selectItem(seeded);
    assert.ok(Math.abs(first.difficulty - 1) <= 0.5, 'first item should sit near the seeded level');
  });

  it('handles a test with no answers at all', () => {
    const result = placementResultFrom(startPlacement());
    assert.equal(result.itemsAsked, 0);
    assert.equal(result.confidence, 0);
  });
});
