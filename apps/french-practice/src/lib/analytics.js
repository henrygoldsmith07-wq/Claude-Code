// Analytics: aggregates the data the app already records (sessions, skill
// metrics, SRS, grammar, XP/time logs) into headline numbers, a skill
// breakdown, weekly/monthly reports and heatmap-ready series. Pure and
// deterministic — no network.

import { retentionNow } from './memory';

const dayStamp = (d) => new Date(d).toISOString().slice(0, 10);
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

export const SKILLS = [
  { id: 'speaking', label: 'Speaking' },
  { id: 'pronunciation', label: 'Pronunciation' },
  { id: 'listening', label: 'Listening' },
  { id: 'reading', label: 'Reading' },
  { id: 'writing', label: 'Writing' },
  { id: 'grammar', label: 'Grammar' },
];

// Average score per skill, drawing on the metrics log plus session overalls
// (speaking) and grammar-quiz bests (grammar). Returns one row per skill.
export function skillBreakdown(metrics, sessions, grammarProgress) {
  const bySkill = {};
  for (const m of metrics) (bySkill[m.skill] ||= []).push(m.score);

  const sessionOveralls = sessions
    .map((s) => s.report?.average_scores?.overall)
    .filter((n) => typeof n === 'number');
  if (sessionOveralls.length) (bySkill.speaking ||= []).push(...sessionOveralls);

  const grammarBests = Object.values(grammarProgress).map((g) => g.best).filter((n) => typeof n === 'number');
  if (grammarBests.length) bySkill.grammar = grammarBests;

  return SKILLS.map((s) => ({ ...s, score: avg(bySkill[s.id] || []), count: (bySkill[s.id] || []).length }));
}

export const skillScore = (breakdown, id) => breakdown.find((s) => s.id === id)?.score ?? null;

// Retention rate: share of reviewed cards still predicted ≥80% recall.
export function retentionRate(entries, srs, now = Date.now()) {
  const tracked = entries.filter((e) => srs[e.id]?.lastReviewed);
  if (!tracked.length) return null;
  const strong = tracked.filter((e) => (retentionNow(srs[e.id], now) || 0) >= 0.8).length;
  return Math.round((strong / tracked.length) * 100);
}

// Words considered "learned": reviewed at least twice (past the first steps).
export const wordsLearned = (srs) => Object.values(srs).filter((s) => (s.reps || 0) >= 2).length;

// Sum a day-keyed log (xp or seconds) over the last N days.
function sumOverDays(log, days, now = new Date()) {
  const start = dayStamp(now.getTime() - (days - 1) * 86400000);
  let total = 0;
  let activeDays = 0;
  let best = { day: null, value: 0 };
  for (const [day, value] of Object.entries(log)) {
    if (day < start) continue;
    total += value;
    if (value > 0) activeDays += 1;
    if (value > best.value) best = { day, value };
  }
  return { total, activeDays, best };
}

// A period report (7 or 30 days) combining time, XP and scored activity.
export function periodReport(days, { xpLog, timeLog, metrics, sessions }, now = new Date()) {
  const start = dayStamp(now.getTime() - (days - 1) * 86400000);
  const xp = sumOverDays(xpLog, days, now);
  const time = sumOverDays(timeLog, days, now);
  const periodMetrics = metrics.filter((m) => dayStamp(m.at) >= start);
  const periodSessions = sessions.filter((s) => s.date && dayStamp(s.date) >= start);
  const scores = periodMetrics.map((m) => m.score)
    .concat(periodSessions.map((s) => s.report?.average_scores?.overall).filter((n) => typeof n === 'number'));
  return {
    days,
    seconds: time.total,
    xp: xp.total,
    activeDays: time.activeDays || xp.activeDays,
    activities: periodMetrics.length + periodSessions.length,
    avgScore: avg(scores),
    bestDay: xp.best.day,
    bestXp: xp.best.value,
  };
}

