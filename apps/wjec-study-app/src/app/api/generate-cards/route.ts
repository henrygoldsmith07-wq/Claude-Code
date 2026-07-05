import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateFlashcards } from "@/lib/anthropic";

export async function POST(request: Request) {
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

  const count = Math.min(Math.max(body.count ?? 10, 1), 20);

  try {
    const cards = await generateFlashcards(subject.name, topic.title, count, body.apiKey);
    return NextResponse.json({ cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flashcard generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
