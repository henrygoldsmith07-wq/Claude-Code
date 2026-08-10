import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMeetings } from "@/lib/mongodb";
import { getObjectBytes } from "@/lib/r2";
import { transcribe } from "@/lib/groq";
import { summarize } from "@/lib/anthropic";
import { extractInsightsHeuristic } from "@/lib/insights";
import { toMeeting } from "@/lib/serialize";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcription of a full meeting can take a while.
export const maxDuration = 300;

/**
 * POST /api/meetings/:id/transcribe — fetch the recording from R2, transcribe
 * with Groq Whisper, generate a summary with Anthropic, and mark it ready.
 * The recorder calls this after the upload completes.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const _id = new ObjectId(params.id);

  const col = await getMeetings();
  const doc = await col.findOne({ _id });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  await col.updateOne({ _id }, { $set: { status: "processing", updatedAt: new Date() } });

  try {
    const bytes = await getObjectBytes(doc.r2Key);
    const filename = doc.r2Key.split("/").pop() || "recording.webm";
    const transcript = await transcribe(bytes, filename, doc.mimeType);

    // Insights are heuristic-only here — no extra LLM call; owner linkage stays evidence-bound.
    const insights = extractInsightsHeuristic(transcript);
    // Summary is best-effort — a transcript with no summary is still useful.
    let summary: string | null = null;
    try {
      summary = await summarize(transcript);
    } catch {
      summary = null;
    }

    const updated = await col.findOneAndUpdate(
      { _id },
      { $set: { transcript, summary, insights, status: "ready", error: null, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return NextResponse.json({ meeting: updated ? toMeeting(updated) : null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "transcription failed";
    await col.updateOne(
      { _id },
      { $set: { status: "error", error: message, updatedAt: new Date() } }
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
