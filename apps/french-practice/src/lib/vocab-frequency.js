// Frequency lexicon → vocabulary packs.
//
// The high-frequency dictionaries (frequency.js for French, content/frequency-de
// and -es for German/Spanish) used to live only in the Reference tool. This
// folds every one of those words into the vocabulary packs so they are
// browsable, searchable and reviewable with the same SRS engine as the curated
// cards — without hand-writing thousands more card literals: the packs are
// built from the dictionary at module load.

import { FREQUENCY_WORDS } from './frequency.js';
import { FREQUENCY_WORDS_DE } from './content/frequency-de.js';
import { FREQUENCY_WORDS_ES } from './content/frequency-es.js';

// Map a coarse frequency band (rank 1–10) onto the card's freq label bucket
// (FREQ_LABELS in vocab.js: 1 Top 100 · 2 Top 500 · 3 Top 1000 · 4 Top 5000 · 5 Niche).
const freqBucket = (rank) => (rank <= 1 ? 1 : rank <= 3 ? 2 : rank <= 5 ? 3 : rank <= 8 ? 4 : 5);

// One deck per this many words — small enough to finish in a sitting, and the
// array is roughly frequency-ordered so lower packs are the more useful words.
const CHUNK = 150;

// Drop repeated head-words (kept first, i.e. the most frequent sense) so a term
// that recurs across bands doesn't appear twice in the decks or the dictionary.
export function dedupeByTerm(words) {
  const seen = new Set();
  const out = [];
  for (const wd of words) {
    if (seen.has(wd.fr)) continue;
    seen.add(wd.fr);
    out.push(wd);
  }
  return out;
}

// Build frequency decks for one language. `adjective` names the language in the
// deck description ("the 1–150 most common German words").
function buildPacks(words, adjective, prefix) {
  const unique = dedupeByTerm(words);
  const packs = [];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const start = i + 1;
    const end = i + slice.length;
    packs.push({
      id: `freq-${packs.length + 1}`,
      title: `Frequency ${start}–${end}`,
      description: `The ${start}–${end} most common ${adjective} words.`,
      entries: slice.map((wd, j) => ({
        id: `${prefix}-${i + j}`,
        fr: wd.fr,
        en: wd.en,
        emoji: '',
        freq: freqBucket(wd.rank),
        example: '',
        exampleEn: '',
        syn: [],
        ant: [],
        coll: [],
        note: wd.ipa ? `IPA ${wd.ipa}` : '',
      })),
    });
  }
  return packs;
}

export const FREQUENCY_PACKS = buildPacks(FREQUENCY_WORDS, 'French', 'fq');
export const FREQUENCY_PACKS_DE = buildPacks(FREQUENCY_WORDS_DE, 'German', 'fqde');
export const FREQUENCY_PACKS_ES = buildPacks(FREQUENCY_WORDS_ES, 'Spanish', 'fqes');

// The deduped word lists, for the offline dictionary (per language).
export const FREQUENCY_WORDS_BY_LANG = {
  fr: dedupeByTerm(FREQUENCY_WORDS),
  de: dedupeByTerm(FREQUENCY_WORDS_DE),
  es: dedupeByTerm(FREQUENCY_WORDS_ES),
};
