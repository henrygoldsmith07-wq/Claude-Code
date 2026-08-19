// Groq API client — pure fetch, no SDK. Every call reports latency + token
// usage to an optional telemetry sink so the Dev Panel can display metrics.

import {
  mockTurn, mockReport, mockHint, mockSentenceCheck, mockAccentFeedback,
  mockWritingFeedback, mockCompletion, mockTutorReply, mockTranslation,
  mockExercises, mockLesson, mockExplanation, mockCharacterReply, mockStory,
  mockSnapVocab,
} from './mocks.js';

import { getLanguage, DEFAULT_LANG } from './languages.js';
import { consume, getRemaining } from './quota.js';
import { relayEnabled } from './relay.js';

const BASE = 'https://api.groq.com/openai/v1';
const CHAT_MODEL = 'llama-3.1-8b-instant';
const WHISPER_MODEL = 'whisper-large-v3-turbo';
// Multimodal model for Snap & learn — accepts an image alongside the prompt.
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Quota guard — mirrors the server relay's daily cap on the client. When a
// relay is configured the server is authoritative; this keeps the UX honest
// offline and avoids burning the key on accidental loops.
function assertQuota(label) {
  const res = consume(1, label);
  if (!res.ok) {
    throw new Error(`Daily AI quota reached (${res.quota.limit} calls). Try again tomorrow — or wire VITE_GROQ_RELAY_URL for shared quotas.`);
  }
}

export function quotaStatus() {
  return { relay: relayEnabled, remaining: getRemaining() };
}

// Active target language — set once from settings so every prompt below teaches
// the right language (French / German / Spanish) without threading it through
// each call site.
let LANG = getLanguage(DEFAULT_LANG);
export const setLanguage = (id) => { LANG = getLanguage(id); };

let telemetrySink = null;
export const setTelemetrySink = (fn) => { telemetrySink = fn; };

function report(entry) {
  if (telemetrySink) telemetrySink({ time: new Date().toISOString(), ...entry });
}

// Transient statuses worth retrying: rate limits and server hiccups.
const RETRYABLE = new Set([429, 500, 502, 503]);
const RETRY_DELAYS_MS = [600, 1800];
const REQUEST_TIMEOUT_MS = 45000;

