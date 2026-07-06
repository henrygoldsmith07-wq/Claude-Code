import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateFlashcards } from "@/lib/anthropic";
import { initialReviewState } from "@/lib/fsrs";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import type { Flashcard } from "@/lib/types";

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "generate-cards", limit: 20, windowMs: 60_000 });
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const count = Math.min(Math.max(body.count ?? 10, 1), 20);

  try {
    const contentQuery = await supabase
      .from("flashcard_content")
      .select("id, front, back")
      .eq("topic_id", topic.id);
    if (contentQuery.error) throw new Error(contentQuery.error.message);
    let content = contentQuery.data;

    if (!content || content.length === 0) {
      const generated = await generateFlashcards(subject.name, topic.title, count, body.apiKey);
      const { data: inserted, error: insertError } = await supabase
        .from("flashcard_content")
        .insert(
          generated.map((g) => ({ subject_id: topic.subjectId, topic_id: topic.id, front: g.front, back: g.back })),
        )
        .select("id, front, back");
      if (insertError) throw new Error(insertError.message);
      content = inserted ?? [];
    }

    const { data: existingProgress, error: progressError } = await supabase
      .from("flashcard_progress")
      .select("id, flashcard_content_id")
      .eq("user_id", user.id)
      .in("flashcard_content_id", content.map((c) => c.id));
    if (progressError) throw new Error(progressError.message);

    const existingContentIds = new Set((existingProgress ?? []).map((p) => p.flashcard_content_id));
    const missing = content.filter((c) => !existingContentIds.has(c.id));

    if (missing.length > 0) {
      const seed = initialReviewState();
      const { error: seedError } = await supabase.from("flashcard_progress").insert(
        missing.map((c) => ({
          user_id: user.id,
          flashcard_content_id: c.id,
          due_date: seed.dueDate,
          stability: seed.stability,
          difficulty: seed.difficulty,
          reps: seed.reps,
          lapses: seed.lapses,
          state: seed.state,
        })),
      );
      if (seedError) throw new Error(seedError.message);
    }

    const { data: progress, error: finalError } = await supabase
      .from("flashcard_progress")
      .select("id, flashcard_content_id, due_date, stability, difficulty, reps, lapses, state, last_reviewed_at")
      .eq("user_id", user.id)
      .in("flashcard_content_id", content.map((c) => c.id));
    if (finalError) throw new Error(finalError.message);

    const contentById = new Map(content.map((c) => [c.id, c]));
    const cards: Flashcard[] = (progress ?? []).map((p) => {
      const c = contentById.get(p.flashcard_content_id)!;
      return {
        id: p.id,
        subjectId: topic.subjectId,
        topicId: topic.id,
        front: c.front,
        back: c.back,
        dueDate: p.due_date,
        stability: p.stability,
        difficulty: p.difficulty,
        reps: p.reps,
        lapses: p.lapses,
        state: p.state,
        lastReviewedAt: p.last_reviewed_at,
      };
    });

    return NextResponse.json({ cards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Flashcard generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
