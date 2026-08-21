// Assistance-fading validation.
//
// Tracks whether learners improve when scaffolding is removed: performance
// with support vs later unaided performance, hints used, retries and delayed
// retention. Detects dependence on scaffolding.
//
// Pair with: cefr.js assistancePolicy, learningAdaptation.js assistanceFading,
// storage.js learner history, memory.js retention.

import { MIN_VALIDATION_N } from './placementValidation.js';

export const MIN_ASSISTANCE_N = 20;

/**
 * @typedef {Object} AssistanceEvent
 * @property {string} id
 * @property {string} at          ISO time
 * @property {string} skill       reading|listening|speaking|grammar|vocab
 * @property {'with'| 'without'} support  whether hints/captions/translation were available
 * @property {number} score       0..100
 * @property {number} [hintsUsed] 0..
 * @property {number} [retries]    0..
 * @property {string} [taskId]
 * @property {number} [retentionScore] later unaided recall of same item
 */

export function makeAssistanceEvent({
  id, at, skill, support, score, hintsUsed, retries, taskId, retentionScore,
} = {}) {
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0 || s > 100) return null;
  const sup = support === 'without' ? 'without' : support === 'with' ? 'with' : null;
  if (!sup) return null;
  const sk = String(skill || 'general').toLowerCase();
  return {
    id: String(id || `asst-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    at: at && !Number.isNaN(new Date(at).getTime()) ? new Date(at).toISOString() : new Date().toISOString(),
    skill: sk,
    support: sup,
    score: Math.round(s),
    hintsUsed: Number.isFinite(Number(hintsUsed)) ? Math.max(0, Math.round(Number(hintsUsed))) : 0,
    retries: Number.isFinite(Number(retries)) ? Math.max(0, Math.round(Number(retries))) : 0,
    taskId: taskId ? String(taskId).slice(0, 120) : null,
    retentionScore: retentionScore != null && Number.isFinite(Number(retentionScore)) ? Math.round(Number(retentionScore)) : null,
  };
}

/**
 * Do learners who do well with support also do well without it?
 * Computes with-vs-without means, gap, and whether delayed retention holds.
 */
export function assistanceMetrics(events = []) {
  const list = (Array.isArray(events) ? events : []).map((e) => (e && e.support ? e : makeAssistanceEvent(e))).filter(Boolean);
  if (!list.length) {
    return {
      n: 0,
      status: 'no-data',
      withMean: null,
      withoutMean: null,
      gap: null,
      hints: null,
      retention: null,
      message: 'No assistance events recorded. Track performance with and without scaffolding to detect dependence.',
    };
  }
  const withScores = list.filter((e) => e.support === 'with').map((e) => e.score);
  const withoutScores = list.filter((e) => e.support === 'without').map((e) => e.score);
  const withMean = withScores.length ? withScores.reduce((a, b) => a + b, 0) / withScores.length : null;
  const withoutMean = withoutScores.length ? withoutScores.reduce((a, b) => a + b, 0) / withoutScores.length : null;
  const gap = withMean != null && withoutMean != null ? withMean - withoutMean : null;

  // Hints & retries correlation with without-support score
  const withHints = list.filter((e) => e.support === 'with');
  const avgHints = withHints.length ? withHints.reduce((a, e) => a + e.hintsUsed, 0) / withHints.length : null;
  const avgRetries = list.length ? list.reduce((a, e) => a + e.retries, 0) / list.length : null;

  // Delayed retention: events that have a later unaided score for the same task
  const withRetention = list.filter((e) => e.retentionScore != null);
  let retention = null;
  if (withRetention.length) {
    const supported = withRetention.filter((e) => e.support === 'with');
    if (supported.length) {
      const meanInitial = supported.reduce((a, e) => a + e.score, 0) / supported.length;
      const meanRetained = supported.reduce((a, e) => a + e.retentionScore, 0) / supported.length;
      retention = {
        n: supported.length,
        meanInitial: Math.round(meanInitial * 10) / 10,
        meanRetained: Math.round(meanRetained * 10) / 10,
        drop: Math.round((meanInitial - meanRetained) * 10) / 10,
        holdRate: Math.round((supported.filter((e) => e.retentionScore >= 70).length / supported.length) * 100) / 100,
      };
    }
  }

  // Dependence signal: large positive gap + low without-mean
  const dependent = gap != null && gap > 15 && withoutMean != null && withoutMean < 60;

  const status = list.length < MIN_ASSISTANCE_N ? 'provisional' : 'validated';

  return {
    n: list.length,
    status,
    withMean: withMean == null ? null : Math.round(withMean * 10) / 10,
    withoutMean: withoutMean == null ? null : Math.round(withoutMean * 10) / 10,
    gap: gap == null ? null : Math.round(gap * 10) / 10,
    hints: avgHints == null ? null : Math.round(avgHints * 100) / 100,
    retries: avgRetries == null ? null : Math.round(avgRetries * 100) / 100,
    retention,
    dependent,
    message: status === 'provisional'
      ? `Provisional (n=${list.length}; need ${MIN_ASSISTANCE_N} paired with/without events).`
      : dependent
        ? `Large gap (${Math.round(gap)}pp) between supported and unaided performance — scaffolding dependence suspected.`
        : `Validated (n=${list.length}). Gap ${gap == null ? '—' : Math.round(gap) + 'pp'}; retention ${retention ? retention.holdRate * 100 + '% ≥70' : 'not yet measured'}.`,
  };
}

export function assistanceStatus(events) {
  const m = assistanceMetrics(events);
  return {
    ...m,
    label: m.status === 'no-data' ? 'Not tracked' : m.status === 'provisional' ? `Provisional (n=${m.n})` : m.dependent ? 'Dependence risk' : `Validated (n=${m.n})`,
  };
}
