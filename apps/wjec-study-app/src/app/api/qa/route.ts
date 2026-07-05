import { NextResponse } from "next/server";
import { answerQuestion, type QaHistoryMessage } from "@/lib/anthropicAssistant";
import { checkRateLimit } from "@/lib/rateLimit";

// Bound free-form input so a request can't drive up token cost.
const MAX_QUESTION_LENGTH = 8_000;
const MAX_HISTORY_MESSAGES = 40;

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "qa", limit: 30, windowMs: 60_000 });
  if (limited) return limited;

  let body: {
    question?: string;
    history?: QaHistoryMessage[];
    mode?: "direct" | "guided";
    anchorText?: string | null;
    apiKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.question || typeof body.question !== "string") {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (body.question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `question must be under ${MAX_QUESTION_LENGTH} characters` },
      { status: 400 },
    );
  }

  const history = Array.isArray(body.history)
    ? body.history.slice(-MAX_HISTORY_MESSAGES)
    : [];

  try {
    const answer = await answerQuestion(
      body.question,
      history,
      body.mode === "guided" ? "guided" : "direct",
      body.anchorText ?? null,
      body.apiKey,
    );
    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to answer question";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
