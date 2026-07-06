import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generatePracticeTest, type GeneratedPracticeItem } from "@/lib/anthropicAssistant";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { PracticeFormat } from "@/lib/types";

const VALID_FORMATS: PracticeFormat[] = ["mcq", "matching", "fill-blank"];

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, {
    name: "generate-practice-test",
    limit: 15,
    windowMs: 60_000,
  });
  if (limited) return limited;

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const count = Math.min(Math.max(body.count ?? 8, 1), 15);

  try {
    const { data: existing, error: selectError } = await supabase
      .from("practice_test_content")
      .select("items")
      .eq("topic_id", topic.id)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);

    let items: GeneratedPracticeItem[];
    if (existing) {
      items = existing.items as unknown as GeneratedPracticeItem[];
    } else {
      items = await generatePracticeTest(subject.name, topic.title, formats, count, body.apiKey);
      const { error: insertError } = await supabase
        .from("practice_test_content")
        .insert({ topic_id: topic.id, subject_id: topic.subjectId, items: items as unknown as Json });
      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Practice test generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
