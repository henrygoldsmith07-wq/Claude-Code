// Shared learning adaptation: select input that is understandable but useful,
// then increase novelty, speed and independence only when the evidence earns it.

import { ALL_LEVELS, assistancePolicy, levelIndex, profileFor } from './cefr.js';
import { fsrsRetention } from './fsrs.js';
import { LISTENING_STAGES, listeningStage } from './accents.js';
import { dictationSpeed, levelForSrs } from './dictationProgression.js';
import { calibration, MIN_SAMPLES, samplesFrom } from './fsrsValidation.js';

const DAY = 86400000;
const clamp = (n, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const tokenise = (text) => String(text || '').toLocaleLowerCase().match(WORD_RE) || [];
const keyWord = (word) => String(word || '').toLocaleLowerCase().replace(/^[dl]['’]/, '').replace(/^(le|la|les|un|une|des|du|de|au|aux)\s+/i, '').trim();
const FUNCTION_WORDS = new Set(['à', 'au', 'aux', 'avec', 'ce', 'cette', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en', 'et', 'il', 'ils', 'je', 'la', 'le', 'les', 'ma', 'mais', 'me', 'mes', 'mon', 'ne', 'nous', 'ou', 'par', 'pas', 'pour', 'que', 'qui', 'se', 'son', 'sur', 'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vous', 'y']);
const lexicalTokens = (text) => tokenise(text).map(keyWord).filter((token) => token && !FUNCTION_WORDS.has(token));
const cardFor = (srs, id) => srs?.[`${id}::receptive`] || srs?.[id] || null;

function cardConfidence(card, now) {
  if (!card || !(card.reps > 0)) return 0;
  const retention = fsrsRetention(card, now);
  const stability = retention == null ? 0.72 : retention;
  if (card.reps === 1) return round(stability * 0.35, 3);
  const repetition = Math.min(1, card.reps / 5);
  return round(clamp(stability * 0.7 + repetition * 0.3), 3);
}

/** Estimate what is genuinely known, not just what has appeared once. */
export function knownVocabularyEstimate(entries = [], srs = {}, { now = Date.now() } = {}) {
  const rows = (entries || [])
    .filter((entry) => entry && entry.id && entry.fr)
    .map((entry) => {
      const card = cardFor(srs, entry.id);
      return {
        id: String(entry.id),
        fr: String(entry.fr),
        freq: Number(entry.freq) || 9,
        reps: Number(card?.reps) || 0,
        retention: card ? fsrsRetention(card, now) : null,
        confidence: cardConfidence(card, now),
      };
    });
  const known = rows.filter((row) => row.confidence >= 0.55);
  const uncertain = rows.filter((row) => row.confidence > 0 && row.confidence < 0.55);
  const weightedKnown = rows.reduce((sum, row) => sum + row.confidence, 0);
  const reviewed = rows.filter((row) => row.reps > 0).length;
  return {
    knownCount: known.length,
    weightedKnown: round(weightedKnown),
    coverage: rows.length ? round(weightedKnown / rows.length) : null,
    reviewedCount: reviewed,
    sampleSize: rows.length,
    confidence: rows.length ? round(clamp(reviewed / Math.min(rows.length, 60))) : 0,
    knownIds: known.map((row) => row.id),
    knownWords: known
      .sort((a, b) => b.confidence - a.confidence || a.freq - b.freq)
      .map((row) => row.fr),
    uncertainWords: uncertain.sort((a, b) => b.confidence - a.confidence).map((row) => row.fr),
    rows,
  };
}

/** Coverage of one piece of input against the learner's known lexicon. */
export function knownVocabularyCoverage(text, knownWords = []) {
  const known = new Set((knownWords || []).map(keyWord).filter(Boolean));
  const tokens = lexicalTokens(text);
  if (!tokens.length) return { coverage: 1, known: 0, unknown: 0, tokens: 0 };
  const hits = tokens.filter((token) => known.has(token)).length;
  return { coverage: round(hits / tokens.length), known: hits, unknown: tokens.length - hits, tokens: tokens.length };
}

/** Select a comprehensible-input vocabulary envelope with a small new-word frontier. */
export function selectComprehensibleInput({
  entries = [], srs = {}, level = 'B1', limit = 40, newWordLimit = 2, targetCoverage = 0.8, now = Date.now(),
} = {}) {
  const estimate = knownVocabularyEstimate(entries, srs, { now });
  const knownRows = estimate.rows
    .filter((row) => row.confidence >= 0.55)
    .sort((a, b) => b.confidence - a.confidence || a.freq - b.freq);
  const newWords = (entries || [])
    .filter((entry) => entry?.id && entry?.fr && !cardFor(srs, entry.id))
    .sort((a, b) => (Number(a.freq) || 9) - (Number(b.freq) || 9))
    .slice(0, Math.max(0, newWordLimit));
  const selectedKnown = knownRows.slice(0, Math.max(0, limit)).map((row) => row.fr);
  const selectedNew = newWords.map((entry) => entry.fr);
  const profile = profileFor(level);
  const coverageTarget = clamp(targetCoverage - Math.max(0, levelIndex(level) - 1) * 0.03, 0.65, 0.92);
  return {
    level,
    knownWords: selectedKnown,
    knownIds: knownRows.slice(0, Math.max(0, limit)).map((row) => row.id),
    newWords: selectedNew,
    vocabulary: [...selectedKnown, ...selectedNew],
    estimate,
    coverageTarget: round(coverageTarget),
    directive: `Keep roughly ${Math.round(coverageTarget * 100)}% of the learner-facing words familiar. Introduce no more than ${selectedNew.length || newWordLimit} new target word${newWordLimit === 1 ? '' : 's'} in one reply.`,
    levelVocabularyTarget: profile.vocabTarget,
  };
}

const SUBORDINATORS = ['parce que', 'puisque', 'bien que', 'quoique', 'alors que', 'tandis que', 'même si', 'si ', 'quand ', 'lorsque', 'afin que', 'pour que', 'comme '];
const CONNECTORS = ['et ', 'mais ', 'ou ', 'donc ', 'car ', 'cependant', 'pourtant', 'en revanche', 'd’abord', 'ensuite', 'enfin', 'ainsi'];

/** Describe sentence load for difficulty calibration and input selection. */
export function sentenceComplexityEstimate(text = '') {
  const raw = String(text || '').trim();
  const words = tokenise(raw);
  const unique = new Set(words);
  const subordination = SUBORDINATORS.reduce((sum, marker) => sum + (raw.toLocaleLowerCase().split(marker).length - 1), 0);
  const coordination = CONNECTORS.reduce((sum, marker) => sum + (raw.toLocaleLowerCase().split(marker).length - 1), 0);
  const punctuationClauses = (raw.match(/[,;:!?]/g) || []).length;
  const clauseCount = Math.max(1, 1 + subordination + Math.min(3, coordination) + Math.floor(punctuationClauses / 2));
  const lexicalDiversity = words.length ? round(unique.size / words.length) : 1;
  const score = clamp(
    words.length / 42 * 0.42 + Math.min(1, clauseCount / 4) * 0.28 + Math.min(1, subordination / 2) * 0.2 + (1 - lexicalDiversity) * 0.1,
  );
  const band = score < 0.18 ? 'A1' : score < 0.32 ? 'A2' : score < 0.52 ? 'B1' : score < 0.72 ? 'B2' : 'C1';
  return {
    score: round(score),
    band,
    wordCount: words.length,
    clauseCount,
    subordination,
    coordination,
    lexicalDiversity,
    features: { longSentence: words.length >= 25, subordinateClause: subordination > 0, connectiveLoad: coordination >= 2 },
  };
}

/** Estimate grammar novelty while keeping recurring errors in the practice loop. */
export function grammarNoveltyEstimate({ topics = [], grammarProgress = {}, errorModel = [] } = {}) {
  const rows = (topics || []).map((topic) => {
    const id = typeof topic === 'string' ? topic : topic?.id;
    if (!id) return null;
    const progress = grammarProgress[id] || {};
    const error = (errorModel || []).find((entry) => entry.mode === 'grammar' && entry.key === id);
    const attempts = Number(progress.attempts) || 0;
    const best = Number(progress.best) || 0;
    const novelty = attempts === 0 ? 1 : best >= 80 && attempts >= 2 ? 0.15 : 0.55;
    return {
      id,
      novelty,
      attempts,
      best,
      errorCount: Number(error?.errorCount) || 0,
      priority: Number(error?.priority) || 0,
      status: error?.status || (attempts ? 'practised' : 'new'),
    };
  }).filter(Boolean);
  const targets = [...rows].sort((a, b) => b.priority - a.priority || b.novelty - a.novelty).slice(0, 4);
  const unseen = rows.filter((row) => row.attempts === 0).map((row) => row.id);
  const reinforce = rows.filter((row) => row.errorCount > 0 || row.best < 80).map((row) => row.id);
  return {
    novelty: rows.length ? round(rows.reduce((sum, row) => sum + row.novelty, 0) / rows.length) : null,
    confidence: rows.length ? round(clamp(rows.reduce((sum, row) => sum + Math.min(1, row.attempts / 3), 0) / rows.length)) : 0,
    targetTopicIds: targets.map((row) => row.id),
    unseenTopicIds: unseen,
    reinforceTopicIds: reinforce,
    rows,
    directive: targets.length
      ? `Grammar targets: ${targets.map((row) => row.id).join(', ')}. Prefer one new structure at a time; recycle errors before adding another.`
      : 'Keep grammar familiar and conversational until more evidence is available.',
  };
}

/** Speech rate responds to level, recent performance and retention without overriding the learner's slider. */
export function speechRateAdaptation({ level = 'B1', score = null, retention = null, userRate = 1, accentBias = 1 } = {}) {
  const profileRate = profileFor(level).speechRate || 1;
  const scoreFactor = score == null ? 1 : score < 60 ? 0.9 : score >= 88 ? 1.05 : 1;
  const retentionFactor = retention == null ? 1 : retention < 0.6 ? 0.92 : retention >= 0.88 ? 1.03 : 1;
  const rate = clamp(profileRate * Number(userRate || 1) * scoreFactor * retentionFactor * Number(accentBias || 1), 0.6, 1.35);
  return { rate: round(rate, 2), base: profileRate, scoreFactor, retentionFactor, userRate: Number(userRate || 1) };
}

function recentScores(metrics = [], reviewEvents = []) {
  const metricScores = (metrics || []).filter((item) => item?.skill === 'listening' && Number.isFinite(Number(item.score))).map((item) => Number(item.score));
  const eventScores = (reviewEvents || []).filter((item) => item?.mode === 'listening' && Number.isFinite(Number(item.score))).map((item) => Number(item.score));
  return [...metricScores, ...eventScores].slice(-8);
}

/** Listening ladder: content length, speed, speakers and accents rise separately. */
export function listeningDifficultyLadder({ level = 'B1', srs = {}, entries = [], metrics = [], reviewEvents = [], previousStage = null } = {}) {
  const scores = recentScores(metrics, reviewEvents);
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const receptiveSrs = Object.fromEntries(Object.entries(srs || {}).filter(([key]) => !key.includes('::productive')));
  let stage = previousStage || levelForSrs(receptiveSrs, entries);
  if (scores.length >= 2 && average >= 85) stage += 1;
  if (scores.length >= 2 && average < 50) stage -= 1;
  const cap = { A1: 2, A2: 3, B1: 4, B2: 5, C1: 5, C2: 5 }[level] || 4;
  stage = Math.max(1, Math.min(cap, stage));
  const meta = listeningStage(stage);
  return {
    stage,
    label: meta.label,
    average,
    sampleSize: scores.length,
    rate: dictationSpeed(stage),
    accents: [...meta.accents],
    accentCount: meta.accents.length,
    speakerCount: stage >= 4 ? 2 : 1,
    maxWords: 8 + stage * 12,
    naturalSpeech: stage >= 3,
    directive: `Listening stage ${stage} (${meta.label}): use ${dictationSpeed(stage)}× baseline speed, ${stage >= 4 ? 'at least two speakers when available' : 'one clear speaker'}, and ${stage >= 4 ? 'varied accents' : 'the reference accent'}.`,
  };
}

export function accentVariety({ stage = 1, history = [], limit = 3 } = {}) {
  const meta = listeningStage(stage);
  const seen = new Set((history || []).map((item) => typeof item === 'string' ? item : item?.accentId).filter(Boolean));
  const ordered = [...meta.accents].sort((a, b) => Number(seen.has(a)) - Number(seen.has(b)));
  return { stage, accentIds: ordered.slice(0, limit), unseen: ordered.filter((id) => !seen.has(id)), variety: meta.accents.length > 1 };
}

/** Natural speech is a controlled expansion, not a sudden jump to slang. */
export function naturalSpeechExpansion(level = 'B1', { score = null } = {}) {
  const idx = levelIndex(level);
  const tiers = [
    ['clear word boundaries', 'high-frequency phrases'],
    ['common contractions such as c’est and j’ai', 'simple discourse connectors'],
    ['elision, fillers and everyday connectors', 'a small amount of idiom'],
    ['reduced forms, idioms and competing viewpoints', 'register-aware discourse markers'],
    ['regional variation, irony and implicit meaning', 'fast connected speech'],
    ['stylistic shifts and culturally dense references', 'rapid, idiomatic speech'],
  ];
  const features = tiers[Math.max(0, Math.min(tiers.length - 1, idx))];
  const expansion = score != null && score < 60 ? Math.max(0, idx - 1) : idx;
  return { level, expansion, features, directive: `Expand natural speech gradually: include ${features.join(' and ')}; keep the rest familiar.` };
}

/** Assistance fades with demonstrated success and returns when retention or confidence dips. */
export function assistanceFading({ level = 'B1', confidence = 0.5, successStreak = 0, retention = null } = {}) {
  const base = assistancePolicy(level, confidence);
  const boost = Math.min(0.2, Math.max(0, successStreak - 1) * 0.04) + (retention != null && retention >= 0.88 ? 0.05 : 0);
  const hold = retention != null && retention < 0.55 ? 0.12 : 0;
  const fade = round(clamp(base.fade + boost - hold));
  return {
    ...base,
    fade,
    captions: fade < 0.35 ? 'always' : fade < 0.7 ? 'after-first' : 'on-request',
    translation: fade < 0.5 ? 'inline' : fade < 0.8 ? 'tap' : 'off',
    starters: fade < 0.4 ? 3 : fade < 0.7 ? 1 : 0,
    simplifyPartner: fade < 0.45,
    correctionTiming: fade < 0.6 ? 'per-turn' : 'delayed',
  };
}

/** A durable, explicit correction preference that can still be overridden in a turn. */
export function correctionFrequencyPolicy({ level = 'B1', preference = 'adaptive', confidence = 0.5, successStreak = 0, retention = null } = {}) {
  const fade = assistanceFading({ level, confidence, successStreak, retention });
  const value = ['adaptive', 'every-turn', 'important', 'end', 'off'].includes(preference) ? preference : 'adaptive';
  const timing = value === 'adaptive' ? fade.correctionTiming : value === 'end' ? 'delayed' : value === 'off' ? 'off' : 'per-turn';
  const scope = value === 'every-turn' ? 'all' : value === 'important' || value === 'adaptive' ? 'significant' : 'none';
  return {
    preference: value,
    timing,
    scope,
    label: value === 'every-turn' ? 'Every error' : value === 'important' ? 'Important errors' : value === 'end' ? 'At session end' : value === 'off' ? 'Off' : timing === 'per-turn' ? 'Adaptive, turn by turn' : 'Adaptive, delayed',
    directive: timing === 'off'
      ? 'Do not show corrections during this session; keep scoring internally.'
      : timing === 'delayed'
        ? 'Do not interrupt the conversation. Store corrections for the end-of-session review.'
        : scope === 'all'
          ? 'Flag every real error, including small naturalness slips, briefly.'
          : 'Flag only significant errors that a patient native would notice or that block meaning.',
  };
}

const RECYCLE_DAYS = [1, 3, 7, 14, 30];

/** Schedule errors after a delay so recycling tests recall rather than recognition. */
export function delayedErrorRecycling(errors = [], { now = Date.now(), limit = 8 } = {}) {
  const rows = (errors || []).filter((entry) => entry && entry.status !== 'resolved' && entry.lastErrorAt).map((entry) => {
    const successes = Number(entry.successCount) || 0;
    const delayDays = RECYCLE_DAYS[Math.min(RECYCLE_DAYS.length - 1, successes)];
    const nextReviewAt = entry.nextReviewAt || new Date(new Date(entry.lastErrorAt).getTime() + delayDays * DAY).toISOString();
    return { ...entry, delayDays, nextReviewAt, due: new Date(nextReviewAt).getTime() <= now };
  });
  const sort = (a, b) => Number(b.due) - Number(a.due) || (Number(b.priority) || 0) - (Number(a.priority) || 0) || new Date(a.nextReviewAt) - new Date(b.nextReviewAt);
  const due = rows.filter((row) => row.due).sort(sort).slice(0, limit);
  const upcoming = rows.filter((row) => !row.due).sort((a, b) => new Date(a.nextReviewAt) - new Date(b.nextReviewAt)).slice(0, limit);
  return { due, upcoming, total: rows.length, dueCount: due.length };
}

/** Compare predicted retention with the next observed outcome, with a sample floor. */
export function retentionCalibration(srs = {}, { minSamples = MIN_SAMPLES, bins = 5 } = {}) {
  const samples = samplesFrom(srs);
  if (samples.length < minSamples) return { ready: false, n: samples.length, needed: minSamples - samples.length, curve: [] };
  const predicted = samples.reduce((sum, sample) => sum + sample.predicted, 0) / samples.length;
  const actual = samples.reduce((sum, sample) => sum + sample.recalled, 0) / samples.length;
  return {
    ready: true,
    n: samples.length,
    predicted: round(predicted),
    actual: round(actual),
    bias: round(actual - predicted),
    curve: calibration(samples, bins),
  };
}

/** Build one inspectable plan for a conversation or listening session. */
export function buildLearningPlan({
  level = 'B1', entries = [], srs = {}, sessions = [], metrics = [], reviewEvents = [], grammarTopics = [], grammarProgress = {}, errorModel = [], correctionFrequency = 'adaptive', confidence = 0.5, userRate = 1, userText = '', now = Date.now(),
} = {}) {
  const recent = (sessions || []).slice(-6).map((session) => Number(session?.report?.average_scores?.overall)).filter(Number.isFinite);
  const average = recent.length ? Math.round(recent.reduce((sum, score) => sum + score, 0) / recent.length) : null;
  const successStreak = recent.slice().reverse().findIndex((score) => score < 80);
  const streak = recent.length ? (successStreak < 0 ? recent.length : successStreak) : 0;
  const input = selectComprehensibleInput({ entries, srs, level, now });
  const progression = conversationDifficultyProgression({ level, sessions, errorModel });
  const listening = listeningDifficultyLadder({ level, srs, entries, metrics, reviewEvents });
  const correction = correctionFrequencyPolicy({ level, preference: correctionFrequency, confidence, successStreak: streak, retention: null });
  const assistance = assistanceFading({ level, confidence, successStreak: streak });
  const naturalSpeech = naturalSpeechExpansion(level, { score: average });
  const speech = speechRateAdaptation({ level, score: average, userRate });
  const grammar = grammarNoveltyEstimate({ topics: grammarTopics, grammarProgress, errorModel });
  const recycling = delayedErrorRecycling(errorModel, { now });
  const retention = retentionCalibration(srs);
  const sentenceComplexity = sentenceComplexityEstimate(userText);
  return {
    input,
    grammar,
    listening,
    naturalSpeech,
    speech,
    assistance,
    correction,
    progression,
    recycling,
    retention,
    sentenceComplexity,
    sentenceTarget: { band: progression.targetLevel, maxWords: profileFor(progression.targetLevel).turnWords[1] },
  };
}

/** Session score trend drives a small, bounded conversation step. */
export function conversationDifficultyProgression({ level = 'B1', sessions = [], errorModel = [] } = {}) {
  const scores = (sessions || []).slice(-6).map((session) => Number(session?.report?.average_scores?.overall)).filter(Number.isFinite);
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const activeErrors = (errorModel || []).filter((entry) => entry.status === 'active').length;
  const strong = scores.length >= 2 && scores.slice(-2).every((score) => score >= 86);
  const struggling = scores.length >= 2 && scores.slice(-2).every((score) => score < 58);
  const delta = strong && activeErrors < 4 ? 1 : struggling ? -1 : 0;
  const index = Math.max(0, Math.min(ALL_LEVELS.length - 1, levelIndex(level) + delta));
  const targetLevel = ALL_LEVELS[index] || level;
  return {
    baseLevel: level,
    targetLevel,
    delta,
    average,
    sampleSize: scores.length,
    activeErrors,
    reason: strong ? 'recent success supports a harder conversation' : struggling ? 'recent difficulty calls for more support' : 'hold the current challenge while evidence accumulates',
    lengthScale: delta > 0 ? 1.12 : delta < 0 ? 0.85 : 1,
  };
}
