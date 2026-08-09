// Pure scoring for the redo loop's improvement delta.
// Kept separate from groq.js so it is testable without network.

export function scoreDelta(before, after) {
  const keys = ['grammar', 'naturalness', 'relevance', 'fluency', 'overall'];
  const signed = {};
  for (const k of keys) signed[k] = Math.round(Number(after?.[k] ?? 0) - Number(before?.[k] ?? 0));
  return { deltas: signed, improved: signed.overall > 0, deltaOverall: signed.overall };
}

export function redoVerdict(deltaOverall) {
  if (deltaOverall >= 10) return 'Great lift — the retry clearly landed better.';
  if (deltaOverall > 0) return 'A little better — you nudged it in the right direction.';
  if (deltaOverall === 0) return 'About the same — one more listen to the correction and try again?';
  return 'A bit weaker than the first — re-read the correction, then say it slower.';
}

export function mockRedoEvaluation() {
  // Slightly higher than the canned first-turn mocks so the demo delta is positive
  return {
    reply: 'Parfait — c’est déjà plus fluide ! On continue ?',
    translation: 'Perfect — already more fluid! Shall we continue?',
    corrections: 'Well done — the correction stuck. Note the liaison in <mark>les‿amis</mark>.',
    native_alternative: '« Voilà, nickel ! On continue ? »',
    grammar_topic: null,
    scores: { grammar: 94, naturalness: 88, relevance: 92, fluency: 88, overall: 91 },
    redo_note: 'The retry fixed the article and landed more naturally — nice incorporation.',
  };
}
