"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DailyTopic, DebateSide } from "@/lib/types";

export default function TopicCard({ topic, activeDebateId }: { topic: DailyTopic; activeDebateId: string | null }) {
  const router = useRouter();
  const [side, setSide] = useState<DebateSide>("for");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDebate() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/solo/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: topic.id, side }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start debate.");
      router.push(`/debate/${data.debate.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start debate.");
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-[var(--rule)] bg-[var(--panel)] p-6">
      <div>
        <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
          {topic.category}
        </span>
        <p className="mt-3 text-base leading-relaxed">{topic.prompt}</p>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Credible sources to consider</p>
        <ul className="flex flex-col gap-2">
          {topic.sources.map((source) => (
            <li key={source.name} className="text-sm text-zinc-400">
              <a href={source.homepage} target="_blank" rel="noreferrer" className="font-medium text-zinc-200 hover:underline">
                {source.name}
              </a>{" "}
              — {source.angle}
            </li>
          ))}
        </ul>
      </div>

      {activeDebateId ? (
        <Link
          href={`/debate/${activeDebateId}`}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-center text-sm font-medium text-white"
        >
          Continue your debate
        </Link>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-400">Pick your side, then debate the AI for at least 5 rounds.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide("for")}
              aria-pressed={side === "for"}
              className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium ${
                side === "for" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--rule)] text-zinc-400"
              }`}
            >
              Argue For
            </button>
            <button
              type="button"
              onClick={() => setSide("against")}
              aria-pressed={side === "against"}
              className={`flex-1 rounded-full border px-4 py-2 text-sm font-medium ${
                side === "against" ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--rule)] text-zinc-400"
              }`}
            >
              Argue Against
            </button>
          </div>
          <button
            type="button"
            onClick={startDebate}
            disabled={starting}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {starting ? "Starting…" : "Start solo debate"}
          </button>
          {error && <p className="text-sm text-[var(--bad)]">{error}</p>}
        </div>
      )}
    </div>
  );
}