// Turn a raw thrown error into calm, human, actionable copy for the UI. The
// raw message (with status codes, stack, etc.) still goes to telemetry via
// report(); this is only what the learner reads.
export function friendlyError(err) {
  const msg = String(err?.message ?? err ?? '');
  const status = (msg.match(/\((\d{3})\)/) || [])[1];
  if (/timed out/i.test(msg)) return 'That took too long to come back. Check your connection and try again.';
  if (/failed to fetch|networkerror|network error|load failed/i.test(msg)) return 'Couldn’t reach the tutor — you may be offline. Check your connection and try again.';
  if (status === '401' || status === '403' || /api key|unauthor/i.test(msg)) return 'Your Groq API key was rejected. Open Settings to check or re-enter it.';
  if (status === '429' || /rate limit/i.test(msg)) return 'Groq is busy right now. Wait a few seconds, then try again.';
  if (status && status[0] === '5') return 'Groq had a hiccup on their end. Give it a moment and try again.';
  if (/non-json|no usable|generation failed|tangled/i.test(msg)) return 'The tutor got its words tangled for a second. Try that again.';
  return 'Something went wrong reaching the tutor. Try again in a moment.';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function timedFetch(label, url, options, { rawBody } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const t0 = performance.now();
    let res;
    try {
      res = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (e) {
      const latency = Math.round(performance.now() - t0);
      lastError = e.name === 'TimeoutError'
        ? new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
        : e;
      report({ label, latency, status: 0, error: String(lastError.message), attempt });
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw lastError;
    }
    const latency = Math.round(performance.now() - t0);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      report({ label, latency, status: res.status, error: text.slice(0, 400), attempt });
      if (RETRYABLE.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
        // Honour Retry-After when Groq sends one, otherwise back off.
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(retryAfter > 0 && retryAfter <= 15 ? retryAfter * 1000 : RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(`${label} failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    report({
      label,
      latency,
      status: res.status,
      usage: data.usage || null,
      payload: rawBody || null,
      response: data,
      attempt,
    });
    return { data, latency };
  }
  throw lastError; // unreachable, but keeps the control flow explicit
}

// ---- key validation (lightweight models-list ping) ----

export async function validateKey(apiKey) {
  const { data, latency } = await timedFetch('validate-key', `${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return { ok: Array.isArray(data.data), latency };
}

export async function pingLatency(apiKey) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  await res.text();
  return Math.round(performance.now() - t0);
}

// ---- transcription (Whisper) ----

export async function transcribe(apiKey, blob, { mock } = {}) {
  if (mock) return mockTurn().transcript;
  assertQuota('whisper');
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', blob, `recording.${ext}`);
  form.append('model', WHISPER_MODEL);
  form.append('language', LANG.whisper);
  form.append('response_format', 'json');
  const { data } = await timedFetch('whisper', `${BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  }, { rawBody: `multipart: recording.${ext} (${Math.round(blob.size / 1024)} KB)` });
  return (data.text || '').trim();
}

// ---- strict-JSON chat helpers ----

function extractJson(content) {
  // Models occasionally wrap JSON in fences or prose; salvage the object.
  const direct = content.trim();
  try { return JSON.parse(direct); } catch { /* fall through */ }
  const match = direct.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('Model returned non-JSON content');
}

async function chatJson(apiKey, messages, { temperature = 0.7, label = 'chat' } = {}) {
  assertQuota(label);
  const body = {
    model: CHAT_MODEL,
    messages,
    temperature,
    response_format: { type: 'json_object' },
    max_tokens: 1024,
  };
  const { data } = await timedFetch(label, `${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, { rawBody: body });
  return extractJson(data.choices[0].message.content);
}

// JSON chat with an attached image (multimodal). Used by Snap & learn.
async function chatVisionJson(apiKey, { system, prompt, imageDataUrl, temperature = 0.3, label = 'vision' }) {
  assertQuota(label);
  const body = {
    model: VISION_MODEL,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    temperature,
    response_format: { type: 'json_object' },
    max_tokens: 1024,
  };
  const { data } = await timedFetch(label, `${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, { rawBody: body });
  return extractJson(data.choices[0].message.content);
}

// Plain-text chat (no JSON mode) — for the tutor and free-form explanations.
async function chatPlain(apiKey, messages, { temperature = 0.6, label = 'chat-plain', maxTokens = 700 } = {}) {
  assertQuota(label);
  const body = { model: CHAT_MODEL, messages, temperature, max_tokens: maxTokens };
  const { data } = await timedFetch(label, `${BASE}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, { rawBody: body });
  return data.choices[0].message.content.trim();
}

/// ---- AI tutor: ask anything about French ----

// Fold the locally-tracked learner profile into a single instruction line, so
// the tutor's answers are personal and context-aware. Never echoed verbatim.
function learnerLine(l) {
  if (!l) return '';
  const bits = [];
  if (l.name) bits.push(`their name is ${l.name}`);
  if (l.topics?.length) bits.push(`interests: ${l.topics.join(', ')}`);
  if (l.mistakes?.length) bits.push(`recurring mistakes to gently catch and reinforce: ${l.mistakes.join('; ')}`);
  if (l.weakGrammar?.length) bits.push(`weak grammar areas: ${l.weakGrammar.join(', ')}`);
  if (l.memory?.focusTopic) bits.push(`due retest: ${l.memory.focusTopic} (${l.memory.errorCount || 1} prior slip${(l.memory.errorCount||1)===1?'':'s'}, ${l.memory.status||'active'}) — deliberately create a natural opening for them to use it, then observe whether they do`);
  if (l.recyclingInstruction) bits.push(l.recyclingInstruction);
  return bits.length
    ? ` Learner profile — ${bits.join('; ')}. Tailor your examples to their interests and weak spots, and address them by name when it feels natural; never recite this profile back to them.`
    : '';
}

const TUTOR_SYSTEM = (level, learner) => `You are a warm, expert ${LANG.name} tutor. The learner is CEFR ${level}. Answer their questions about ${LANG.name} — grammar, vocabulary, usage, culture, learning strategy — in clear English with ${LANG.name} examples (each with a translation). Be concise: prefer 3-6 short paragraphs or a tight list. Use markdown sparingly (**bold** for ${LANG.name} forms). If they write to you in ${LANG.name}, gently correct any mistakes first, then answer. End with one short follow-up question or a suggestion of what to explore next, when it fits.${learnerLine(learner)}`;

export async function tutorChat(apiKey, { messages, level = 'B1', learner, mock }) {
  if (mock) return mockTutorReply(messages[messages.length - 1]?.content || '');
  return chatPlain(apiKey, [
    { role: 'system', content: TUTOR_SYSTEM(level, learner) },
    ...messages.slice(-12),
  ], { label: 'tutor-chat' });
}

// ---- in-character chat: talk to AI personalities in French ----

export async function characterChat(apiKey, { messages, persona, level = 'B1', learner, mock }) {
  if (mock) return mockCharacterReply();
  // Characters stay in role, so only light personalisation — name + interests,
  // never the grammar diagnostics that would break immersion.
  const known = [];
  if (learner?.name) known.push(`Their name is ${learner.name}`);
  if (learner?.topics?.length) known.push(`they enjoy talking about ${learner.topics.join(', ')}`);
  const knownLine = known.length ? ` You already know the learner: ${known.join('; ')} — weave that in naturally, in character.` : '';
  return chatPlain(apiKey, [
    {
      role: 'system',
      content: `${persona} The learner practising with you is CEFR ${level} in ${LANG.name}. Stay fully in character. Reply in ${LANG.name} only, 1-3 short sentences pitched at ${level}, then on a new line give an English translation in *italics*. Keep the conversation moving with a question when natural.${knownLine}`,
    },
    ...messages.slice(-12),
  ], { label: 'character-chat', temperature: 0.8, maxTokens: 400 });
}

// ---- instant translation (any text, both directions) ----

export async function translateText(apiKey, { text, direction, mock }) {
  if (mock) return mockTranslation(direction);
  const target = direction === 'en-fr' ? LANG.name : 'English';
  return chatPlain(apiKey, [
    { role: 'system', content: `Translate the user's text into natural ${target}. Reply with ONLY the translation, nothing else.` },
    { role: 'user', content: text },
  ], { label: 'translate-text', temperature: 0.2 });
}

// ---- generate practice exercises on any topic ----

function normalizeExercises(json) {
  const list = Array.isArray(json.exercises) ? json.exercises : [];
  return list
    .filter((e) => e && e.q && Array.isArray(e.options) && e.options.length >= 2)
    .slice(0, 4)
    .map((e) => ({
      q: String(e.q),
      options: e.options.slice(0, 3).map(String),
      answer: Math.min(Math.max(0, Number(e.answer) || 0), Math.min(2, e.options.length - 1)),
      why: String(e.why || ''),
    }));
}

export async function generateExercises(apiKey, { topic, level = 'B1', mock }) {
  if (mock) return mockExercises();
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `Create ${LANG.name} practice exercises for a CEFR ${level} learner on the topic: "${topic}". Reply ONLY as JSON: {"exercises": [{"q": "fill-in-the-blank or question, ${LANG.name} with ___ where needed", "options": ["3 short options"], "answer": index_of_correct, "why": "one-line explanation in English"}]} — exactly 3 exercises, difficulty matched to ${level}.`,
    },
    { role: 'user', content: topic },
  ], { label: 'generate-exercises', temperature: 0.6 });
  const exercises = normalizeExercises(json);
  if (!exercises.length) throw new Error('The model returned no usable exercises — try a more specific topic.');
  return exercises;
}

// ---- quiz drawn from a finished conversation ----

// Turns a just-finished roleplay into a short comprehension + vocabulary quiz,
// grounded in what was actually said, so the words and phrases from the chat
// get one active-recall pass while they're fresh.
export async function quizFromConversation(apiKey, { history, level = 'B1', mock }) {
  if (mock) return mockExercises();
  const transcript = (history || [])
    .map((t) => `Learner: ${t.userText}\nPartner: ${t.reply}`)
    .join('\n');
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `You are a ${LANG.name} tutor. Below is a transcript of a roleplay a CEFR ${level} learner just completed. Write a short quiz that checks they understood and can reuse the ${LANG.name} vocabulary and phrases FROM THIS CONVERSATION. Reply ONLY as JSON: {"exercises": [{"q": "question, ${LANG.name} (use ___ for a gap where useful)", "options": ["3 short options"], "answer": index_of_correct, "why": "one-line explanation in English"}]} — exactly 3 exercises, grounded in the transcript, matched to ${level}.`,
    },
    { role: 'user', content: transcript || 'The conversation was very short.' },
  ], { label: 'quiz-from-conversation', temperature: 0.5 });
  const exercises = normalizeExercises(json);
  if (!exercises.length) throw new Error('Could not build a quiz from this chat — try a longer conversation.');
  return exercises;
}

