import { NextResponse } from "next/server";
import { getNextReflectionStep } from "@/lib/gemini";
import { checkRateLimit } from "@/lib/rateLimit";
import type { Message } from "@/lib/types";

// Cap the conversation so a single request can't send an unbounded history
// and drive up token usage (and cost) on the server fallback key.
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 8000;

export async function POST(request: Request) {
  // Calls the paid Gemini API — rate limit per client so it can't be
  // spammed to run up the account owner's bill.
  const limited = checkRateLimit(request, { name: "reflect", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  let body: { messages?: Message[]; apiKey?: string; entries?: unknown };
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

  try {
    const entries = Array.isArray(body.entries) ? (body.entries as { id: string; coreEmotion: string | null; triggers: string[] }[]).slice(0, 8) : undefined;
    // map lightweight entries hint into Entry-shaped objects for prompt diversity (no content leakage)
    const entryHints = entries?.map((e) => ({
      id: e.id,
      createdAt: new Date().toISOString(),
      title: "",
      messages: [],
      status: "complete" as const,
      summary: e.coreEmotion || e.triggers.length ? {
        trace: { event: "", observations: [], assumptions: [], namedEmotion: e.coreEmotion ?? "", alternativeInterpretations: [], intendedOutcome: "", intendedAction: "", predictedOutcome: "", followUpAt: null, followUpNote: null },
        coreEmotion: e.coreEmotion ?? "",
        underlyingTriggers: e.triggers,
        possibleBiases: [],
        otherPerspective: "", balancedAssessment: "", cautionFlags: [], suggestedNextSteps: [], hedgedDisclaimer: null,
      } : null,
    }));
    const result = await getNextReflectionStep(messages, body.apiKey, { entries: entryHints as unknown as import("@/lib/types").Entry[] });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reflection step failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
