// A small, pure learner-error model shared by every practice mode.
// Storage owns persistence; this module owns normalisation, recurrence and
// prioritisation so the rules stay testable without a browser.

export const LEARNER_ERROR_CATEGORIES = ['grammar', 'vocabulary', 'listening', 'pronunciation'];

const STATUSES = new Set(['active', 'recovering', 'resolved']);
const MAX_ENTRIES = 240;
const MAX_EVIDENCE = 8;
const MAX_MODES = 8;

function iso(value, fallback) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function clampScore(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Math.max(0, Math.min(100, Math.round(Number(value))));
}

function categoryOf(value) {
  const category = String(value || '').toLowerCase();
  return LEARNER_ERROR_CATEGORIES.includes(category) ? category : 'grammar';
}

function keyOf(value) {
  return String(value || 'general').trim().slice(0, 120) || 'general';
}

function entryId(category, key) {
  return `${category}:${key}`;
}

function normaliseEvidence(evidence, fallbackAt) {
  if (!evidence || typeof evidence !== 'object') return null;
  return {
    at: iso(evidence.at, fallbackAt),
    mode: String(evidence.mode || 'unknown').slice(0, 40),
    score: clampScore(evidence.score),
    source: String(evidence.source || '').slice(0, 60) || null,
    detail: String(evidence.detail || '').slice(0, 180) || null,
  };
}

function normaliseEntry(input, fallbackAt = new Date().toISOString()) {
  if (!input || typeof input !== 'object') return null;
  const category = categoryOf(input.category);
  const key = keyOf(input.key || input.topicId || input.itemId);
  const evidence = Array.isArray(input.evidence)
    ? input.evidence.map((item) => normaliseEvidence(item, fallbackAt)).filter(Boolean).slice(-MAX_EVIDENCE)
    : [];
  const modes = Array.isArray(input.modes)
    ? [...new Set(input.modes.map((mode) => String(mode).slice(0, 40)).filter(Boolean))].slice(0, MAX_MODES)
    : [];
  const errorCount = Math.max(0, Math.floor(Number(input.errorCount) || 0));
  const successCount = Math.max(0, Math.floor(Number(input.successCount) || 0));
  const cleanPasses = Math.max(0, Math.floor(Number(input.cleanPasses) || 0));
  const status = STATUSES.has(input.status)
    ? input.status
    : cleanPasses >= 2
      ? 'resolved'
      : successCount > 0
        ? 'recovering'
        : 'active';
  return {
    id: String(input.id || entryId(category, key)).slice(0, 180),
    category,
    key,
    label: String(input.label || key).slice(0, 140),
    firstSeen: iso(input.firstSeen, fallbackAt),
    lastSeen: iso(input.lastSeen || input.lastErrorAt || input.lastSuccessAt, fallbackAt),
    lastErrorAt: input.lastErrorAt ? iso(input.lastErrorAt, fallbackAt) : null,
    lastSuccessAt: input.lastSuccessAt ? iso(input.lastSuccessAt, fallbackAt) : null,
    errorCount,
    successCount,
    recurrenceCount: Math.max(0, Math.floor(Number(input.recurrenceCount) || 0)),
    cleanPasses,
    status,
    lastScore: clampScore(input.lastScore),
    modes,
    evidence,
  };
}

export function createLearnerErrorModel(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const fallbackAt = iso(input.updatedAt, new Date().toISOString());
  const entries = Array.isArray(input.entries)
    ? input.entries.map((entry) => normaliseEntry(entry, fallbackAt)).filter(Boolean)
    : [];
  const unique = new Map();
  for (const entry of entries) {
    const current = unique.get(entry.id);
    if (!current || current.lastSeen < entry.lastSeen) unique.set(entry.id, entry);
  }
  return {
    version: 1,
    updatedAt: fallbackAt,
    entries: [...unique.values()].slice(0, MAX_ENTRIES),
  };
}

function withEvidence(entry, error, at) {
  const nextEvidence = normaliseEvidence({
    at,
    mode: error.mode,
    score: error.score,
    source: error.source,
    detail: error.detail,
  }, at);
  const evidence = nextEvidence
    ? [...entry.evidence.filter((item) => item.at !== nextEvidence.at || item.mode !== nextEvidence.mode), nextEvidence].slice(-MAX_EVIDENCE)
    : entry.evidence;
  const mode = String(error.mode || '').slice(0, 40);
  const modes = mode && !entry.modes.includes(mode) ? [...entry.modes, mode].slice(-MAX_MODES) : entry.modes;
  return { evidence, modes };
}

