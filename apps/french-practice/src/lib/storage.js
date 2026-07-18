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
  grammar: 'fp.grammar', // { [topicId]: { best, attempts, lastAt } } — quiz results
  wordCache: 'fp.wordCache', // { [word]: translation } — tap-to-translate lookups
  reviewLog: 'fp.reviewLog', // { 'YYYY-MM-DD': count } — daily review activity (heatmap)
  reminderDay: 'fp.reminderDay', // last day a smart reminder fired
  coins: 'fp.coins', // spendable currency (earned with XP, achievements, challenges)
  achievements: 'fp.achievements', // { [id]: dateUnlocked }
  challenges: 'fp.challenges', // { day, counts: { metric: n }, claimed: [ids] }
  avatar: 'fp.avatar', // selected avatar id
  avatarsOwned: 'fp.avatarsOwned', // [ids] purchased/unlocked
  collectibles: 'fp.collectibles', // { [id]: dateEarned }
  eventXp: 'fp.eventXp', // { [eventId]: xp earned during the event }
  xpLog: 'fp.xpLog', // { 'YYYY-MM-DD': xp } — daily XP history (calendar, weekly goal)
  freezes: 'fp.freezes', // streak freezes owned (auto-consumed on a 1-day gap)
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
  weeklyGoal: 150,
  smartReminders: false,
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
  logDailyXp(gained);
  return total;
}

// ---- daily XP history (learning calendar + weekly goal) ----

export const getXpLog = () => read(KEYS.xpLog, {});

function logDailyXp(gained) {
  if (gained <= 0) return;
  const log = getXpLog();
  const today = dayStamp();
  log[today] = (log[today] || 0) + gained;
  const cutoff = dayStamp(new Date(Date.now() - 400 * 86400000));
  for (const day of Object.keys(log)) if (day < cutoff) delete log[day];
  write(KEYS.xpLog, log);
}

// XP earned Monday→today of the current week.
export function getWeekXp() {
  const log = getXpLog();
  const now = new Date();
  const monday = new Date(now.getTime() - ((now.getDay() + 6) % 7) * 86400000);
  const start = dayStamp(monday);
  return Object.entries(log).reduce((sum, [day, xp]) => (day >= start ? sum + xp : sum), 0);
}

// ---- daily streak ----

const dayStamp = (d = new Date()) => d.toISOString().slice(0, 10);

export const getStreak = () => {
  const s = read(KEYS.streak, { count: 0, lastDay: null });
  if (!s.lastDay) return s;
  const yesterday = dayStamp(new Date(Date.now() - 86400000));
  const twoDaysAgo = dayStamp(new Date(Date.now() - 2 * 86400000));
  // A single missed day can be covered by a streak freeze (consumed once —
  // afterwards lastDay reads as yesterday, so this branch won't re-fire).
  if (s.lastDay === twoDaysAgo && getFreezes() > 0) {
    write(KEYS.freezes, getFreezes() - 1);
    const repaired = { ...s, lastDay: yesterday, frozeYesterday: true };
    write(KEYS.streak, repaired);
    return repaired;
  }
  // A streak survives until a full day is missed.
  if (s.lastDay !== dayStamp() && s.lastDay !== yesterday) {
    return { count: 0, lastDay: s.lastDay };
  }
  return s;
};

// ---- streak freezes (bought with coins, max 2, auto-used) ----

export const FREEZE_COST = 150;
export const MAX_FREEZES = 2;

export const getFreezes = () => read(KEYS.freezes, 0);

export function buyFreeze() {
  if (getFreezes() >= MAX_FREEZES) return null;
  if (spendCoins(FREEZE_COST) == null) return null;
  const total = getFreezes() + 1;
  write(KEYS.freezes, total);
  return total;
}

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

// ---- tap-to-translate word cache ----

export const getCachedWord = (word) => read(KEYS.wordCache, {})[word] ?? null;

export function cacheWord(word, translation) {
  const cache = read(KEYS.wordCache, {});
  cache[word] = translation;
  const keys = Object.keys(cache);
  if (keys.length > 500) delete cache[keys[0]]; // crude LRU-ish cap
  write(KEYS.wordCache, cache);
}

// ---- grammar quiz progress ----

export const getGrammarProgress = () => read(KEYS.grammar, {});

