import { NextResponse } from "next/server";
import { generateMindMap } from "@/lib/anthropicAssistant";
import { checkRateLimit } from "@/lib/rateLimit";

// Bound free-form source text so a request can't drive up token cost.
const MAX_SOURCE_TEXT_LENGTH = 50_000;

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "generate-mindmap", limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  let body: { subjectContext?: string; sourceText?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.sourceText || typeof body.sourceText !== "string") {
    return NextResponse.json({ error: "sourceText is required" }, { status: 400 });
  }
  if (body.sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `sourceText must be under ${MAX_SOURCE_TEXT_LENGTH} characters` },
      { status: 400 },
    );
  }

  try {
    const mindMap = await generateMindMap(
      body.subjectContext ?? "general",
      body.sourceText,
      body.apiKey,
    );
    return NextResponse.json(mindMap);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mind map generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
