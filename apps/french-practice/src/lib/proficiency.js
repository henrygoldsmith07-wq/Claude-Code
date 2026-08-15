// The proficiency score.
//
// One number, 0–100, backed by five sub-scores that each come from something
// the learner actually did — not from XP, not from streak length, not from
// how many days the app was opened. XP measures attendance; this measures
// French.
//
// Design rules, in order of importance:
//   1. Every component must degrade gracefully to "unknown" rather than 0.
//      A learner who has never done a dictation is not a learner with 0%
//      listening, and averaging in a phantom zero is how progress screens
//      start lying.
//   2. Evidence decays. A speaking score from four months ago says little
//      about today, so recent sessions weigh more.
//   3. The score reports its own confidence, driven by how much evidence
//      exists and how recent it is. Low confidence is shown, not hidden.

import { LEVELS, levelIndex, profileFor } from './cefr.js';

export const DIMENSIONS = [
  { id: 'vocabulary', label: 'Vocabulary', weight: 0.25, blurb: 'Words held in long-term memory, weighted by how well they stick.' },
  { id: 'grammar', label: 'Grammar', weight: 0.20, blurb: 'Syllabus points mastered at 80+ on their quiz.' },
  { id: 'speaking', label: 'Speaking', weight: 0.25, blurb: 'Recent conversation scores, recency-weighted.' },
  { id: 'listening', label: 'Listening', weight: 0.15, blurb: 'Comprehension quizzes and dictation accuracy.' },
  { id: 'writing', label: 'Writing', weight: 0.15, blurb: 'Composition and correction scores.' },
];

const HALF_LIFE_DAYS = 45;

