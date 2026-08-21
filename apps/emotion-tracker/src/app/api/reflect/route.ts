import { NextResponse } from "next/server";
import { getNextReflectionStep } from "@/lib/gemini";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Message, ReflectionMode } from "@/lib/types";
import { detectAdversarial, shouldNotAutoConvert } from "@/lib/adversarial";

// Cap the conversation so a single request can't send an unbounded history
// and drive up token usage (and cost) on the server fallback key.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 8000;

export async function POST(request: Request) {
  // Calls the paid Gemini API — rate limit per client so it can't be
  // spammed to run up the account owner's bill.
  const limited = checkRateLimit(request, { name: "reflect", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  let body: { messages?: Message[]; apiKey?: string; entries?: unknown; mode?: ReflectionMode; corrections?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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

  // Adversarial pre-check: block pure prompt-injection without calling LLM
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const flags = detectAdversarial(lastUser.content);
    if (flags.some((f) => f.flag === "prompt_injection" && f.confidence >= 0.9)) {
      return NextResponse.json({ error: "Message appears to contain instruction override — please rephrase as your own experience." }, { status: 400 });
    }
    // do not auto-convert every sentence; if flagged, hint is added in system prompt, not filtered here
    void shouldNotAutoConvert;
  }

  try {
    const entries = Array.isArray(body.entries) ? (body.entries as { id: string; coreEmotion: string | null; triggers: string[] }[]).slice(0, 5) : undefined;
    // lightweight entry hints: id + labels only, max 5, no verbatim text — retrieve only relevant via memory layer when possible
    const entryHints = entries?.map((e) => ({
      id: String(e.id).slice(0, 80),
      createdAt: new Date().toISOString(),
      title: "",
      messages: [],
      status: "complete" as const,
      summary: e.coreEmotion || e.triggers.length ? {
        trace: { event: "", observations: [], assumptions: [], namedEmotion: e.coreEmotion ?? "", alternativeInterpretations: [], intendedOutcome: "", intendedAction: "", predictedOutcome: "", followUpAt: null, followUpNote: null },
        coreEmotion: e.coreEmotion ?? "",
        underlyingTriggers: e.triggers.slice(0, 3),
        possibleBiases: [],
        otherPerspective: "", balancedAssessment: "", cautionFlags: [], suggestedNextSteps: [], hedgedDisclaimer: null,
      } : null,
    }));
    const corrections = Array.isArray(body.corrections) ? (body.corrections as unknown as Record<string, unknown>[]).slice(0, 10).map((c) => ({
      key: String(c.key ?? "").slice(0, 180),
      kind: (c.kind as import("@/lib/corrections").CorrectionKind) ?? "pattern",
      rejectedAt: String(c.rejectedAt ?? new Date().toISOString()),
      reason: typeof c.reason === "string" ? String(c.reason).slice(0, 300) : undefined,
      rejectedInterpretation: typeof c.rejectedInterpretation === "string" ? String(c.rejectedInterpretation).slice(0, 300) : undefined,
      affectedFacts: Array.isArray(c.affectedFacts) ? (c.affectedFacts as string[]).slice(0, 6).map((s) => String(s).slice(0, 120)) : undefined,
      affectedPatterns: Array.isArray(c.affectedPatterns) ? (c.affectedPatterns as string[]).slice(0, 6).map((s) => String(s).slice(0, 120)) : undefined,
      replacementUnderstanding: typeof c.replacementUnderstanding === "string" ? String(c.replacementUnderstanding).slice(0, 300) : null,
    })) : undefined;
    const result = await getNextReflectionStep(messages, body.apiKey, { entries: entryHints as unknown as import("@/lib/types").Entry[], mode, corrections });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reflection step failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
