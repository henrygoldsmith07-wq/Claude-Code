import "server-only";

// ---------------------------------------------------------------------------
// Provider abstraction.
//
// The rest of the app asks for a completion and never learns which model
// answered — or whether one answered at all. "No provider" is a first-class,
// fully supported mode: every AI task in tasks.ts has a deterministic
// implementation in src/domain, so the product works completely with no API key
// configured. That is not a degraded demo mode; it is the floor the whole
// design sits on.
//
// Keys never leave the server. No provider SDK is bundled into the client and
// no key is serialised into any response.
// ---------------------------------------------------------------------------

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  /** When set, the model is told to reply with JSON matching this shape. */
  jsonHint?: string;
}

export interface CompletionResult {
  text: string;
  /** Reported by the provider where available; used for cost monitoring. */
  usage?: { inputTokens: number; outputTokens: number };
}

export interface AiProvider {
  name: string;
  model: string;
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

const TIMEOUT_MS = 30_000;

/**
 * POST JSON with the whole call — headers *and* body — under one timeout.
 *
 * Clearing the abort timer when `fetch` resolves only bounds the time to the
 * response headers; a provider that sends headers and then stalls the body
 * would otherwise hang the caller indefinitely. The body is consumed inside
 * this function so the deadline covers it.
 */
async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<{ status: number; ok: boolean; text: string; json: () => unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    return {
      status: res.status,
      ok: res.ok,
      text,
      json: () => parsed,
    };
  } finally {
    clearTimeout(timer);
  }
}

function anthropicProvider(): AiProvider | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  return {
    name: "anthropic",
    model,
    async complete(request) {
      const res = await postJson(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        {
          model,
          max_tokens: request.maxTokens ?? 900,
          temperature: request.temperature ?? 0.6,
          system: request.jsonHint
            ? `${request.system}\n\nReply with JSON only, matching: ${request.jsonHint}`
            : request.system,
          messages: request.messages,
        },
      );
      if (!res.ok) throw new Error(`anthropic ${res.status}: ${res.text.slice(0, 200)}`);
      const json = res.json() as {
        content?: { type: string; text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return {
        text: (json.content ?? [])
          .filter((block) => block.type === "text")
          .map((block) => block.text ?? "")
          .join("")
          .trim(),
        usage: json.usage
          ? { inputTokens: json.usage.input_tokens ?? 0, outputTokens: json.usage.output_tokens ?? 0 }
          : undefined,
      };
    },
  };
}

/** Any OpenAI-compatible endpoint: OpenRouter, Groq, Together, or a local server. */
function openAiCompatibleProvider(): AiProvider | null {
  const baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL;
  const key = process.env.OPENAI_COMPATIBLE_API_KEY;
  const model = process.env.OPENAI_COMPATIBLE_MODEL;
  if (!baseUrl || !model) return null;
  return {
    name: "openai-compatible",
    model,
    async complete(request) {
      const res = await postJson(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        key ? { authorization: `Bearer ${key}` } : {},
        {
          model,
          max_tokens: request.maxTokens ?? 900,
          temperature: request.temperature ?? 0.6,
          ...(request.jsonHint ? { response_format: { type: "json_object" } } : {}),
          messages: [
            {
              role: "system",
              content: request.jsonHint
                ? `${request.system}\n\nReply with JSON only, matching: ${request.jsonHint}`
                : request.system,
            },
            ...request.messages,
          ],
        },
      );
      if (!res.ok) throw new Error(`openai-compatible ${res.status}: ${res.text.slice(0, 200)}`);
      const json = res.json() as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: (json.choices?.[0]?.message?.content ?? "").trim(),
        usage: json.usage
          ? { inputTokens: json.usage.prompt_tokens ?? 0, outputTokens: json.usage.completion_tokens ?? 0 }
          : undefined,
      };
    },
  };
}

const FACTORIES: Record<string, () => AiProvider | null> = {
  anthropic: anthropicProvider,
  "openai-compatible": openAiCompatibleProvider,
};

export function getProvider(): AiProvider | null {
  const preferred = process.env.AI_PROVIDER?.trim();
  if (preferred) {
    if (preferred === "none") return null;
    return FACTORIES[preferred]?.() ?? null;
  }
  for (const factory of Object.values(FACTORIES)) {
    const provider = factory();
    if (provider) return provider;
  }
  return null;
}

export function providerStatus(): { available: boolean; name: string | null; model: string | null } {
  const provider = getProvider();
  return { available: Boolean(provider), name: provider?.name ?? null, model: provider?.model ?? null };
}

/**
 * One retry on transient failure, then give up and let the caller fall back.
 * Retrying harder is the wrong trade: the deterministic path is already good,
 * and a user waiting 40 seconds for feedback has been failed either way.
 */
export async function completeWithRetry(
  provider: AiProvider,
  request: CompletionRequest,
  attempts = 2,
): Promise<CompletionResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await provider.complete(request);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // A timeout will not fix itself on retry — it would only double the wait.
      if (error instanceof Error && error.name === "AbortError") break;
      // 4xx other than 429 will not fix themselves.
      if (/\b4\d\d\b/.test(message) && !message.includes("429")) break;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Pull the first JSON object or array out of a reply that may be fenced or prosey. */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
  if (end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