/** Exponential recency weight — evidence halves in value every 45 days. */
export function recencyWeight(timestamp, now = Date.now()) {
  if (!timestamp) return 0.5;
  const days = Math.max(0, (now - new Date(timestamp).getTime()) / 86400000);
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/** Recency-weighted mean of {score, at} records. Returns null when empty. */
export function weightedMean(records, now = Date.now()) {
  if (!records || !records.length) return null;
  let num = 0;
  let den = 0;
  for (const r of records) {
    const score = Number(r.score);
    if (!Number.isFinite(score)) continue;
    const wgt = recencyWeight(r.at, now);
    num += score * wgt;
    den += wgt;
  }
  return den > 0 ? num / den : null;
}

/**
 * Vocabulary sub-score: progress toward the level's word target, where a word
 * only counts once it has survived at least two reviews. Cards seen once are
 * recognition, not knowledge.
 */
export function vocabularyScore({ srs = {}, level = 'A1' } = {}) {
  const states = Object.values(srs);
  if (!states.length) return { score: null, known: 0, target: profileFor(level).vocabTarget };

  let known = 0;
  let strong = 0;
  for (const s of states) {
    const reps = s.reps || 0;
    if (reps >= 2 && s.lastRating !== 'again') {
      known += 1;
      if (reps >= 4) strong += 1;
    }
  }
  const target = profileFor(level).vocabTarget;
  // Strong cards count 1.25×, capped at the target — knowing 600 words well
  // beats having seen 900 twice.
  const effective = Math.min(target, known + strong * 0.25);
  return { score: Math.round((effective / target) * 100), known, strong, target };
}

/** Grammar sub-score: syllabus points mastered, against the level's target. */
export function grammarScore({ topicScores = {}, level = 'A1' } = {}) {
  const entries = Object.values(topicScores);
  if (!entries.length) return { score: null, mastered: 0, target: profileFor(level).grammarTarget };
  const mastered = entries.filter((v) => (typeof v === 'number' ? v : v?.best || 0) >= 80).length;
  const target = profileFor(level).grammarTarget;
  return { score: Math.round(Math.min(1, mastered / target) * 100), mastered, target };
}

/** Speaking sub-score straight from recency-weighted session composites. */
export function speakingScore({ sessions = [] } = {}, now = Date.now()) {
  const records = sessions
    .filter((s) => Number.isFinite(Number(s.score ?? s.overall)))
    .map((s) => ({ score: Number(s.score ?? s.overall), at: s.at || s.date || s.endedAt }));
  const mean = weightedMean(records, now);
  return { score: mean === null ? null : Math.round(mean), samples: records.length };
}

/** Listening: comprehension quizzes and dictation accuracy, pooled. */
export function listeningScore({ metrics = [] } = {}, now = Date.now()) {
  const records = metrics
    .filter((m) => m.skill === 'listening' || m.skill === 'dictation')
    .map((m) => ({ score: Number(m.score), at: m.at }));
  const mean = weightedMean(records, now);
  return { score: mean === null ? null : Math.round(mean), samples: records.length };
}

/** Writing: composition and correction scores. */
export function writingScore({ metrics = [] } = {}, now = Date.now()) {
  const records = metrics
    .filter((m) => m.skill === 'writing')
    .map((m) => ({ score: Number(m.score), at: m.at }));
  const mean = weightedMean(records, now);
  return { score: mean === null ? null : Math.round(mean), samples: records.length };
}

/**
 * The composite. Weights are renormalised over the dimensions that have
 * evidence, so a learner who has never written anything gets a score built
 * from the four they have done — with the confidence lowered to say so.
 */
export function proficiency(evidence = {}, now = Date.now()) {
  const level = evidence.level || 'A1';
  const parts = {
    vocabulary: vocabularyScore({ srs: evidence.srs, level }),
    grammar: grammarScore({ topicScores: evidence.topicScores, level }),
    speaking: speakingScore({ sessions: evidence.sessions }, now),
    listening: listeningScore({ metrics: evidence.metrics }, now),
    writing: writingScore({ metrics: evidence.metrics }, now),
  };

  const present = DIMENSIONS.filter((d) => parts[d.id].score !== null);
  const totalWeight = present.reduce((a, d) => a + d.weight, 0);

  if (!present.length) {
    return {
      score: null,
      level,
      band: null,
      confidence: 0,
      parts,
      covered: [],
      missing: DIMENSIONS.map((d) => d.id),
      note: 'No practice recorded yet — the score appears once you have done something scoreable.',
    };
  }

  const score = Math.round(
    present.reduce((a, d) => a + parts[d.id].score * (d.weight / totalWeight), 0),
  );

  // Confidence: how much of the weight is covered, times how much evidence
  // sits behind the behavioural dimensions.
  const coverage = totalWeight;
  const samples = parts.speaking.samples + parts.listening.samples + parts.writing.samples;
  const depth = Math.min(1, samples / 12);
  const confidence = Math.round(Math.max(0, Math.min(1, coverage * 0.6 + depth * 0.4)) * 100) / 100;

  return {
    score,
    level,
    band: bandFor(score, level),
    confidence,
    parts,
    covered: present.map((d) => d.id),
    missing: DIMENSIONS.filter((d) => parts[d.id].score === null).map((d) => d.id),
    weakest: present.slice().sort((a, b) => parts[a.id].score - parts[b.id].score)[0]?.id || null,
    strongest: present.slice().sort((a, b) => parts[b.id].score - parts[a.id].score)[0]?.id || null,
  };
}

/**
 * The score is *within-level*: 100 at A2 does not mean C1, it means the A2
 * syllabus is finished. The band names that plainly.
 */
export function bandFor(score, level) {
  if (score === null) return null;
  if (score < 30) return `Starting ${level}`;
  if (score < 60) return `Working through ${level}`;
  if (score < 85) return `Consolidating ${level}`;
  return `${level} complete — ready to test up`;
}

/**
 * Turn the score into a scale that spans the whole ladder, so a progress chart
 * does not reset to zero every time someone is promoted. Each level owns 100
 * points: A1 0–100, A2 100–200, and so on.
 */
export function globalScore(score, level) {
  if (score === null) return null;
  const base = Math.max(0, levelIndex(level)) * 100;
  return base + score;
}

/** Human-readable next step from the weakest covered dimension. */
export function nextFocus(result) {
  if (!result || result.score === null) return 'Do a lesson or a conversation — the score needs evidence.';
  if (result.missing.length) {
    const d = DIMENSIONS.find((x) => x.id === result.missing[0]);
    return `No ${d.label.toLowerCase()} evidence yet — one session would sharpen the estimate.`;
  }
  const d = DIMENSIONS.find((x) => x.id === result.weakest);
  return d ? `${d.label} is your lowest component — ${d.blurb.toLowerCase()}` : 'Keep going.';
}

/** Every level's target, for a "what is left" table. */
export function ladder() {
  return LEVELS.map((l) => {
    const p = profileFor(l);
    return { level: l, label: p.label, words: p.vocabTarget, grammar: p.grammarTarget };
  });
}
