// The CEFR spine — one canonical description of what each level *is*, so that
// every other module (curriculum, placement, proficiency, conversation,
// exams) agrees on what "B1" means instead of each inventing its own ladder.
//
// Levels run A1–C1. C2 stays a valid *setting* (the app has always let people
// pick it) but the curriculum deliberately stops at C1: past that point the
// useful work is reading widely and living in the language, not drilling a
// syllabus, and pretending to teach it would be a lie about coverage.
//
// Descriptors are our own plain-English paraphrases of the Council of Europe's
// illustrative scales — the published can-do statements are the reference, the
// wording here is written for a learner reading a progress screen.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const ALL_LEVELS = [...LEVELS, 'C2'];

/** Ordinal position, for comparisons. C2 sits above the taught spine. */
export const levelIndex = (level) => ALL_LEVELS.indexOf(level);
export const isAtLeast = (level, floor) => levelIndex(level) >= levelIndex(floor);
export const nextLevel = (level) => ALL_LEVELS[Math.min(ALL_LEVELS.length - 1, levelIndex(level) + 1)] || 'C2';
export const prevLevel = (level) => ALL_LEVELS[Math.max(0, levelIndex(level) - 1)] || 'A1';

/**
 * Per-level profile. Numbers are the syllabus targets the rest of the app
 * measures against — receptive vocabulary size, how many grammar points are
 * expected to be mastered, and the speech/turn shape typical of the level.
 */
export const LEVEL_PROFILE = {
  A1: {
    label: 'Breakthrough',
    blurb: 'Everyday phrases about yourself, your home and immediate needs.',
    vocabTarget: 600,
    grammarTarget: 10,
    // Speech: what a *learner* at this level is expected to produce.
    turnWords: [8, 25],
    speechRate: 0.85,
    listeningWpm: 100,
    // How long a sustained conversation should run, in learner turns.
    conversationTurns: 6,
    canDo: [
      'Introduce yourself and ask someone basic questions about themselves.',
      'Order food and drink, and buy a ticket or a single item.',
      'Understand slow, clear speech about family, home and daily routine.',
      'Fill in a form and write a short message about where you live.',
    ],
    // Sound work that matters most at this level.
    phonemeFocus: ['u-ou', 'r'],
  },
  A2: {
    label: 'Waystage',
    blurb: 'Routine exchanges — shopping, travel, work, past weekends.',
    vocabTarget: 1200,
    grammarTarget: 20,
    turnWords: [20, 45],
    speechRate: 0.9,
    listeningWpm: 120,
    conversationTurns: 8,
    canDo: [
      'Handle short social exchanges without preparing every sentence.',
      'Describe your past weekend, your job and your plans in simple terms.',
      'Understand the main point of short, clear announcements and messages.',
      'Write a short connected text — an email to a friend, a description.',
    ],
    phonemeFocus: ['nasal-an', 'nasal-on', 'liaison'],
  },
  B1: {
    label: 'Threshold',
    blurb: 'Cope with most travel situations and hold an opinion.',
    vocabTarget: 2500,
    grammarTarget: 32,
    turnWords: [40, 90],
    speechRate: 1.0,
    listeningWpm: 140,
    conversationTurns: 12,
    canDo: [
      'Enter unprepared into conversation on familiar topics and keep it going.',
      'Give reasons and explanations for your opinions and plans.',
      'Follow the main points of clear standard speech, including some radio.',
      'Write connected text describing experiences, events and ambitions.',
    ],
    phonemeFocus: ['nasal-in', 'gn', 'liaison'],
  },
  B2: {
    label: 'Vantage',
    blurb: 'Argue a case, follow the news, work in French without strain.',
    vocabTarget: 4500,
    grammarTarget: 44,
    turnWords: [70, 160],
    speechRate: 1.05,
    listeningWpm: 160,
    conversationTurns: 16,
    canDo: [
      'Take an active part in discussion, accounting for and sustaining a view.',
      'Interact with fluency and spontaneity enough that neither side strains.',
      'Understand extended speech, most TV news and current-affairs programmes.',
      'Write clear, detailed text and an essay that argues a position.',
    ],
    phonemeFocus: ['j', 'liaison', 'nasal-in'],
  },
  C1: {
    label: 'Effective operational proficiency',
    blurb: 'Fluent, flexible and precise — including implicit meaning.',
    vocabTarget: 8000,
    grammarTarget: 55,
    turnWords: [120, 260],
    speechRate: 1.1,
    listeningWpm: 180,
    conversationTurns: 22,
    canDo: [
      'Express yourself fluently without obviously searching for expressions.',
      'Use language flexibly for social, academic and professional purposes.',
      'Understand demanding, longer texts and recognise implicit meaning.',
      'Write well-structured, detailed text on complex subjects.',
    ],
    phonemeFocus: ['liaison', 'j', 'r'],
  },
};

