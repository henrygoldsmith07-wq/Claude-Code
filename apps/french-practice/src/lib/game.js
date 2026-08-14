import { getLanguage } from './languages.js';
import { contentLang } from './content/active.js';

// Gamification (single-player only): levels, achievements, coins, daily
// challenges, avatars, collectibles and seasonal events. Everything is
// local — no leaderboards or leagues, since there is no backend to rank
// against and the app is a solo practice studio.

// ---- deterministic RNG (so bots and daily picks are stable per seed) ----

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- levels (XP → level; each level needs 50 more XP than the last) ----

export function levelFromXp(xp) {
  let level = 1;
  let remaining = xp;
  let need = 100;
  while (remaining >= need) {
    remaining -= need;
    level += 1;
    need += 50;
  }
  // Titles follow the target language (Débutant… / Anfänger… / Principiante…).
  const titles = getLanguage(contentLang()).levelTitles;
  return {
    level,
    intoLevel: remaining,
    needed: need,
    progress: remaining / need,
    title: titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))],
  };
}

// ---- avatars (unlockable content: free starters, coin buys, achievement gifts) ----

export const AVATARS = [
  { id: 'sourire', emoji: '🙂', name: 'Le Sourire', cost: 0 },
  { id: 'beret', emoji: '👩‍🎨', name: "L'Artiste", cost: 0 },
  { id: 'chef', emoji: '👨‍🍳', name: 'Le Chef', cost: 40 },
  { id: 'chat', emoji: '🐈', name: 'Le Chat', cost: 60 },
  { id: 'coq', emoji: '🐓', name: 'Le Coq', cost: 80 },
  { id: 'mime', emoji: '🎭', name: 'Le Mime', cost: 120 },
  { id: 'astronaute', emoji: '👩‍🚀', name: "L'Astronaute", cost: 200 },
  { id: 'roi', emoji: '👑', name: 'Sa Majesté', achievement: 'cinq-mille' },
  { id: 'phenix', emoji: '🔥', name: 'Le Phénix', achievement: 'serie-7' },
];

// ---- achievements ----

export const ACHIEVEMENTS = [
  { id: 'premier-pas', emoji: '👣', title: 'Premiers pas', desc: 'Earn your first XP', coins: 10, check: (s) => s.xp > 0 },
  { id: 'causeur', emoji: '💬', title: 'Causeur', desc: 'Finish 5 Arena sessions', coins: 25, check: (s) => s.sessions >= 5 },
  { id: 'serie-3', emoji: '🔥', title: 'Bien parti', desc: 'A 3-day streak', coins: 15, check: (s) => s.streak >= 3 },
  { id: 'serie-7', emoji: '🌋', title: 'Inarrêtable', desc: 'A 7-day streak', coins: 50, check: (s) => s.streak >= 7 },
  { id: 'mille', emoji: '⚡', title: 'Millier', desc: 'Reach 1,000 XP', coins: 30, check: (s) => s.xp >= 1000 },
  { id: 'cinq-mille', emoji: '🏆', title: 'Grand fond', desc: 'Reach 5,000 XP', coins: 100, check: (s) => s.xp >= 5000 },
  { id: 'niveau-5', emoji: '🎖️', title: 'Niveau 5', desc: 'Reach level 5', coins: 25, check: (s) => s.level >= 5 },
  { id: 'niveau-10', emoji: '🏅', title: 'Niveau 10', desc: 'Reach level 10', coins: 60, check: (s) => s.level >= 10 },
  { id: 'studieux', emoji: '🃏', title: 'Studieux', desc: 'Review 100 flashcards', coins: 40, check: (s) => s.reviews >= 100 },
  { id: 'grammairien', emoji: '📐', title: 'Grammairien', desc: 'Master a grammar topic (80+)', coins: 25, check: (s) => s.grammarMastered >= 1 },
  { id: 'lexicographe', emoji: '📔', title: 'Lexicographe', desc: 'Save 20 words to your notebook', coins: 25, check: (s) => s.notebook >= 20 },
  { id: 'collectionneur', emoji: '🖼️', title: 'Collectionneur', desc: 'Own 5 collectibles', coins: 50, check: (s) => s.collectibles >= 5 },
  { id: 'repetiteur', emoji: '🎤', title: 'Répétiteur', desc: 'Complete 5 phrase drills', coins: 30, check: (s) => (s.drills || 0) >= 5 },
  { id: 'surligneur', emoji: '⭐', title: 'Surligneur', desc: 'Star 10 survival lines', coins: 20, check: (s) => (s.starred || 0) >= 10 },
];

