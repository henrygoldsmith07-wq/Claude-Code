// The conversation layer: memory, steering, fading scaffolds and recycling.
//
// A conversation partner that forgets you between sessions is a demo, not a
// tutor. Four things live here:
//
//   memory     — durable facts about the learner and what has been discussed,
//                so session twelve can open with "how did the interview go?"
//   steering   — the learner's own directives ("slower", "be stricter",
//                "talk about cycling"), parsed and folded into the prompt
//   assistance — the fade curve from cefr.js applied to a live conversation
//   recycling  — turning what went wrong into drills, and what was new into
//                vocabulary and grammar queues that come back later
//
// Storage is injectable so all of it is testable without a browser.

import { assistancePolicy, conversationTargets, profileFor } from './cefr.js';

const KEY = 'fp.conversationMemory';
const MAX_FACTS = 40;
const MAX_TOPICS = 30;

const memStore = new Map();

const defaultStorage = {
  get(k) {
    try {
      if (typeof localStorage === 'undefined') return memStore.get(k) ?? null;
      return localStorage.getItem(k);
    } catch { return memStore.get(k) ?? null; }
  },
  set(k, v) {
    try {
      if (typeof localStorage === 'undefined') { memStore.set(k, v); return; }
      localStorage.setItem(k, v);
    } catch { memStore.set(k, v); }
  },
};

const EMPTY = { facts: [], topics: [], threads: [], recycle: { vocab: [], grammar: [], corrections: [] }, updatedAt: null };

export function getMemory(storage = defaultStorage) {
  try {
    const raw = storage.get(KEY);
    if (!raw) return { ...EMPTY, recycle: { vocab: [], grammar: [], corrections: [] } };
    const parsed = JSON.parse(raw);
    return {
      ...EMPTY,
      ...parsed,
      recycle: { vocab: [], grammar: [], corrections: [], ...(parsed.recycle || {}) },
    };
  } catch {
    return { ...EMPTY, recycle: { vocab: [], grammar: [], corrections: [] } };
  }
}

export function saveMemory(memory, storage = defaultStorage) {
  const next = { ...memory, updatedAt: new Date().toISOString() };
  storage.set(KEY, JSON.stringify(next));
  return next;
}

export function clearMemory(storage = defaultStorage) {
  storage.set(KEY, JSON.stringify({ ...EMPTY, recycle: { vocab: [], grammar: [], corrections: [] } }));
}

// ---------------------------------------------------------------- facts -----

/**
 * A fact is `{ key, value, at, confidence }`. Keys are namespaced so a new
 * value for `job` replaces the old one instead of accumulating contradictions
 * — people change jobs, and a partner that says "you're a nurse, right?" two
 * months after you retrained is worse than one that never asked.
 */
export function rememberFact(memory, key, value, { confidence = 0.8, at = new Date().toISOString() } = {}) {
  if (!key || !value) return memory;
  const facts = memory.facts.filter((f) => f.key !== key);
  facts.push({ key: String(key), value: String(value).slice(0, 160), at, confidence });
  // Keep the most recent, but never drop identity facts to make room.
  const pinned = facts.filter((f) => PINNED_KEYS.has(f.key));
  const rest = facts.filter((f) => !PINNED_KEYS.has(f.key)).sort((a, b) => (a.at < b.at ? 1 : -1));
  return { ...memory, facts: [...pinned, ...rest.slice(0, MAX_FACTS - pinned.length)] };
}

const PINNED_KEYS = new Set(['name', 'city', 'job', 'goal', 'level']);

export const getFact = (memory, key) => memory.facts.find((f) => f.key === key)?.value || null;

export function forgetFact(memory, key) {
  return { ...memory, facts: memory.facts.filter((f) => f.key !== key) };
}

/** Record that a topic was covered, so the partner can vary and call back. */
export function noteTopic(memory, topic, { at = new Date().toISOString(), scenarioId = null } = {}) {
  if (!topic) return memory;
  const topics = memory.topics.filter((t) => t.topic !== topic);
  topics.unshift({ topic: String(topic).slice(0, 80), at, scenarioId, times: (memory.topics.find((t) => t.topic === topic)?.times || 0) + 1 });
  return { ...memory, topics: topics.slice(0, MAX_TOPICS) };
}