/** C2 exists as a setting; describe it honestly rather than 404ing. */
export const BEYOND_C1 = {
  label: 'Mastery',
  blurb: 'Beyond the taught syllabus — read widely, watch untamed input, write a lot.',
  vocabTarget: 16000,
  grammarTarget: 55,
  turnWords: [150, 320],
  speechRate: 1.15,
  listeningWpm: 200,
  conversationTurns: 24,
  canDo: ['Read anything. Argue anything. The app can score you, but it can no longer teach you.'],
  phonemeFocus: ['liaison'],
};

export const profileFor = (level) => LEVEL_PROFILE[level] || (level === 'C2' ? BEYOND_C1 : LEVEL_PROFILE.A1);

/**
 * The grammar inventory, by level: the ordered list of topic ids a learner is
 * expected to control before that level is complete. Ids match grammar topic
 * ids so `coverageReport` can tell us where the library is thin.
 */
export const GRAMMAR_INVENTORY = {
  A1: [
    'present', 'articles', 'nombres-genre', 'etre-avoir', 'questions-base',
    'negation', 'adjectifs', 'possessifs', 'aller-futur-proche', 'prepositions-lieu',
  ],
  A2: [
    'passe-compose', 'imparfait', 'pronoms-cod-coi', 'futur-simple', 'imperatif',
    'comparatif', 'partitifs', 'verbes-pronominaux', 'depuis-pendant', 'y-en',
  ],
  B1: [
    'conditionnel', 'subjonctif-present', 'plus-que-parfait', 'relatifs',
    'discours-indirect', 'gerondif', 'pronoms-relatifs-composes', 'si-hypothese',
    'accord-participe', 'expressions-temps', 'passif', 'demonstratifs',
  ],
  B2: [
    'subjonctif-passe', 'concordance-temps', 'connecteurs-logiques', 'nominalisation',
    'participe-present', 'double-pronoms', 'conditionnel-passe', 'restriction-ne-que',
    'inversion-stylistique', 'cause-consequence', 'concession', 'registre',
  ],
  C1: [
    'subjonctif-imparfait', 'passe-simple', 'hypothese-complexe', 'anaphore-cohesion',
    'modalisation', 'ellipse-oral', 'figement-idiomatique', 'argumentation-academique',
    'litote-ironie', 'peripheries-verbales', 'accord-cas-difficiles',
  ],
};

/**
 * The library grew organically before the inventory existed, so several
 * syllabus points already ship under a different id. Mapping them here means
 * `coverageReport` counts the lesson that exists instead of reporting a gap
 * and inviting someone to write a duplicate.
 */
export const GRAMMAR_ALIASES = {
  'nombres-genre': 'genre-nombre',
  'questions-base': 'questions',
  adjectifs: 'adjectifs-place',
  'aller-futur-proche': 'futur-proche',
  'pronoms-cod-coi': 'pronoms',
  'futur-simple': 'futur-conditionnel',
  partitifs: 'quantites',
  'verbes-pronominaux': 'pronominaux',
  conditionnel: 'futur-conditionnel',
  'subjonctif-present': 'subjonctif',
  'si-hypothese': 'si-clauses',
  'connecteurs-logiques': 'connecteurs',
  'inversion-stylistique': 'inversion',
  registre: 'registres',
  'hypothese-complexe': 'hypothese-avancee',
};

/** Resolve a syllabus id to whichever topic id actually ships it. */
export const resolveTopicId = (id, have) =>
  (have.has(id) ? id : GRAMMAR_ALIASES[id] && have.has(GRAMMAR_ALIASES[id]) ? GRAMMAR_ALIASES[id] : null);

/** Every inventory id, in level order. */
export const grammarSyllabus = () => LEVELS.flatMap((l) => GRAMMAR_INVENTORY[l].map((id) => ({ id, cefr: l })));

/** Cumulative inventory up to and including `level`. */
export function grammarUpTo(level) {
  const cap = levelIndex(level);
  return LEVELS.filter((l) => levelIndex(l) <= cap).flatMap((l) => GRAMMAR_INVENTORY[l]);
}

/**
 * Vocabulary themes each level should cover. Used to band packs and to tell a
 * learner what is still unopened above them.
 */
export const VOCAB_THEMES = {
  A1: ['greetings', 'self', 'family', 'numbers', 'food-basic', 'colours', 'classroom', 'home-basic', 'time-basic'],
  A2: ['shopping', 'travel', 'directions', 'weather', 'health-basic', 'daily-routine', 'clothes', 'hobbies', 'past-events'],
  B1: ['work', 'education', 'media', 'environment', 'technology', 'relationships', 'opinions', 'town-life', 'health'],
  B2: ['politics', 'economy', 'science', 'culture-arts', 'social-issues', 'argument', 'abstract-qualities', 'work-advanced'],
  C1: ['academic', 'legal-admin', 'nuance-register', 'idiom-advanced', 'literary', 'rhetoric', 'specialist'],
};

