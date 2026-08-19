import { rateFsrs as fsrsRate, migrateFromSm2 } from './fsrs.js';
// Thin localStorage wrapper — the app's only persistence layer (no backend).

const KEYS = {
  apiKey: 'fp.groqKey',
  sessions: 'fp.sessions', // durable array of completed session summaries
  sessionHistoryMeta: 'fp.sessionHistory.v2', // migration marker for unbounded session history
  pulseHistory: 'fp.pulse-history.v2', // versioned, transcript-free history for Pulse
  pulseOptIn: 'fp.pulse-opt-in', // Le Studio's own Pulse opt-in, separate from the mirror it gates
  reviewEvents: 'fp.reviewEvents.v2', // durable per-review events; reviewLog remains a heatmap aggregate
  learnerErrors: 'fp.learnerErrors.v1', // persistent cross-mode error model
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
  vacation: 'fp.vacation', // ISO day until which streak loss is paused
  grammarErrors: 'fp.grammarErrors', // { [topicId]: count } — Arena mistake classifications
  gettingStarted: 'fp.gettingStarted', // '1' once the Home checklist is dismissed
  lastActivity: 'fp.lastActivity', // { type, id?, label, at } — powers Home's continue card
  timeLog: 'fp.timeLog', // { 'YYYY-MM-DD': seconds } — time studied per day
  metrics: 'fp.metrics', // [{ skill, score, at }] — scored-activity log for analytics
  habitTracker: 'fp.habitTracker', // { list: [{id,name}], done: { habitId: { 'YYYY-MM-DD': true } } }
  onboarded: 'fp.onboarded', // '1' once the first-run onboarding is done/skipped
  syncId: 'fp.syncId', // stable local account id — travels with a sync snapshot
  lastBackup: 'fp.lastBackup', // ISO time of the last export/sync-code created
  starred: 'fp.starredLines', // [{ id, fr, en, source, addedAt }] — favourited survival phrases
  weaknessMemory: 'fp.weaknessMemory', // persistent weakness memory: error → repair → retest → recurrence
  errorNotebook: 'fp.errorNotebook', // detailed writing/speaking corrections
  phonemeProfile: 'fp.phonemeProfile', // pronunciation attempts by phoneme
};

export { KEYS };

// A stable per-account id, created on first use. Because it exports/imports
// with the snapshot, two devices restored from the same code share one id —
// the closest thing to an "account" without a backend.
export function getSyncId() {
  let id = read(KEYS.syncId, null);
  if (!id) {
    id = 'ls-' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
    write(KEYS.syncId, id);
  }
  return id;
}

export const getLastBackup = () => read(KEYS.lastBackup, null);
export const markBackup = () => write(KEYS.lastBackup, new Date().toISOString());

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
  return { app: 'le-studio', version: 2, exportedAt: new Date().toISOString(), data };
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
  language: 'fr', // the language being studied right now: fr | de | es
  // Every language the learner signed up for. Empty means "derive from
  // `language`", which is what settings saved before multi-language look
  // like — normaliseLanguages() does that, so upgrading never reassigns
  // someone studying German to the French default.
  languages: [],
  timezone: null, // IANA tz, detected at onboarding — frames reminder copy
  // accessibility preferences (applied as classes on <html>)
  reduceMotion: false,
  largeText: false,
  dyslexiaFont: false,
  highContrast: false,
  examBoard: null, // null | gcse-aqa | gcse-edexcel | a-level-aqa | delf-b1 | delf-b2
  correctionFrequency: 'adaptive', // adaptive | every-turn | important | end | off
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

// ---- Pulse opt-in ---------------------------------------------------------
// Pulse reads the mirror under `fp.pulse-history.v2`. Sharing is off by
// default and gated here, where the data originates: while the flag is off no
// mirror is written, and revoking deletes the mirror outright.

export const readPulseOptIn = () => read(KEYS.pulseOptIn, null) === '1';

export function setPulseOptIn(enabled) {
  if (enabled) {
    write(KEYS.pulseOptIn, '1');
  } else {
    localStorage.removeItem(KEYS.pulseOptIn);
    localStorage.removeItem(KEYS.pulseHistory);
  }
}

// ---- durable session and Pulse history ------------------------------------

const SESSION_HISTORY_SCHEMA = 2;
const LEGACY_SESSION_KEYS = ['fp.sessionHistory', 'fp.sessions.v1'];

function isoOrNow(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
    ? value
    : new Date().toISOString();
}

function normaliseSession(session, index) {
  const savedAt = isoOrNow(session?.savedAt || session?.date);
  return {
    ...(session && typeof session === 'object' ? session : {}),
    id: String(session?.id || `session:legacy:${index}:${savedAt}`),
    date: isoOrNow(session?.date || savedAt),
    savedAt,
    historySchemaVersion: SESSION_HISTORY_SCHEMA,
  };
}