// ---- a short story woven from the learner's own known words ----

// Writes a level-appropriate story that reuses as many of the learner's
// learned words as it naturally can, so review turns into reading. Returns
// { title, paragraphs: [{ fr, en }] } (fr = target language).
export async function generateStory(apiKey, { words = [], level = 'B1', mock }) {
  if (mock) return mockStory();
  const wordList = words.slice(0, 24).join(', ') || '(pick common, useful words)';
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `Write a short, natural, self-contained ${LANG.name} story for a CEFR ${level} learner. Weave in as many of THESE words as you naturally can, without forcing them: ${wordList}. Keep sentences at ${level} difficulty and the whole thing engaging and easy to follow. Reply ONLY as JSON: {"title": "a short ${LANG.name} title", "paragraphs": [{"fr": "one or two ${LANG.name} sentences", "en": "their English translation"}]} — 3 to 5 short paragraphs.`,
    },
    { role: 'user', content: 'Write my story.' },
  ], { label: 'generate-story', temperature: 0.8 });
  const paragraphs = Array.isArray(json.paragraphs)
    ? json.paragraphs
        .filter((p) => p && typeof p.fr === 'string')
        .map((p) => ({ fr: String(p.fr), en: String(p.en || '') }))
    : [];
  if (!paragraphs.length) throw new Error('The story came back empty — try again.');
  return { title: String(json.title || 'Une petite histoire'), paragraphs };
}

