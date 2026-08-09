// Pure helpers for phrase drills: pools, answer matching, shadowing queues.
// Offline, no AI — works against authored real-world + phrasebook + starred lines.

import { SITUATIONS } from './realworld.js';

/** Strip accents / punctuation for forgiving typed answers. */
export function normalizeAnswer(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score a typed French guess against the expected line.
 * Returns { ok, exact, similarity } — ok if exact match after normalize
 * or high enough token overlap for longer phrases.
 */
export function scoreGuess(guess, expected) {
  const g = normalizeAnswer(guess);
  const e = normalizeAnswer(expected);
  if (!g || !e) return { ok: false, exact: false, similarity: 0 };
  if (g === e) return { ok: true, exact: true, similarity: 1 };

  const gTokens = new Set(g.split(' ').filter(Boolean));
  const eTokens = e.split(' ').filter(Boolean);
  if (!eTokens.length) return { ok: false, exact: false, similarity: 0 };
  let hit = 0;
  for (const t of eTokens) if (gTokens.has(t)) hit += 1;
  const similarity = hit / eTokens.length;
  // Short lines need near-exact; longer ones allow one missing function word.
  const threshold = eTokens.length <= 3 ? 1 : eTokens.length <= 6 ? 0.85 : 0.75;
  return { ok: similarity >= threshold, exact: false, similarity };
}

/** Flatten all situation phrases into a drill pool. */
export function allSituationPhrases() {
  const out = [];
  for (const s of SITUATIONS) {
    for (const p of s.phrases) {
      out.push({
        id: `${s.id}:${p.fr.slice(0, 40)}`,
        fr: p.fr,
        en: p.en,
        source: s.title,
        situationId: s.id,
      });
    }
  }
  return out;
}

/**
 * Build a practice queue.
 * mode: 'all' | 'starred' | situationId
 * starred: array from getStarredLines()
 */
export function buildDrillPool({ mode = 'all', starred = [], limit = 12, seed = Date.now() } = {}) {
  let pool;
  if (mode === 'starred') {
    pool = starred.map((s) => ({
      id: s.id,
      fr: s.fr,
      en: s.en,
      source: s.source || 'Starred',
    }));
  } else if (mode && mode !== 'all') {
    const sit = SITUATIONS.find((s) => s.id === mode);
    pool = sit
      ? sit.phrases.map((p) => ({
          id: `${sit.id}:${p.fr.slice(0, 40)}`,
          fr: p.fr,
          en: p.en,
          source: sit.title,
          situationId: sit.id,
        }))
      : allSituationPhrases();
  } else {
    pool = allSituationPhrases();
  }
  if (!pool.length) return [];
  // Deterministic shuffle from seed
  let a = seed >>> 0;
  const rand = () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(limit, arr.length));
}

/** XP for a completed drill run. */
export function drillXp(correct, total) {
  if (total <= 0) return 0;
  return Math.max(3, correct * 2 + (correct === total ? 5 : 0));
}