function sessionArray(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.sessions)) return value.sessions;
  if (value && Array.isArray(value.items)) return value.items;
  return [];
}

function migrateSessionHistory() {
  const marker = read(KEYS.sessionHistoryMeta, null);
  const primaryRaw = read(KEYS.sessions, null);
  let source = primaryRaw;
  let sourceKey = KEYS.sessions;
  if (source == null || (Array.isArray(source) && source.length === 0)) {
    for (const key of LEGACY_SESSION_KEYS) {
      const candidate = read(key, null);
      if (candidate != null) {
        source = candidate;
        sourceKey = key;
        break;
      }
    }
  }
  const sessions = sessionArray(source).map(normaliseSession);
  const alreadyMigrated = marker?.schemaVersion === SESSION_HISTORY_SCHEMA && Array.isArray(primaryRaw);
  if (!alreadyMigrated || sourceKey !== KEYS.sessions || !Array.isArray(primaryRaw)) {
    // The old UI retained only a recent window. We can preserve every row
    // still present, but deleted rows cannot be reconstructed from local data.
    write(KEYS.sessions, sessions);
    write(KEYS.sessionHistoryMeta, {
      schemaVersion: SESSION_HISTORY_SCHEMA,
      migratedAt: new Date().toISOString(),
      migration: 'last-10-to-durable',
      recoveredSessions: sessions.length,
      retention: 'unbounded',
      sourceKey,
    });
  }
  return sessions;
}

export const getSessionHistoryMeta = () => read(KEYS.sessionHistoryMeta, null);
export const getSessions = () => migrateSessionHistory();

function normalisePracticeMode(value) {
  const mode = String(value || '').toLowerCase();
  if (mode === 'vocab' || mode === 'vocabulary' || mode === 'cards' || mode === 'receptive' || mode === 'productive') return 'vocabulary';
  if (mode === 'grammar') return 'grammar';
  if (mode === 'listening' || mode === 'dictation') return 'listening';
  if (mode === 'pronunciation' || mode === 'phoneme' || mode === 'shadow' || mode === 'shadowing') return 'pronunciation';
  if (mode === 'writing') return 'writing';
  if (mode === 'speaking' || mode === 'conversation') return 'speaking';
  if (mode === 'reading') return 'reading';
  return mode || 'vocabulary';
}

function pulseSkill(value) {
  const mode = normalisePracticeMode(value);
  return mode === 'grammar' || mode === 'listening' || mode === 'reading' ? mode : mode === 'pronunciation' ? 'speaking' : 'vocab';
}

function normaliseReviewEvent(event, index) {
  const reviewedAt = isoOrNow(event?.reviewedAt || event?.at);
  const mode = normalisePracticeMode(event?.mode || event?.skill);
  const itemId = String(event?.itemId || event?.cardId || event?.gapKey || 'unknown');
  return {
    ...(event && typeof event === 'object' ? event : {}),
    kind: event?.kind || 'review',
    id: String(event?.id || `review:legacy:${index}:${reviewedAt}`),
    reviewedAt,
    itemId,
    mode,
    skill: event?.skill || pulseSkill(mode),
  };
}

export const getReviewEvents = () => {
  const raw = read(KEYS.reviewEvents, []);
  const events = Array.isArray(raw) ? raw : raw && Array.isArray(raw.events) ? raw.events : [];
  return events.map(normaliseReviewEvent);
};

export function recordReviewEvent(event = {}) {
  const reviewedAt = isoOrNow(event.reviewedAt || event.at);
  const mode = normalisePracticeMode(event.mode || event.skill);
  const itemId = String(event.itemId || event.cardId || event.gapKey || 'unknown');
  const record = {
    ...(event && typeof event === 'object' ? event : {}),
    kind: event.kind || 'review',
    id: String(event.id || `review:${Date.now()}:${itemId}:${Math.random().toString(36).slice(2, 8)}`),
    reviewedAt,
    itemId,
    mode,
    skill: event.skill || pulseSkill(mode),
  };
  const events = getReviewEvents();
  events.push(record);
  write(KEYS.reviewEvents, events);
  publishPulseHistory();
  return record;
}

// ---- persistent learner error model --------------------------------------
// One local model joins mistakes from conversation, grammar, vocabulary,
// listening, pronunciation, writing, and reading. The raw review stream keeps
// the evidence; this table keeps the durable, actionable summary.

const LEARNER_ERROR_SCHEMA = 1;
const RECYCLE_MODES = {
  grammar: ['grammar', 'speaking'],
  vocabulary: ['vocabulary', 'speaking'],
  listening: ['listening', 'dictation'],
  pronunciation: ['pronunciation', 'speaking'],
  speaking: ['speaking', 'grammar'],
  writing: ['writing', 'grammar'],
  reading: ['reading', 'vocabulary'],
};

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function compactText(value, length = 180) {
  return String(value || '').trim().slice(0, length);
}