// ---- Snap & learn: turn a photo into target-language vocabulary ----

export async function generateVocabFromImage(apiKey, { imageDataUrl, level = 'A2', mock }) {
  if (mock) return mockSnapVocab();
  if (!imageDataUrl || !/^data:image\//.test(imageDataUrl)) {
    throw new Error('That image didn’t load — pick a photo and try again.');
  }
  const json = await chatVisionJson(apiKey, {
    system: `You help a CEFR ${level} learner of ${LANG.name} build vocabulary from photos. Look at the image: name the most useful, concrete things you can see, AND read any printed ${LANG.name} text (signs, menus, labels) if present. Give each as a ${LANG.name} word with its correct article/gender where relevant. Reply ONLY as JSON: {"caption": "a short ${LANG.name} caption of the scene", "captionEn": "its English translation", "items": [{"fr": "${LANG.name} word (with article)", "en": "English translation", "emoji": "one relevant emoji"}]} — 5 to 10 items, most useful first, no duplicates.`,
    prompt: 'What useful words can I learn from this photo?',
    imageDataUrl,
    label: 'snap-vocab',
  });
  const items = Array.isArray(json.items)
    ? json.items
        .filter((it) => it && typeof it.fr === 'string' && it.fr.trim())
        .map((it) => ({ fr: String(it.fr).trim(), en: String(it.en || '').trim(), emoji: String(it.emoji || '📸').trim().slice(0, 4) }))
        .slice(0, 12)
    : [];
  if (!items.length) throw new Error('No clear words came back — try a sharper or closer photo.');
  return { caption: String(json.caption || ''), captionEn: String(json.captionEn || ''), items };
}

// ---- personalized lesson from the learner's recurring mistakes ----

export async function generateLesson(apiKey, { habits, level = 'B1', mock }) {
  if (mock) return mockLesson();
  const habitList = habits.length
    ? habits.map((h, i) => `${i + 1}. ${h.text} (seen ${h.count}×)`).join('\n')
    : 'No recorded habits yet — pick one high-value topic for this level.';
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `You are a ${LANG.name} tutor building a personalized micro-lesson for a CEFR ${level} learner, targeting their recurring mistakes:\n${habitList}\n\nReply ONLY as JSON: {"title": "short lesson title", "explanation": "markdown mini-lesson in English (${LANG.name} in **bold**, with translations) directly addressing the most frequent habit(s), max 180 words", "exercises": [{"q": "...___...", "options": ["..."], "answer": 0, "why": "..."}]} — exactly 3 exercises practicing exactly these weaknesses.`,
    },
    { role: 'user', content: 'Generate my lesson.' },
  ], { label: 'generate-lesson', temperature: 0.5 });
  const exercises = normalizeExercises(json);
  if (!exercises.length) throw new Error('Lesson generation failed — try again.');
  return { title: String(json.title || 'Your custom lesson'), explanation: String(json.explanation || ''), exercises };
}

