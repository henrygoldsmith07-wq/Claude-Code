import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateAudioScript } from "@/lib/anthropicAssistant";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, {
    name: "generate-audio-script",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  let body: { topicId?: string; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = body.topicId ? findTopic(body.topicId) : undefined;
  if (!topic) {
    return NextResponse.json({ error: "Unknown topicId" }, { status: 400 });
  }
  const subject = findSubject(topic.subjectId);
  if (!subject) {
    return NextResponse.json({ error: "Unknown subject" }, { status: 400 });
  }

  try {
    const script = await generateAudioScript(subject.name, topic.title, body.apiKey);
    return NextResponse.json({ script });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio script generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
