import { NextRequest, NextResponse } from "next/server";
import { getMeetings } from "@/lib/mongodb";
import { toMeeting } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/search?q=&scope=memory — searchable meeting memory (title + transcript + summary). */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const col = await getMeetings();
  const filter = q ? { $or: [{ title: { $regex: q, $options: "i" } }, { "transcript.text": { $regex: q, $options: "i" } }, { summary: { $regex: q, $options: "i" } }, { "transcript.segments.text": { $regex: q, $options: "i" } }] } : {};
  const docs = await col.find(filter).sort({ createdAt: -1 }).limit(100).toArray();
  const collections = q ? await col.distinct("collections").catch(()=>[]) : [];
  return NextResponse.json({ meetings: docs.map(toMeeting), q, collections });
}
