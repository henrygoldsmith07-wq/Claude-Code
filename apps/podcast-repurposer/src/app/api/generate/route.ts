import { NextResponse } from "next/server";
import { generateEpisodeOutputs } from "@/lib/anthropic";
import { getSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/rateLimit";
import type { GenerateRequest } from "@/lib/types";

const MAX_TRANSCRIPT_LENGTH = 60000;
const MIN_TRANSCRIPT_LENGTH = 50;

export async function POST(request: Request) {
  const limited = checkRateLimit(request, { name: "generate", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = body.title?.trim();
  const transcript = body.transcript?.trim();
  const apiKey = body.apiKey?.trim();

  if (!title || !transcript) {
    return NextResponse.json(
      { error: "title and transcript are required" },
      { status: 400 },
    );
  }
  if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `transcript is too short (min ${MIN_TRANSCRIPT_LENGTH} characters)` },
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
    outputs = await generateEpisodeOutputs(title, transcript, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let episodeId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
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
    } catch {
      // Persistence is best-effort; never fail the generation response
    }
  }

  return NextResponse.json({ episodeId, outputs });
}
