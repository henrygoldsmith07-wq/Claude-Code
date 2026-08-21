// CEFR content calibration audit.
//
// Every reading text, listening track and practice task carries an authoring
// CEFR label — but a label is not evidence. This module audits content by
// vocabulary frequency, sentence complexity, grammar footprint, topic
// abstraction, idiomaticity, speech rate and support level, and adds review/
// provenance states so the coverage report is auditable.
//
// Pure, offline, deterministic. The UI surfaces the audit so a thin level
// shows up as thin.

import { profileFor, LEVELS } from './cefr.js';
import { sentenceComplexityEstimate } from './learningAdaptation.js';

// ---- Vocabulary frequency: reuse frequency band if available ----

function freqBandFor(text) {
  // Heuristic: count words outside top-1000 proxy — we approximate by word length
  // and absence from a small common-word set. Real frequency uses the vocab
  // library; this is a fallback for ad-hoc strings.
  const COMMON = new Set(['le', 'la', 'de', 'et', 'à', 'un', 'une', 'est', 'il', 'elle', 'que', 'qui', 'dans', 'pour', 'pas', 'vous', 'nous', 'je', 'tu', 'on', 'mais', 'avec', 'plus', 'par', 'sur', 'au', 'ce', 'se', 'son', 'sa', 'ne', 'comme', 'tout', 'faire', 'être', 'avoir', 'une', 'des']);
  const words = String(text || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (!words.length) return { band: 1, rareRatio: 0 };
  let rare = 0;
  for (const w of words) if (!COMMON.has(w) && w.length > 5) rare += 1;
  const rareRatio = rare / words.length;
  const band = rareRatio < 0.15 ? 1 : rareRatio < 0.3 ? 2 : rareRatio < 0.45 ? 3 : 4;
  return { band, rareRatio: Math.round(rareRatio * 100) / 100 };
}

// Topic abstraction tiers: concrete -> abstract
const TOPIC_ABSTRACTION = {
  // A1
  greetings: 1, self: 1, family: 1, numbers: 1, 'food-basic': 1, colours: 1, classroom: 1, 'home-basic': 1, 'time-basic': 1,
  // A2
  shopping: 1, travel: 2, directions: 1, weather: 1, 'health-basic': 1, 'daily-routine': 1, clothes: 1, hobbies: 1, 'past-events': 2,
  // B1
  work: 2, education: 2, media: 2, environment: 2, technology: 2, relationships: 2, opinions: 3, 'town-life': 2, health: 2,
  // B2
  politics: 3, economy: 3, science: 3, 'culture-arts': 3, 'social-issues': 3, argument: 4, 'abstract-qualities': 4, 'work-advanced': 3,
  // C1
  academic: 4, 'legal-admin': 4, 'nuance-register': 4, 'idiom-advanced': 4, literary: 4, rhetoric: 4, specialist: 4,
};

const IDIOM_MARKERS = ['mine de rien', 'en dépit de', 'au fur', 'quoi qu', 'il faut que', 'bien que', 'avoir beau', 'force est de'];

function idiomaticityScore(text) {
  const lower = String(text || '').toLowerCase();
  let hits = 0;
  for (const m of IDIOM_MARKERS) if (lower.includes(m)) hits += 1;
  return { hits, score: Math.min(1, hits / 3) };
}

// Provenance / review states for each content item
export const PROVENANCE = {
  authored: 'authored',          // hand-written, editor-approved
  llm_draft: 'llm-draft',        // LLM-generated, awaiting review
  reviewed: 'reviewed',          // LLM draft reviewed by editor
  verified: 'verified',          // double-checked (e.g., exam board mapping)
};

export const REVIEW_STATE = {
  pending: 'pending',
  approved: 'approved',
  needs_revision: 'needs-revision',
  rejected: 'rejected',
};

/**
 * Audit a single text-like item.
 * item = { id, cefr, title?, text?:string, paragraphs?:[{fr}], lines?:[{fr}], topic?, speechRate?, support? }
 */
export function auditContentItem(item = {}) {
  const text = item.text
    || (Array.isArray(item.paragraphs) ? item.paragraphs.map((p) => p.fr).join(' ') : '')
    || (Array.isArray(item.lines) ? item.lines.map((l) => l.fr).join(' ') : '')
    || String(item.title || '');
  const complexity = sentenceComplexityEstimate(text);
  const freq = freqBandFor(text);
  const idiom = idiomaticityScore(text);
  const abstraction = TOPIC_ABSTRACTION[item.topic] ?? (item.cefr === 'A1' ? 1 : item.cefr === 'A2' ? 1 : item.cefr === 'B1' ? 2 : item.cefr === 'B2' ? 3 : 4);
  const expected = profileFor(item.cefr || 'B1');
  const speechRate = Number.isFinite(Number(item.speechRate)) ? Number(item.speechRate) : expected.speechRate ?? 1;
  const speechDrift = Math.abs(speechRate - (expected.speechRate ?? 1));
  const support = item.support || 'none'; // none | gloss | translation | captions

  // Determine if complexity aligns with CEFR
  const levelOrder = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };
  const itemLevel = levelOrder[item.cefr] ?? 2;
  const complexityLevel = levelOrder[complexity.band] ?? 2;
  const levelDelta = complexityLevel - itemLevel;
  const aligned = Math.abs(levelDelta) <= 1;

  return {
    id: String(item.id || ''),
    cefr: item.cefr || 'B1',
    provenance: item.provenance || PROVENANCE.authored,
    reviewState: item.reviewState || REVIEW_STATE.pending,
    metrics: {
      complexity: { score: complexity.score, band: complexity.band, wordCount: complexity.wordCount, clauseCount: complexity.clauseCount },
      freqBand: freq.band,
      rareRatio: freq.rareRatio,
      idiomaticity: idiom.score,
      idiomHits: idiom.hits,
      abstraction,
      speechRate,
      speechRateDelta: Math.round(speechDrift * 100) / 100,
      support,
    },
    // Heuristic overall flag
    flags: [
      !aligned ? `complexity ${complexity.band} vs label ${item.cefr}` : null,
      freq.band >= 4 && item.cefr === 'A1' ? 'vocab too rare for A1' : null,
      speechDrift > 0.25 ? `speech rate ${speechRate} drifts from ${expected.speechRate}` : null,
      idiom.score > 0.5 && ['A1', 'A2'].includes(item.cefr) ? 'idiomaticity too high for level' : null,
    ].filter(Boolean),
    aligned,
    textLength: text.length,
  };
}

