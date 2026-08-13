import "server-only";
import { checkCriticismBalance, checkFeedbackLanguage, checkGeneratedContent } from "@/domain/safety";
import * as cache from "./cache";
import { JSON_HINTS, MAX_TOKENS, PROMPT_VERSIONS, SYSTEM_PROMPTS, TEMPERATURES } from "./prompts";
import { completeWithRetry, extractJson, getProvider } from "./provider";
import * as telemetry from "./telemetry";
import { RESPONSE_SCHEMAS } from "./types";
import type { AiEnvelope, AiRequest, AiTask } from "./types";

// ---------------------------------------------------------------------------
// Task runner.
//
// One pipeline for every AI task:
//
//   rate limit → cache → provider (with retry) → JSON extract → schema
//   validate → safety gate → return; and at any failure, fall back.
//
// The fallback is not an error path. It is the deterministic implementation of
// the same task, supplied by the caller, and it is what runs whenever the model
// is absent, slow, malformed or unsafe. The user gets a working product in all
// four cases and is told which one they are looking at.
// ---------------------------------------------------------------------------

export interface RunOptions<T> {
  request: AiRequest;
  /** Deterministic result, computed before the model is called. Never optional. */
  fallback: T;
  /** Caller identity for rate limiting — an IP hash or session id, never a user id. */
  rateLimitKey: string;
  /** Extra validation for this specific task, run on the model's output. */
  validate?: (value: T) => boolean;
}

export async function run<T>(options: RunOptions<T>): Promise<AiEnvelope<T>> {
  const { request, fallback, rateLimitKey } = options;
  const task = request.task as AiTask;
  const promptVersion = PROMPT_VERSIONS[task];
  const started = Date.now();

  const limit = cache.checkRateLimit(rateLimitKey);
  if (!limit.allowed) {
    telemetry.record({
      task,
      provider: null,
      model: null,
      promptVersion,
      outcome: "rate-limited",
      latencyMs: 0,
      at: new Date().toISOString(),
    });
    return {
      data: fallback,
      source: "fallback",
      note: `Hourly AI limit reached (resets in ${Math.ceil(limit.resetsInSeconds / 60)} minutes). Showing the built-in version.`,
    };
  }

  const key = cache.hashKey(task, request);
  const cached = cache.get<T>(task, key);
  if (cached) {
    telemetry.record({
      task,
      provider: null,
      model: null,
      promptVersion,
      outcome: "cache-hit",
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
    });
    return { data: cached, source: "ai", promptVersion, note: "Reused a recent response.", latencyMs: Date.now() - started };
  }

  const provider = getProvider();
  if (!provider) {
    telemetry.record({
      task,
      provider: null,
      model: null,
      promptVersion,
      outcome: "fallback",
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
    });
    return { data: fallback, source: "fallback", note: "No AI provider configured." };
  }

  try {
    const result = await completeWithRetry(provider, {
      system: SYSTEM_PROMPTS[task],
      messages: [{ role: "user", content: JSON.stringify(stripForPrompt(request)) }],
      temperature: TEMPERATURES[task],
      maxTokens: MAX_TOKENS[task],
      jsonHint: JSON_HINTS[task],
    });

    const parsed = extractJson<unknown>(result.text);
    const schema = RESPONSE_SCHEMAS[task];
    const validated = parsed === null ? null : schema.safeParse(parsed);

    if (!validated || !validated.success) {
      telemetry.record({
        task,
        provider: provider.name,
        model: provider.model,
        promptVersion,
        outcome: "invalid-schema",
        latencyMs: Date.now() - started,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        estimatedCostUsd: telemetry.estimateCost(provider.model, result.usage?.inputTokens, result.usage?.outputTokens),
        at: new Date().toISOString(),
      });
      return { data: fallback, source: "fallback", note: "The model's reply did not match the expected shape." };
    }

    const data = validated.data as T;

    const safety = safetyCheck(task, data);
    if (safety) {
      telemetry.record({
        task,
        provider: provider.name,
        model: provider.model,
        promptVersion,
        outcome: "unsafe-output",
        latencyMs: Date.now() - started,
        at: new Date().toISOString(),
      });
      return { data: fallback, source: "fallback", note: safety };
    }

    if (options.validate && !options.validate(data)) {
      telemetry.record({
        task,
        provider: provider.name,
        model: provider.model,
        promptVersion,
        outcome: "invalid-schema",
        latencyMs: Date.now() - started,
        at: new Date().toISOString(),
      });
      return { data: fallback, source: "fallback", note: "The model's reply failed this task's checks." };
    }

    cache.set(task, key, data);
    const latencyMs = Date.now() - started;
    telemetry.record({
      task,
      provider: provider.name,
      model: provider.model,
      promptVersion,
      outcome: "ai",
      latencyMs,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      estimatedCostUsd: telemetry.estimateCost(provider.model, result.usage?.inputTokens, result.usage?.outputTokens),
      at: new Date().toISOString(),
    });
    return { data, source: "ai", provider: provider.name, promptVersion, latencyMs };
  } catch (error) {
    telemetry.record({
      task,
      provider: provider.name,
      model: provider.model,
      promptVersion,
      outcome: "error",
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
    });
    const message = error instanceof Error ? error.message : String(error);
    return {
      data: fallback,
      source: "fallback",
      // The provider's error text can echo request content, so only its shape is kept.
      note: `AI call failed (${message.slice(0, 40).replace(/[\r\n]/g, " ")}). Showing the built-in version.`,
    };
  }
}

/**
 * Every string a model produced is checked before display. The gates differ by
 * task because the failure modes differ: feedback can drift into character
 * judgements, coaching into persuasion technique.
 */
function safetyCheck(task: AiTask, data: unknown): string | null {
  const text = collectStrings(data).join("\n");

  const generated = checkGeneratedContent(text);
  if (generated.verdict !== "ok") return generated.message ?? "Generated content failed the safety check.";

  if (task === "phrase-feedback" || task === "coach-explain" || task === "explain-insight") {
    const language = checkFeedbackLanguage(text);
    if (language.verdict !== "ok") return language.message ?? "Generated feedback failed the language check.";
  }

  if (task === "phrase-feedback") {
    const value = data as { whatWorked?: string[] };
    const balance = checkCriticismBalance(value.whatWorked ?? [], 1);
    if (balance.verdict !== "ok") return balance.message ?? "Feedback was unbalanced.";
  }

  if (task === "explain-insight") {
    const value = data as { possibleExplanation?: string };
    // The hedge is the entire point of this field; an unhedged causal claim
    // presented as an insight is the failure this check exists to catch.
    if (value.possibleExplanation && !/\b(one|a possible|possibly|may|might|could|perhaps|it may be)\b/i.test(value.possibleExplanation)) {
      return "The explanation was not appropriately hedged.";
    }
  }

  return null;
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectStrings(item, depth + 1));
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => collectStrings(item, depth + 1));
  return [];
}

/** The task discriminator is carried in the system prompt; sending it twice wastes tokens. */
function stripForPrompt(request: AiRequest): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...(request as Record<string, unknown>) };
  delete rest.task;
  return rest;
}

export { telemetry };
