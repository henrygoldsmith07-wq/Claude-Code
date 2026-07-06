"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, Message, ReflectionSummary } from "@/lib/types";
import SummaryView from "./SummaryView";

interface Props {
  entry: Entry;
  apiKey: string;
  onAppendMessage: (id: string, message: Message) => void;
  onCompleteEntry: (id: string, summary: ReflectionSummary) => void;
  onError: (message: string) => void;
}

export default function ReflectionSession({
  entry,
  apiKey,
  onAppendMessage,
  onCompleteEntry,
  onError,
}: Props) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const requestedForRef = useRef<string | null>(null);

  const lastMessage = entry.messages[entry.messages.length - 1];
  const awaitingAi = entry.status === "in_progress" && lastMessage?.role === "user";

  useEffect(() => {
    if (!awaitingAi) return;
    const requestKey = `${entry.id}:${entry.messages.length}`;
    if (requestedForRef.current === requestKey) return;
    requestedForRef.current = requestKey;

    setLoading(true);
    fetch("/api/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: entry.messages, apiKey: apiKey || undefined }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        if (data.step === "question") {
          onAppendMessage(entry.id, { role: "assistant", content: data.question });
        } else {
          onCompleteEntry(entry.id, data.summary);
        }
      })
      .catch((err) => {
        onError(err instanceof Error ? err.message : "Something went wrong");
        requestedForRef.current = null;
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAi, entry.id, entry.messages.length]);

  function submitAnswer() {
    if (!answer.trim()) return;
    onAppendMessage(entry.id, { role: "user", content: answer.trim() });
    setAnswer("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {entry.messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "self-end bg-blue-600 text-white"
                  : "self-start bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="self-start rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-500 dark:bg-zinc-800">
              Thinking...
            </div>
          )}
          {entry.status === "complete" && entry.summary && (
            <div className="mt-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
              <SummaryView summary={entry.summary} />
            </div>
          )}
        </div>
      </div>

      {entry.status === "in_progress" && !awaitingAi && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mx-auto flex max-w-2xl gap-2">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitAnswer();
                }
              }}
              rows={2}
              placeholder="Answer honestly — this is just for you."
              className="flex-1 resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={submitAnswer}
              disabled={!answer.trim()}
              className="self-end rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
