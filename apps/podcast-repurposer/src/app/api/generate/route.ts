import { NextResponse } from "next/server";
import { generateEpisodeOutputs } from "@/lib/anthropic";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import type { GenerateRequest } from "@/lib/types";

const MAX_TRANSCRIPT_LENGTH = 60000;

export async function POST(request: Request) {
  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title?.trim();
  const transcript = body.transcript?.trim();

  if (!title || !transcript) {
    return NextResponse.json(
      { error: "title and transcript are required" },
      { status: 400 },
    );
  }
  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `transcript must be under ${MAX_TRANSCRIPT_LENGTH} characters` },
      { status: 400 },
    );
  }

  let outputs;
  try {
    outputs = await generateEpisodeOutputs(title, transcript);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let episodeId: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseServerClient();
    const { data: episode, error: episodeError } = await supabase
      .from("episodes")
      .insert({ title, transcript })
      .select("id")
      .single();

    if (!episodeError && episode) {
      episodeId = episode.id;
      await supabase.from("episode_outputs").insert({
        episode_id: episode.id,
        blog_post: outputs.blogPost,
        show_notes: outputs.showNotes,
        social_snippets: outputs.socialSnippets,
        chapters: outputs.chapters,
      });
    }
  }

  return NextResponse.json({ episodeId, outputs });
}