// ---- deeper explanation of a specific mistake ----

export async function explainMistake(apiKey, { userText, corrections, level = 'B1', mock }) {
  if (mock) return mockExplanation();
  return chatPlain(apiKey, [
    {
      role: 'system',
      content: `A CEFR ${level} ${LANG.name} learner said: "${userText}". They received these corrections: "${corrections}". Explain the UNDERLYING rule(s) behind the main correction in plain English — why ${LANG.name} works this way, the pattern to remember, and one extra example with translation. Max 120 words.`,
    },
    { role: 'user', content: 'Why is that wrong? Explain the rule.' },
  ], { label: 'explain-mistake', temperature: 0.4, maxTokens: 400 });
}

// ---- conversational turn evaluation ----

// ---- redo: targeted re-evaluation of the same turn ----
export async function evaluateRedoTurn(apiKey, { scenario, historyBefore, originalText, retryText, level = 'B1', mock }) {
  if (mock) {
    const { mockRedoEvaluation } = await import('./redo.js');
    return mockRedoEvaluation(level);
  }
  // Judge only the retry — same history prefix, same system — but include the
  // original + its correction so the model can reward incorporation.
  const originalEv = historyBefore.length ? null : null; // placeholder — caller threads it via prompt
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `${turnSystem()}\n\n${LEVEL_NOTES[level] || LEVEL_NOTES.B1}\n\nCurrent scenario: ${scenario.title} — ${scenario.setup}\nYour role: ${scenario.aiRole}\n\nREDO MODE: the learner is retrying their last turn. Original: "${originalText}" Retry: "${retryText}" — score ONLY the retry, but in corrections call out specifically whether they incorporated the previous correction. Include a "redo_note" field (one sentence in English: did the retry improve and what specifically got better or still needs work?).`,
    },
    ...historyBefore.flatMap((t) => [
      { role: 'user', content: t.userText },
      { role: 'assistant', content: JSON.stringify({ reply: t.reply }) },
    ]),
    { role: 'user', content: retryText },
  ], { label: 'evaluate-redo', temperature: 0.5 });
  // tolerate models that omit redo_note
  const base = normalizeTurn(json);
  base.redo_note = String(json.redo_note || '');
  return base;
}

const LEVEL_NOTES = {
  A1: 'The learner is CEFR A1 (beginner). Use very short present-tense sentences and the most frequent vocabulary only. Repeat key words. Score very generously — reward any successful communication.',
  A2: 'The learner is CEFR A2 (elementary). Use short, simple sentences, basic past tense, high-frequency vocabulary. Be forgiving in scoring.',
  B1: 'The learner is CEFR B1 (intermediate). Use natural everyday language with some idioms; a full range of common tenses is fair game.',
  B2: 'The learner is CEFR B2 (upper-intermediate). Speak at near-native pace and complexity, use idioms and the subjunctive freely, and score with higher expectations.',
  C1: 'The learner is CEFR C1 (advanced). Use sophisticated, fully native language — nuance, register shifts, cultural references. Score strictly: naturalness and precision matter.',
  C2: 'The learner is CEFR C2 (mastery). Treat them as a native peer: rapid, idiomatic, stylistically demanding language. Only flawless, natural production scores highly.',
};

// The grammar-topic ids match the French grammar library, so this field is
// only requested when the target language is French.
const FR_GRAMMAR_TOPIC_LINE =
  '  "grammar_topic": "If the learner\'s main mistake maps to one of these topics, its id; otherwise null: present (present tense conjugation), articles (articles & partitives), negation, passe-compose (passé composé vs imparfait), futur-conditionnel (future & conditional), subjonctif (subjunctive), pronoms (object pronouns), comparatif (comparatives), relatifs (relative pronouns), prepositions-lieu (place prepositions), accord-participe (past-participle agreement), pronominaux (reflexive verbs).",\n';

