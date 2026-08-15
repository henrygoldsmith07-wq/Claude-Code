// Accents of the francophone world, and how the app speaks them.
//
// An honest constraint first: this app has no backend and ships no audio
// files, so "native-speaker audio in multiple accents" means routing to the
// best matching voice the *device* has installed, and falling back gracefully
// when it has none. A phone with fr-CA installed genuinely speaks Québécois;
// one without gets fr-FR and is told so, rather than being handed a Parisian
// voice labelled "Montréal".
//
// What is always available regardless of installed voices: the written
// features of each variety — the vocabulary swaps, the numbers, the
// pronunciation notes — which is most of what a learner needs to *recognise*
// an accent, and recognition is the skill that actually fails in the wild.

export const ACCENTS = [
  {
    id: 'fr-fr',
    label: 'France (standard)',
    region: 'Île-de-France',
    speechLang: 'fr-FR',
    voiceHint: /Thomas|Amelie|Amélie|Audrey|French|Marie/i,
    rateBias: 1.0,
    blurb: 'The reference accent of broadcast French and of every exam recording.',
    features: [
      'Uvular r, though lighter than learners expect.',
      'Final unstressed vowels routinely dropped in speech: «j\'sais pas».',
      'Fourteen vowels in theory; younger Parisians merge several.',
    ],
    lexicon: [],
  },
  {
    id: 'fr-ca',
    label: 'Québec',
    region: 'Canada',
    speechLang: 'fr-CA',
    voiceHint: /Chantal|Amelie|Canadian|Nicolas/i,
    rateBias: 1.0,
    blurb: 'Distinct vowels, older vocabulary, and a rhythm that catches out learners trained only on Paris French.',
    features: [
      'Diphthongised long vowels: «père» leans toward "pa-èr".',
      't and d affricate before i/u — «tu» sounds close to "tsu", «dire» to "dzire".',
      'Anglicisms are resisted in writing but common in speech, with different ones than in France.',
    ],
    lexicon: [
      { qc: 'le char', fr: 'la voiture', en: 'car' },
      { qc: 'la blonde', fr: 'la copine', en: 'girlfriend' },
      { qc: 'le chum', fr: 'le copain', en: 'boyfriend / mate' },
      { qc: 'magasiner', fr: 'faire du shopping', en: 'to shop' },
      { qc: 'le déjeuner', fr: 'le petit déjeuner', en: 'breakfast (meals shift by one)' },
      { qc: 'présentement', fr: 'actuellement', en: 'currently' },
      { qc: 'tantôt', fr: 'tout à l’heure', en: 'in a while / a while ago' },
    ],
  },
  {
    id: 'fr-be',
    label: 'Belgique',
    region: 'Wallonie & Bruxelles',
    speechLang: 'fr-BE',
    voiceHint: /Belgian|Belge/i,
    rateBias: 0.98,
    blurb: 'Closest to standard French of the varieties here — the differences are mostly lexical, and the numbers.',
    features: [
      'septante (70) and nonante (90) instead of soixante-dix and quatre-vingt-dix.',
      'Long vowels held noticeably longer than in Paris.',
      'w pronounced /w/ in words where France says /v/.',
    ],
    lexicon: [
      { qc: 'septante', fr: 'soixante-dix', en: 'seventy' },
      { qc: 'nonante', fr: 'quatre-vingt-dix', en: 'ninety' },
      { qc: 'une drache', fr: 'une averse', en: 'a downpour' },
      { qc: 'le GSM', fr: 'le portable', en: 'mobile phone' },
      { qc: 'savoir (= pouvoir)', fr: 'pouvoir', en: '"je ne sais pas venir" = I can\'t come' },
    ],
  },
  {
    id: 'fr-ch',
    label: 'Suisse romande',
    region: 'Switzerland',
    speechLang: 'fr-CH',
    voiceHint: /Swiss|Suisse/i,
    rateBias: 0.95,
    blurb: 'Slower delivery, its own numbers, and a set of administrative words France does not use.',
    features: [
      'septante, huitante (in some cantons) and nonante.',
      'Noticeably slower and more evenly stressed than Parisian French.',
      'Germanic loanwords in everyday use.',
    ],
    lexicon: [
      { qc: 'huitante', fr: 'quatre-vingts', en: 'eighty (Vaud, Valais, Fribourg)' },
      { qc: 'le natel', fr: 'le portable', en: 'mobile phone' },
      { qc: 'la panosse', fr: 'la serpillière', en: 'floor cloth' },
      { qc: 'ça joue', fr: 'ça marche', en: 'that works / OK' },
    ],
  },
  {
    id: 'fr-af',
    label: 'Afrique de l’Ouest',
    region: 'Sénégal, Côte d’Ivoire, Mali',
    speechLang: 'fr-FR',
    voiceHint: /French/i,
    rateBias: 0.97,
    blurb: 'The demographic centre of gravity of French — more speakers than France, and largely absent from teaching material.',
    features: [
      'Rolled or tapped r in many varieties, rather than uvular.',
      'Syllables more evenly timed; final consonants often clearly released.',
      'Rich local vocabulary and calques from Wolof, Bambara and Baoulé.',
    ],
    lexicon: [
      { qc: 'un maquis', fr: 'un petit restaurant', en: 'informal open-air restaurant (Côte d’Ivoire)' },
      { qc: 'être fatigué (= être malade)', fr: 'être malade', en: 'to be ill' },
      { qc: 'un pagne', fr: 'un tissu porté', en: 'wrapped cloth garment' },
      { qc: 'deuxième bureau', fr: 'une maîtresse', en: 'a mistress (humorous)' },
    ],
  },
  {
    id: 'fr-mid',
    label: 'Midi (Sud de la France)',
    region: 'Occitanie, Provence',
    speechLang: 'fr-FR',
    voiceHint: /French/i,
    rateBias: 0.97,
    blurb: 'Southern French: the accent most French people can imitate and most learners have never heard.',
    features: [
      'Final -e pronounced where the north drops it: «une petite» has three clear syllables.',
      'Nasal vowels partly denasalised — «pain» leans toward "peng".',
      'Sing-song intonation with strong penultimate stress.',
    ],
    lexicon: [
      { qc: 'peuchère', fr: 'le pauvre', en: 'poor thing (Provence)' },
      { qc: 'la poche', fr: 'le sac plastique', en: 'carrier bag' },
      { qc: 'dégun', fr: 'personne', en: 'nobody (Marseille)' },
    ],
  },
];