export function recordGrammarQuiz(topicId, score) {
  const all = getGrammarProgress();
  const prev = all[topicId] || { best: 0, attempts: 0 };
  all[topicId] = {
    best: Math.max(prev.best, score),
    attempts: prev.attempts + 1,
    lastAt: new Date().toISOString(),
  };
  write(KEYS.grammar, all);
  return all[topicId];
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
  const prev = srs[cardId] || { interval: 0, reps: 0, lapses: 0 };
  const base = SRS_STEPS[rating] ?? 1;
  const interval = rating === 'again' ? 0 : Math.max(base, Math.round(prev.interval * 2));
  srs[cardId] = {
    interval,
    reps: prev.reps + 1,
    lapses: (prev.lapses || 0) + (rating === 'again' ? 1 : 0),
    due: new Date(Date.now() + interval * 86400000).toISOString(),
    lastRating: rating,
    lastReviewed: new Date().toISOString(),
  };
  write(KEYS.srs, srs);
  logReview();
  return srs[cardId];
}

// ---- review activity log (per-day counts; feeds the heatmap) ----

export const getReviewLog = () => read(KEYS.reviewLog, {});

function logReview() {
  const log = getReviewLog();
  const today = dayStamp();
  log[today] = (log[today] || 0) + 1;
  // keep ~6 months so the object stays small
  const cutoff = dayStamp(new Date(Date.now() - 183 * 86400000));
  for (const day of Object.keys(log)) if (day < cutoff) delete log[day];
  write(KEYS.reviewLog, log);
}

// ---- mistake review (drill the recurring-mistake bank down to zero) ----

export function reviewHabit(key, gotIt) {
  const habits = getHabits();
  const habit = habits.find((h) => h.key === key);
  if (!habit) return habits;
  if (gotIt) habit.count -= 1;
  habit.lastSeen = new Date().toISOString();
  const next = habits.filter((h) => h.count > 0);
  next.sort((a, b) => b.count - a.count || (a.lastSeen < b.lastSeen ? 1 : -1));
  write(KEYS.habits, next);
  return next;
}

// ---- smart reminders (at most one nudge per day) ----

export const shouldRemindToday = () => read(KEYS.reminderDay, null) !== dayStamp();
export const markRemindedToday = () => write(KEYS.reminderDay, dayStamp());

// ---- coins (earned alongside XP; spent on avatars) ----

export const getCoins = () => read(KEYS.coins, 0);

export function addCoins(amount) {
  const total = getCoins() + Math.max(0, Math.round(amount));
  write(KEYS.coins, total);
  return total;
}

export function spendCoins(amount) {
  const total = getCoins();
  if (total < amount) return null;
  write(KEYS.coins, total - amount);
  return total - amount;
}

// ---- achievements ----

export const getAchievements = () => read(KEYS.achievements, {});

export function unlockAchievement(id) {
  const all = getAchievements();
  if (all[id]) return false;
  all[id] = new Date().toISOString();
  write(KEYS.achievements, all);
  return true;
}

// ---- daily challenges (per-day metric counters + claimed rewards) ----

export function getChallengeState() {
  const s = read(KEYS.challenges, null);
  if (s && s.day === dayStamp()) return s;
  return { day: dayStamp(), counts: {}, claimed: [] };
}

export function bumpChallengeMetric(metric, amount = 1) {
  const s = getChallengeState();
  s.counts[metric] = (s.counts[metric] || 0) + amount;
  write(KEYS.challenges, s);
  return s;
}

export function claimChallenge(id) {
  const s = getChallengeState();
  if (s.claimed.includes(id)) return s;
  s.claimed.push(id);
  write(KEYS.challenges, s);
  return s;
}

// ---- avatars ----

export const getAvatar = () => read(KEYS.avatar, 'sourire');
export const setAvatar = (id) => write(KEYS.avatar, id);
export const getOwnedAvatars = () => read(KEYS.avatarsOwned, ['sourire', 'beret']);

export function ownAvatar(id) {
  const owned = getOwnedAvatars();
  if (!owned.includes(id)) write(KEYS.avatarsOwned, [...owned, id]);
}

// ---- collectibles ----

export const getCollectibles = () => read(KEYS.collectibles, {});

export function awardCollectible(id) {
  const all = getCollectibles();
  if (all[id]) return false;
  all[id] = new Date().toISOString();
  write(KEYS.collectibles, all);
  return true;
}

// ---- seasonal event progress ----

export const getEventXp = (eventId) => read(KEYS.eventXp, {})[eventId] || 0;

export function addEventXp(eventId, amount) {
  const all = read(KEYS.eventXp, {});
  all[eventId] = (all[eventId] || 0) + Math.max(0, Math.round(amount));
  write(KEYS.eventXp, all);
  return all[eventId];
}