// A function (not a const) so it reads the active language at call time.
const turnSystem = () => `You are a warm ${LANG.name} conversation partner for a learner. You play a role in a given scenario.

You MUST reply with ONLY a JSON object in exactly this shape:
{
  "reply": "Conversational reply in natural, level-appropriate ${LANG.name}. Stay in character for the scenario. Keep it to 1-3 sentences and always end in a way that invites the learner to respond.",
  "translation": "English translation of the reply.",
  "corrections": "Constructive markdown-formatted corrections of the learner's grammar, spelling, or vocabulary, WRITTEN IN ENGLISH (quote the ${LANG.name} words being discussed). Wrap removed/wrong ${LANG.name} words in <s></s> tags and corrected ${LANG.name} words in <mark></mark> tags. If the sentence was perfect, say so warmly in English.",
  "native_alternative": "How a native ${LANG.name} speaker would express the learner's idea using common, everyday phrasing.",
${LANG.id === 'fr' ? FR_GRAMMAR_TOPIC_LINE : ''}  "scores": { "grammar": 0-100, "naturalness": 0-100, "relevance": 0-100, "fluency": 0-100, "overall": 0-100 }
}
Scores are integers. "overall" = 0.30*grammar + 0.30*naturalness + 0.20*relevance + 0.20*fluency (rounded).`;

const REQUIRED_SCORES = ['grammar', 'naturalness', 'relevance', 'fluency', 'overall'];

function normalizeTurn(json) {
  const scores = json.scores || {};
  for (const k of REQUIRED_SCORES) {
    scores[k] = Math.max(0, Math.min(100, Math.round(Number(scores[k]) || 0)));
  }
  return {
    reply: String(json.reply || ''),
    translation: String(json.translation || ''),
    corrections: String(json.corrections || ''),
    native_alternative: String(json.native_alternative || ''),
    grammar_topic: json.grammar_topic ? String(json.grammar_topic) : null,
    scores,
  };
}

function learningPlanLine(plan) {
  if (!plan) return '';
  const input = plan.input || {};
  const grammar = plan.grammar || {};
  const natural = plan.naturalSpeech || {};
  const assistance = plan.assistance || {};
  const correction = plan.correction || {};
  const progression = plan.progression || {};
  const recycling = plan.recycling || {};
  const due = Array.isArray(recycling.due) ? recycling.due.slice(0, 3).map((entry) => entry.label || entry.key).filter(Boolean) : [];
  return [
    '\n\nLEARNING ADAPTATION (follow this quietly; do not mention internal scores):',
    input.directive,
    grammar.directive,
    natural.directive,
    `Assistance fade: ${assistance.translation === 'off' ? 'no English translation' : assistance.translation === 'inline' ? 'brief English glosses are allowed' : 'translate only when asked'}; offer ${assistance.starters || 0} sentence starter${assistance.starters === 1 ? '' : 's'} unless the learner asks for more challenge.`,
    plan.sentenceComplexity?.wordCount ? `The learner's last sentence was ${plan.sentenceComplexity.band}-sized (${plan.sentenceComplexity.wordCount} words); keep the next turn manageable and add complexity gradually.` : '',
    progression.targetLevel && progression.targetLevel !== progression.baseLevel
      ? `Progression: gently target CEFR ${progression.targetLevel} language while keeping the turn accessible.`
      : 'Progression: hold the current conversation challenge until more evidence accumulates.',
    correction.directive,
    due.length ? `Delayed recycling due: naturally revisit ${due.join(', ')} when it fits.` : '',
    plan.sentenceTarget?.maxWords ? `Keep the partner reply within roughly ${Math.max(8, Math.round(plan.sentenceTarget.maxWords * 0.7))}–${plan.sentenceTarget.maxWords} words.` : '',
  ].filter(Boolean).join(' ');
}

