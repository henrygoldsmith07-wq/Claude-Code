/**
 * OpenRouter free-tier access.
 *
 * When OPENROUTER_API_KEY is set, AI features run against OpenRouter's
 * `:free` models. The catalog is fetched once and cached: we prefer models
 * matching the household's preferred families, else any available free slot.
 * Free models are unmetered for the household — the AI budget system does
 * not apply to this provider.
 */

const PREFERRED_TOKENS = [
  'lfm', 'nemotron', 'gemma', 'glm', 'laguna', 'inkling',
  'dots', 'north', 's2.1', 'flux',
];

const CATALOG_TTL_MS = 10 * 60 * 1000;
let cachedModel = null;
let cachedAt = 0;

export const isOpenRouterConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

export const openRouterBase = () =>
  (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');

/** Pick a free model from the live catalog, preferring known-good families. */
export async function pickFreeModel(fetchImpl = fetch) {
  if (!isOpenRouterConfigured()) return null;
  if (cachedModel && Date.now() - cachedAt < CATALOG_TTL_MS) return cachedModel;
  try {
    const res = await fetchImpl(`${openRouterBase()}/models`);
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const body = await res.json();
    const free = (body?.data || [])
      .map((m) => m.id)
      .filter((id) => typeof id === 'string' && id.endsWith(':free'));
    cachedModel =
      free.find((id) => PREFERRED_TOKENS.some((t) => id.toLowerCase().includes(t))) ||
      free[0] ||
      null;
    cachedAt = Date.now();
  } catch {
    cachedModel = null; // caller falls back to the legacy provider path
  }
  return cachedModel;
}

/** Chat completion against the chosen free model. Returns assistant text. */
export async function freeChat({ system, user, maxTokens = 1200, fetchImpl = fetch } = {}) {
  const model = await pickFreeModel(fetchImpl);
  if (!model) throw new Error('no-free-model');
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
    const err = new Error(`openrouter ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  const text = body?.choices?.[0]?.message?.content ?? '';
  return { text, model };
}
