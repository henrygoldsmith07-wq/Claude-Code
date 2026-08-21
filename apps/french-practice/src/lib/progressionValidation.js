// Progression-gate validation: does moving up a CEFR band mean general
// competence, or just mastery of app items?
//
// A progression is only validated by performance on *unseen* tasks that were
// not used to trigger it — reading, listening, writing, speaking, grammar and
// vocabulary transfer — each scored without the scaffolding that helped during
// learning. The harness starts empty and stays empty until such held-out
// evidence is supplied.
//
// See: cefr.js promotionGate, learnerValidation.js, storage.js

import { ALL_LEVELS, levelIndex } from './cefr.js';

export const MIN_PROGRESSION_N = 15;
export const UNSEEN_SKILLS = ['reading', 'listening', 'writing', 'speaking', 'grammar', 'vocabulary'];

function clampLevel(l) {
  const v = String(l || '').trim().toUpperCase();
  return ALL_LEVELS.includes(v) ? v : null;
}

/**
 * @typedef {Object} ProgressionValidationEntry
 * @property {string} id
 * @property {string} from  // CEFR before
 * @property {string} to    // CEFR after
 * @property {string} at    // ISO time of progression
 * @property {Object} unseen // { reading?:0..100, listening?:0..100, ... } — held-out scores
 * @property {boolean} [transfer] // did held-out vocab appear in new context?
 */

export function makeProgressionEntry({
  id, from, to, at, unseen = {}, transfer,
} = {}) {
  const f = clampLevel(from);
  const t = clampLevel(to);
  if (!f || !t) return null;
  if (levelIndex(t) <= levelIndex(f)) return null;
  const cleanUnseen = {};
  for (const skill of UNSEEN_SKILLS) {
    const v = unseen[skill];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) continue;
    cleanUnseen[skill] = Math.round(n);
  }
  // At least one held-out skill must be supplied; otherwise there's nothing to validate against
  if (!Object.keys(cleanUnseen).length) return null;
  return {
    id: String(id || `prog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    from: f,
    to: t,
    at: at && !Number.isNaN(new Date(at).getTime()) ? new Date(at).toISOString() : new Date().toISOString(),
    unseen: cleanUnseen,
    transfer: transfer == null ? null : Boolean(transfer),
  };
}

/**
 * Aggregate: does the held-out performance support the progression?
 * We report per-skill means and the proportion that met a 70+ threshold.
 */
export function progressionValidationMetrics(entries = []) {
  const usable = (Array.isArray(entries) ? entries : [])
    .map((e) => (e && e.from && e.to && e.unseen ? e : makeProgressionEntry(e)))
    .filter(Boolean);

  if (!usable.length) {
    return {
      n: 0,
      status: 'no-data',
      perSkill: {},
      overallPassRate: null,
      transferRate: null,
      message: 'No held-out transfer tasks recorded for progressions. Progressions reflect app mastery until unseen tasks are scored.',
    };
  }

  const perSkill = {};
  for (const skill of UNSEEN_SKILLS) {
    const vals = usable.map((e) => e.unseen[skill]).filter((v) => Number.isFinite(v));
    if (!vals.length) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const pass = vals.filter((v) => v >= 70).length / vals.length;
    perSkill[skill] = {
      n: vals.length,
      mean: Math.round(mean * 10) / 10,
      passRate: Math.round(pass * 100) / 100,
    };
  }

  // Overall: mean across skills that were tested
  const allScores = usable.flatMap((e) => Object.values(e.unseen));
  const overallMean = allScores.length ? allScores.reduce((a, b) => a + b, 0) / allScores.length : null;
  const overallPass = allScores.length ? allScores.filter((v) => v >= 70).length / allScores.length : null;
  const transferValues = usable.map((e) => e.transfer).filter((v) => v !== null && v !== undefined);
  const transferRate = transferValues.length ? transferValues.filter(Boolean).length / transferValues.length : null;

  const status = usable.length < MIN_PROGRESSION_N ? 'provisional' : 'validated';

  return {
    n: usable.length,
    status,
    perSkill,
    overallMean: overallMean == null ? null : Math.round(overallMean * 10) / 10,
    overallPassRate: overallPass == null ? null : Math.round(overallPass * 100) / 100,
    transferRate: transferRate == null ? null : Math.round(transferRate * 100) / 100,
    message: usable.length < MIN_PROGRESSION_N
      ? `Provisional (n=${usable.length}; need ${MIN_PROGRESSION_N} progressions with held-out tasks).`
      : `Validated against ${usable.length} progressions with unseen transfer tasks.`,
  };
}

export function progressionValidationStatus(entries) {
  const m = progressionValidationMetrics(entries);
  return {
    ...m,
    label: m.status === 'no-data' ? 'Not validated' : m.status === 'provisional' ? `Provisional (n=${m.n})` : `Validated (n=${m.n})`,
  };
}

// ---- transfer-check builder ----
//
// After a promotion, general competence is checked on tasks the learner has
// NOT seen, one per skill, drawn from caller-supplied CEFR-tagged banks.
// Pure: the caller owns the banks (placement items, reading texts, grammar
// quizzes…) and the exclusion list (everything already answered). The result
// feeds makeProgressionEntry once scored, closing the loop.

const ORDER = Object.fromEntries(ALL_LEVELS.map((l, i) => [l, i]));

function unseenFromBank(bank, capIndex, exclude, limit) {
  const skip = new Set(exclude);
  const usable = (Array.isArray(bank) ? bank : [])
    .filter((item) => item && item.id && !skip.has(item.id))
    .filter((item) => {
      const idx = ORDER[String(item.cefr || '').toUpperCase()];
      return idx !== undefined && idx <= capIndex;
    });
  // Deterministic: stable sort by level distance below the cap, then id.
  usable.sort((a, b) =>
    (ORDER[String(b.cefr).toUpperCase()] - ORDER[String(a.cefr).toUpperCase()])
    || String(a.id).localeCompare(String(b.id)));
  return usable.slice(0, Math.max(0, limit));
}

/**
 * Build a post-promotion transfer check.
 * @param {object} opts
 * @param {string} opts.level            the NEW CEFR level after promotion
 * @param {object} [opts.banks]          { [skill]: [{id, cefr}] } — at least the skills you want to probe
 * @param {string[]} [opts.excludeIds]   item ids the learner has already seen/answered
 * @param {number}  [opts.perSkill=1]    how many unseen items per skill
 * @returns {{ level, tasks: object, missing: string[], total: number }}
 */
export function buildTransferCheck({ level, banks = {}, excludeIds = [], perSkill = 1 } = {}) {
  const target = clampLevel(level);
  if (!target) {
    return { level: null, tasks: {}, missing: UNSEEN_SKILLS.slice(), total: 0, error: 'invalid level' };
  }
  const capIndex = ORDER[target];
  const tasks = {};
  const missing = [];
  let total = 0;
  for (const skill of UNSEEN_SKILLS) {
    const picked = unseenFromBank(banks[skill], capIndex, excludeIds, perSkill);
    if (picked.length) {
      tasks[skill] = picked.map(({ id, cefr }) => ({ id, cefr }));
      total += picked.length;
    } else {
      missing.push(skill);
    }
  }
  return { level: target, tasks, missing, total };
}
