// Human-marked writing/speaking corpus.
//
// Infrastructure for collecting paired AI vs human marks on the same learner
// response — without fabricating either. Each entry captures the prompt/task,
// the learner's text/transcript, the AI's score & corrections, the human's
// score & corrections, the criterion (CEFR/exam), the rater, and whether a
// consensus rating exists.
//
// Metrics: score agreement, false corrections, missed errors, feedback
// usefulness, criterion-level agreement. The store starts empty and remains
// so until a qualified rater contributes.
//
// Pair with: storage.js (persistence), intelligibility.js / examBenchmark.js
// (human benchmark pattern), groq.js (AI structured outputs).

export const MIN_CORPUS_N = 30;

const CRITERIA = new Set(['communication', 'accuracy', 'range', 'pronunciation', 'spontaneity', 'content', 'organisation', 'comprehension', 'grammar', 'vocabulary', 'cefr', 'exam']);

function clampCriterion(v) {
  const s = String(v || '').trim().toLowerCase();
  return CRITERIA.has(s) ? s : 'cefr';
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * @typedef {Object} CorpusEntry
 * @property {string} id
 * @property {string} mode        // 'writing' | 'speaking'
 * @property {string} prompt      // question/task presented
 * @property {string} response    // learner text / transcript
 * @property {number|null} aiScore
 * @property {string|null} aiCorrections  // markdown / JSON
 * @property {number|null} humanScore
 * @property {string|null} humanCorrections
 * @property {string} criterion
 * @property {string} [rater]     // human rater id
 * @property {string} [consensus] // consensus score if multiple raters
 * @property {string} at          // ISO time
 */

export function makeCorpusEntry({
  id, mode, prompt, response, aiScore, aiCorrections, humanScore, humanCorrections, criterion, rater, consensus, at,
} = {}) {
  const m = String(mode || '').toLowerCase();
  if (!['writing', 'speaking'].includes(m)) return null;
  const p = String(prompt || '').trim();
  const r = String(response || '').trim();
  if (!p || !r) return null;
  const ai = clampScore(aiScore);
  const human = clampScore(humanScore);
  // Both scores may be null & still useful (correction-only entry), but at least one correction stream must exist
  // We allow storing AI-only or human-only while awaiting the other, but mark completeness
  return {
    id: String(id || `corpus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    mode: m,
    prompt: p.slice(0, 2000),
    response: r.slice(0, 8000),
    aiScore: ai,
    aiCorrections: aiCorrections != null ? String(aiCorrections).slice(0, 8000) : null,
    humanScore: human,
    humanCorrections: humanCorrections != null ? String(humanCorrections).slice(0, 8000) : null,
    criterion: clampCriterion(criterion),
    rater: rater ? String(rater).slice(0, 80) : null,
    consensus: consensus != null ? String(consensus).slice(0, 200) : null,
    at: at && !Number.isNaN(new Date(at).getTime()) ? new Date(at).toISOString() : new Date().toISOString(),
    hasHuman: human != null || (humanCorrections && String(humanCorrections).trim()),
    hasAI: ai != null || (aiCorrections && String(aiCorrections).trim()),
    paired: ai != null && human != null,
  };
}

/**
 * Score agreement metrics over paired entries (those with both scores).
 */
export function corpusScoreAgreement(entries = []) {
  const usable = (Array.isArray(entries) ? entries : []).filter((e) => e && Number.isFinite(Number(e.aiScore)) && Number.isFinite(Number(e.humanScore)));
  if (!usable.length) {
    return { n: 0, status: 'no-data', meanAbsoluteError: null, within5: null, within10: null, correlation: null, message: 'No paired AI/human scores yet.' };
  }
  let abs = 0;
  let w5 = 0;
  let w10 = 0;
  const pairs = [];
  for (const e of usable) {
    const d = Math.abs(Number(e.aiScore) - Number(e.humanScore));
    abs += d;
    if (d <= 5) w5 += 1;
    if (d <= 10) w10 += 1;
    pairs.push([Number(e.aiScore), Number(e.humanScore)]);
  }
  const mae = abs / usable.length;
  // Pearson correlation reuse from intelligibility.js logic inline
  const n = pairs.length;
  let corr = null;
  if (n >= 3) {
    const xs = pairs.map((p) => p[0]);
    const ys = pairs.map((p) => p[1]);
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
    const den = Math.sqrt(dx * dy);
    corr = den ? Math.round((num / den) * 1000) / 1000 : null;
  }
  return {
    n: usable.length,
    status: usable.length < MIN_CORPUS_N ? 'provisional' : 'validated',
    meanAbsoluteError: Math.round(mae * 10) / 10,
    within5: Math.round((w5 / usable.length) * 100) / 100,
    within10: Math.round((w10 / usable.length) * 100) / 100,
    correlation: corr,
    message: usable.length < MIN_CORPUS_N ? `Provisional (n=${usable.length}; need ${MIN_CORPUS_N} paired marks).` : `Validated against ${usable.length} paired marks.`,
  };
}

/**
 * Correction-level agreement, counted only where human corrections exist.
 * Computes false corrections (AI flagged, human didn't), missed errors
 * (human flagged, AI didn't) and their rates — via simple token overlap
 * on the corrections strings as proxies when structured diffs aren't available.
 *
 * This is intentionally transparent about being an approximation; exact
 * false/missed error counts require rater-labelled spans.
 */
export function corpusCorrectionMetrics(entries = []) {
  const withHumanCorr = (Array.isArray(entries) ? entries : []).filter((e) => e && e.humanCorrections && String(e.humanCorrections).trim());
  if (!withHumanCorr.length) {
    return { n: 0, status: 'no-data', falseCorrectionRate: null, missedErrorRate: null, message: 'No human corrections yet — correction agreement cannot be measured.' };
  }
  const both = withHumanCorr.filter((e) => e.aiCorrections && String(e.aiCorrections).trim());
  if (!both.length) {
    return { n: withHumanCorr.length, status: 'provisional', falseCorrectionRate: null, missedErrorRate: null, message: `${withHumanCorr.length} human corrections, but no paired AI corrections to compare.` };
  }
  // Heuristic: count <s> tags (removed) in each corrections HTML as error spans
  const countSpans = (html) => (String(html).match(/<s>/g) || []).length;
  let falsePos = 0, falseNeg = 0, totalHuman = 0, totalAI = 0;
  for (const e of both) {
    const a = countSpans(e.aiCorrections);
    const h = countSpans(e.humanCorrections);
    totalAI += a; totalHuman += h;
    if (a > h) falsePos += (a - h);
    if (h > a) falseNeg += (h - a);
  }
  const denom = Math.max(1, totalHuman + totalAI);
  return {
    n: both.length,
    status: both.length < MIN_CORPUS_N ? 'provisional' : 'validated',
    falseCorrectionRate: Math.round((falsePos / Math.max(1, totalAI)) * 100) / 100,
    missedErrorRate: Math.round((falseNeg / Math.max(1, totalHuman)) * 100) / 100,
    totalHumanSpans: totalHuman,
    totalAISpans: totalAI,
    message: both.length < MIN_CORPUS_N ? `Provisional heuristic over ${both.length} paired correction sets.` : `Heuristic over ${both.length} pairs; exact rates need span-level rater labels.`,
  };
}

/**
 * Full corpus health check — both score and correction metrics, plus counts.
 */
export function corpusMetrics(entries = []) {
  const list = Array.isArray(entries) ? entries : [];
  const scores = corpusScoreAgreement(list);
  const corrections = corpusCorrectionMetrics(list);
  const byCriterion = {};
  for (const e of list) {
    const c = e.criterion || 'cefr';
    byCriterion[c] = (byCriterion[c] || 0) + 1;
  }
  const byMode = {
    writing: list.filter((e) => e.mode === 'writing').length,
    speaking: list.filter((e) => e.mode === 'speaking').length,
  };
  const n = list.length;
  return {
    n,
    status: n === 0 ? 'no-data' : scores.status === 'validated' && corrections.status === 'validated' ? 'validated' : 'provisional',
    byMode,
    byCriterion,
    scores,
    corrections,
    message: n === 0 ? 'Corpus empty — add human-marked responses to validate AI marking.' : `Corpus holds ${n} items (${byMode.writing} writing, ${byMode.speaking} speaking).`,
  };
}
