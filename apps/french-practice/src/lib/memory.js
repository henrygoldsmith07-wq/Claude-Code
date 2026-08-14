// Memory model for the revision hub.
//
// There is one forgetting curve in this app and it is the scheduler's:
// R(t) = 0.9^(t/S), where stability S is *defined* as the days until recall
// falls to 90%. This module used to run a different one — R(t) = e^(-t/S),
// with S approximated by the SM-2 interval — so the hub and the scheduler
// disagreed about the same card. A card with S=10 reviewed 5 days ago read as
// 95% recall to the scheduler and 61% here, which is the difference between
// "strong" and "fading" on the revision screen.

import { retrievability } from './fsrs.js';

const DAY = 86400000;

/**
 * Predicted recall probability right now (0..1), or null if never reviewed.
 * Prefers the card's FSRS stability; a legacy SM-2 row falls back to its
 * interval, which SM-2 also targets at roughly 90% recall, so both go through
 * the same curve.
 */
export function retentionNow(srsEntry, now = Date.now()) {
  if (!srsEntry || !srsEntry.lastReviewed) return null;
  const days = Math.max(0, (now - new Date(srsEntry.lastReviewed).getTime()) / DAY);
  const stability = Math.max(0.5, srsEntry.S || srsEntry.interval || 0);
  return retrievability(stability, days);
}

// Bucket every tracked card by how well it's being remembered.
export function memoryBuckets(entries, srs, now = Date.now()) {
  const buckets = { strong: [], fading: [], atRisk: [], fresh: [] };
  for (const e of entries) {
    const r = retentionNow(srs[e.id], now);
    if (r == null) buckets.fresh.push(e);
    else if (r >= 0.8) buckets.strong.push({ ...e, retention: r });
    else if (r >= 0.5) buckets.fading.push({ ...e, retention: r });
    else buckets.atRisk.push({ ...e, retention: r });
  }
  buckets.fading.sort((a, b) => a.retention - b.retention);
  buckets.atRisk.sort((a, b) => a.retention - b.retention);
  return buckets;
}

// Weak words: reviewed at least twice and still stumbling — high lapse
// ratio or the last answer was a fail. Worst first.
export function weakEntries(entries, srs) {
  return entries
    .map((e) => ({ entry: e, s: srs[e.id] }))
    .filter(({ s }) => s && s.reps >= 2 && ((s.lapses || 0) / s.reps >= 1 / 3 || s.lastRating === 'again'))
    .sort((a, b) => (b.s.lapses || 0) / b.s.reps - (a.s.lapses || 0) / a.s.reps)
    .map(({ entry }) => entry);
}

// Points for an SVG forgetting curve: R(t) over `days` days for stability S.
// Same curve the scheduler uses, so the drawing matches the percentages.
export function curvePoints(stability, days = 14, width = 100, height = 100) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * days;
    const r = retrievability(stability, t);
    pts.push(`${((t / days) * width).toFixed(1)},${((1 - r) * height).toFixed(1)}`);
  }
  return pts.join(' ');
}

// Heatmap grid: `weeks` columns of 7 days ending today, with intensity
// levels 0–4 scaled to the busiest day in range.
export function heatmapWeeks(log, weeks = 15, now = new Date()) {
  const days = weeks * 7;
  const stamps = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    const day = d.toISOString().slice(0, 10);
    stamps.push({ day, count: log[day] || 0 });
  }
  const max = Math.max(1, ...stamps.map((s) => s.count));
  const level = (c) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));
  const grid = [];
  for (let w = 0; w < weeks; w++) {
    grid.push(stamps.slice(w * 7, w * 7 + 7).map((s) => ({ ...s, level: level(s.count) })));
  }
  return grid;
}

// Notebook entries as reviewable flashcards (custom cards lack pack extras).
export const notebookAsEntries = (notebook) =>
  notebook.map((e) => ({ id: e.id, fr: e.fr, en: e.en, note: e.note || '', syn: [], ant: [], coll: [], custom: true }));

// Total reviews across the log — the heatmap headline.
export const totalReviews = (log) => Object.values(log).reduce((a, b) => a + b, 0);

// Review order for the due queue, primarily by how often the word is used:
// the most common French words come first, so study effort compounds on the
// vocabulary that appears most in real speech. Within one frequency band we
// then surface the most-forgotten card (lowest predicted recall, and
// never-reviewed cards ahead of any recall value) — that's where a repetition
// does the most for long-term retention.
export function reviewOrder(due, srs, now = Date.now()) {
  const freq = (e) => e.freq || 9; // lower freq number = more common
  const recall = (e) => {
    const r = retentionNow(srs[e.id], now);
    return r == null ? -1 : r; // never-reviewed sorts before any recall value
  };
  return [...due].sort((a, b) => freq(a) - freq(b) || recall(a) - recall(b));
}

// ---- frequency-gated introduction of new cards ----
// The library holds thousands of words, so we never dump every unseen card
// into the due queue at once. A never-seen card only becomes due once every
// more-common word has been learnt — the most common words first, and the
// next tier unlocks only when the current one is done. Cards already in the
// SRS schedule are never gated; they come due on their own timetable. Custom
// notebook cards (no frequency) are always available — the learner chose them.

const freqOf = (e) => e.freq || 0;                 // lower = more common; 0 = ungraded
const isLearnt = (s) => (s?.reps || 0) >= 2;       // matches wordsLearned()

// The active learning frontier: the most-common frequency tier that still has
// a word the learner hasn't learnt yet. Infinity once everything is learnt.
export function frontierTier(entries, srs) {
  let frontier = Infinity;
  for (const e of entries) {
    const f = freqOf(e);
    if (!f || isLearnt(srs[e.id])) continue;
    if (f < frontier) frontier = f;
  }
  return frontier;
}

// Is this card due to study now? Started cards follow their SRS schedule; a
// brand-new graded card is due only if its tier is at or below the frontier;
// custom cards are always available.
export function isEntryDue(e, srs, frontier, now = Date.now()) {
  const s = srs[e.id];
  if (s) return !s.due || new Date(s.due).getTime() <= now;
  const f = freqOf(e);
  if (!f) return true;
  return f <= frontier;
}

// Entries due right now, with new cards gated by frequency. Pass the full
// library so the frontier is computed globally, not per pack.
export function dueEntries(entries, srs, now = Date.now()) {
  const frontier = frontierTier(entries, srs);
  return entries.filter((e) => isEntryDue(e, srs, frontier, now));
}

// When is reviewing most worthwhile? Count cards already due plus cards
// whose retention slips under 80% within 24h — the smart-reminder message.
export function reviewOutlook(entries, srs, now = Date.now()) {
  let dueNow = 0;
  let slippingSoon = 0;
  for (const e of entries) {
    const s = srs[e.id];
    if (!s || !s.due || new Date(s.due).getTime() <= now) {
      dueNow += 1;
      continue;
    }
    const r = retentionNow(s, now);
    const rTomorrow = retentionNow(s, now + DAY);
    if (r != null && r >= 0.8 && rTomorrow < 0.8) slippingSoon += 1;
  }
  return { dueNow, slippingSoon };
}