/**
 * Run audit over a library array.
 */
export function auditLibrary(items = []) {
  const audits = (Array.isArray(items) ? items : []).map(auditContentItem);
  const byLevel = {};
  for (const a of audits) {
    const b = (byLevel[a.cefr] ||= { total: 0, aligned: 0, flags: 0, pending: 0, approved: 0 });
    b.total += 1;
    if (a.aligned) b.aligned += 1;
    if (a.flags.length) b.flags += 1;
    if (a.reviewState === REVIEW_STATE.pending) b.pending += 1;
    if (a.reviewState === REVIEW_STATE.approved) b.approved += 1;
  }
  const overallAligned = audits.length ? audits.filter((a) => a.aligned).length / audits.length : null;
  return {
    n: audits.length,
    byLevel,
    overallAligned: overallAligned == null ? null : Math.round(overallAligned * 100) / 100,
    flagged: audits.filter((a) => a.flags.length),
    pendingReview: audits.filter((a) => a.reviewState === REVIEW_STATE.pending).length,
    audits,
  };
}

/**
 * Coverage vs CEFR ladder: how many items per level and whether alignment holds.
 */
export function calibrationSummary({ readingTexts = [], listeningTracks = [], vocabPacks = [], grammarTopics = [] } = {}) {
  const reading = auditLibrary(readingTexts);
  const listening = auditLibrary(listeningTracks);
  // Vocab packs & grammar topics are counted, not audited for text complexity
  const byLevel = {};
  for (const l of LEVELS) {
    byLevel[l] = {
      reading: reading.byLevel[l]?.total || 0,
      listening: listening.byLevel[l]?.total || 0,
      readingAligned: reading.byLevel[l] ? Math.round((reading.byLevel[l].aligned / reading.byLevel[l].total) * 100) / 100 : null,
      listeningAligned: listening.byLevel[l] ? Math.round((listening.byLevel[l].aligned / listening.byLevel[l].total) * 100) / 100 : null,
    };
  }
  return {
    reading: { n: reading.n, overallAligned: reading.overallAligned, flagged: reading.flagged.length, pendingReview: reading.pendingReview },
    listening: { n: listening.n, overallAligned: listening.overallAligned, flagged: listening.flagged.length, pendingReview: listening.pendingReview },
    vocabPacks: vocabPacks.length || 0,
    grammarTopics: grammarTopics.length || 0,
    byLevel,
    message: reading.flagged.length || listening.flagged.length
      ? `${reading.flagged.length + listening.flagged.length} items flagged for level-complexity drift; review pending on ${reading.pendingReview + listening.pendingReview}.`
      : 'No drift flagged in current library.',
  };
}
