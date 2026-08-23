// openrouter.ts — OpenRouter (OpenAI-compatible) provider for guided reflection.
//
// Design notes:
// - Zero-dependency: plain fetch against https://openrouter.ai/api/v1.
// - Free-tier models vary in tool-calling reliability, so every request first
//   attempts native tool calling; if the model answers in prose instead, we
//   fall back to strict-JSON parsing of the message content. Both paths yield
//   the same normalized step shapes gemini.ts expects.
// - Model slugs drift on free tiers: OPENROUTER_MODEL pins one; otherwise an
//   ordered chain is tried and the first model that answers wins (cached for
//   the process lifetime).

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * Every chat-capable free model from the operator's approved list, ordered
 * reasoning-first. Per-model free tiers have their own caps; rotating through
 * the whole pool makes the effective supply unlimited — when one model is
 * capped (402/429) the next takes over transparently.
 *
 * Deliberately excluded (wrong modality for a text reflection step):
 * embedding models (LFM2.5-Embedding, Nemotron 3 Embed, Llama Nemotron Embed VL),
 * TTS (Flux), rerankers (Llama Nemotron Rerank VL), and the content-safety
 * classifier (Nemotron 3.5 Content Safety).
 */
export const OPENROUTER_FALLBACK_MODELS = [
  "z-ai/glm-5.2:free",
  "nvidia/nemotron-3-ultra:free",
  "google/gemma-4-31b:free",
  "google/gemma-4-26b-a4b:free",
  "nvidia/nemotron-3-super:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-nano-9b-v2:free",
  "nvidia/nemotron-nano-12b-2-vl:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "nvidia/nemotron-3-nano-omni:free",
  "liquid/lfm2.5-2.6b:free",
  // Slugs below are best-guess mappings for smaller/newer listings; unknown
  // ones simply 404 and fall through within milliseconds.
  "rednote-hilab/dots3-note-preview:free",
  "inkling/inkling-small:free",
  "inkling/inkling:free",
  "s2b/s2.1-pro-free:free",
  "laguna/laguna-s-2.1:free",
  "laguna/laguna-xs-2.1:free",
  "north/north-mini-code:free",
];

/** Round-robin cursor so successive calls start at different chain positions —
 *  spreads load across per-model free caps instead of hammering index 0. */
let rotationOffset = 0;

function rotatedChain(models: string[]): string[] {
  if (models.length <= 1) return models;
  const offset = rotationOffset % models.length;
  rotationOffset = (rotationOffset + 1) % models.length;
  return [...models.slice(offset), ...models.slice(0, offset)];
}

export function resolveModelChain(pinned?: string): string[] {
  const envPin = pinned || process.env.OPENROUTER_MODEL || "";
  if (envPin.trim()) return [envPin.trim()];
  return rotatedChain([...OPENROUTER_FALLBACK_MODELS]);
}

export interface OpenRouterToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ChatChoiceMessage {
  role: string;
  content: string | null;
  tool_calls?: { id?: string; type?: string; function?: { name?: string; arguments?: string } }[];
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Normalize one assistant turn into a reflection step, tolerating prose-only replies. */
export function parseAssistantStep(message: ChatChoiceMessage): { question?: string; summary?: unknown } | null {
  // Native tool call
  const call = message.tool_calls?.find((t) => t.function?.name);
  if (call?.function?.name) {
    let args: unknown;
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      args = null;
    }
    if (!args) throw new Error(`OpenRouter model returned unparseable tool arguments for ${call.function.name}`);
    if (call.function.name === "ask_followup") return { question: String((args as Record<string, unknown>).question ?? "") };
    return { summary: args };
  }

  // Prose fallback: strict JSON embedded in content
  const content = message.content ?? "";
  if (content.trim()) {
    const parsed = extractJson(content);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.question === "string") return { question: obj.question };
      if ("trace" in obj || "coreEmotion" in obj) return { summary: obj };
    }
  }
  return null;
}

const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Run one reflection step across the model chain until a model produces a
 * usable tool call or structured JSON. Throws when every model fails.
 */
export async function callOpenRouterStep(params: {
  apiKey: string;
  systemPrompt: string;
  messages: { role: string; content: string }[];
  tools: OpenRouterToolSpec[];
  modelChain?: string[];
}): Promise<{ question?: string; summary?: unknown; model: string }> {
  const chain = params.modelChain ?? resolveModelChain();
  const errors: string[] = [];

  for (const model of chain) {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://reflect.local",
          "X-Title": "Reflect",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1800,
          temperature: 0.7,
          messages: [{ role: "system", content: params.systemPrompt }, ...params.messages],
          tools: params.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
          tool_choice: "auto",
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        errors.push(`${model}: HTTP ${response.status}${body ? ` — ${body.slice(0, 140)}` : ""}`);
        continue;
      }

      const data = (await response.json()) as { choices?: { message?: ChatChoiceMessage }[] };
      const message = data.choices?.[0]?.message;
      if (!message) {
        errors.push(`${model}: empty response`);
        continue;
      }
      const step = parseAssistantStep(message);
      if (!step) {
        errors.push(`${model}: no structured output in reply`);
        continue;
      }
      return { ...step, model };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${msg}`);
    }
  }

  throw new Error(`OpenRouter models exhausted — tried: ${errors.join(" | ")}`);
}
