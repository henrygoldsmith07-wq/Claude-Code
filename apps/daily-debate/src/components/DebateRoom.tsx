"use client";

import { useState } from "react";
import Link from "next/link";
import MessageComposer from "./MessageComposer";
import ScoreBadges from "./ScoreBadges";
import { useSpeechSynthesis } from "./useSpeechSynthesis";
import { MIN_ROUNDS, type DebateSummary, type InputMode, type SoloDebate, type SoloDebateTurn } from "@/lib/types";

interface DebateSummaryPayload {
  totalScore: number;
  summary: DebateSummary;
}

export default function DebateRoom({
  debate,
  topic,
  initialTurns,
}: {
  debate: SoloDebate;
  topic: { title: string; prompt: string };
  initialTurns: SoloDebateTurn[];
}) {
  const [turns, setTurns] = useState(initialTurns);
  const [roundCount, setRoundCount] = useState(debate.round_count);
  const [status, setStatus] = useState(debate.status);
  const [sending, setSending] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DebateSummaryPayload | null>(null);
  const { speak, supported: ttsSupported } = useSpeechSynthesis();

  const aiSide = debate.side === "for" ? "against" : "for";
  const pending = turns[turns.length - 1];
  const canFinish = turns.filter((t) => t.user_message).length >= MIN_ROUNDS;

  async function submitTurn(message: string, inputMode: InputMode) {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/solo/${debate.id}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, inputMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit response.");

      setTurns((prev) => [...prev.slice(0, -1), data.completedTurn, data.nextTurn]);
      setRoundCount(data.roundCount);
      if (ttsSupported) speak(data.nextTurn.ai_message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response.");
    } finally {
      setSending(false);
    }
  }

  async function finishDebate() {
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/solo/${debate.id}/finish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to finish debate.");
      setStatus("completed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish debate.");
    } finally {
      setFinishing(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-[var(--rule)] bg-[var(--panel)] p-6">
        <h2 className="text-xl font-semibold">Debate complete — {result.totalScore} pts</h2>
        <p className="text-sm text-zinc-300">{result.summary.overallFeedback}</p>
        {result.summary.strengths.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Strengths</p>
            <ul className="list-inside list-disc text-sm text-zinc-300">
              {result.summary.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {result.summary.improvements.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">To improve</p>
            <ul className="list-inside list-disc text-sm text-zinc-300">
              {result.summary.improvements.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <Link href="/" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white">
            Back to today
          </Link>
          <Link href="/leaderboard" className="rounded-full border border-[var(--rule)] px-4 py-2 text-sm text-zinc-300">
            View leaderboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{topic.title}</p>
        <p className="text-sm text-zinc-400">{topic.prompt}</p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          You&apos;re arguing <span className="text-[var(--foreground)]">{debate.side}</span> · AI argues {aiSide}
        </p>
        <p className="tabular text-sm text-zinc-500">
          Round {roundCount} {roundCount < MIN_ROUNDS && `· ${MIN_ROUNDS - roundCount + 1} to go`}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-xl border border-[var(--rule)] bg-[var(--panel)] p-4">
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-2">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[var(--accent-soft)] px-3 py-2 text-sm">
              {turn.ai_message}
            </div>
            {turn.user_message && (
              <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
                <div className="rounded-2xl rounded-tr-sm bg-white/10 px-3 py-2 text-sm">{turn.user_message}</div>
                {turn.scores && <ScoreBadges scores={turn.scores} />}
                {turn.feedback && <p className="text-xs text-zinc-500">{turn.feedback}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-[var(--bad)]">{error}</p>}

      {status === "active" && !pending?.user_message && (
        <MessageComposer onSubmit={submitTurn} disabled={sending} />
      )}

      {canFinish && status === "active" && (
        <button
          type="button"
          onClick={finishDebate}
          disabled={finishing}
          className="rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] disabled:opacity-40"
        >
          {finishing ? "Scoring your debate…" : "Finish & get scored"}
        </button>
      )}
    </div>
  );
}
