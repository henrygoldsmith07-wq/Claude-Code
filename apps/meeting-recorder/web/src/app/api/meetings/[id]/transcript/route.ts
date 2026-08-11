import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMeetings } from "@/lib/mongodb";
import { toMeeting } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/meetings/:id/transcript — edit transcript text, speaker names, history, enrolment. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as {
    segments?: { start: number; end: number; text: string; words?: { word: string; start: number; end: number; confidence: number }[] }[];
    speakers?: Record<string,string>;
    speakerEnrolment?: { id: string; name: string; sampleText?: string }[];
    transcriptHistory?: { at: string; segmentIndex: number; before: string; after: string }[];
  };
  const _id = new ObjectId(params.id);
  const col = await getMeetings();
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (Array.isArray(body.segments)) {
    const transcript = body.segments;
    const text = transcript.map((s) => s.text).join(" ");
    const existing = await col.findOne({ _id }, { projection: { transcript: 1 } });
    const words = existing?.transcript?.words ?? undefined;
    update.transcript = { text, segments: transcript, ...(words ? { words } : {}) };
  }
  if (body.speakers && typeof body.speakers === "object") update.speakers = body.speakers;
  if (Array.isArray(body.speakerEnrolment)) update.speakerEnrolment = body.speakerEnrolment;
  if (Array.isArray(body.transcriptHistory)) update.transcriptHistory = body.transcriptHistory;
  const doc = await col.findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ meeting: toMeeting(doc) });
}