// ---- daily challenges (3 per day, deterministic pick) ----

const CHALLENGE_POOL = [
  { id: 'xp-30', metric: 'xp', target: 30, title: 'Faites chauffer', desc: 'Earn 30 XP today', coins: 10, xp: 5 },
  { id: 'xp-60', metric: 'xp', target: 60, title: 'Grosse journée', desc: 'Earn 60 XP today', coins: 20, xp: 10 },
  { id: 'cards-10', metric: 'cards', target: 10, title: 'Mémoire vive', desc: 'Review 10 flashcards', coins: 12, xp: 6 },
  { id: 'cards-20', metric: 'cards', target: 20, title: 'Marathon de cartes', desc: 'Review 20 flashcards', coins: 20, xp: 10 },
  { id: 'session-1', metric: 'session', target: 1, title: 'Au parloir', desc: 'Finish an Arena session', coins: 15, xp: 8 },
  { id: 'dictation-1', metric: 'dictation', target: 1, title: "L'oreille fine", desc: 'Complete a dictée sentence', coins: 10, xp: 5 },
  { id: 'quickfire-1', metric: 'quickfire', target: 1, title: 'Sans filet', desc: 'Do a Quick Fire improv', coins: 12, xp: 6 },
  { id: 'cards-5', metric: 'cards', target: 5, title: 'Cinq sur cinq', desc: 'Review 5 flashcards', coins: 8, xp: 4 },
  { id: 'drill-1', metric: 'drill', target: 1, title: 'Sur le terrain', desc: 'Finish a phrase drill', coins: 12, xp: 6 },
  { id: 'drill-2', metric: 'drill', target: 2, title: 'Répétition générale', desc: 'Complete 2 phrase drills', coins: 18, xp: 10 },
  { id: 'grammar-1', metric: 'grammar', target: 1, title: 'Grammaire du jour', desc: 'Finish a grammar quiz', coins: 12, xp: 6 },
  { id: 'culture-1', metric: 'culture', target: 1, title: 'Culture minute', desc: 'Complete a culture quiz', coins: 10, xp: 5 },
];

export function dailyChallenges(dayStr) {
  const rand = mulberry(hashSeed(`day-${dayStr}`));
  const pool = [...CHALLENGE_POOL];
  const picks = [];
  const metrics = new Set();
  while (picks.length < 3 && pool.length) {
    const i = Math.floor(rand() * pool.length);
    const [c] = pool.splice(i, 1);
    if (metrics.has(c.metric)) continue; // one challenge per metric
    metrics.add(c.metric);
    picks.push(c);
  }
  return picks;
}

// ---- collectibles (postcards from France, earned — never bought) ----

export const COLLECTIBLES = [
  { id: 'tour-eiffel', emoji: '🗼', title: 'La Tour Eiffel', source: 'challenges', hint: 'Complete all 3 daily challenges' },
  { id: 'croissant', emoji: '🥐', title: 'Le Croissant', source: 'challenges', hint: 'Complete all 3 daily challenges' },
  { id: 'fromage', emoji: '🧀', title: 'Le Plateau', source: 'challenges', hint: 'Complete all 3 daily challenges' },
  { id: 'baguette', emoji: '🥖', title: 'La Baguette', source: 'challenges', hint: 'Complete all 3 daily challenges' },
  { id: 'vin', emoji: '🍷', title: 'Le Bordeaux', source: 'challenges', hint: 'Complete all 3 daily challenges' },
  { id: 'velo', emoji: '🚲', title: 'Le Vélo', source: 'badges', need: 4, hint: 'Unlock 4 achievements' },
  { id: 'tgv', emoji: '🚄', title: 'Le TGV', source: 'badges', need: 8, hint: 'Unlock 8 achievements' },
  { id: 'coq-or', emoji: '🐓', title: "Le Coq d'Or", source: 'badges', need: 12, hint: 'Unlock every achievement' },
  { id: 'fleur-printemps', emoji: '🌸', title: 'Le Printemps', source: 'event', hint: 'Spring event reward' },
  { id: 'plage-ete', emoji: '🏖️', title: "L'Été", source: 'event', hint: 'Summer event reward' },
  { id: 'feuille-automne', emoji: '🍂', title: "L'Automne", source: 'event', hint: 'Autumn event reward' },
  { id: 'neige-hiver', emoji: '⛄', title: "L'Hiver", source: 'event', hint: 'Winter event reward' },
];