/**
 * Gate for moving up a level. Deliberately multi-signal: a placement guess
 * alone, or a run of lucky flashcards alone, should not promote anyone.
 *
 * Returns { ready, met, missing, progress } where progress is 0..1 across the
 * four requirements, so the UI can show a "how close am I" bar rather than a
 * binary.
 */
export function promotionGate(level, evidence = {}) {
  const p = profileFor(level);
  const {
    vocabKnown = 0,
    grammarMastered = 0,
    speakingAvg = 0,
    checkpointsPassed = 0,
  } = evidence;

  const checks = [
    { id: 'vocab', label: `${p.vocabTarget} words known`, have: vocabKnown, need: p.vocabTarget },
    { id: 'grammar', label: `${p.grammarTarget} grammar points mastered`, have: grammarMastered, need: p.grammarTarget },
    { id: 'speaking', label: 'speaking average of 70+', have: Math.round(speakingAvg), need: 70 },
    { id: 'checkpoints', label: '2 checkpoints passed', have: checkpointsPassed, need: 2 },
  ];

  const met = checks.filter((c) => c.have >= c.need);
  const missing = checks.filter((c) => c.have < c.need);
  const progress = checks.reduce((sum, c) => sum + Math.min(1, c.need ? c.have / c.need : 1), 0) / checks.length;

  return {
    ready: missing.length === 0,
    met: met.map((c) => c.id),
    missing,
    progress: Math.round(progress * 100) / 100,
    from: level,
    to: nextLevel(level),
  };
}

/**
 * Where the shipped content actually sits against the syllabus. Honest gap
 * report rather than a claim: pass in the real topic/pack ids and it says what
 * is missing, so a thin level shows up as thin.
 */
export function coverageReport({ grammarTopics = [], vocabByLevel = {} } = {}) {
  const have = new Set(grammarTopics.map((t) => (typeof t === 'string' ? t : t.id)));
  const rows = LEVELS.map((level) => {
    const wanted = GRAMMAR_INVENTORY[level];
    const covered = wanted.filter((id) => resolveTopicId(id, have));
    const gaps = wanted.filter((id) => !resolveTopicId(id, have));
    const words = vocabByLevel[level] || 0;
    return {
      level,
      grammarCovered: covered.length,
      grammarWanted: wanted.length,
      grammarGaps: gaps,
      words,
      wordTarget: LEVEL_PROFILE[level].vocabTarget,
      complete: gaps.length === 0,
    };
  });
  const totalWanted = rows.reduce((a, r) => a + r.grammarWanted, 0);
  const totalCovered = rows.reduce((a, r) => a + r.grammarCovered, 0);
  return { rows, grammarCoverage: totalWanted ? Math.round((totalCovered / totalWanted) * 100) : 0 };
}

/**
 * Assistance policy — how much help the app shows at a given level. This is
 * the single place the "scaffolding fades as you improve" rule lives, so the
 * conversation UI, the listening player and the reading pane all fade in step.
 *
 * `confidence` (0..1, from the proficiency model) nudges the fade earlier for
 * someone who is clearly comfortable, and holds it longer for someone who is
 * struggling at their nominal level.
 */
export function assistancePolicy(level, confidence = 0.5) {
  const idx = levelIndex(level);
  const c = Math.max(0, Math.min(1, confidence));
  // Base fade 0 (maximum help) → 1 (no help) across A1..C1.
  const base = Math.min(1, idx / 4);
  const fade = Math.max(0, Math.min(1, base * 0.75 + c * 0.25));

  return {
    fade: Math.round(fade * 100) / 100,
    // Captions under audio: full for beginners, delayed then off.
    captions: fade < 0.35 ? 'always' : fade < 0.7 ? 'on-demand' : 'off',
    // Inline English gloss next to the partner's French.
    translation: fade < 0.5 ? 'inline' : fade < 0.8 ? 'tap' : 'off',
    // Sentence starters offered before the learner speaks.
    starters: fade < 0.4 ? 3 : fade < 0.7 ? 1 : 0,
    // How many hint steps the hint engine will give before showing the answer.
    hintSteps: fade < 0.4 ? 3 : fade < 0.75 ? 2 : 1,
    // Does the partner slow down and simplify?
    simplifyPartner: fade < 0.45,
    // Corrections shown after every turn, or batched to the end of the talk?
    correctionTiming: fade < 0.6 ? 'per-turn' : 'end-of-session',
  };
}

/** Target shape of a single conversation at this level. */
export function conversationTargets(level) {
  const p = profileFor(level);
  const [minWords, maxWords] = p.turnWords;
  return {
    turns: p.conversationTurns,
    minWords,
    maxWords,
    partnerRate: p.speechRate,
    // Rough wall-clock expectation, for the "this will take ~N min" label.
    estimatedMinutes: Math.max(3, Math.round((p.conversationTurns * (maxWords / 90)) + 2)),
  };
}
