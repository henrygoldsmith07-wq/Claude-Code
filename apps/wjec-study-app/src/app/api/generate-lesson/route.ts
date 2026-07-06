import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateLesson } from "@/lib/anthropic";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { LessonSection } from "@/lib/types";

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "generate-lesson", limit: 20, windowMs: 60_000 });
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { data: existing, error: selectError } = await supabase
      .from("lesson_content")
      .select("sections")
      .eq("topic_id", topic.id)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);

    let sections: LessonSection[];
    if (existing) {
      sections = existing.sections as unknown as LessonSection[];
    } else {
      sections = await generateLesson(subject.name, topic.title, body.apiKey);
      const { error: insertError } = await supabase
        .from("lesson_content")
        .insert({ topic_id: topic.id, subject_id: topic.subjectId, sections: sections as unknown as Json });
      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({ sections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lesson generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
