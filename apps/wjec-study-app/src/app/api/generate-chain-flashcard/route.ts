import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateChainFlashcards } from "@/lib/anthropicAssistant";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { ChainFlashcard, ChainFlashcardStep } from "@/lib/types";

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, {
    name: "generate-chain-flashcard",
    limit: 15,
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { data: existing, error: selectError } = await supabase
      .from("chain_flashcard_content")
      .select("id, title, steps")
      .eq("topic_id", topic.id);
    if (selectError) throw new Error(selectError.message);

    let chains: { id: string; title: string; steps: ChainFlashcardStep[] }[] = (existing ?? []).map(
      (c) => ({ id: c.id, title: c.title, steps: c.steps as unknown as ChainFlashcardStep[] }),
    );

    if (chains.length === 0) {
      const generated = await generateChainFlashcards(subject.name, topic.title, body.apiKey);
      const { data: inserted, error: insertError } = await supabase
        .from("chain_flashcard_content")
        .insert({
          topic_id: topic.id,
          subject_id: topic.subjectId,
          title: generated.title,
          steps: generated.steps as unknown as Json,
        })
        .select("id, title, steps")
        .single();
      if (insertError) throw new Error(insertError.message);
      chains = [{ id: inserted.id, title: inserted.title, steps: inserted.steps as unknown as ChainFlashcardStep[] }];
    }

    const chain = chains[Math.floor(Math.random() * chains.length)];
    const result: ChainFlashcard = {
      id: chain.id,
      subjectId: topic.subjectId,
      topicId: topic.id,
      title: chain.title,
      steps: chain.steps,
    };

    return NextResponse.json({ chain: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chain flashcard generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
