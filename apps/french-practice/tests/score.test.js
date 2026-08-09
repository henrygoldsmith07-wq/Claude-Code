import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compositeScore, scoreExplainers } from '../src/lib/score.js';

describe('compositeScore', () => {
  it('weights dimensions correctly', () => {
    assert.equal(
      compositeScore({ grammar: 100, naturalness: 100, relevance: 100, fluency: 100 }),
      100,
    );
    assert.equal(
      compositeScore({ grammar: 100, naturalness: 0, relevance: 0, fluency: 0 }),
      30,
    );
    assert.equal(
      compositeScore({ grammar: 80, naturalness: 70, relevance: 90, fluency: 60 }),
      Math.round(0.3 * 80 + 0.3 * 70 + 0.2 * 90 + 0.2 * 60),
    );
  });

  it('treats missing dimensions as zero', () => {
    assert.equal(compositeScore({}), 0);
    assert.equal(compositeScore({ grammar: 50 }), 15);
  });

  it('exposes plain-English explainers', () => {
    const e = scoreExplainers();
    assert.ok(e.overall.includes('30%'));
    assert.ok(e.grammar.length > 10);
  });
});
