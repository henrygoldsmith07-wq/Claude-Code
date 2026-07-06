import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateQuizQuestions } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/types";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const count = Math.min(Math.max(body.count ?? 8, 1), 15);

  try {
    const selectQuery = await supabase
      .from("quiz_content")
      .select("id, question, options, correct_index, explanation")
      .eq("topic_id", topic.id);
    if (selectQuery.error) throw new Error(selectQuery.error.message);
    let rows = selectQuery.data;

    if (!rows || rows.length === 0) {
      const generated = await generateQuizQuestions(subject.name, topic.title, count, body.apiKey);
      const { data: inserted, error: insertError } = await supabase
        .from("quiz_content")
        .insert(
          generated.map((g) => ({
            subject_id: topic.subjectId,
            topic_id: topic.id,
            question: g.question,
            options: g.options,
            correct_index: g.correctIndex,
            explanation: g.explanation,
          })),
        )
        .select("id, question, options, correct_index, explanation");
      if (insertError) throw new Error(insertError.message);
      rows = inserted ?? [];
    }

    const questions: QuizQuestion[] = rows.map((r) => ({
      id: r.id,
      subjectId: topic.subjectId,
      topicId: topic.id,
      question: r.question,
      options: r.options as string[],
      correctIndex: r.correct_index,
      explanation: r.explanation,
    }));

    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quiz generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
