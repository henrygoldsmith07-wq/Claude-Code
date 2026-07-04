import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateLesson } from "@/lib/anthropic";

export async function POST(request: Request) {
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
    const sections = await generateLesson(subject.name, topic.title, body.apiKey);
    return NextResponse.json({ sections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lesson generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