export function recordLearnerError(model, error = {}, { at = new Date().toISOString() } = {}) {
  const base = createLearnerErrorModel(model);
  const category = categoryOf(error.category);
  const key = keyOf(error.key || error.topicId || error.itemId);
  const id = entryId(category, key);
  const previous = base.entries.find((entry) => entry.id === id);
  const count = Math.max(1, Math.floor(Number(error.count) || 1));
  const recurrence = Math.max(0, Math.floor(Number(error.recurrenceCount) || 0));
  const wasRepaired = Boolean(previous && (previous.successCount > 0 || previous.status !== 'active'));
  const starter = previous || normaliseEntry({ category, key, label: error.label }, at);
  const { evidence, modes } = withEvidence(starter, error, at);
  const next = {
    ...starter,
    label: String(error.label || starter.label || key).slice(0, 140),
    lastSeen: at,
    lastErrorAt: at,
    errorCount: starter.errorCount + count,
    recurrenceCount: starter.recurrenceCount + recurrence + (wasRepaired && count > 0 ? 1 : 0),
    cleanPasses: 0,
    status: 'active',
    lastScore: clampScore(error.score),
    evidence,
    modes,
  };
  return {
    version: 1,
    updatedAt: at,
    entries: [next, ...base.entries.filter((entry) => entry.id !== id)].slice(0, MAX_ENTRIES),
  };
}

export function recordLearnerSuccess(model, success = {}, { at = new Date().toISOString() } = {}) {
  const base = createLearnerErrorModel(model);
  const category = categoryOf(success.category);
  const key = keyOf(success.key || success.topicId || success.itemId);
  const id = entryId(category, key);
  const previous = base.entries.find((entry) => entry.id === id);
  if (!previous) return base;
  const { evidence, modes } = withEvidence(previous, success, at);
  const cleanPasses = previous.cleanPasses + 1;
  const mode = String(success.mode || '').slice(0, 40);
  return {
    version: 1,
    updatedAt: at,
    entries: [{
      ...previous,
      lastSeen: at,
      lastSuccessAt: at,
      successCount: previous.successCount + 1,
      cleanPasses,
      status: cleanPasses >= 2 ? 'resolved' : 'recovering',
      lastScore: clampScore(success.score),
      evidence,
      modes: mode && !modes.includes(mode) ? [...modes, mode].slice(-MAX_MODES) : modes,
    }, ...base.entries.filter((entry) => entry.id !== id)],
  };
}

const STATUS_ORDER = { active: 0, recovering: 1, resolved: 2 };

export function prioritiseLearnerErrors(model, { limit = 12, includeResolved = false } = {}) {
  const entries = createLearnerErrorModel(model).entries.filter((entry) => includeResolved || entry.status !== 'resolved');
  return entries
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || b.recurrenceCount - a.recurrenceCount
      || b.errorCount - a.errorCount
      || (a.lastSeen < b.lastSeen ? 1 : -1))
    .slice(0, limit);
}

export function learnerErrorSummary(model) {
  const entries = createLearnerErrorModel(model).entries;
  const byCategory = Object.fromEntries(LEARNER_ERROR_CATEGORIES.map((category) => [category, {
    entries: 0,
    errors: 0,
    active: 0,
    recovering: 0,
    resolved: 0,
  }]));
  let recurrences = 0;
  for (const entry of entries) {
    const bucket = byCategory[entry.category];
    bucket.entries += 1;
    bucket.errors += entry.errorCount;
    bucket[entry.status] += 1;
    recurrences += entry.recurrenceCount;
  }
  return {
    totalEntries: entries.length,
    totalErrors: entries.reduce((sum, entry) => sum + entry.errorCount, 0),
    active: entries.filter((entry) => entry.status === 'active').length,
    recovering: entries.filter((entry) => entry.status === 'recovering').length,
    resolved: entries.filter((entry) => entry.status === 'resolved').length,
    recurrences,
    byCategory,
  };
}