export const getAccent = (id) => ACCENTS.find((a) => a.id === id) || ACCENTS[0];
export const accentIds = () => ACCENTS.map((a) => a.id);

/**
 * Pick the best installed voice for an accent.
 *
 * Returns `{ voice, exact, fallbackNote }`. `exact` is false when the device
 * has no voice for the requested locale — the caller must show the note
 * rather than pretend. Voice lists are passed in so this stays testable.
 */
export function resolveVoice(accentId, voices = []) {
  const accent = getAccent(accentId);
  const french = voices.filter((v) => String(v.lang || '').toLowerCase().startsWith('fr'));

  if (!french.length) {
    return { voice: null, exact: false, accent, fallbackNote: 'No French voice is installed on this device — audio will use the default system voice.' };
  }

  const localeMatches = french.filter((v) => String(v.lang).toLowerCase().replace('_', '-') === accent.speechLang.toLowerCase());
  if (localeMatches.length) {
    const named = localeMatches.find((v) => accent.voiceHint.test(v.name || ''));
    return { voice: named || localeMatches[0], exact: true, accent, fallbackNote: null };
  }

  const named = french.find((v) => accent.voiceHint.test(v.name || ''));
  const fallback = named || french.find((v) => String(v.lang).toLowerCase().startsWith('fr-fr')) || french[0];
  return {
    voice: fallback,
    exact: false,
    accent,
    fallbackNote: `Your device has no ${accent.label} voice installed, so this plays in ${fallback.lang}. The written notes below still describe the real accent.`,
  };
}

/** Which accents this device can genuinely speak. */
export function availableAccents(voices = []) {
  return ACCENTS.map((a) => ({ ...a, ...resolveVoice(a.id, voices) }));
}

// ---------------------------------------------------- listening progression -

/**
 * Listening speed progression.
 *
 * Two dimensions move independently, which is the point: a learner can handle
 * fast speech in a familiar accent long before they handle slow speech in an
 * unfamiliar one. Ramping both at once is why "advanced listening" so often
 * feels like a wall.
 */
export const LISTENING_STAGES = [
  { id: 1, label: 'Slow & clear', rate: 0.75, accents: ['fr-fr'], blurb: 'Standard accent, deliberately slow, every word released.' },
  { id: 2, label: 'Careful native', rate: 0.9, accents: ['fr-fr'], blurb: 'Standard accent at the pace of a teacher.' },
  { id: 3, label: 'Natural', rate: 1.0, accents: ['fr-fr', 'fr-be'], blurb: 'Ordinary conversational pace; elision starts to bite.' },
  { id: 4, label: 'Varied accents', rate: 1.0, accents: ['fr-fr', 'fr-be', 'fr-ch', 'fr-mid'], blurb: 'Same pace, unfamiliar voices.' },
  { id: 5, label: 'Fast & wide', rate: 1.15, accents: ['fr-fr', 'fr-ca', 'fr-af', 'fr-mid', 'fr-be'], blurb: 'Full speed across the francophone world.' },
];

/**
 * Move a learner up or down a stage from their comprehension score. The bands
 * are deliberately asymmetric — you need 85% to advance but only drop below
 * 50%, so one bad track does not undo a month.
 */
export function nextListeningStage(current, comprehensionPct) {
  const stage = Math.max(1, Math.min(LISTENING_STAGES.length, current || 1));
  if (comprehensionPct >= 85 && stage < LISTENING_STAGES.length) return stage + 1;
  if (comprehensionPct < 50 && stage > 1) return stage - 1;
  return stage;
}

export const listeningStage = (id) => LISTENING_STAGES.find((s) => s.id === id) || LISTENING_STAGES[0];

/**
 * The playback settings for a track at a given stage: rate, and which accent
 * to use. Accent rotates deterministically by track id so a learner meets a
 * spread rather than the same voice every time.
 */
export function playbackFor(stageId, trackId = '') {
  const stage = listeningStage(stageId);
  let hash = 0;
  for (let i = 0; i < String(trackId).length; i += 1) hash = (hash * 31 + String(trackId).charCodeAt(i)) | 0;
  const accentId = stage.accents[Math.abs(hash) % stage.accents.length];
  const accent = getAccent(accentId);
  return {
    rate: Math.round(stage.rate * accent.rateBias * 100) / 100,
    accentId,
    accentLabel: accent.label,
    stage: stage.id,
    stageLabel: stage.label,
  };
}

/**
 * Caption policy for listening, keyed off the assistance fade rather than
 * invented per-screen rules: beginners see the transcript from the start,
 * intermediates get it after one listen, advanced learners have to ask.
 */
export function captionPolicy(fade) {
  if (fade < 0.35) return { show: 'immediate', label: 'Transcript shown while you listen' };
  if (fade < 0.7) return { show: 'after-first', label: 'Transcript unlocks after one listen' };
  return { show: 'on-request', label: 'Transcript hidden — reveal it only if you need it' };
}
