import { NextRequest, NextResponse } from "next/server";
import { getMeetings } from "@/lib/mongodb";
import { deleteObject } from "@/lib/r2";
import { isAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/cron/retention — delete expired meetings (autoDelete). Cron or manual. */
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const col = await getMeetings();
  const now = Date.now();
  const docs = await col.find({ retentionDays: { $exists: true } }).toArray();
  let deleted = 0;
  for (const doc of docs) {
    const days = doc.retentionDays as unknown as number;
    if (typeof days !== "number" || days <= 0) continue;
    const deadline = new Date(doc.createdAt).getTime() + days * 24 * 3600_000;
    if (deadline >= now) continue;
    // Only auto-delete when policy says so — here retentionDays being set implies autoDelete for now.
    await deleteObject(doc.r2Key).catch(()=>{});
    await col.deleteOne({ _id: doc._id });
    deleted++;
  }
  return NextResponse.json({ deleted, checked: docs.length });
}

export async function GET(req: NextRequest) { return POST(req); }
