import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMeetings } from "@/lib/mongodb";
import { playbackUrl, deleteObject } from "@/lib/r2";
import { toMeeting } from "@/lib/serialize";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function oid(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

/** GET /api/meetings/:id — meeting detail plus a fresh presigned playback URL. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const _id = oid(params.id);
  if (!_id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const col = await getMeetings();
  const doc = await col.findOne({ _id });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const meeting = toMeeting(doc);
  const url =
    doc.status === "created" ? null : await playbackUrl(doc.r2Key).catch(() => null);
  return NextResponse.json({ meeting, playbackUrl: url });
}

/** PATCH /api/meetings/:id — update title or status (recorder marks "uploaded"). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const _id = oid(params.id);
  if (!_id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    status?: string;
    durationSec?: number;
  };
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string" && body.title.trim()) update.title = body.title.trim();
  if (typeof body.status === "string") update.status = body.status;
  if (typeof body.durationSec === "number") update.durationSec = Math.floor(body.durationSec);

  const col = await getMeetings();
  const doc = await col.findOneAndUpdate({ _id }, { $set: update }, { returnDocument: "after" });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ meeting: toMeeting(doc) });
}

/** DELETE /api/meetings/:id — remove the record and its R2 object. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const _id = oid(params.id);
  if (!_id) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const col = await getMeetings();
  const doc = await col.findOne({ _id });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  await deleteObject(doc.r2Key).catch(() => undefined);
  await col.deleteOne({ _id });
  return NextResponse.json({ ok: true });
}
