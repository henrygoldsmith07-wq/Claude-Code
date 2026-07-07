import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { checkRateLimit } from "@/lib/rateLimit";
import { summarizeSoloDebate } from "@/lib/anthropic";
import { levelForPoints, updateStreak } from "@/lib/gamification";
import { MIN_ROUNDS } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ debateId: string }> }) {
  const limited = checkRateLimit(request, { name: "solo-finish", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { debateId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ObjectId.isValid(debateId)) return NextResponse.json({ error: "Debate not found." }, { status: 404 });

  const db = await getDb();
  const debates = db.collection("solo_debates");
  const userId = new ObjectId(session.user.id);
  const debate = await debates.findOne({ _id: new ObjectId(debateId), user_id: userId });
  if (!debate) return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  if (debate.status === "completed") return NextResponse.json({ error: "Debate already completed." }, { status: 409 });

  const turns = await db
    .collection("solo_debate_turns")
    .find({ debate_id: debate._id })
    .sort({ round_number: 1 })
    .toArray();

  const answered = turns.filter((turn) => turn.user_message);
  if (answered.length < MIN_ROUNDS) {
    return NextResponse.json(
      { error: `Complete at least ${MIN_ROUNDS} rounds before finishing.` },
      { status: 400 },
    );
  }

  const totalScore = answered.reduce((sum, turn) => sum + (turn.turn_score ?? 0), 0);

  const topic = await db.collection("daily_topics").findOne({ _id: debate.topic_id });

  const transcript = answered
    .map((turn) => `AI: ${turn.ai_message}\nUser: ${turn.user_message}`)
    .join("\n\n");

  let summary;
  try {
    summary = await summarizeSoloDebate({ topicTitle: topic?.title ?? "the debate", transcript });
  } catch (error) {
    console.error("Failed to summarize debate:", error);
    summary = { overallFeedback: "Great work completing the debate.", strengths: [], improvements: [] };
  }

  await debates.updateOne(
    { _id: debate._id },
    { $set: { status: "completed", total_score: totalScore, completed_at: new Date().toISOString() } },
  );

  const profiles = db.collection("profiles");
  const profile = await profiles.findOne({ _id: userId });
  if (profile) {
    const today = new Date().toISOString().slice(0, 10);
    const streak = updateStreak(today, profile.last_activity_date, profile.current_streak, profile.longest_streak);
    const newTotalPoints = profile.total_points + totalScore;
    await profiles.updateOne(
      { _id: userId },
      {
        $set: {
          total_points: newTotalPoints,
          level: levelForPoints(newTotalPoints),
          current_streak: streak.current_streak,
          longest_streak: streak.longest_streak,
          last_activity_date: streak.last_activity_date,
        },
      },
    );
  }

  return NextResponse.json({ totalScore, summary });
}
