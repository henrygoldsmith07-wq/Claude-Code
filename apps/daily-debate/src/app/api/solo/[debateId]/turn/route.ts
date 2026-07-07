import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { serializeTurn } from "@/lib/db/serialize";
import { checkRateLimit } from "@/lib/rateLimit";
import { debateTurn } from "@/lib/anthropic";
import { pointsForTurn } from "@/lib/gamification";
import type { InputMode } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ debateId: string }> }) {
  const limited = checkRateLimit(request, { name: "solo-turn", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { debateId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ObjectId.isValid(debateId)) return NextResponse.json({ error: "Debate not found." }, { status: 404 });

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const inputMode: InputMode = body?.inputMode === "voice" ? "voice" : "text";
  if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });

  const db = await getDb();
  const debates = db.collection("solo_debates");
  const debate = await debates.findOne({ _id: new ObjectId(debateId), user_id: new ObjectId(session.user.id) });
  if (!debate) return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  if (debate.status !== "active") return NextResponse.json({ error: "Debate already completed." }, { status: 409 });

  const topic = await db.collection("daily_topics").findOne({ _id: debate.topic_id });
  if (!topic) return NextResponse.json({ error: "Topic not found." }, { status: 404 });

  const turns = db.collection("solo_debate_turns");
  const allTurns = await turns.find({ debate_id: debate._id }).sort({ round_number: 1 }).toArray();
  if (allTurns.length === 0) {
    return NextResponse.json({ error: "Debate has no turns." }, { status: 500 });
  }

  const pendingTurn = allTurns[allTurns.length - 1];
  if (pendingTurn.user_message) {
    return NextResponse.json({ error: "Latest round already answered." }, { status: 409 });
  }

  const history = allTurns.slice(0, -1).flatMap((turn) => [
    { role: "ai" as const, text: turn.ai_message },
    ...(turn.user_message ? [{ role: "user" as const, text: turn.user_message }] : []),
  ]);
  history.push({ role: "ai", text: pendingTurn.ai_message });

  let result;
  try {
    result = await debateTurn({
      topicTitle: topic.title,
      topicPrompt: topic.prompt,
      userSide: debate.side as "for" | "against",
      history,
      latestUserMessage: message,
    });
  } catch (error) {
    console.error("Failed to score debate turn:", error);
    return NextResponse.json({ error: "Failed to evaluate your response." }, { status: 502 });
  }

  const turnScore = pointsForTurn(result.scores);

  await turns.updateOne(
    { _id: pendingTurn._id },
    {
      $set: {
        user_message: message,
        input_mode: inputMode,
        scores: result.scores,
        turn_score: turnScore,
        feedback: result.feedback,
      },
    },
  );

  const nextRoundNumber = pendingTurn.round_number + 1;
  const nextTurnInsert = await turns.insertOne({
    debate_id: debate._id,
    round_number: nextRoundNumber,
    ai_message: result.aiMessage,
    user_message: null,
    input_mode: "text",
    scores: null,
    turn_score: null,
    feedback: null,
    created_at: new Date().toISOString(),
  });
  const nextTurnDoc = await turns.findOne({ _id: nextTurnInsert.insertedId });
  if (!nextTurnDoc) {
    return NextResponse.json({ error: "Failed to continue debate." }, { status: 500 });
  }

  await debates.updateOne({ _id: debate._id }, { $set: { round_count: nextRoundNumber } });

  return NextResponse.json({
    completedTurn: serializeTurn({
      ...pendingTurn,
      user_message: message,
      scores: result.scores,
      turn_score: turnScore,
      feedback: result.feedback,
    }),
    nextTurn: serializeTurn(nextTurnDoc),
    roundCount: nextRoundNumber,
  });
}
