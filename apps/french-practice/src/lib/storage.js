// Thin localStorage wrapper — the app's only persistence layer (no backend).

const KEYS = {
  apiKey: 'fp.groqKey',
  sessions: 'fp.sessions', // array of completed session summaries
  streak: 'fp.streak', // { count, lastDay }
  srs: 'fp.srs', // { [cardId]: { interval, due, reps } }
  settings: 'fp.settings', // { ttsRate, mockMode, devPanel }
  xp: 'fp.xp', // lifetime experience points
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — degrade silently */
  }
}

export const getApiKey = () => read(KEYS.apiKey, '');
export const setApiKey = (k) => write(KEYS.apiKey, k);
export const clearApiKey = () => localStorage.removeItem(KEYS.apiKey);

export const getSettings = () =>
  read(KEYS.settings, { ttsRate: 1, mockMode: false, devPanel: false });
export const setSettings = (s) => write(KEYS.settings, s);

// ---- session history (last 10 kept for trend charts) ----

export const getSessions = () => read(KEYS.sessions, []);

export function saveSession(summary) {
  const sessions = getSessions();
  sessions.push({ ...summary, date: new Date().toISOString() });
  write(KEYS.sessions, sessions.slice(-10));
  bumpStreak();
}

// ---- experience points (10 XP per point of overall turn score / 10) ----

export const getXp = () => read(KEYS.xp, 0);

export function addXp(amount) {
  const total = getXp() + Math.max(0, Math.round(amount));
  write(KEYS.xp, total);
  return total;
}

// ---- daily streak ----

const dayStamp = (d = new Date()) => d.toISOString().slice(0, 10);

export const getStreak = () => {
  const s = read(KEYS.streak, { count: 0, lastDay: null });
  if (!s.lastDay) return s;
  const yesterday = dayStamp(new Date(Date.now() - 86400000));
  // A streak survives until a full day is missed.
  if (s.lastDay !== dayStamp() && s.lastDay !== yesterday) {
    return { count: 0, lastDay: s.lastDay };
  }
  return s;
};

function bumpStreak() {
  const today = dayStamp();
  const s = getStreak();
  if (s.lastDay === today) return;
  write(KEYS.streak, { count: s.count + 1, lastDay: today });
}

// ---- spaced repetition (simple SM-2-ish intervals, in days) ----

const SRS_STEPS = { again: 0, hard: 1, good: 3, easy: 7 };

export const getSrs = () => read(KEYS.srs, {});

export function rateCard(cardId, rating) {
  const srs = getSrs();
  const prev = srs[cardId] || { interval: 0, reps: 0 };
  const base = SRS_STEPS[rating] ?? 1;
  const interval = rating === 'again' ? 0 : Math.max(base, Math.round(prev.interval * 2));
  srs[cardId] = {
    interval,
    reps: prev.reps + 1,
    due: new Date(Date.now() + interval * 86400000).toISOString(),
    lastRating: rating,
  };
  write(KEYS.srs, srs);
  return srs[cardId];
}
