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

// Human time from seconds: "2h 5m", "40m", "—".
export function fmtDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
