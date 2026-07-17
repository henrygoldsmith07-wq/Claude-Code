// Groq API client — pure fetch, no SDK. Every call reports latency + token
// usage to an optional telemetry sink so the Dev Panel can display metrics.

import { mockTurn, mockReport, mockHint, mockSentenceCheck } from './mocks';

const BASE = 'https://api.groq.com/openai/v1';
const CHAT_MODEL = 'llama-3.1-8b-instant';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

let telemetrySink = null;
export const setTelemetrySink = (fn) => { telemetrySink = fn; };

function report(entry) {
  if (telemetrySink) telemetrySink({ time: new Date().toISOString(), ...entry });
}

// Transient statuses worth retrying: rate limits and server hiccups.
const RETRYABLE = new Set([429, 500, 502, 503]);
const RETRY_DELAYS_MS = [600, 1800];
const REQUEST_TIMEOUT_MS = 45000;

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
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', blob, `recording.${ext}`);
  form.append('model', WHISPER_MODEL);
  form.append('language', 'fr');
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

// ---- conversational turn evaluation ----

const LEVEL_NOTES = {
  A2: 'The learner is CEFR A2 (elementary). Use short, simple sentences, present/passé composé, high-frequency vocabulary. Be forgiving in scoring.',
  B1: 'The learner is CEFR B1 (intermediate). Use natural everyday French with some idioms; a full range of common tenses is fair game.',
  B2: 'The learner is CEFR B2 (upper-intermediate). Speak at near-native pace and complexity, use idioms and subjonctif freely, and score with higher expectations.',
};

const TURN_SYSTEM = `Tu es un partenaire de conversation français chaleureux pour un apprenant. Tu joues un rôle dans un scénario donné.

You MUST reply with ONLY a JSON object in exactly this shape:
{
  "reply": "Conversational reply in natural, intermediate French. Stay in character for the scenario. Keep it to 1-3 sentences and always end in a way that invites the learner to respond.",
  "translation": "English translation of the reply.",
  "corrections": "Constructive markdown-formatted corrections of the learner's grammar, spelling, or vocabulary, WRITTEN IN ENGLISH (quote the French words being discussed). Wrap removed/wrong French words in <s></s> tags and corrected French words in <mark></mark> tags. If the sentence was perfect, say so warmly in English.",
  "native_alternative": "How a native French speaker would express the learner's idea using common slang, modern structures, and phrases.",
  "scores": { "grammar": 0-100, "naturalness": 0-100, "relevance": 0-100, "fluency": 0-100, "overall": 0-100 }
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
    scores,
  };
}

export async function evaluateTurn(apiKey, { scenario, history, userText, curveball, level = 'B1', mock }) {
  if (mock) return mockTurn().evaluation;
  const messages = [
    { role: 'system', content: `${TURN_SYSTEM}\n\n${LEVEL_NOTES[level] || LEVEL_NOTES.B1}\n\nScénario actuel : ${scenario.title} — ${scenario.setup}\nTon rôle : ${scenario.aiRole}` },
    ...history.flatMap((t) => [
      { role: 'user', content: t.userText },
      { role: 'assistant', content: JSON.stringify({ reply: t.reply }) },
    ]),
  ];
  if (curveball) {
    messages.push({
      role: 'system',
      content: `IMPRÉVU ! Dans ta prochaine réponse, introduis naturellement ce rebondissement : ${curveball}`,
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
    'Level 1: give only 2-3 useful French vocabulary words with English glosses.',
    'Level 2: give a French sentence starter (first 3-5 words) the learner could use.',
    'Level 3: give one complete natural French sentence they could say, with English translation.',
  ][level - 1];
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `You help a CEFR ${cefr} French learner respond in a roleplay. Scenario: ${scenario.title}. The other speaker just said: "${lastAiReply}". ${depth} Match the vocabulary to their level. Reply ONLY as JSON: {"hint": "..."}`,
    },
    { role: 'user', content: 'Donnez-moi un indice.' },
  ], { label: `hint-${level}` });
  return String(json.hint || '');
}

// ---- flashcard sentence verification ----

export async function checkSentence(apiKey, { card, sentence, mock }) {
  if (mock) return mockSentenceCheck();
  const json = await chatJson(apiKey, [
    {
      role: 'system',
      content: `A French learner must use the filler expression "${card.front}" (${card.meaning}) correctly in a sentence. Judge their attempt. Reply ONLY as JSON: {"correct": true|false, "feedback": "short encouraging feedback in English, with a corrected French version if needed"}`,
    },
    { role: 'user', content: sentence },
  ], { label: 'sentence-check', temperature: 0.3 });
  return { correct: Boolean(json.correct), feedback: String(json.feedback || '') };
}

// ---- end-of-session report card ----

const REPORT_SYSTEM = `You are a supportive French teacher writing an end-of-session report card for an intermediate learner. You will receive the full conversation with per-turn scores.

Reply with ONLY a JSON object in exactly this shape:
{
  "session_grade": "letter grade like A-, B+",
  "average_scores": { "grammar": 0-100, "naturalness": 0-100, "relevance": 0-100, "fluency": 0-100, "overall": 0-100 },
  "strengths": ["2-4 specific strengths, quoting the learner's actual French when possible"],
  "stubborn_habits": ["2-4 recurring mistakes or habits observed across turns"],
  "tomorrow_focus": "One concrete, personalized practice focus for tomorrow."
}`;

export async function sessionReport(apiKey, { scenario, history, level = 'B1', mock }) {
  if (mock) return mockReport();
  const transcriptLines = history.map((t, i) =>
    `Turn ${i + 1}\nLearner: ${t.userText}\nScores: ${JSON.stringify(t.evaluation.scores)}\nPartner: ${t.evaluation.reply}`
  ).join('\n\n');
  const json = await chatJson(apiKey, [
    { role: 'system', content: `${REPORT_SYSTEM}\n\n${LEVEL_NOTES[level] || LEVEL_NOTES.B1}` },
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

// weighted composite used across the UI: S = 0.30G + 0.30N + 0.20R + 0.20F
export function compositeScore(s) {
  return Math.round(0.3 * s.grammar + 0.3 * s.naturalness + 0.2 * s.relevance + 0.2 * s.fluency);
}
