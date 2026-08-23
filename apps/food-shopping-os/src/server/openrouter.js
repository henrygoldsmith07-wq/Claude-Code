/**
 * OpenRouter free-tier access.
 *
 * When OPENROUTER_API_KEY is set, AI features run against OpenRouter's
 * `:free` models, ranked by capability: strongest chat models first, with
 * automatic fall-down the list when one is rate-limited or unavailable.
 * Non-chat endpoints (embeddings, rerankers, TTS, safety classifiers) are
 * excluded from selection. Free models are unmetered for the household —
 * the AI budget system does not apply to this provider.
 */

/** Capability order: position = preference. Tokens must all appear in the id. */
const CHAT_MODEL_ORDER = [
  { name: 'GLM 5.2', tokens: ['glm'] },
  { name: 'Nemotron 3 Ultra', tokens: ['nemotron', 'ultra'] },
  { name: 'Nemotron 3.5 Lightning', tokens: ['lightning'] },
  { name: 'Nemotron 3 Super', tokens: ['nemotron', 'super'] },
  { name: 'Gemma 4 31B', tokens: ['gemma', '31b'] },
  { name: 'Gemma 4 26B A4B', tokens: ['gemma', '26b'] },
  { name: 'Nemotron 3 Nano 30B A3B', tokens: ['30b'] },
  { name: 'Nemotron Nano 12B 2 VL', tokens: ['12b'] },
  { name: 'Nemotron Nano 9B V2', tokens: ['9b'] },
  { name: 'LFM2.5-2.6B', tokens: ['lfm'] },
  { name: 'North Mini Code', tokens: ['north'] },
  { name: 'Inkling Small', tokens: ['inkling-small'] },
  { name: 'Inkling', tokens: ['inkling'] },
  { name: 'Laguna family', tokens: ['laguna'] },
  { name: 'Dots3 Note', tokens: ['dots'] },
];

/** Endpoint-only models that can never serve chat completions. */
const NON_CHAT_TOKENS = ['embed', 'rerank', 'tts', 'safety', 'moderation', 'whisper'];

const CATALOG_TTL_MS = 10 * 60 * 1000;
let cachedRanking = null;
let cachedAt = 0;

export const isOpenRouterConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

export const openRouterBase = () =>
  (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

const matchScore = (id) => {
  const lower = id.toLowerCase();
  let best = Infinity;
  CHAT_MODEL_ORDER.forEach((entry, position) => {
    if (entry.tokens.every((t) => lower.includes(t))) best = Math.min(best, position);
  });
  return best;
};

/** Free chat-capable models, strongest first. */
export async function rankedFreeModels(fetchImpl = fetch) {
  if (!isOpenRouterConfigured()) return [];
  if (cachedRanking && Date.now() - cachedAt < CATALOG_TTL_MS) return cachedRanking;
  try {
    const res = await fetchImpl(`${openRouterBase()}/models`);
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const body = await res.json();
    const free = (body?.data || [])
      .map((m) => m.id)
      .filter((id) => typeof id === 'string' && id.endsWith(':free'))
      .filter((id) => !NON_CHAT_TOKENS.some((t) => id.toLowerCase().includes(t)));
    cachedRanking = free
      .map((id) => ({ id, rank: matchScore(id) }))
      .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
      .map((r) => r.id);
    cachedAt = Date.now();
  } catch {
    cachedRanking = [];
  }
  return cachedRanking;
}

/**
 * Chat completion with intelligent failover: try the smartest free model,
 * walk down the ranking on failure (rate limits, outages), give up only if
 * every slot refuses — the caller then decides whether to pay elsewhere.
 */
export async function freeChat({ system, user, maxTokens = 1200, fetchImpl = fetch } = {}) {
  const models = await rankedFreeModels(fetchImpl);
  if (!models.length) throw new Error('no-free-model');
  let lastError = null;
  for (const model of models.slice(0, 6)) {
    try {
      const res = await fetchImpl(`${openRouterBase()}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) {
        lastError = Object.assign(new Error(`openrouter ${res.status}`), { status: res.status });
        if (res.status === 401) break; // bad key never fixes itself on the next model
        continue;
      }
      const body = await res.json();
      return { text: body?.choices?.[0]?.message?.content ?? '', model };
    } catch (error) {
      lastError = error;
      if (error?.status === 401) break;
    }
  }
  throw lastError || new Error('no-free-model');
}
