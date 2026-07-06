import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { judgePvpMatch } from "@/lib/anthropic";
import { levelForPoints, updateStreak } from "@/lib/gamification";
import type { InputMode } from "@/lib/types";

async function awardPoints(userId: string, points: number) {
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("*").eq("id", userId).single();
  if (!profile) return;
  const today = new Date().toISOString().slice(0, 10);
  const streak = updateStreak(today, profile.last_activity_date, profile.current_streak, profile.longest_streak);
  const newTotalPoints = profile.total_points + points;
  await service
    .from("profiles")
    .update({
      total_points: newTotalPoints,
      level: levelForPoints(newTotalPoints),
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      last_activity_date: streak.last_activity_date,
    })
    .eq("id", userId);
}

export async function POST(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const limited = checkRateLimit(request, { name: "pvp-turn", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { matchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const inputMode: InputMode = body?.inputMode === "voice" ? "voice" : "text";
  if (!message) return NextResponse.json({ error: "message is required." }, { status: 400 });

  const { data: match, error: matchError } = await supabase
    .from("pvp_matches")
    .select("*")
    .eq("id", matchId)
    .single();
  if (matchError || !match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
  if (match.status !== "active") return NextResponse.json({ error: "Match already completed." }, { status: 409 });
  if (match.player_a !== user.id && match.player_b !== user.id) {
    return NextResponse.json({ error: "Not a participant in this match." }, { status: 403 });
  }
  if (match.current_turn_player !== user.id) {
    return NextResponse.json({ error: "Not your turn." }, { status: 409 });
  }

  const { data: turn, error: turnError } = await supabase
    .from("pvp_turns")
    .insert({ match_id: matchId, player_id: user.id, round_number: match.current_round, message, input_mode: inputMode })
    .select("*")
    .single();
  if (turnError || !turn) {
    console.error("Failed to save PvP turn:", turnError);
    return NextResponse.json({ error: "Failed to save your response." }, { status: 500 });
  }

  const isPlayerA = user.id === match.player_a;
  const roundJustCompleted = !isPlayerA;
  const nextRound = roundJustCompleted ? match.current_round + 1 : match.current_round;
  const nextTurnPlayer = isPlayerA ? match.player_b : match.player_a;
  const matchComplete = roundJustCompleted && nextRound > match.round_limit;

  if (!matchComplete) {
    await supabase
      .from("pvp_matches")
      .update({ current_round: nextRound, current_turn_player: nextTurnPlayer })
      .eq("id", matchId);
    return NextResponse.json({ turn, matchComplete: false });
  }

  const service = createServiceClient();
  const { data: topic } = await service.from("daily_topics").select("*").eq("id", match.topic_id).single();
  const { data: allTurns } = await service
    .from("pvp_turns")
    .select("*")
    .eq("match_id", matchId)
    .order("round_number", { ascending: true })
    .order("created_at", { ascending: true });

  const transcript = (allTurns ?? [])
    .map((t) => `${t.player_id === match.player_a ? "Player A" : "Player B"} (round ${t.round_number}): ${t.message}`)
    .join("\n");

  let verdict;
  try {
    verdict = await judgePvpMatch({
      topicTitle: topic?.title ?? "the topic",
      topicPrompt: topic?.prompt ?? "",
      playerASide: match.player_a_side as "for" | "against",
      transcript,
    });
  } catch (error) {
    console.error("Failed to judge PvP match:", error);
    verdict = { winner: "tie" as const, playerAScore: 0, playerBScore: 0, rationale: "Judging failed; scored as a tie." };
  }

  const winnerId = verdict.winner === "a" ? match.player_a : verdict.winner === "b" ? match.player_b : null;

  await service
    .from("pvp_matches")
    .update({
      status: "completed",
      current_round: nextRound,
      current_turn_player: null,
      winner_id: winnerId,
      judge_verdict: verdict,
      completed_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  await Promise.all([awardPoints(match.player_a, verdict.playerAScore), awardPoints(match.player_b, verdict.playerBScore)]);

  return NextResponse.json({ turn, matchComplete: true, verdict });
}
