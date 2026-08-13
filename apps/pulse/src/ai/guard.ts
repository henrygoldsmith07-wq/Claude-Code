/**
 * The numeric firewall.
 *
 * AI is allowed to do four things in Pulse: explain, summarise, parse a
 * natural-language question, and word a hypothesis. It is never allowed to
 * produce a number. That is not a policy note — it is enforced here.
 *
 * Any narrative returned by a model is scanned for numeric tokens, and every
 * one of them must appear in the fact set that the deterministic engine
 * computed. A single unverifiable number rejects the whole narrative and the
 * caller falls back to the template. This means the worst case is prose that
 * reads a little flatter, never prose that is quietly wrong.
 */

export interface NumericFact {
  /** Canonical string as the engine computed it, e.g. "8.7". */
  value: string;
  /** What it means, used in the prompt so the model can place it correctly. */
  label: string;
}

export interface GuardViolation {
  token: string;
  reason: "not-in-facts" | "fabricated-precision";
}

export interface GuardResult {
  ok: boolean;
  violations: GuardViolation[];
  /** Numbers that were present and verified. */
  verified: string[];
}

/** Numbers a narrative may always use: small counts and ordinals in prose. */
const ALWAYS_ALLOWED = new Set(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "12", "24"]);

const NUMBER_PATTERN = /-?\d+(?:[.,]\d+)*/g;

function canonicalise(token: string): string {
  const normalised = token.replace(/,/g, "");
  const parsed = Number(normalised);
  if (!Number.isFinite(parsed)) return normalised;
  // Trailing zeros must not make "8.70" look different from "8.7".
  return String(parsed);
}

/**
 * Builds the set of numeric strings a narrative is permitted to contain.
 *
 * Each fact contributes several renderings of the same quantity, because a
 * model may legitimately write 0.087 as 8.7% or round 42.0 to 42, and
 * rejecting that would make the guard useless in practice.
 */
export function buildAllowedNumbers(facts: readonly NumericFact[]): Set<string> {
  const allowed = new Set<string>(ALWAYS_ALLOWED);
  for (const fact of facts) {
    const parsed = Number(fact.value.replace(/[,%]/g, ""));
    if (!Number.isFinite(parsed)) continue;
    allowed.add(canonicalise(fact.value));
    allowed.add(String(parsed));
    allowed.add(String(Math.round(parsed)));
    allowed.add(parsed.toFixed(1));
    allowed.add(parsed.toFixed(2));
    allowed.add(canonicalise(parsed.toFixed(1)));
    allowed.add(canonicalise(parsed.toFixed(2)));
    // Percentage rendering of a ratio, and vice versa.
    if (Math.abs(parsed) <= 1) {
      const asPercent = parsed * 100;
      allowed.add(canonicalise(asPercent.toFixed(1)));
      allowed.add(String(Math.round(asPercent)));
    } else {
      const asRatio = parsed / 100;
      allowed.add(canonicalise(asRatio.toFixed(3)));
      allowed.add(canonicalise(asRatio.toFixed(2)));
    }
  }
  return allowed;
}

export function guardNarrative(text: string, facts: readonly NumericFact[]): GuardResult {
  const allowed = buildAllowedNumbers(facts);
  const violations: GuardViolation[] = [];
  const verified: string[] = [];

  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const token = match[0];
    const canonical = canonicalise(token);
    if (allowed.has(canonical) || allowed.has(token)) {
      verified.push(token);
      continue;
    }
    violations.push({ token, reason: "not-in-facts" });
  }

  return { ok: violations.length === 0, violations, verified };
}

export interface LanguageModel {
  /** Returns prose only. Implementations must not have tool access. */
  complete(prompt: string, options?: { maxTokens?: number }): Promise<string>;
}

export interface NarrativeRequest {
  /** Deterministically composed text. The fallback, and the source of truth. */
  deterministic: string;
  /** Numbers the model may use. */
  facts: NumericFact[];
  /** What kind of rewrite is wanted. */
  task: "explain" | "summarise" | "word-hypothesis";
  /** Extra non-numeric context, e.g. metric names and caveats. */
  context?: string[];
}

export interface NarrativeResult {
  text: string;
  /** True when the model's text was used; false when it fell back. */
  usedModel: boolean;
  violations: GuardViolation[];
}

const TASK_INSTRUCTIONS: Record<NarrativeRequest["task"], string> = {
  explain:
    "Rewrite the finding below so it is easy to read. Keep every number exactly as given. Do not add numbers, do not estimate, and do not claim that anything causes anything.",
  summarise:
    "Summarise the points below in at most three sentences. Keep every number exactly as given and introduce none of your own.",
  "word-hypothesis":
    "Restate the hypothesis below as one clear, testable sentence. Keep every number exactly as given.",
};

export function buildPrompt(request: NarrativeRequest): string {
  const facts = request.facts.map((fact) => `- ${fact.label}: ${fact.value}`).join("\n");
  const context = request.context?.length ? `\n\nContext (do not contradict):\n${request.context.map((c) => `- ${c}`).join("\n")}` : "";
  return [
    TASK_INSTRUCTIONS[request.task],
    "",
    "The only numbers you may use:",
    facts || "- (none)",
    context,
    "",
    "Text to rewrite:",
    request.deterministic,
  ].join("\n");
}

/**
 * Runs a narrative through the model and the guard.
 *
 * Falls back silently to the deterministic text on any failure — an unreachable
 * model, a refusal, or a fabricated number. The caller always gets usable copy.
 */
export async function narrate(request: NarrativeRequest, model?: LanguageModel): Promise<NarrativeResult> {
  if (!model) return { text: request.deterministic, usedModel: false, violations: [] };

  let candidate: string;
  try {
    candidate = await model.complete(buildPrompt(request));
  } catch {
    return { text: request.deterministic, usedModel: false, violations: [] };
  }

  const trimmed = candidate.trim();
  if (!trimmed) return { text: request.deterministic, usedModel: false, violations: [] };

  const guard = guardNarrative(trimmed, request.facts);
  if (!guard.ok) return { text: request.deterministic, usedModel: false, violations: guard.violations };

  // Causal language is not permitted in explanations of observational results.
  if (request.task === "explain" && /\b(causes?|caused|because of|leads to|proves)\b/i.test(trimmed)) {
    return {
      text: request.deterministic,
      usedModel: false,
      violations: [{ token: "causal-language", reason: "fabricated-precision" }],
    };
  }

  return { text: trimmed, usedModel: true, violations: [] };
}

/**
 * A model that does nothing. The default, so Pulse is fully functional with no
 * AI provider configured and no data leaving the device.
 */
export const offlineModel: LanguageModel = {
  async complete() {
    return "";
  },
};