function compactContext(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 8)) {
    if (item == null || typeof item === 'boolean' || typeof item === 'number') out[key] = item;
    else if (typeof item === 'string') out[key] = item.slice(0, 180);
    else if (Array.isArray(item)) out[key] = item.slice(0, 8).map((x) => String(x).slice(0, 80));
  }
  return Object.keys(out).length ? out : null;
}

function errorKey(mode, key) {
  return `${mode}:${compactText(key, 120)}`;
}

export const getLearnerErrors = () => {
  const raw = read(KEYS.learnerErrors, []);
  const entries = Array.isArray(raw) ? raw : raw && Array.isArray(raw.entries) ? raw.entries : [];
  return entries.filter((entry) => entry && entry.key && entry.mode).map((entry) => ({
    schemaVersion: LEARNER_ERROR_SCHEMA,
    ...entry,
    mode: normalisePracticeMode(entry.mode),
    key: compactText(entry.key, 120),
    label: compactText(entry.label || entry.key, 180),
  }));
};

function writeLearnerErrors(entries) {
  // Error summaries are deliberately generous; unlike the old recent-session
  // window, this does not discard the learner's durable pattern history.
  write(KEYS.learnerErrors, entries);
}

function errorPriority(entry) {
  const ageDays = Math.max(0, (Date.now() - new Date(entry.lastErrorAt || entry.lastAt || 0).getTime()) / 86400000);
  const recency = Math.max(0, 1 - ageDays / 45);
  const active = entry.status === 'active' ? 3 : entry.status === 'recovering' ? 1 : 0;
  return Math.round((entry.errorCount * 2 + entry.recurrenceCount * 3 + active + recency) * 100) / 100;
}

const ERROR_RECYCLE_DAYS = [1, 3, 7, 14, 30];
function errorRecycleAt(entry, from = entry?.lastErrorAt) {
  if (entry?.nextReviewAt) return entry.nextReviewAt;
  if (!from) return null;
  const successes = Math.max(0, Number(entry.successCount) || 0);
  const days = ERROR_RECYCLE_DAYS[Math.min(ERROR_RECYCLE_DAYS.length - 1, successes)];
  return new Date(new Date(from).getTime() + days * 86400000).toISOString();
}

export function recordLearnerError({ mode, key, label, score = 0, source = 'practice', context = null } = {}) {
  const normalisedMode = normalisePracticeMode(mode);
  const cleanKey = compactText(key, 120);
  if (!cleanKey) return null;
  const now = new Date().toISOString();
  const list = getLearnerErrors();
  let entry = list.find((item) => item.mode === normalisedMode && item.key === cleanKey);
  if (!entry) {
    entry = {
      schemaVersion: LEARNER_ERROR_SCHEMA,
      id: errorKey(normalisedMode, cleanKey),
      mode: normalisedMode,
      key: cleanKey,
      label: compactText(label || cleanKey),
      firstSeen: now,
      lastAt: now,
      lastErrorAt: now,
      lastSuccessAt: null,
      errorCount: 0,
      successCount: 0,
      attempts: 0,
      recurrenceCount: 0,
      lastScore: 0,
      lastSource: source,
      nextReviewAt: null,
      status: 'active',
      context: null,
    };
    list.unshift(entry);
  } else if (entry.lastSuccessAt && new Date(entry.lastSuccessAt).getTime() <= Date.now()) {
    entry.recurrenceCount = (entry.recurrenceCount || 0) + 1;
  }
  entry.label = compactText(label || entry.label || cleanKey);
  entry.lastAt = now;
  entry.lastErrorAt = now;
  entry.errorCount = (entry.errorCount || 0) + 1;
  entry.attempts = (entry.attempts || 0) + 1;
  entry.lastScore = clampScore(score);
  entry.lastSource = compactText(source || 'practice', 80);
  entry.context = compactContext(context);
  const delayDays = ERROR_RECYCLE_DAYS[Math.min(ERROR_RECYCLE_DAYS.length - 1, Number(entry.successCount) || 0)];
  entry.nextReviewAt = new Date(Date.now() + delayDays * 86400000).toISOString();
  entry.status = 'active';
  writeLearnerErrors(list);
  return entry;
}