export async function evaluateTurn(apiKey, { scenario, history, userText, curveball, level = 'B1', knownWords, reversed, learner, learningPlan, mock }) {
  if (mock) return mockTurn().evaluation;
  const messages = [
    {
      role: 'system',
      content: `${turnSystem()}\n\n${LEVEL_NOTES[level] || LEVEL_NOTES.B1}\n\nCurrent scenario: ${scenario.title} — ${scenario.setup}\nYour role: ${reversed
        ? `The roles are reversed today: the learner plays this role — «${scenario.aiRole}» — and YOU play the ordinary customer / other person in the scene. Ask questions, make realistic requests, and add small complications like a real customer would.`
        : scenario.aiRole}${knownWords && knownWords.length
        ? `\n\nVocabulary the learner already knows (prefer these words and their level naturally, without artificially limiting yourself): ${knownWords.join(', ')}.`
        : ''}${learner ? learnerLine(learner) : ''}${learningPlanLine(learningPlan)}`,
    },
    ...history.flatMap((t) => [
      { role: 'user', content: t.userText },
      { role: 'assistant', content: JSON.stringify({ reply: t.reply }) },
    ]),
  ];
  if (curveball) {
    messages.push({
      role: 'system',
      content: `PLOT TWIST! In your next reply, naturally introduce this development: ${curveball}`,
    });
  }
  messages.push({ role: 'user', content: userText });
  const json = await chatJson(apiKey, messages, { label: 'evaluate-turn' });
  return normalizeTurn(json);
}

// ---- progressive hints ----

export async function getHint(apiKey, { scenario, lastAiReply, level, cefr = 'B1', mock }) {
  if (mock) return mockHint(level);
  const depth = [
    `Level 1: give only 2-3 useful ${LANG.name} vocabulary words with English glosses.`,
    `Level 2: give a ${LANG.name} sentence starter (first 3-5 words) the learner could use.`,
    `Level 3: give one complete natural ${LANG.name} sentence they could say, with English translation.`,
  ][level - 1];
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `You help a CEFR ${cefr} ${LANG.name} learner respond in a roleplay. Scenario: ${scenario.title}. The other speaker just said: "${lastAiReply}". ${depth} Match the vocabulary to their level. Reply ONLY as JSON: {"hint": "..."}`,
    },
    { role: 'user', content: 'Give me a hint.' },
  ], { label: `hint-${level}` });
  return String(json.hint || '');
}

// ---- pronunciation / accent feedback ----
// The learner read a target sentence aloud; Whisper heard `heard`. Words the
// model mis-transcribed are the best available signal of what was mispronounced.

export async function accentFeedback(apiKey, { target, heard, level = 'B1', mock }) {
  if (mock) return mockAccentFeedback();
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `You are a ${LANG.name} pronunciation coach for a CEFR ${level} learner. They read a sentence aloud and a speech recognizer transcribed what it heard. Differences between the two reveal likely pronunciation problems (vowel quality, tricky consonants, silent letters, linking, word stress). Give 2-3 sentences of specific, encouraging feedback IN ENGLISH: name the exact sounds or words to work on (quote the ${LANG.name}), and one concrete articulation tip. If the transcript matches well, say what they did right. Reply ONLY as JSON: {"feedback": "..."}`,
    },
    {
      role: 'user',
      content: `Target sentence: "${target}"\nWhat the recognizer heard: "${heard || '(nothing recognizable)'}"`,
    },
  ], { label: 'accent-feedback', temperature: 0.4 });
  return String(json.feedback || '');
}

// ---- writing correction & essay feedback ----

export async function writingFeedback(apiKey, { text, prompt, level = 'B1', depth = 'quick', mock }) {
  if (mock) return mockWritingFeedback(depth);
  const essay = depth === 'essay';
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `You are a ${LANG.name} writing teacher reviewing a CEFR ${level} learner's ${essay ? 'essay' : 'short text'}${prompt ? ` written to the prompt: "${prompt}"` : ''}.
${LEVEL_NOTES[level] || LEVEL_NOTES.B1}
Reply ONLY as JSON:
{
  "corrections": "Markdown corrections IN ENGLISH quoting the ${LANG.name}. Wrap wrong ${LANG.name} in <s></s> and fixes in <mark></mark>. Cover every real error${essay ? ', grouped by type' : ''}.",
  "strengths": ["1-3 specific things done well, quoting their ${LANG.name}"],
  "suggestions": ["${essay ? '2-3 concrete improvements: structure, connectors, register, richer vocabulary' : '1-2 quick wins for next time'}"],
  "scores": { "grammar": 0-100, "vocabulary": 0-100${essay ? ', "structure": 0-100' : ''}, "overall": 0-100 }
}`,
    },
    { role: 'user', content: text },
  ], { label: essay ? 'essay-feedback' : 'writing-feedback', temperature: 0.4 });
  const scores = json.scores || {};
  for (const k of Object.keys(scores)) {
    scores[k] = Math.max(0, Math.min(100, Math.round(Number(scores[k]) || 0)));
  }
  return {
    corrections: String(json.corrections || ''),
    strengths: Array.isArray(json.strengths) ? json.strengths.map(String) : [],
    suggestions: Array.isArray(json.suggestions) ? json.suggestions.map(String) : [],
    scores,
  };
}

