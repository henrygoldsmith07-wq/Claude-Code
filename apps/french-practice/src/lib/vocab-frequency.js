// Frequency lexicon → vocabulary packs.
//
// The full high-frequency dictionary (frequency.js, ~2,200 words) used to live
// only in the Reference tool. This folds every one of those words into the
// vocabulary packs so they are browsable, searchable and reviewable with the
// same SRS engine as the curated cards — without hand-writing 2,000 more card
// literals: the packs are built from the dictionary at module load.

import { FREQUENCY_WORDS } from './frequency';

// Map a coarse frequency band (rank 1–10) onto the card's freq label bucket
// (FREQ_LABELS in vocab.js: 1 Top 100 · 2 Top 500 · 3 Top 1000 · 4 Top 5000 · 5 Niche).
const freqBucket = (rank) => (rank <= 1 ? 1 : rank <= 3 ? 2 : rank <= 5 ? 3 : rank <= 8 ? 4 : 5);

// One deck per this many words — small enough to finish in a sitting, and the
// array is roughly frequency-ordered so lower packs are the more useful words.
const CHUNK = 150;

export const FREQUENCY_PACKS = (() => {
  const packs = [];
  for (let i = 0; i < FREQUENCY_WORDS.length; i += CHUNK) {
    const slice = FREQUENCY_WORDS.slice(i, i + CHUNK);
    const start = i + 1;
    const end = i + slice.length;
    packs.push({
      id: `freq-${packs.length + 1}`,
      title: `Frequency ${start}–${end}`,
      description: `The ${start}–${end} most common French words.`,
      entries: slice.map((wd, j) => ({
        id: `fq-${i + j}`,
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
})();
