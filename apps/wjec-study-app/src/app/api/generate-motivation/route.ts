import { NextResponse } from "next/server";
import { findSubject } from "@/lib/curriculum";
import { generateMotivationalPrompts } from "@/lib/anthropicAssistant";
import { checkRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import type { SubjectId } from "@/lib/types";

const MIN_CACHED_PROMPTS = 6;

export async function POST(request: Request) {
  // Calls the paid Anthropic API — rate limit per client to prevent abuse.
  const limited = checkRateLimit(request, { name: "generate-motivation", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  let body: { subjectId?: SubjectId; examDate?: string | null; apiKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subject = body.subjectId ? findSubject(body.subjectId) : undefined;
  if (!subject) {
    return NextResponse.json({ error: "Unknown subjectId" }, { status: 400 });
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
      .from("motivational_prompts_content")
      .select("tone, message")
      .eq("subject_id", subject.id);
    if (selectError) throw new Error(selectError.message);

    let prompts = existing ?? [];
    if (prompts.length < MIN_CACHED_PROMPTS) {
      const generated = await generateMotivationalPrompts(
        subject.name,
        body.examDate ?? null,
        body.apiKey,
      );
      const { error: insertError } = await supabase.from("motivational_prompts_content").insert(
        generated.map((p) => ({ subject_id: subject.id, tone: p.tone, message: p.message })),
      );
      if (insertError) throw new Error(insertError.message);
      prompts = [...prompts, ...generated];
    }

    return NextResponse.json({ prompts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Motivational prompt generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