export function recordLearnerSuccess({ mode, key, label, score = 100, source = 'practice', context = null } = {}) {
  const normalisedMode = normalisePracticeMode(mode);
  const cleanKey = compactText(key, 120);
  if (!cleanKey) return null;
  const list = getLearnerErrors();
  const entry = list.find((item) => item.mode === normalisedMode && item.key === cleanKey);
  if (!entry) return null;
  const now = new Date().toISOString();
  entry.label = compactText(label || entry.label || cleanKey);
  entry.lastAt = now;
  entry.lastSuccessAt = now;
  entry.successCount = (entry.successCount || 0) + 1;
  entry.attempts = (entry.attempts || 0) + 1;
  entry.lastScore = clampScore(score);
  entry.lastSource = compactText(source || 'practice', 80);
  entry.context = compactContext(context);
  const delayDays = ERROR_RECYCLE_DAYS[Math.min(ERROR_RECYCLE_DAYS.length - 1, Number(entry.successCount) || 0)];
  entry.nextReviewAt = new Date(Date.now() + delayDays * 86400000).toISOString();
  entry.status = entry.successCount >= 2 && entry.successCount >= entry.errorCount ? 'resolved' : 'recovering';
  writeLearnerErrors(list);
  return entry;
}

function recordGapOutcome({ mode, key, label, score = 0, source, context, event = true }) {
  const result = clampScore(score) >= 80
    ? recordLearnerSuccess({ mode, key, label, score, source, context })
    : recordLearnerError({ mode, key, label, score, source, context });
  if (event) {
    recordReviewEvent({
      kind: 'assessment',
      mode,
      itemId: key,
      gapKey: key,
      label: compactText(label || key),
      score: clampScore(score),
      correct: clampScore(score) >= 80,
      source,
      context: compactContext(context),
    });
  }
  return result;
}

export function recordGrammarGap(topicId, { score = 0, source = 'grammar', context = null } = {}) {
  return recordGapOutcome({ mode: 'grammar', key: topicId, label: topicId, score, source, context });
}

export function recordVocabularyGap(itemId, { label = itemId, score = 0, source = 'vocabulary', context = null, event = false } = {}) {
  return recordGapOutcome({ mode: 'vocabulary', key: itemId, label, score, source, context, event });
}

export function recordListeningGap(itemId, { label = itemId, score = 0, source = 'listening', context = null } = {}) {
  return recordGapOutcome({ mode: 'listening', key: itemId, label, score, source, context });
}

export function recordPronunciationGap(itemId, { label = itemId, score = 0, source = 'pronunciation', context = null } = {}) {
  return recordGapOutcome({ mode: 'pronunciation', key: itemId, label, score, source, context });
}

export function recordSpeakingGap(itemId, { label = itemId, score = 0, source = 'speaking', context = null } = {}) {
  return recordGapOutcome({ mode: 'speaking', key: itemId, label, score, source, context });
}

export function recordWritingGap(itemId, { label = itemId, score = 0, source = 'writing', context = null } = {}) {
  return recordGapOutcome({ mode: 'writing', key: itemId, label, score, source, context });
}

export function getLearnerErrorModel() {
  return getLearnerErrors()
    .map((entry) => ({
      ...entry,
      priority: errorPriority(entry),
      recycleModes: RECYCLE_MODES[entry.mode] || [entry.mode],
    }))
    .sort((a, b) => b.priority - a.priority || b.errorCount - a.errorCount || (a.lastAt < b.lastAt ? 1 : -1));
}

export function getErrorModelSummary() {
  const entries = getLearnerErrors();
  const byMode = {};
  for (const entry of entries) byMode[entry.mode] = (byMode[entry.mode] || 0) + 1;
  return {
    total: entries.length,
    active: entries.filter((entry) => entry.status === 'active').length,
    recovering: entries.filter((entry) => entry.status === 'recovering').length,
    resolved: entries.filter((entry) => entry.status === 'resolved').length,
    recurrences: entries.reduce((sum, entry) => sum + (entry.recurrenceCount || 0), 0),
    byMode,
  };
}

export function getCrossModePracticeQueue(limit = 12) {
  return getLearnerErrorModel()
    .filter((entry) => entry.status !== 'resolved')
    .slice(0, Math.max(0, limit));
}

/** Errors become deliberate delayed retests instead of immediate recognition drills. */
export function getDelayedErrorQueue(limit = 12, nowMs = Date.now()) {
  return getLearnerErrorModel()
    .filter((entry) => entry.status !== 'resolved')
    .map((entry) => ({ ...entry, nextReviewAt: errorRecycleAt(entry) }))
    .filter((entry) => entry.nextReviewAt && new Date(entry.nextReviewAt).getTime() <= nowMs)
    .slice(0, Math.max(0, limit));
}

export const getCrossModeMistakeQueue = getCrossModePracticeQueue;

