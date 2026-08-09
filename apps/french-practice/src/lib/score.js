/** Pure scoring helpers (no browser APIs). */

/**
 * Weighted composite used across the UI:
 * S = 0.30·grammar + 0.30·naturalness + 0.20·relevance + 0.20·fluency
 */
export function compositeScore(s = {}) {
  const g = +s.grammar || 0;
  const n = +s.naturalness || 0;
  const r = +s.relevance || 0;
  const f = +s.fluency || 0;
  return Math.round(0.3 * g + 0.3 * n + 0.2 * r + 0.2 * f);
}

/** Plain-English breakdown for tooltips / report cards. */
export function scoreExplainers() {
  return {
    grammar: 'How correct the French was (endings, gender, agreement).',
    naturalness: 'Whether a native speaker would actually say it that way.',
    relevance: 'How well the reply answered the prompt or situation.',
    fluency: 'Flow and completeness — not just isolated words.',
    overall: '30% grammar + 30% naturalness + 20% relevance + 20% fluency.',
  };
}
