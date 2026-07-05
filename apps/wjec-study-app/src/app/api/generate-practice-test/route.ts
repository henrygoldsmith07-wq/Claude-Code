import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generatePracticeTest } from "@/lib/anthropicAssistant";
import type { PracticeFormat } from "@/lib/types";

const VALID_FORMATS: PracticeFormat[] = ["mcq", "matching", "fill-blank"];

export async function POST(request: Request) {
  let body: { topicId?: string; formats?: PracticeFormat[]; count?: number; apiKey?: string };
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

  const formats = (body.formats ?? []).filter((f): f is PracticeFormat => VALID_FORMATS.includes(f));
  if (formats.length === 0) {
    return NextResponse.json({ error: "At least one valid format is required" }, { status: 400 });
  }

  const count = Math.min(Math.max(body.count ?? 8, 1), 15);

  try {
    const items = await generatePracticeTest(subject.name, topic.title, formats, count, body.apiKey);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Practice test generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
