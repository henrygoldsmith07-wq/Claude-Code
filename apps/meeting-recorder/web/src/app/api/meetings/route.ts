import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getMeetings, MeetingDoc } from "@/lib/mongodb";
import { presignUpload } from "@/lib/r2";
import { toMeeting } from "@/lib/serialize";
import { isAuthorized } from "@/lib/auth";
import type { CreateMeetingRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "bin";
}

/** GET /api/meetings — list meetings for the dashboard (newest first). */
export async function GET() {
  const col = await getMeetings();
  const docs = await col.find({}).sort({ createdAt: -1 }).limit(200).toArray();
  return NextResponse.json({ meetings: docs.map(toMeeting) });
}

/**
 * POST /api/meetings — create a meeting record and hand back a presigned R2
 * upload URL. Called by the desktop recorder when a recording stops.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreateMeetingRequest = {};
  try {
    body = (await req.json()) as CreateMeetingRequest;
  } catch {
    // empty body is fine — defaults below
  }

  const mimeType = body.mimeType?.trim() || "video/webm";
  const shareId = nanoid(12);
  const now = new Date();
  const key = `recordings/${now.getFullYear()}/${shareId}.${extForMime(mimeType)}`;

  const doc: MeetingDoc = {
    title: body.title?.trim() || `Meeting — ${now.toLocaleString()}`,
    status: "created",
    createdAt: now,
    updatedAt: now,
    durationSec: Math.max(0, Math.floor(body.durationSec ?? 0)),
    r2Key: key,
    mimeType,
    shareId,
    transcript: null,
    summary: null,
    error: null,
    chat: [],
  };

  const col = await getMeetings();
  const insert = await col.insertOne(doc);
  const upload = await presignUpload(key, mimeType);

  return NextResponse.json({
    meeting: toMeeting({ ...doc, _id: insert.insertedId }),
    upload: { url: upload.url, method: "PUT" as const, headers: upload.headers },
  });
}