/**
 * An open thread is something worth following up: an exam next week, a trip
 * being planned. `due` is when it becomes worth asking about.
 */
export function openThread(memory, { id, summary, due = null }) {
  if (!summary) return memory;
  const threads = memory.threads.filter((t) => t.id !== id);
  threads.push({ id: id || `t${threads.length + 1}`, summary: String(summary).slice(0, 160), due, openedAt: new Date().toISOString() });
  return { ...memory, threads: threads.slice(-12) };
}

export function closeThread(memory, id) {
  return { ...memory, threads: memory.threads.filter((t) => t.id !== id) };
}

/** Threads worth raising now. */
export function dueThreads(memory, now = Date.now()) {
  return memory.threads.filter((t) => !t.due || new Date(t.due).getTime() <= now);
}

/**
 * The prompt fragment. Deliberately short — the whole memory is not worth the
 * tokens, and a partner that recites your file is unsettling rather than
 * warm. Identity facts, the last few topics (so it can avoid repeating), and
 * any thread that is due.
 */
export function memoryBrief(memory, { maxFacts = 8 } = {}) {
  const facts = [
    ...memory.facts.filter((f) => PINNED_KEYS.has(f.key)),
    ...memory.facts.filter((f) => !PINNED_KEYS.has(f.key)).slice(0, maxFacts),
  ].slice(0, maxFacts + PINNED_KEYS.size);

  const lines = [];
  if (facts.length) {
    lines.push(`What you know about them: ${facts.map((f) => `${f.key}: ${f.value}`).join('; ')}.`);
  }
  const recent = memory.topics.slice(0, 5).map((t) => t.topic);
  if (recent.length) {
    lines.push(`Already discussed recently (vary from these): ${recent.join(', ')}.`);
  }
  const due = dueThreads(memory);
  if (due.length) {
    lines.push(`Worth following up naturally: ${due.map((t) => t.summary).join('; ')}.`);
  }
  return lines.join(' ');
}

// -------------------------------------------------------------- steering ----

/**
 * Learner-issued directives. Parsed from plain typed text so the learner can
 * steer mid-conversation without hunting for a settings panel — "parle plus
 * lentement", "be stricter", "let's talk about cycling".
 *
 * Returns null when the text is just conversation, which is the common case;
 * the caller only diverts when something is returned.
 */
