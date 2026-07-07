import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { serializeDebate, serializeTurn } from "@/lib/db/serialize";
import { checkRateLimit } from "@/lib/rateLimit";
import { debateOpening } from "@/lib/gemini";
import type { DebateSide } from "@/lib/types";

export async function POST(request: Request) {
  const limited = checkRateLimit(request, { name: "solo-start", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const topicId = typeof body?.topicId === "string" ? body.topicId : null;
  const side: DebateSide | null = body?.side === "for" || body?.side === "against" ? body.side : null;
  if (!topicId || !ObjectId.isValid(topicId) || !side) {
    return NextResponse.json({ error: "topicId and side are required." }, { status: 400 });
  }

  const db = await getDb();
  const topic = await db.collection("daily_topics").findOne({ _id: new ObjectId(topicId) });
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const debates = db.collection("solo_debates");
  const now = new Date().toISOString();
  const debateInsert = await debates.insertOne({
    user_id: new ObjectId(session.user.id),
    topic_id: new ObjectId(topicId),
    side,
    status: "active",
    round_count: 1,
    total_score: null,
    created_at: now,
    completed_at: null,
  });

  const aiSide: DebateSide = side === "for" ? "against" : "for";
  let aiMessage: string;
  try {
    aiMessage = await debateOpening({ topicTitle: topic.title, topicPrompt: topic.prompt, aiSide });
  } catch (error) {
    console.error("Failed to generate opening:", error);
    return NextResponse.json({ error: "Failed to generate AI opening." }, { status: 502 });
  }

  const turns = db.collection("solo_debate_turns");
  const turnInsert = await turns.insertOne({
    debate_id: debateInsert.insertedId,
    round_number: 1,
    ai_message: aiMessage,
    user_message: null,
    input_mode: "text",
    scores: null,
    turn_score: null,
    feedback: null,
    created_at: now,
  });

  const debateDoc = await debates.findOne({ _id: debateInsert.insertedId });
  const turnDoc = await turns.findOne({ _id: turnInsert.insertedId });
  if (!debateDoc || !turnDoc) {
    return NextResponse.json({ error: "Failed to start debate." }, { status: 500 });
  }

  return NextResponse.json({ debate: serializeDebate(debateDoc), turn: serializeTurn(turnDoc) });
}