// First unowned collectible from a source group, if any.
export function nextCollectible(owned, source) {
  return COLLECTIBLES.find((c) => c.source === source && !owned[c.id]) || null;
}

// Badge-count collectibles the player has earned but not yet been given.
export function earnedBadgeCollectibles(owned, unlockedCount) {
  return COLLECTIBLES.filter((c) => c.source === 'badges' && c.need <= unlockedCount && !owned[c.id]);
}

// ---- milestones (a journey timeline; next one is always visible) ----

export const MILESTONES = [
  { id: 'ms-xp-100', label: '100 XP', metric: 'xp', target: 100 },
  { id: 'ms-xp-500', label: '500 XP', metric: 'xp', target: 500 },
  { id: 'ms-xp-1000', label: '1,000 XP', metric: 'xp', target: 1000 },
  { id: 'ms-xp-2500', label: '2,500 XP', metric: 'xp', target: 2500 },
  { id: 'ms-xp-5000', label: '5,000 XP', metric: 'xp', target: 5000 },
  { id: 'ms-streak-7', label: '7-day streak', metric: 'streak', target: 7 },
  { id: 'ms-streak-30', label: '30-day streak', metric: 'streak', target: 30 },
  { id: 'ms-reviews-100', label: '100 card reviews', metric: 'reviews', target: 100 },
  { id: 'ms-sessions-5', label: '5 conversations', metric: 'sessions', target: 5 },
];

// ---- certificates (earned documents, rendered to PNG on demand) ----

export const CERTIFICATES = [
  { id: 'cert-bronze', title: 'Certificat de Bronze', requirement: 'Reach 500 XP', metric: 'xp', target: 500 },
  { id: 'cert-argent', title: "Certificat d'Argent", requirement: 'Reach 1,500 XP', metric: 'xp', target: 1500 },
  { id: 'cert-or', title: "Certificat d'Or", requirement: 'Reach 3,500 XP', metric: 'xp', target: 3500 },
  { id: 'cert-assidu', title: "Certificat d'Assiduité", requirement: 'A 30-day streak', metric: 'streak', target: 30 },
];

// ---- encouraging feedback (state-aware, rotates daily) ----

const CHEERS = {
  goalDone: [
    'Objectif atteint — well earned. Anything extra today is pure bonus.',
    'Goal hit! Consistency like this is exactly how French sticks.',
    'Done for today — and your future self says merci.',
  ],
  close: [
    'Almost there — one more exercise tips you over today’s goal.',
    'So close. A quick review round would seal the day.',
    'The goal is within one conversation turn. Allez !',
  ],
  started: [
    'Good start — small daily doses beat weekend marathons.',
    'Underway. Ten focused minutes today is a win.',
    'Every rep counts double when it’s daily. Keep rolling.',
  ],
  fresh: [
    'New day, fresh curve — a two-minute review is the easiest first step.',
    'Nothing yet today. Start tiny: one flashcard round.',
    'The hardest part is opening the app. Ça y est — you’re here.',
  ],
};

export function encouragement({ goalPct, streak, day }) {
  const bucket =
    goalPct >= 100 ? 'goalDone' : goalPct >= 70 ? 'close' : goalPct > 0 ? 'started' : 'fresh';
  const lines = CHEERS[bucket];
  const pick = lines[hashSeed(`${day}-${bucket}`) % lines.length];
  return streak >= 3 && bucket !== 'goalDone'
    ? `${pick} Your ${streak}-day streak is counting on you.`
    : pick;
}

// ---- weekly league (local leaderboard, no backend) ----
// The app has no server, so there are no real opponents to rank against.
// Instead each week spins up a deterministic cohort of "pace-setters" —
// seeded challengers, not real people — and ranks the learner among them by
// this week's XP. Tier tracks the learner's level, so climbing leagues means
// levelling up. Honest, offline, and still a proper ladder to chase.

