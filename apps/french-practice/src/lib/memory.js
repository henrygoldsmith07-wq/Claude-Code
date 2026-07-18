// Memory model for the revision hub. Retention follows an exponential
// forgetting curve R(t) = e^(-t/S): S (stability, in days) grows with each
// successful review — we approximate it with the card's SRS interval.

const DAY = 86400000;

// Predicted recall probability right now (0..1), or null if never reviewed.
export function retentionNow(srsEntry, now = Date.now()) {
  if (!srsEntry || !srsEntry.lastReviewed) return null;
  const days = Math.max(0, (now - new Date(srsEntry.lastReviewed).getTime()) / DAY);
  const stability = Math.max(0.5, srsEntry.interval || 0);
  return Math.exp(-days / stability);
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
export function curvePoints(stability, days = 14, width = 100, height = 100) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * days;
    const r = Math.exp(-t / stability);
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

// Science-based review order for the due queue. Reviewing an item just as
// it's about to be forgotten is where a repetition does the most for
// long-term retention, so we sort by ascending predicted recall (most
// forgotten first). Never-reviewed-but-due cards come first (highest
// learning value), and ties break toward higher-frequency words — the ones
// that appear most in real French, so effort compounds fastest.
export function reviewOrder(dueEntries, srs, now = Date.now()) {
  const rank = (e) => {
    const r = retentionNow(srs[e.id], now);
    return r == null ? -1 : r; // never-reviewed sorts before any recall value
  };
  const freq = (e) => e.freq || 9; // lower freq number = more common
  return [...dueEntries].sort((a, b) => rank(a) - rank(b) || freq(a) - freq(b));
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
