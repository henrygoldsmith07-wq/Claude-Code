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
  prefs: 'fp.prefs', // personalisation: learning style, lesson length, topics, adaptive
  coins: 'fp.coins', // spendable currency (earned with XP, achievements, challenges)
  achievements: 'fp.achievements', // { [id]: dateUnlocked }
  challenges: 'fp.challenges', // { day, counts: { metric: n }, claimed: [ids] }
  avatar: 'fp.avatar', // selected avatar id
  avatarsOwned: 'fp.avatarsOwned', // [ids] purchased/unlocked
  collectibles: 'fp.collectibles', // { [id]: dateEarned }
  eventXp: 'fp.eventXp', // { [eventId]: xp earned during the event }
  xpLog: 'fp.xpLog', // { 'YYYY-MM-DD': xp } — daily XP history (calendar, weekly goal)
  freezes: 'fp.freezes', // streak freezes owned (auto-consumed on a 1-day gap)
  timeLog: 'fp.timeLog', // { 'YYYY-MM-DD': seconds } — time studied per day
  metrics: 'fp.metrics', // [{ skill, score, at }] — scored-activity log for analytics
  habitTracker: 'fp.habitTracker', // { list: [{id,name}], done: { habitId: { 'YYYY-MM-DD': true } } }
  onboarded: 'fp.onboarded', // '1' once the first-run onboarding is done/skipped
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

// ---- first-run onboarding gate ----
// New visitors (no key, no XP, no sessions, no explicit flag) see the wizard.

export const isOnboarded = () => read(KEYS.onboarded, null) === '1';
export const setOnboarded = () => write(KEYS.onboarded, '1');

export function shouldOnboard() {
  if (isOnboarded()) return false;
  const returning = Boolean(getApiKey()) || getXp() > 0 || getSessions().length > 0;
  return !returning;
}

// ---- data portability (manual "sync across devices", no backend) ----
// Export every fp.* key except the private API key into a portable backup,
// and restore it on another device. There is no server; this is the honest
// way to move progress between machines.

export function exportProgress() {
  const data = {};
  for (const key of Object.values(KEYS)) {
    if (key === KEYS.apiKey) continue; // never export the secret
    const raw = localStorage.getItem(key);
    if (raw != null) data[key] = raw;
  }
  return { app: 'le-studio', version: 1, exportedAt: new Date().toISOString(), data };
}

export function importProgress(payload) {
  if (!payload || payload.app !== 'le-studio' || typeof payload.data !== 'object') {
    throw new Error('That doesn’t look like a Le Studio backup file.');
  }
  const allowed = new Set(Object.values(KEYS));
  let restored = 0;
  for (const [key, raw] of Object.entries(payload.data)) {
    if (key === KEYS.apiKey || !allowed.has(key)) continue; // ignore unknown/secret keys
    try {
      JSON.parse(raw); // validate it's the stored JSON shape
      localStorage.setItem(key, raw);
      restored += 1;
    } catch { /* skip malformed entry */ }
  }
  return restored;
}

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
  name: '',
};
export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
export const setSettings = (s) => write(KEYS.settings, s);

// ---- personalisation preferences ----

const DEFAULT_PREFS = {
  learningStyle: 'balanced', // balanced | conversation | grammar | vocabulary | immersion
  lessonLength: 'medium', // short | medium | long
  adaptiveDifficulty: true, // nudge effective difficulty from recent scores
  favouriteTopics: [], // subset of TOPIC ids
};
export const getPrefs = () => ({ ...DEFAULT_PREFS, ...read(KEYS.prefs, {}) });
export const setPrefs = (p) => write(KEYS.prefs, { ...getPrefs(), ...p });

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

// ---- time studied (seconds per day; drives Analytics) ----

export const getTimeLog = () => read(KEYS.timeLog, {});

export function addStudyTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (!s) return;
  const log = getTimeLog();
  const today = dayStamp();
  log[today] = (log[today] || 0) + s;
  const cutoff = dayStamp(new Date(Date.now() - 400 * 86400000));
  for (const day of Object.keys(log)) if (day < cutoff) delete log[day];
  write(KEYS.timeLog, log);
}

// ---- scored-activity metrics (per-skill scores for Analytics) ----

export const getMetrics = () => read(KEYS.metrics, []);

export function recordSkillScore(skill, score) {
  const n = Math.max(0, Math.min(100, Math.round(score)));
  const metrics = getMetrics();
  metrics.push({ skill, score: n, at: new Date().toISOString() });
  write(KEYS.metrics, metrics.slice(-300));
  return metrics;
}

// ---- habit tracker (user-defined daily habits with per-habit streaks) ----

const DEFAULT_HABITS = [
  { id: 'h-speak', name: 'Speak French out loud' },
  { id: 'h-review', name: 'Review my flashcards' },
  { id: 'h-listen', name: 'Listen to something in French' },
];

export function getHabitTracker() {
  const t = read(KEYS.habitTracker, null);
  if (t && Array.isArray(t.list)) return t;
  return { list: DEFAULT_HABITS, done: {} };
}

export function addHabit(name) {
  const t = getHabitTracker();
  const id = `h-${Date.now()}`;
  t.list.push({ id, name: String(name).slice(0, 60) });
  write(KEYS.habitTracker, t);
  return t;
}

export function removeHabit(id) {
  const t = getHabitTracker();
  t.list = t.list.filter((h) => h.id !== id);
  delete t.done[id];
  write(KEYS.habitTracker, t);
  return t;
}

export function setHabitList(names) {
  const t = getHabitTracker();
  t.list = names.map((name, i) => ({ id: `h-${Date.now()}-${i}`, name: String(name).slice(0, 60) }));
  write(KEYS.habitTracker, t);
  return t;
}

export function toggleHabit(id, day = dayStamp()) {
  const t = getHabitTracker();
  t.done[id] ||= {};
  if (t.done[id][day]) delete t.done[id][day];
  else t.done[id][day] = true;
  write(KEYS.habitTracker, t);
  return t;
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

// ---- spaced repetition: the SM-2 algorithm (SuperMemo / Anki) ----
// The evidence-based scheduler: each card carries an ease factor (EF) that
// grows when recall is easy and shrinks when it's hard, and the interval
// compounds by EF once a card has graduated. This spaces reviews to land
// just as a memory is about to fade — the most efficient way to retain.

const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
// Map the four rating buttons to SM-2 quality grades (0–5).
const QUALITY = { again: 2, hard: 3, good: 4, easy: 5 };

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
  const prev = srs[cardId] || { interval: 0, reps: 0, lapses: 0, ease: DEFAULT_EASE };
  let ease = prev.ease || DEFAULT_EASE;
  let reps = prev.reps || 0;
  let interval;

  if (rating === 'again') {
    // Lapse: relearn today, drop the ease, and restart the interval ladder.
    reps = 0;
    interval = 0;
    ease = Math.max(MIN_EASE, ease - 0.2);
  } else {
    // SM-2 ease update: EF' = EF + (0.1 − (5−q)(0.08 + (5−q)·0.02)).
    const q = QUALITY[rating];
    ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round((prev.interval || 1) * ease);
    // "Hard" still advances, but by less than a full ease step.
    if (rating === 'hard') interval = Math.max(1, Math.round(interval * 0.6));
  }

  srs[cardId] = {
    interval,
    reps,
    ease: Math.round(ease * 100) / 100,
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