export const LEAGUE_TIERS = [
  { id: 'bronze', name: 'Bronze', emoji: '🥉', minLevel: 1 },
  { id: 'argent', name: 'Argent', emoji: '🥈', minLevel: 3 },
  { id: 'or', name: 'Or', emoji: '🥇', minLevel: 5 },
  { id: 'emeraude', name: 'Émeraude', emoji: '💚', minLevel: 7 },
  { id: 'diamant', name: 'Diamant', emoji: '💎', minLevel: 9 },
];

export function leagueTier(level) {
  let idx = 0;
  LEAGUE_TIERS.forEach((t, i) => { if (level >= t.minLevel) idx = i; });
  return { ...LEAGUE_TIERS[idx], index: idx };
}

const RIVAL_NAMES = [
  'Camille', 'Luc', 'Amélie', 'Théo', 'Chloé', 'Hugo', 'Léa',
  'Naïma', 'Yann', 'Sofia', 'Mathis', 'Inès', 'Bruno', 'Manon',
];
const RIVAL_AVATARS = ['🦊', '🐻', '🦉', '🐸', '🦁', '🐼', '🦋', '🐙', '🦜', '🐨', '🦎', '🐢'];

// weekProgress: 0..1 fraction of the Mon–Sun week elapsed, so rivals climb as
// the week goes on instead of teleporting to a final total.
export function weeklyLeague(weekKey, userWeekXp, weekProgress, tierIndex = 0, user = {}) {
  const rand = mulberry(hashSeed(`league-${weekKey}-${tierIndex}`));
  const base = 140 + tierIndex * 110; // tougher tiers set a faster pace
  const p = Math.min(1, Math.max(0, weekProgress));
  const names = [...RIVAL_NAMES];
  const rivals = [];
  for (let i = 0; i < 9; i++) {
    const name = names.splice(Math.floor(rand() * names.length), 1)[0];
    const weekTarget = Math.round(base * (0.5 + rand() * 1.5));
    const xp = Math.max(0, Math.round(weekTarget * p * (0.82 + rand() * 0.36)));
    rivals.push({ name, avatar: RIVAL_AVATARS[hashSeed(name) % RIVAL_AVATARS.length], xp });
  }
  const you = { name: user.name || 'You', avatar: user.avatar || '🙂', xp: Math.max(0, userWeekXp), isUser: true };
  // Sort by XP; on a tie the learner sits just below an equal rival (fairer).
  const standings = [...rivals, you].sort((a, b) => b.xp - a.xp || (a.isUser ? 1 : b.isUser ? -1 : 0));
  const rank = standings.findIndex((s) => s.isUser) + 1;
  const ahead = rank > 1 ? standings[rank - 2] : null;
  return { standings, rank, ahead, count: standings.length, promoteZone: 3, relegateZone: 3 };
}

// ---- seasonal events (date-windowed, one per season) ----

const SEASONS = [
  { key: 'printemps', title: 'Le Printemps des Mots', emoji: '🌸', from: [2, 20], to: [5, 20], goal: 400, collectible: 'fleur-printemps' },
  { key: 'ete', title: "L'Été en Terrasse", emoji: '🏖️', from: [5, 21], to: [8, 21], goal: 400, collectible: 'plage-ete' },
  { key: 'automne', title: "L'Automne des Feuilles", emoji: '🍂', from: [8, 22], to: [11, 20], goal: 400, collectible: 'feuille-automne' },
  { key: 'hiver', title: "L'Hiver au Coin du Feu", emoji: '⛄', from: [11, 21], to: [2, 19], goal: 400, collectible: 'neige-hiver' },
];

export function activeEvent(d = new Date()) {
  const m = d.getMonth();
  const day = d.getDate();
  const after = (s) => m > s.from[0] || (m === s.from[0] && day >= s.from[1]);
  const before = (s) => m < s.to[0] || (m === s.to[0] && day <= s.to[1]);
  const season = SEASONS.find((s) =>
    s.from[0] <= s.to[0] ? after(s) && before(s) : after(s) || before(s)
  );
  if (!season) return null;
  // Winter spans New Year — key the id to the year the season started in.
  const year = season.key === 'hiver' && m <= 2 ? d.getFullYear() - 1 : d.getFullYear();
  return { ...season, id: `${season.key}-${year}` };
}
