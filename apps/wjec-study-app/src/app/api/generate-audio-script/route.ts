import { NextResponse } from "next/server";
import { findSubject, findTopic } from "@/lib/curriculum";
import { generateAudioScript } from "@/lib/anthropicAssistant";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { AudioScriptLine } from "@/lib/types";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    const { data: existing, error: selectError } = await supabase
      .from("audio_script_content")
      .select("script")
      .eq("topic_id", topic.id)
      .maybeSingle();
    if (selectError) throw new Error(selectError.message);

    let script: AudioScriptLine[];
    if (existing) {
      script = existing.script as unknown as AudioScriptLine[];
    } else {
      script = await generateAudioScript(subject.name, topic.title, body.apiKey);
      const { error: insertError } = await supabase
        .from("audio_script_content")
        .insert({ topic_id: topic.id, subject_id: topic.subjectId, script: script as unknown as Json });
      if (insertError) throw new Error(insertError.message);
    }

    return NextResponse.json({ script });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio script generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