const STEER_PATTERNS = [
  { id: 'slower', re: /\b(slower|plus lentement|moins vite|ralenti[sr]?)\b/i, patch: { paceDelta: -0.15 } },
  { id: 'faster', re: /\b(faster|plus vite|accélère|speed up)\b/i, patch: { paceDelta: +0.15 } },
  { id: 'stricter', re: /\b(stricter|plus strict|corrige tout|correct everything|be harsh)\b/i, patch: { strictness: 'high' } },
  { id: 'gentler', re: /\b(gentler|moins strict|less strict|stop correcting|ne corrige pas)\b/i, patch: { strictness: 'low' } },
  { id: 'simpler', re: /\b(simpler|plus simple|easier|plus facile)\b/i, patch: { complexityDelta: -1 } },
  { id: 'harder', re: /\b(harder|plus difficile|challenge me|plus dur)\b/i, patch: { complexityDelta: +1 } },
  { id: 'formal', re: /\b(vouvoie|formal|vouvoyer|plus formel)\b/i, patch: { register: 'vous' } },
  { id: 'informal', re: /\b(tutoie|informal|tutoyer|on se tutoie)\b/i, patch: { register: 'tu' } },
  { id: 'english-off', re: /\b(no english|pas d'anglais|only french|en français seulement)\b/i, patch: { translations: 'off' } },
  { id: 'english-on', re: /\b(show english|traduis|translations? on|en anglais)\b/i, patch: { translations: 'inline' } },
  { id: 'longer', re: /\b(longer|plus long|develop|développe)\b/i, patch: { lengthDelta: +0.3 } },
  { id: 'shorter', re: /\b(shorter|plus court|be brief|sois bref)\b/i, patch: { lengthDelta: -0.3 } },
];

const TOPIC_RE = /\b(?:let'?s talk about|talk about|parlons de|parle-moi de|on parle de|change (?:the )?(?:subject|topic) to|switch to)\s+(.{2,60})/i;

export function parseSteer(text) {
  if (!text || typeof text !== 'string') return null;
  const patches = [];
  const ids = [];
  for (const p of STEER_PATTERNS) {
    if (p.re.test(text)) { patches.push(p.patch); ids.push(p.id); }
  }
  const topicMatch = text.match(TOPIC_RE);
  const topic = topicMatch ? topicMatch[1].replace(/[.!?].*$/, '').trim() : null;
  if (!patches.length && !topic) return null;
  return { ids, topic, patch: Object.assign({}, ...patches) };
}

/** Default steer for a level, before the learner touches anything. */
export function defaultSteer(level) {
  const targets = conversationTargets(level);
  return {
    pace: targets.partnerRate,
    strictness: 'normal',
    complexity: level,
    register: 'vous',
    translations: null, // null = follow the assistance policy
    topic: null,
    lengthScale: 1,
  };
}

/** Apply a parsed steer on top of the current one. Pure. */
export function applySteer(steer, parsed) {
  if (!parsed) return steer;
  const p = parsed.patch || {};
  const next = { ...steer };
  if (p.paceDelta) next.pace = Math.max(0.6, Math.min(1.4, next.pace + p.paceDelta));
  if (p.strictness) next.strictness = p.strictness;
  if (p.register) next.register = p.register;
  if (p.translations) next.translations = p.translations === 'off' ? 'off' : 'inline';
  if (p.lengthDelta) next.lengthScale = Math.max(0.5, Math.min(2, next.lengthScale + p.lengthDelta));
  if (p.complexityDelta) {
    const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const i = order.indexOf(next.complexity);
    next.complexity = order[Math.max(0, Math.min(order.length - 1, i + p.complexityDelta))];
  }
  if (parsed.topic) next.topic = parsed.topic;
  return next;
}

/** One line of plain English confirming what the steer did, for the UI. */
export function describeSteer(parsed) {
  if (!parsed) return null;
  const said = [];
  if (parsed.ids.includes('slower')) said.push('speaking slower');
  if (parsed.ids.includes('faster')) said.push('speeding up');
  if (parsed.ids.includes('stricter')) said.push('correcting everything');
  if (parsed.ids.includes('gentler')) said.push('easing off corrections');
  if (parsed.ids.includes('simpler')) said.push('simplifying');
  if (parsed.ids.includes('harder')) said.push('pushing harder');
  if (parsed.ids.includes('formal')) said.push('switching to vous');
  if (parsed.ids.includes('informal')) said.push('switching to tu');
  if (parsed.ids.includes('english-off')) said.push('dropping the English');
  if (parsed.ids.includes('english-on')) said.push('showing translations');
  if (parsed.topic) said.push(`moving to “${parsed.topic}”`);
  return said.length ? said.join(', ') : null;
}

// ------------------------------------------------------------ assistance ----

/**
 * The live scaffolding settings for a conversation: how much English, how many
 * starters, whether captions show. `assistancePolicy` owns the curve; this
 * lets an explicit steer override it, because a learner who asked for no
 * English should get no English regardless of their level.
 */
export function scaffolding(level, confidence, steer = null) {
  const policy = assistancePolicy(level, confidence);
  if (!steer) return policy;
  const out = { ...policy };
  if (steer.translations === 'off') { out.translation = 'off'; out.captions = 'off'; }
  if (steer.translations === 'inline') { out.translation = 'inline'; out.captions = 'always'; }
  if (steer.strictness === 'high') out.correctionTiming = 'per-turn';
  if (steer.strictness === 'low') out.correctionTiming = 'end-of-session';
  return out;
}

/**
 * The system-prompt fragment describing how the partner should behave. This is
 * where level, steer, memory and fade all become one instruction — keeping it
 * in one function is what stops the four drifting apart.
 */
export function partnerDirective({ level = 'B1', confidence = 0.5, steer = null, memory = null } = {}) {
  const s = steer || defaultSteer(level);
  const scaffold = scaffolding(level, confidence, s);
  const targets = conversationTargets(s.complexity || level);
  const p = profileFor(s.complexity || level);

  const parts = [
    `Speak French at CEFR ${s.complexity || level}. Aim for replies of ${Math.round(targets.minWords * s.lengthScale)}–${Math.round(targets.maxWords * s.lengthScale)} words.`,
    s.register === 'tu' ? 'Address the learner as «tu».' : 'Address the learner as «vous».',
    scaffold.simplifyPartner
      ? 'Keep sentences short, use high-frequency words, and rephrase rather than repeat when they do not understand.'
      : 'Use natural, unsimplified French, including idiom and elision where a native would.',
    scaffold.translation === 'inline'
      ? 'Add a short English gloss in brackets after each French sentence.'
      : scaffold.translation === 'tap'
        ? 'Do not translate unless asked.'
        : 'Never translate into English.',
    scaffold.correctionTiming === 'per-turn'
      ? 'Correct significant errors every turn, briefly, before continuing.'
      : 'Do not interrupt to correct; collect errors for the end-of-session report.',
    s.strictness === 'high'
      ? 'Flag every error including minor ones.'
      : s.strictness === 'low'
        ? 'Only flag errors that block understanding.'
        : 'Flag errors that a patient native would notice, not every slip.',
    `Sustain the conversation for at least ${targets.turns} exchanges: ask follow-up questions, take positions, and do not close it down early.`,
    p.phonemeFocus?.length ? `If pronunciation comes up, their level's focus sounds are: ${p.phonemeFocus.join(', ')}.` : '',
    s.topic ? `The learner has asked to talk about: ${s.topic}. Follow their lead.` : 'Follow the learner\'s lead on subject matter; if they steer, go with them.',
  ].filter(Boolean);

  const brief = memory ? memoryBrief(memory) : '';
  if (brief) parts.push(brief);

  return parts.join(' ');
}

// -------------------------------------------------------------- recycling ---

/**
 * Every correction becomes a drill. This is the piece that turns a
 * conversation from a performance into practice: the mistake is captured with
 * the sentence it happened in, and comes back as a retry the learner has to
 * get right, not merely read.
 */
export function correctionToDrill(correction, { at = new Date().toISOString() } = {}) {
  if (!correction || !correction.wrong || !correction.right) return null;
  return {
    id: `drill-${hash(`${correction.wrong}|${correction.right}`)}`,
    kind: 'correction-retry',
    prompt: correction.context || `Say this correctly: “${correction.wrong}”`,
    wrong: correction.wrong,
    right: correction.right,
    why: correction.why || '',
    topicId: correction.topicId || null,
    at,
    // Retries required before it leaves the queue — one correct repetition is
    // recognition, not repair.
    needed: 2,
    passed: 0,
  };
}

/** Add correction drills to the recycle queue, deduped by id. */
export function queueCorrections(memory, corrections = []) {
  const drills = corrections.map((c) => correctionToDrill(c)).filter(Boolean);
  const existing = new Map(memory.recycle.corrections.map((d) => [d.id, d]));
  for (const d of drills) if (!existing.has(d.id)) existing.set(d.id, d);
  return { ...memory, recycle: { ...memory.recycle, corrections: [...existing.values()].slice(-60) } };
}

/** Mark a retry outcome; a drill that passes `needed` times is retired. */
export function recordRetry(memory, drillId, passed) {
  const corrections = memory.recycle.corrections
    .map((d) => {
      if (d.id !== drillId) return d;
      return { ...d, passed: passed ? d.passed + 1 : 0, lastAt: new Date().toISOString() };
    })
    .filter((d) => d.passed < d.needed);
  return { ...memory, recycle: { ...memory.recycle, corrections } };
}

/** Drills still owed, hardest-first (most failures). */
export function dueDrills(memory, limit = 5) {
  return memory.recycle.corrections
    .slice()
    .sort((a, b) => a.passed - b.passed)
    .slice(0, limit);
}

/**
 * Words the partner used that the learner has not met go into a recycling
 * queue, so the next conversation can deliberately reuse them. Spacing is the
 * point: a word met once in a chat and never again is a word lost.
 */
export function queueVocab(memory, words = [], knownIds = new Set()) {
  const known = knownIds instanceof Set ? knownIds : new Set(knownIds);
  const seen = new Set(memory.recycle.vocab.map((v) => v.fr));
  const additions = words
    .filter((wd) => wd && wd.fr && !known.has(wd.id) && !seen.has(wd.fr))
    .map((wd) => ({ fr: wd.fr, en: wd.en || '', id: wd.id || null, at: new Date().toISOString(), uses: 0 }));
  return { ...memory, recycle: { ...memory.recycle, vocab: [...memory.recycle.vocab, ...additions].slice(-80) } };
}

/** Words to push into the next conversation — least-used first. */
export function vocabToRecycle(memory, limit = 6) {
  return memory.recycle.vocab
    .slice()
    .sort((a, b) => a.uses - b.uses || (a.at < b.at ? -1 : 1))
    .slice(0, limit);
}

/** Mark recycled words as used once the partner has worked them in. */
export function markVocabUsed(memory, frs = []) {
  const set = new Set(frs);
  const vocab = memory.recycle.vocab
    .map((v) => (set.has(v.fr) ? { ...v, uses: v.uses + 1 } : v))
    // Three natural re-encounters is enough; after that it belongs to the SRS.
    .filter((v) => v.uses < 3);
  return { ...memory, recycle: { ...memory.recycle, vocab } };
}

/** Grammar points that went wrong, queued to be re-elicited deliberately. */
export function queueGrammar(memory, topicIds = []) {
  const counts = new Map(memory.recycle.grammar.map((g) => [g.topicId, g]));
  for (const id of topicIds) {
    if (!id) continue;
    const cur = counts.get(id);
    counts.set(id, { topicId: id, misses: (cur?.misses || 0) + 1, at: new Date().toISOString(), elicited: cur?.elicited || 0 });
  }
  return { ...memory, recycle: { ...memory.recycle, grammar: [...counts.values()].slice(-40) } };
}

/** The grammar points the next conversation should try to force out. */
export function grammarToRecycle(memory, limit = 3) {
  return memory.recycle.grammar
    .slice()
    .sort((a, b) => b.misses - a.misses || a.elicited - b.elicited)
    .slice(0, limit);
}

export function markGrammarElicited(memory, topicIds = []) {
  const set = new Set(topicIds);
  const grammar = memory.recycle.grammar
    .map((g) => (set.has(g.topicId) ? { ...g, elicited: g.elicited + 1 } : g))
    .filter((g) => g.elicited < 3 || g.misses > g.elicited);
  return { ...memory, recycle: { ...memory.recycle, grammar } };
}

/**
 * The recycling instruction appended to the partner's prompt: reuse these
 * words, and steer toward contexts that force these structures.
 */
export function recyclingDirective(memory, { vocabLimit = 5, grammarLimit = 2 } = {}) {
  const words = vocabToRecycle(memory, vocabLimit);
  const grammar = grammarToRecycle(memory, grammarLimit);
  const parts = [];
  if (words.length) {
    parts.push(`Work these words back into the conversation naturally: ${words.map((v) => v.fr).join(', ')}.`);
  }
  if (grammar.length) {
    parts.push(`Steer toward questions that make the learner produce: ${grammar.map((g) => g.topicId).join(', ')}.`);
  }
  return parts.join(' ');
}

/**
 * End-of-conversation housekeeping in one call: note the topic, queue the
 * corrections, queue new words and failed grammar, and mark what got used.
 */
export function absorbSession(memory, {
  topic = null,
  scenarioId = null,
  corrections = [],
  newWords = [],
  knownIds = new Set(),
  grammarMisses = [],
  vocabUsed = [],
  grammarElicited = [],
} = {}) {
  let next = memory;
  if (topic) next = noteTopic(next, topic, { scenarioId });
  next = queueCorrections(next, corrections);
  next = queueVocab(next, newWords, knownIds);
  next = queueGrammar(next, grammarMisses);
  next = markVocabUsed(next, vocabUsed);
  next = markGrammarElicited(next, grammarElicited);
  return next;
}

// Small stable hash for drill ids — not cryptographic, just deterministic.
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
