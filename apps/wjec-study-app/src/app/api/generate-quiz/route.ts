import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateQuizQuestions } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "generate-quiz", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  let body: { topicId?: string; count?: number; apiKey?: string };
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

  const count = Math.min(Math.max(body.count ?? 8, 1), 15);

  try {
    const questions = await generateQuizQuestions(subject.name, topic.title, count, body.apiKey);
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quiz generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
