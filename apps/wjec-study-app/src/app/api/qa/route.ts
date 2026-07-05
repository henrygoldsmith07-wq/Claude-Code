import { NextResponse } from "next/server";
import { answerQuestion, type QaHistoryMessage } from "@/lib/anthropicAssistant";

export async function POST(request: Request) {
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

  try {
    const answer = await answerQuestion(
      body.question,
      Array.isArray(body.history) ? body.history : [],
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
