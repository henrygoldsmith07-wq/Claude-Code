import { NextResponse } from "next/server";
import { getNextReflectionStep, ProviderContractError } from "@/lib/gemini";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Message, ReflectionMode } from "@/lib/types";
import { detectAdversarial } from "@/lib/adversarial";

// Cap the conversation so a single request can't send an unbounded history
// and drive up token usage (and cost) on the server fallback key.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 8000;
// Route handlers have no automatic body-size limit; reject oversized payloads
// before buffering/parsing them into memory.
const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: { messages?: Message[]; apiKey?: string; entries?: unknown; mode?: ReflectionMode; corrections?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Rate limit per client: the OpenRouter account is free-models-only (no
  // spend risk), so the ceiling is generous while still stopping spam.
  const limited = checkRateLimit(request, { name: "reflect", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: `messages must contain at most ${MAX_MESSAGES} items` },
      { status: 400 },
    );
  }
  for (const message of messages) {
    if (
      (message.role !== "user" && message.role !== "assistant") ||
      typeof message.content !== "string" ||
      message.content.length === 0 ||
      message.content.length > MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json({ error: "Invalid message in conversation history" }, { status: 400 });
    }
  }
  if (messages[0].role !== "user") {
    return NextResponse.json({ error: "First message must describe the situation" }, { status: 400 });
  }
  const mode: ReflectionMode = body.mode === "quick" ? "quick" : "full";

  // Adversarial pre-check: block pure prompt-injection without calling LLM.
  // Every user turn is scanned — an injection split across messages must not
  // evade the block just because its payload isn't in the latest turn.
  const injectionHit = messages
    .filter((m) => m.role === "user")
    .some((m) => detectAdversarial(m.content).some((f) => f.flag === "prompt_injection" && f.confidence >= 0.9));
  if (injectionHit) {
    return NextResponse.json({ error: "Message appears to contain instruction override — please rephrase as your own experience." }, { status: 400 });
  }
  // do not auto-convert every sentence; if flagged, hint is added in system prompt, not filtered here

  try {
    // lightweight entry hints: id + labels only, max 5, no verbatim text.
    // Items are validated individually — one malformed row is skipped, never
    // a crash (the client controls this array).
    const entryHints = Array.isArray(body.entries)
      ? body.entries.slice(0, 5).flatMap((raw): import("@/lib/types").Entry[] => {
          if (typeof raw !== "object" || raw === null) return [];
          const e = raw as Record<string, unknown>;
          if (typeof e.id !== "string" || !e.id.trim()) return [];
          const coreEmotion = typeof e.coreEmotion === "string" ? e.coreEmotion : null;
          const triggers = Array.isArray(e.triggers) ? e.triggers.filter((t): t is string => typeof t === "string") : [];
          return [{
            id: e.id.slice(0, 80),
            createdAt: new Date().toISOString(),
            title: "",
            messages: [],
            status: "complete" as const,
            summary: coreEmotion || triggers.length ? {
              trace: { event: "", observations: [], assumptions: [], namedEmotion: coreEmotion ?? "", alternativeInterpretations: [], intendedOutcome: "", intendedAction: "", predictedOutcome: "", followUpAt: null, followUpNote: null },
              coreEmotion: coreEmotion ?? "",
              underlyingTriggers: triggers.slice(0, 3),
              possibleBiases: [],
              otherPerspective: "", balancedAssessment: "", cautionFlags: [], suggestedNextSteps: [], hedgedDisclaimer: null,
            } : null,
          }];
        })
      : undefined;
    const corrections = Array.isArray(body.corrections)
      ? body.corrections.slice(0, 10).flatMap((raw): import("@/lib/corrections").Correction[] => {
          if (typeof raw !== "object" || raw === null) return [];
          const c = raw as Record<string, unknown>;
          const kind = typeof c.kind === "string" && ["pattern", "assumption", "contradiction", "calibration", "unresolved"].includes(c.kind)
            ? (c.kind as import("@/lib/corrections").CorrectionKind)
            : "pattern";
          return [{
            key: String(c.key ?? "").slice(0, 180),
            kind,
            rejectedAt: String(c.rejectedAt ?? new Date().toISOString()),
            reason: typeof c.reason === "string" ? String(c.reason).slice(0, 300) : undefined,
            rejectedInterpretation: typeof c.rejectedInterpretation === "string" ? String(c.rejectedInterpretation).slice(0, 300) : undefined,
            affectedFacts: Array.isArray(c.affectedFacts) ? c.affectedFacts.slice(0, 6).map((s) => String(s).slice(0, 120)) : undefined,
            affectedPatterns: Array.isArray(c.affectedPatterns) ? c.affectedPatterns.slice(0, 6).map((s) => String(s).slice(0, 120)) : undefined,
            replacementUnderstanding: typeof c.replacementUnderstanding === "string" ? String(c.replacementUnderstanding).slice(0, 300) : null,
          }];
        })
      : undefined;
    const result = await getNextReflectionStep(messages, body.apiKey, { entries: entryHints, mode, corrections });
    return NextResponse.json(result);
  } catch (error) {
    // Contract failures (key handling, hedging rules, correction enforcement)
    // are product messages — forward them. Anything else is an internal
    // failure: log it server-side and return a generic message so SDK/quota/
    // infrastructure details never reach the client.
    if (error instanceof ProviderContractError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("[reflect] unexpected failure:", error);
    return NextResponse.json(
      { error: "The reflection service hit an unexpected problem — try again." },
      { status: 502 },
    );
  }
}