// XP totalled over an inclusive day window, counted back from today:
// fromDaysAgo is the older bound, toDaysAgo the newer (0 = today). Powers the
// week-over-week trend and the pace behind projections.
export function xpInRange(xpLog, fromDaysAgo, toDaysAgo, now = new Date()) {
  const from = dayStamp(now.getTime() - fromDaysAgo * 86400000);
  const to = dayStamp(now.getTime() - toDaysAgo * 86400000);
  let total = 0;
  for (const [day, v] of Object.entries(xpLog)) if (day >= from && day <= to) total += v;
  return total;
}

// Average daily XP over the last `days` days (zero days included) — a
// realistic near-term rate to project forward from.
export function dailyPace(xpLog, days = 14, now = new Date()) {
  return xpInRange(xpLog, days - 1, 0, now) / days;
}

// XP totalled per Monday-anchored week for the last `weeks` weeks, oldest
// first. Each bucket: { start (YYYY-MM-DD Monday), label ("5 Aug"), total }.
// Feeds the weekly-XP bar chart in the analytics view.
export function weeklyXp(xpLog, weeks = 8, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const monday = new Date(d.getTime() - ((d.getDay() + 6) % 7) * 86400000);
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(monday.getTime() - i * 7 * 86400000);
    const startStamp = dayStamp(start);
    const endStamp = dayStamp(start.getTime() + 6 * 86400000);
    let total = 0;
    for (const [day, v] of Object.entries(xpLog)) if (day >= startStamp && day <= endStamp) total += v;
    buckets.push({
      start: startStamp,
      label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      total,
    });
  }
  return buckets;
}

// Cumulative words-learned growth per week over the last `weeks` weeks, from
// the SRS map's per-card review history. A card counts from the week it
// crossed its second review (our "learned" threshold). Oldest first:
// { start, label, total } where total is the running vocabulary size.
export function vocabGrowth(srs, weeks = 8, now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const monday = new Date(d.getTime() - ((d.getDay() + 6) % 7) * 86400000);
  // Learned-on timestamps (ms): cards past two reps, dated by last review.
  const learnedOn = Object.values(srs)
    .filter((s) => (s.reps || 0) >= 2 && s.lastReviewed)
    .map((s) => new Date(s.lastReviewed).getTime());
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(monday.getTime() - i * 7 * 86400000 + 7 * 86400000 - 1);
    const total = learnedOn.filter((t) => t <= end.getTime()).length;
    const start = new Date(monday.getTime() - i * 7 * 86400000);
    buckets.push({
      start: dayStamp(start),
      label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      total,
    });
  }
  return buckets;
}

// Hesitation markers a transcriber sometimes surfaces, per target language.
const FILLERS = {
  fr: ['euh', 'heu', 'ben', 'bah', 'hein', 'bon'],
  de: ['äh', 'ähm', 'öhm', 'halt', 'also', 'ne'],
  es: ['eh', 'este', 'pues', 'bueno', 'osea'],
};

// Delivery metrics from a spoken attempt: speaking pace (words/min) and the
// number of audible hesitation markers. Pure — derived from the transcript
// and the recording length, so it works offline once transcription is done.
export function speechMetrics(heard, durationMs, langId = 'fr') {
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,!?;:¿¡"«»]/g, '');
  const words = String(heard || '').trim().split(/\s+/).filter(Boolean);
  const seconds = Math.max(0.4, (durationMs || 0) / 1000);
  const wpm = Math.round((words.length / seconds) * 60);
  const fillerSet = new Set((FILLERS[langId] || FILLERS.fr).map(norm));
  const fillers = words.filter((w) => fillerSet.has(norm(w))).length;
  // Learner-friendly bands: measured is fine, fast can blur clarity.
  const pace = wpm < 55 ? 'measured' : wpm <= 145 ? 'natural' : 'fast';
  return { words: words.length, seconds: Math.round(seconds), wpm, fillers, pace };
}

// Human time from seconds: "2h 5m", "40m", "—".
export function fmtDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