// ---- sentence-completion judging ----

export async function judgeCompletion(apiKey, { starter, completion, level = 'B1', mock }) {
  if (mock) return mockCompletion();
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `A CEFR ${level} ${LANG.name} learner must complete the sentence starter "${starter}" naturally and grammatically. Judge their completion of the FULL sentence. Reply ONLY as JSON: {"natural": true|false, "feedback": "short feedback in English quoting the ${LANG.name}; if flawed, give the corrected full sentence"}`,
    },
    { role: 'user', content: `${starter} ${completion}` },
  ], { label: 'completion-check', temperature: 0.3 });
  return { natural: Boolean(json.natural), feedback: String(json.feedback || '') };
}

// ---- tap-to-translate single-word lookup ----

export async function translateWord(apiKey, { word, context, mock }) {
  if (mock) return '(mock translation — add an API key for real lookups)';
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `You are a ${LANG.name}-English dictionary. Given a ${LANG.name} word and the sentence it appears in, reply ONLY as JSON: {"translation": "concise English translation of the word AS USED in that sentence (max 8 words, include the base form if inflected)"}`,
    },
    { role: 'user', content: `Word: "${word}"\nSentence: "${context}"` },
  ], { label: 'translate-word', temperature: 0.2 });
  return String(json.translation || '');
}

// ---- flashcard sentence verification ----

export async function checkSentence(apiKey, { card, sentence, mock }) {
  if (mock) return mockSentenceCheck();
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `A ${LANG.name} learner must use the expression "${card.front}" (${card.meaning}) correctly in a sentence. Judge their attempt. Reply ONLY as JSON: {"correct": true|false, "feedback": "short encouraging feedback in English, with a corrected ${LANG.name} version if needed"}`,
    },
    { role: 'user', content: sentence },
  ], { label: 'sentence-check', temperature: 0.3 });
  return { correct: Boolean(json.correct), feedback: String(json.feedback || '') };
}

// ---- end-of-session report card ----

const reportSystem = () => `You are a supportive ${LANG.name} teacher writing an end-of-session report card for an intermediate learner. You will receive the full conversation with per-turn scores.

Reply with ONLY a JSON object in exactly this shape:
{
  "session_grade": "letter grade like A-, B+",
  "average_scores": { "grammar": 0-100, "naturalness": 0-100, "relevance": 0-100, "fluency": 0-100, "overall": 0-100 },
  "strengths": ["2-4 specific strengths, quoting the learner's actual ${LANG.name} when possible"],
  "stubborn_habits": ["2-4 recurring mistakes or habits observed across turns"],
  "tomorrow_focus": "One concrete, personalized practice focus for tomorrow."
}`;

export async function sessionReport(apiKey, { scenario, history, level = 'B1', mock }) {
  if (mock) return mockReport();
  const transcriptLines = history.map((t, i) =>
    `Turn ${i + 1}\nLearner: ${t.userText}\nScores: ${JSON.stringify(t.evaluation.scores)}\nPartner: ${t.evaluation.reply}`
  ).join('\n\n');
  const json = await chatJson(apiKey, [
    { role: 'system', content: `${reportSystem()}\n\n${LEVEL_NOTES[level] || LEVEL_NOTES.B1}` },
    { role: 'user', content: `Scenario: ${scenario.title}\n\n${transcriptLines}` },
  ], { label: 'session-report', temperature: 0.5 });
  const avg = json.average_scores || {};
  for (const k of REQUIRED_SCORES) {
    avg[k] = Math.max(0, Math.min(100, Math.round(Number(avg[k]) || 0)));
  }
  return {
    session_grade: String(json.session_grade || 'B'),
    average_scores: avg,
    strengths: Array.isArray(json.strengths) ? json.strengths.map(String) : [],
    stubborn_habits: Array.isArray(json.stubborn_habits) ? json.stubborn_habits.map(String) : [],
    tomorrow_focus: String(json.tomorrow_focus || ''),
  };
}

export { compositeScore } from './score.js';
