// Shared French sentence pool with translations — feeds the Dictée
// (listening), Pronunciation (read-aloud) and Shadowing (listen & repeat)
// drills. Drawn from flashcard examples, scenario openers and vocab packs.

import { FLASHCARDS, SCENARIOS } from './data';
import { allEntries } from './vocab';

export const SENTENCE_POOL = [
  ...FLASHCARDS.map((c) => ({ text: c.example, translation: c.exampleTranslation })),
  ...SCENARIOS.map((s) => ({ text: s.opener, translation: s.openerTranslation })),
  ...allEntries()
    .filter((e) => FLASHCARDS.every((c) => c.id !== e.id))
    .map((e) => ({ text: e.example, translation: e.exampleEn })),
];

export const randomPoolSentence = (excludeText) => {
  const candidates = SENTENCE_POOL.filter((s) => s.text !== excludeText);
  return candidates[Math.floor(Math.random() * candidates.length)];
};

// Normalize for spoken comparison: lowercase, strip punctuation, keep accents.
export const toWords = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

// Word-level LCS alignment: which target words were heard/recognized.
export function diffWords(target, attempt) {
  const m = target.length;
  const n = attempt.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = target[i] === attempt[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hit = new Array(m).fill(false);
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (target[i] === attempt[j]) { hit[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return hit;
}

// Map normalized hit flags back onto display tokens (punctuation-only tokens
// count as hits so they never render as "missed").
export function displayHits(text, hits) {
  const words = text.split(/\s+/);
  let k = 0;
  return words.map((w) => (toWords(w).length ? hits[(k += 1) - 1] : true));
}