function speakingRecord(session, index) {
  const report = session?.report || {};
  const startedAt = session?.startedAt || session?.date;
  if (typeof startedAt !== 'string') return null;
  const durationMs = Number(report.durationMs ?? report.duration_ms ?? session.durationMs ?? 0);
  return {
    kind: 'speaking',
    id: String(session.id || `session:${session.scenarioId || 'unknown'}:${session.date || index}`),
    startedAt,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
    ...(typeof report.pronunciationScore === 'number' ? { pronunciationScore: report.pronunciationScore } : {}),
    ...(typeof report.pronunciation_score === 'number' ? { pronunciationScore: report.pronunciation_score } : {}),
    ...(typeof report.fluencyScore === 'number' ? { fluencyScore: report.fluencyScore } : {}),
    ...(typeof report.fluency_score === 'number' ? { fluencyScore: report.fluency_score } : {}),
    ...(typeof report.wordsSpoken === 'number' ? { wordsSpoken: report.wordsSpoken } : {}),
    promptCount: Number.isFinite(Number(session.turns)) ? Math.max(0, Number(session.turns)) : 0,
    ...(typeof session.topic === 'string' ? { topic: session.topic } : {}),
  };
}

function publishPulseHistory() {
  if (!readPulseOptIn()) return;
  const records = getSessions().map(speakingRecord).filter(Boolean).concat(getReviewEvents());
  write(KEYS.pulseHistory, {
    format: 'le-studio.source-history',
    schemaVersion: 2,
    source: 'le-studio-french',
    connectorVersion: '2.0.0',
    generatedAt: new Date().toISOString(),
    records,
    cursor: null,
  });
}

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
  const savedAt = new Date().toISOString();
  sessions.push({
    ...summary,
    id: summary.id || `session:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    date: summary.date || savedAt,
    savedAt,
    historySchemaVersion: SESSION_HISTORY_SCHEMA,
  });
  write(KEYS.sessions, sessions);
  publishPulseHistory();
  recordHabits(summary.report?.stubborn_habits || []);
  bumpStreak();
}

// ---- last activity (Home's "continue where you left off") ----

export const getLastActivity = () => read(KEYS.lastActivity, null);

export function setLastActivity(type, id, label) {
  write(KEYS.lastActivity, { type, id: id || null, label, at: new Date().toISOString() });
}

// ---- getting-started checklist (Home) ----

export const isGettingStartedDismissed = () => read(KEYS.gettingStarted, null) === '1';
export const dismissGettingStarted = () => write(KEYS.gettingStarted, '1');

// ---- grammar-error categories (Arena classifications, for Analytics) ----

export const getGrammarErrors = () => read(KEYS.grammarErrors, {});

export function recordGrammarError(topicId) {
  const all = getGrammarErrors();
  all[topicId] = (all[topicId] || 0) + 1;
  write(KEYS.grammarErrors, all);
  recordGrammarGap(topicId, { source: 'conversation' });
  return all[topicId];
}

// ---- persistent learner weakness memory (moat) ----
// error occurs → repair → later scenario deliberately tests it → recurrence
// Each entry tracks a grammar topic that has actually been mis-used in the Arena.
// Tiny, bounded, and fully local — carries inside the fp.* snapshot export.
const WEAKNESS_CAP = 30;
const RETEST_LADDER_DAYS = [1, 3, 7, 14]; // spaced retests after a repair
function clampTopicId(id) { return String(id || '').slice(0, 64); }
export const getWeaknessMemory = () => {
  const raw = read(KEYS.weaknessMemory, []);
  return Array.isArray(raw) ? raw : [];
};
function writeWeakness(list) { write(KEYS.weaknessMemory, list.slice(0, WEAKNESS_CAP)); }
function nextRetestDelay(repairCount) {
  const i = Math.min(Math.max(0, (repairCount || 0) - 1), RETEST_LADDER_DAYS.length - 1);
  return RETEST_LADDER_DAYS[i] * 86400000;
}
export function recordWeaknessError(topicId, { scenarioId = null } = {}) {
  const id = clampTopicId(topicId);
  if (!id) return null;
  const now = new Date().toISOString();
  const list = getWeaknessMemory();
  let e = list.find((x) => x.topicId === id);
  if (!e) {
    e = { topicId: id, firstSeen: now, lastErrorAt: now, errorCount: 1, lastRepairAt: null, repairCount: 0, retestDueAt: null, retests: [], status: 'active', lastScenarioId: scenarioId };
    list.unshift(e);
  } else {
    e.lastErrorAt = now;
    e.errorCount = (e.errorCount || 0) + 1;
    e.status = 'active';
    // Recurrence: a new error after a previous repair/retest is the signal we measure
    if (e.retests && e.retests.length) {
      const last = e.retests[e.retests.length - 1];
      if (last && last.passed) e.recurrenceCount = (e.recurrenceCount || 0) + 1;
    }
    if (scenarioId) e.lastScenarioId = scenarioId;
    e.retestDueAt = null; // new slip cancels any scheduled retest until repaired again
  }
  writeWeakness(list);
  return e;
}
export function recordWeaknessRepair(topicId, { scenarioId = null, passed = true } = {}) {
  const id = clampTopicId(topicId);
  if (!id) return null;
  const now = new Date().toISOString();
  const list = getWeaknessMemory();
  let e = list.find((x) => x.topicId === id);
  if (!e) {
    e = { topicId: id, firstSeen: now, lastErrorAt: now, errorCount: 0, lastRepairAt: now, repairCount: 1, retestDueAt: new Date(Date.now() + nextRetestDelay(1)).toISOString(), retests: [{ at: now, scenarioId, passed }], status: passed ? 'recovering' : 'active' };
    list.unshift(e);
  } else {
    e.lastRepairAt = now;
    e.repairCount = (e.repairCount || 0) + 1;
    e.retestDueAt = new Date(Date.now() + nextRetestDelay(e.repairCount)).toISOString();
    e.retests = [...(e.retests || []), { at: now, scenarioId, passed }].slice(-12);
    // Two consecutive passed retests after repair → resolved
    const tail = e.retests.slice(-2);
    e.status = tail.length === 2 && tail.every((r) => r.passed) ? 'resolved' : (passed ? 'recovering' : 'active');
  }
  writeWeakness(list);
  return e;
}
export function recordWeaknessRetestResult(topicId, passed, { scenarioId = null } = {}) {
  const id = clampTopicId(topicId);
  if (!id) return null;
  const now = new Date().toISOString();
  const list = getWeaknessMemory();
  const e = list.find((x) => x.topicId === id);
  if (!e) return null;
  e.retests = [...(e.retests || []), { at: now, scenarioId, passed }].slice(-12);
  if (passed) {
    e.repairCount = (e.repairCount || 0) + 1;
    e.lastRepairAt = now;
    e.retestDueAt = new Date(Date.now() + nextRetestDelay(e.repairCount)).toISOString();
    const tail = e.retests.slice(-2);
    e.status = tail.length === 2 && tail.every((r) => r.passed) ? 'resolved' : 'recovering';
  } else {
    e.lastErrorAt = now;
    e.errorCount = (e.errorCount || 0) + 1;
    e.recurrenceCount = (e.recurrenceCount || 0) + 1;
    e.status = 'active';
    e.retestDueAt = null;
  }
  writeWeakness(list);
  return e;
}
export function getDueWeaknesses(nowMs = Date.now()) {
  return getWeaknessMemory()
    .filter((e) => e && e.status !== 'resolved' && e.retestDueAt && new Date(e.retestDueAt).getTime() <= nowMs)
    .sort((a, b) => new Date(a.retestDueAt) - new Date(b.retestDueAt));
}
export function getWeaknessSummary() {
  const list = getWeaknessMemory();
  const byStatus = { active: 0, recovering: 0, resolved: 0 };
  let retests = 0, recurrences = 0;
  for (const e of list) {
    if (e.status in byStatus) byStatus[e.status] += 1;
    retests += (e.retests || []).length;
    recurrences += e.recurrenceCount || 0;
  }
  const recurrenceRate = retests ? Math.round((recurrences / retests) * 100) / 100 : null;
  return { total: list.length, byStatus, retests, recurrences, recurrenceRate, due: getDueWeaknesses().length };
}

// ---- recurring mistake bank ----
// Stubborn habits from each report accumulate across sessions so patterns
// ("you've hit this 4 times") become visible instead of being overwritten.

const habitKey = (text) =>
  String(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 80);

export const getHabits = () => read(KEYS.habits, []);

// A compact profile of the learner for the AI tutor & characters — their name
// and preferences, plus the mistakes and weak grammar areas the app has
// actually observed, so replies are personal and context-aware rather than
// generic. Everything here is already stored locally.
// ---- explicit learner model (7.9 → 9+) ----
// Aggregates vocab recall, grammar, pronunciation, hesitation, sentence patterns
// into one inspectable snapshot. All pure, offline.
export function getLearnerModel() {
  const srs = getSrs();
  const habits = getHabits();
  const grammar = getGrammarProgress();
  const metrics = getMetrics();
  const xpLog = getXpLog();
  const notebook = getNotebook();
  const sessions = getSessions();
  // vocab recall buckets from memory helpers
  const vocabRecall = {
      strong: Object.values(srs).filter(s=> (s.interval||0)>=7).length,
      fading: Object.values(srs).filter(s=> (s.interval||0)>=1 && (s.interval||0)<7).length,
      atRisk: Object.values(srs).filter(s=> s.lastRating==='again').length,
      fresh: Object.values(srs).filter(s=> !s.lastReviewed).length,
    };
  const errHist = getGrammarErrors();
  const pronun = metrics.filter(m=> m.skill==='pronunciation').slice(-20);
  const avgPronun = pronun.length ? Math.round(pronun.reduce((a,b)=>a+b.score,0)/pronun.length) : null;
  return {
    srsSize: Object.keys(srs).length,
    vocabRecall,
    habits: habits.slice(0, 5),
    grammar,
    errHist,
    pronunciation: { avg: avgPronun, n: pronun.length },
    sessions: sessions.length,
    sessionHistory: getSessionHistoryMeta(),
    reviewEvents: getReviewEvents().length,
    errors: getErrorModelSummary(),
    errorQueue: getCrossModePracticeQueue(8),
    delayedErrorQueue: getDelayedErrorQueue(8),
    notebook: notebook.length,
    xpLogDays: Object.keys(xpLog).length,
  };
}
export function getLearnerBrief() {
  const mistakes = getHabits().filter((h) => (h.count || 0) > 1).slice(0, 3).map((h) => h.text);
  const weakGrammar = Object.entries(getGrammarErrors())
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([topic]) => topic);
  const errorQueue = getCrossModePracticeQueue(3).map((entry) => ({
    mode: entry.mode,
    label: entry.label,
    errors: entry.errorCount,
    recurrences: entry.recurrenceCount,
    recycleModes: entry.recycleModes,
  }));
  const prefs = getPrefs();
  const settings = getSettings();
  // Retest intent: nudge the tutor toward the next due weakness (if any)
  const due = getDueWeaknesses()[0] || null;
  const memory = due ? { focusTopic: due.topicId, status: due.status, errorCount: due.errorCount } : null;
  return {
    name: String(getSettings().name || '').slice(0, 40),
    topics: (prefs.favouriteTopics || []).slice(0, 4),
    mistakes,
    weakGrammar,
    errorQueue,
    delayedErrorQueue: getDelayedErrorQueue(3).map((entry) => ({
      mode: entry.mode,
      label: entry.label,
      errors: entry.errorCount,
      recurrences: entry.recurrenceCount,
      recycleModes: entry.recycleModes,
    })),
    correctionFrequency: settings.correctionFrequency,
    memory,
  };
}

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
  // Vacation mode: while active, missed days never break the streak —
  // lastDay is quietly rolled forward to yesterday.
  const vac = read(KEYS.vacation, null);
  if (s.lastDay !== dayStamp() && s.lastDay !== yesterday && vac && vac >= yesterday) {
    const kept = { ...s, lastDay: yesterday };
    write(KEYS.streak, kept);
    return kept;
  }
  // A streak survives until a full day is missed. When it breaks, remember
  // what was lost so a paid repair remains possible for a few days.
  if (s.lastDay !== dayStamp() && s.lastDay !== yesterday) {
    if (s.count > 0) write(KEYS.streak, { count: 0, lastDay: null, lostCount: s.count, lostAt: dayStamp() });
    return { count: 0, lastDay: s.lastDay, lostCount: s.count, lostAt: dayStamp() };
  }
  return s;
};

// ---- vacation mode & streak repair ----

export const REPAIR_COST = 300;
export const REPAIR_WINDOW_DAYS = 3;

export const getVacationUntil = () => read(KEYS.vacation, null);

// Start (days > 0) or end (days = 0/null) vacation mode.
export function setVacationDays(days) {
  if (!days) { write(KEYS.vacation, null); return null; }
  const until = dayStamp(new Date(Date.now() + days * 86400000));
  write(KEYS.vacation, until);
  return until;
}

// A broken streak can be bought back within REPAIR_WINDOW_DAYS.
export function getRepairableStreak() {
  const s = read(KEYS.streak, {});
  if (!s.lostCount || !s.lostAt) return null;
  const ageDays = Math.floor((Date.now() - new Date(s.lostAt).getTime()) / 86400000);
  return ageDays <= REPAIR_WINDOW_DAYS ? s.lostCount : null;
}

/** ISO week key (YYYY-Www) for free repair quota. */
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** One free streak repair per calendar week (Plan 1 A2.2). */
export function canFreeRepairThisWeek() {
  const used = read('fp.freeRepairWeek', null);
  return used !== isoWeekKey();
}

export function repairStreak({ free = false } = {}) {
  const lost = getRepairableStreak();
  if (!lost) return null;
  if (free) {
    if (!canFreeRepairThisWeek()) return null;
    write('fp.freeRepairWeek', isoWeekKey());
  } else if (spendCoins(REPAIR_COST) == null) {
    return null;
  }
  const restored = { count: lost, lastDay: dayStamp(new Date(Date.now() - 86400000)) };
  write(KEYS.streak, restored);
  return restored;
}

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

// ---- starred survival lines (real-world / phrase drills) ----

export const getStarredLines = () => read(KEYS.starred, []);

export const isStarredLine = (id) => getStarredLines().some((e) => e.id === id);

export function toggleStarredLine({ id, fr, en, source = '' }) {
  const list = getStarredLines();
  const idx = list.findIndex((e) => e.id === id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(KEYS.starred, list);
    return { list, starred: false };
  }
  list.unshift({ id, fr, en, source, addedAt: new Date().toISOString() });
  write(KEYS.starred, list.slice(0, 100));
  return { list: getStarredLines(), starred: true };
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
  const scoreValue = clampScore(score);
  const all = getGrammarProgress();
  const prev = all[topicId] || { best: 0, attempts: 0 };
  all[topicId] = {
    best: Math.max(prev.best, scoreValue),
    attempts: prev.attempts + 1,
    lastAt: new Date().toISOString(),
  };
  write(KEYS.grammar, all);
  recordGrammarGap(topicId, { score: scoreValue, source: 'grammar-quiz' });
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
const VOCAB_SCORE = { again: 0, hard: 60, good: 85, easy: 100 };

export const getSrs = () => read(KEYS.srs, {});
export const getFsrs = () => read(KEYS.srs, {});
export function getReceptiveSrs(){ const s=getSrs(); const out={}; for(const[k,v] of Object.entries(s)) if(!k.includes('::')) out[k]=v; return out; }


// A card is due if it was never reviewed, or its due date has passed.
export const isCardDue = (srsEntry) =>
  !srsEntry || !srsEntry.due || new Date(srsEntry.due) <= new Date();

export function getDueCardIds(allIds) {
  const srs = getSrs();
  return allIds.filter((id) => isCardDue(srs[id]));
}

export function rateCard(cardId, rating, opts={}) {
  const mode = opts.mode || 'receptive';
  const key = mode==='productive' ? `${cardId}::productive` : cardId;
  const srs = getSrs();
  const existing = srs[key];
  // FSRS is the scheduler. It used to be gated on `existing?.S != null` — a
  // condition only an FSRS card could satisfy — with every call site passing
  // that same condition back in as `opts.fsrs`. Nothing ever set S for the
  // first time, so the branch was unreachable and every card in the app was
  // silently scheduled by the SM-2 fallback below. Legacy SM-2 rows convert on
  // their next review via migrateFromSm2.
  const useFsrs = opts.fsrs !== false;
  if(useFsrs){
    const prev = migrateFromSm2(existing);
    const next = fsrsRate(prev, rating);
    srs[key] = next;
    write(KEYS.srs, srs);
    logReview({ cardId, rating, mode, label: opts.label, elapsedMs: opts.elapsedMs, skill: opts.skill, intervalDays: existing?.interval });
    recordVocabularyGap(key, {
      label: opts.label || cardId,
      score: VOCAB_SCORE[rating] ?? 0,
      source: `vocabulary-${mode}`,
      context: { rating, reviewMode: mode },
    });
    return next;
  }
  const prev = srs[key] || { interval: 0, reps: 0, lapses: 0, ease: DEFAULT_EASE };
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

  srs[key] = {
    interval,
    reps,
    ease: Math.round(ease * 100) / 100,
    lapses: (prev.lapses || 0) + (rating === 'again' ? 1 : 0),
    due: new Date(Date.now() + interval * 86400000).toISOString(),
    lastRating: rating,
    lastReviewed: new Date().toISOString(),
  };
  write(KEYS.srs, srs);
  logReview({ cardId, rating, mode, label: opts.label, elapsedMs: opts.elapsedMs, skill: opts.skill, intervalDays: existing?.interval });
  recordVocabularyGap(key, {
    label: opts.label || cardId,
    score: VOCAB_SCORE[rating] ?? 0,
    source: `vocabulary-${mode}`,
    context: { rating, reviewMode: mode },
  });
  return srs[key];
}

// ---- review activity log (per-day counts; feeds the heatmap) ----

export const getReviewLog = () => read(KEYS.reviewLog, {});

function logReview({ cardId, rating, mode, label, elapsedMs, skill, intervalDays } = {}) {
  const log = getReviewLog();
  const today = dayStamp();
  log[today] = (log[today] || 0) + 1;
  // keep ~6 months so the object stays small
  const cutoff = dayStamp(new Date(Date.now() - 183 * 86400000));
  for (const day of Object.keys(log)) if (day < cutoff) delete log[day];
  write(KEYS.reviewLog, log);

  recordReviewEvent({
    kind: 'review',
    itemId: String(cardId || 'unknown'),
    mode: 'vocabulary',
    reviewMode: mode || 'receptive',
    label: label || cardId || 'Vocabulary card',
    skill: skill || 'vocab',
    rating,
    correct: rating !== 'again',
    elapsedMs: Number.isFinite(Number(elapsedMs)) ? Math.max(0, Number(elapsedMs)) : 0,
    ...(Number.isFinite(Number(intervalDays)) ? { intervalDays: Math.max(0, Number(intervalDays)) } : {}),
  });
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
