// Thin localStorage wrapper — the app's only persistence layer (no backend).

const KEYS = {
  apiKey: 'fp.groqKey',
  sessions: 'fp.sessions', // array of completed session summaries
  streak: 'fp.streak', // { count, lastDay }
  srs: 'fp.srs', // { [cardId]: { interval, due, reps } }
  settings: 'fp.settings', // { ttsRate, mockMode, devPanel, theme, level, dailyGoal }
  xp: 'fp.xp', // lifetime experience points
  xpDay: 'fp.xpDay', // { day: 'YYYY-MM-DD', amount } — today's XP toward the goal
  active: 'fp.activeSession', // { scenarioId, history } — in-flight conversation
  habits: 'fp.habits', // [{ text, key, count, lastSeen }] — recurring mistakes
  notebook: 'fp.notebook', // [{ id, fr, en, note, addedAt }] — saved words
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

// theme: null = follow the OS preference; 'dark' | 'light' once toggled
// level: CEFR level used to calibrate the LLM; dailyGoal: XP target per day
const DEFAULT_SETTINGS = {
  ttsRate: 1,
  mockMode: false,
  devPanel: false,
  theme: null,
  level: 'B1',
  dailyGoal: 30,
};
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
export const setSettings = (s) => write(KEYS.settings, s);

// ---- session history (last 10 kept for trend charts) ----

export const getSessions = () => read(KEYS.sessions, []);

// ---- in-flight conversation (survives a page refresh) ----

export const getActiveSession = () => read(KEYS.active, null);
export const setActiveSession = (scenarioId, history) =>
  write(KEYS.active, { scenarioId, history });
export const clearActiveSession = () => localStorage.removeItem(KEYS.active);

// The most recent report powers the Home dashboard's "Today's focus".
export function getLastReport() {
  const sessions = getSessions();
  return sessions.length ? sessions[sessions.length - 1] : null;
}

export function saveSession(summary) {
  const sessions = getSessions();
  sessions.push({ ...summary, date: new Date().toISOString() });
  write(KEYS.sessions, sessions.slice(-10));
  recordHabits(summary.report?.stubborn_habits || []);
  bumpStreak();
}

// ---- recurring mistake bank ----
// Stubborn habits from each report accumulate across sessions so patterns
// ("you've hit this 4 times") become visible instead of being overwritten.

const habitKey = (text) =>
  String(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80);

export const getHabits = () => read(KEYS.habits, []);

function recordHabits(habitTexts) {
  const habits = getHabits();
  const now = new Date().toISOString();
  for (const text of habitTexts) {
    const key = habitKey(text);
    if (!key) continue;
    const existing = habits.find((h) => h.key === key);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
      existing.text = String(text); // keep the freshest wording
    } else {
      habits.push({ text: String(text), key, count: 1, lastSeen: now });
    }
  }
  habits.sort((a, b) => b.count - a.count || (a.lastSeen < b.lastSeen ? 1 : -1));
  write(KEYS.habits, habits.slice(0, 20));
}

// ---- experience points (10 XP per point of overall turn score / 10) ----

export const getXp = () => read(KEYS.xp, 0);

export function getTodayXp() {
  const d = read(KEYS.xpDay, null);
  return d && d.day === dayStamp() ? d.amount : 0;
}

export function addXp(amount) {
  const gained = Math.max(0, Math.round(amount));
  const total = getXp() + gained;
  write(KEYS.xp, total);
  write(KEYS.xpDay, { day: dayStamp(), amount: getTodayXp() + gained });
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

// ---- vocabulary notebook (one-click saved words) ----

export const getNotebook = () => read(KEYS.notebook, []);

export const isInNotebook = (id) => getNotebook().some((e) => e.id === id);

export function saveToNotebook({ id, fr, en, note = '' }) {
  const nb = getNotebook();
  if (nb.some((e) => e.id === id)) return nb;
  nb.unshift({ id, fr, en, note, addedAt: new Date().toISOString() });
  write(KEYS.notebook, nb.slice(0, 200));
  return nb;
}

export function removeFromNotebook(id) {
  const nb = getNotebook().filter((e) => e.id !== id);
  write(KEYS.notebook, nb);
  return nb;
}

// ---- spaced repetition (simple SM-2-ish intervals, in days) ----

const SRS_STEPS = { again: 0, hard: 1, good: 3, easy: 7 };

export const getSrs = () => read(KEYS.srs, {});

// A card is due if it was never reviewed, or its due date has passed.
export const isCardDue = (srsEntry) =>
  !srsEntry || !srsEntry.due || new Date(srsEntry.due) <= new Date();

export function getDueCardIds(allIds) {
  const srs = getSrs();
  return allIds.filter((id) => isCardDue(srs[id]));
}

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
