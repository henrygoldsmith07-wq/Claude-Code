// Placement validation infrastructure.
//
// Stores learners with an independently known CEFR level (teacher assessment,
// external exam) alongside the placement result, ability estimate, confidence
// interval and test length. Measures exact / within-one agreement, ability
// error and confidence calibration — but never fabricates a learner.
//
// Usage: recordPlacementValidation({...}) when a teacher-entered level is
// available; computePlacementMetrics() reports the aggregate. All pure and
// offline; storage wrapper lives in storage.js.
//
// See also: placement.js (adaptive engine), learnerValidation.js (longitudinal).

import { ALL_LEVELS, levelIndex } from './cefr.js';
import { BAND_CENTRE } from './placement.js';

export const MIN_VALIDATION_N = 20;

const VALID_LEVELS = new Set(ALL_LEVELS);

/**
 * @typedef {Object} PlacementValidationEntry
 * @property {string} id
 * @property {string} knownLevel   // teacher/assessment CEFR
 * @property {string} placedLevel  // app placement CEFR
 * @property {number} theta        // ability estimate (logits)
 * @property {number} se           // standard error (logits)
 * @property {number} knownTheta   // centre for known level
 * @property {number} itemsAsked
 * @property {string} at           // ISO timestamp
 * @property {string} [rater]      // who supplied known level
 * @property {string} [source]     // e.g. "GCSE result", "DELF B1"
 */

function clampKnownLevel(level) {
  const l = String(level || '').trim().toUpperCase();
  return VALID_LEVELS.has(l) ? l : null;
}

/**
 * Create a single validation entry.
 * Returns null if required fields are missing/invalid — never throw.
 */
export function makePlacementValidationEntry({
  id, knownLevel, placedLevel, theta, se, itemsAsked, rater, source, at,
} = {}) {
  const known = clampKnownLevel(knownLevel);
  const placed = clampKnownLevel(placedLevel);
  const t = Number(theta);
  const s = Number(se);
  const n = Number(itemsAsked);
  if (!known || !placed || !Number.isFinite(t) || !Number.isFinite(s) || !Number.isFinite(n)) return null;
  if (s < 0 || s > 5) return null;
  if (n < 1 || n > 100) return null;
  const knownTheta = BAND_CENTRE[known];
  return {
    id: String(id || `pv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    knownLevel: known,
    placedLevel: placed,
    theta: Math.round(t * 100) / 100,
    se: Math.round(s * 100) / 100,
    knownTheta: Number.isFinite(knownTheta) ? knownTheta : t,
    itemsAsked: Math.round(n),
    at: at && !Number.isNaN(new Date(at).getTime()) ? new Date(at).toISOString() : new Date().toISOString(),
    rater: rater ? String(rater).slice(0, 80) : undefined,
    source: source ? String(source).slice(0, 120) : undefined,
    // Derived
    exact: known === placed ? 1 : 0,
    withinOne: Math.abs(levelIndex(known) - levelIndex(placed)) <= 1 ? 1 : 0,
    abilityError: Math.abs(t - (Number.isFinite(knownTheta) ? knownTheta : t)),
    // Confidence: does the interval contain the known level?
    calibrated: Math.abs(t - (Number.isFinite(knownTheta) ? knownTheta : t)) <= s ? 1 : 0,
  };
}

/**
 * Aggregate metrics over a list of entries.
 * Returns status.no-data when empty, provisional below MIN_VALIDATION_N.
 */
export function placementValidationMetrics(entries = []) {
  const usable = (Array.isArray(entries) ? entries : [])
    .map((e) => {
      // accept raw stored entries; if exact/withinOne already computed, use it
      if (e && e.knownLevel && e.placedLevel && Number.isFinite(e.theta)) return e;
      return makePlacementValidationEntry(e);
    })
    .filter(Boolean);

  if (!usable.length) {
    return {
      n: 0,
      status: 'no-data',
      exactAgreement: null,
      withinOneAgreement: null,
      meanAbilityError: null,
      rmse: null,
      calibration: null,
      byKnownLevel: {},
      message: 'No externally validated placements recorded. Add teacher-assessed learners to evaluate placement accuracy — never fabricate them.',
    };
  }

  const n = usable.length;
  const exact = usable.reduce((a, e) => a + (e.exact ?? (e.knownLevel === e.placedLevel ? 1 : 0)), 0) / n;
  const withinOne = usable.reduce((a, e) => a + (e.withinOne ?? (Math.abs(levelIndex(e.knownLevel) - levelIndex(e.placedLevel)) <= 1 ? 1 : 0)), 0) / n;
  const abilityErrors = usable.map((e) => e.abilityError ?? Math.abs(Number(e.theta) - Number(e.knownTheta ?? BAND_CENTRE[e.knownLevel] ?? e.theta)));
  const mae = abilityErrors.reduce((a, b) => a + b, 0) / n;
  const rmse = Math.sqrt(abilityErrors.reduce((a, b) => a + b * b, 0) / n);
  const calibrated = usable.filter((e) => e.calibrated != null ? e.calibrated : (Math.abs(Number(e.theta) - Number(e.knownTheta)) <= Number(e.se))).length / n;

  // Per known-level breakdown
  const byKnownLevel = {};
  for (const lvl of ALL_LEVELS) {
    const subset = usable.filter((e) => e.knownLevel === lvl);
    if (!subset.length) continue;
    const ex = subset.filter((e) => (e.exact ?? (e.knownLevel === e.placedLevel ? 1 : 0))).length / subset.length;
    const w1 = subset.filter((e) => (e.withinOne ?? (Math.abs(levelIndex(e.knownLevel) - levelIndex(e.placedLevel)) <= 1 ? 1 : 0))).length / subset.length;
    byKnownLevel[lvl] = { n: subset.length, exact: Math.round(ex * 100) / 100, withinOne: Math.round(w1 * 100) / 100 };
  }

  // Confidence calibration: bin by se (narrow interval = high confidence)
  // Compare mean calibrated vs expected 68% for ±1 SE under normal.
  const expected = 0.68;
  const calibrationError = Math.abs(calibrated - expected);

  const status = n < MIN_VALIDATION_N ? 'provisional' : 'validated';

  return {
    n,
    status,
    exactAgreement: Math.round(exact * 100) / 100,
    withinOneAgreement: Math.round(withinOne * 100) / 100,
    meanAbilityError: Math.round(mae * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    calibration: Math.round(calibrated * 100) / 100,
    calibrationError: Math.round(calibrationError * 100) / 100,
    expectedCalibration: expected,
    byKnownLevel,
    message: n < MIN_VALIDATION_N
      ? `Provisional (n=${n}; need ${MIN_VALIDATION_N} externally validated learners). Treat agreement as indicative, not established.`
      : `Validated against ${n} learners with independent CEFR levels.`,
  };
}

/**
 * What the UI should show when no validation exists.
 */
export function placementValidationStatus(entries) {
  const m = placementValidationMetrics(entries);
  return {
    ...m,
    label: m.status === 'no-data' ? 'Not validated' : m.status === 'provisional' ? `Provisional (n=${m.n})` : `Validated (n=${m.n})`,
  };
}
