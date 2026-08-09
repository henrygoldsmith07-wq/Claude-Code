import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMeetings, MeetingDoc } from "@/lib/mongodb";
import { answerQuestion } from "@/lib/anthropic";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/meetings/:id/chat — ask a question about the meeting. Answers are
 * grounded in the transcript and cite [m:ss] timestamps the UI makes clickable.
 * Conversation history is persisted on the meeting document.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!ObjectId.isValid(params.id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const _id = new ObjectId(params.id);

  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question || !question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const col = await getMeetings();
  const doc = await col.findOne({ _id });
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!doc.transcript || doc.transcript.segments.length === 0) {
    return NextResponse.json(
      { error: "This meeting has no transcript yet." },
      { status: 409 }
    );
  }

  const history: ChatMessage[] = (doc.chat ?? []).map((m) => ({
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  try {
    const answer = await answerQuestion(doc.transcript, history, question.trim());
    const now = new Date();
    const entries: MeetingDoc["chat"] = [
      { role: "user", content: question.trim(), createdAt: now },
      { role: "assistant", content: answer, createdAt: now },
    ];
    await col.updateOne(
      { _id },
      {
        $push: { chat: { $each: entries } },
        $set: { updatedAt: now },
      }
    );
    return NextResponse.json({ answer });
  } catch (err) {
    const message = err instanceof Error ? err.message : "chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
