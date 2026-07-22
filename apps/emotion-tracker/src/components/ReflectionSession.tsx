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
  const bottomRef = useRef<HTMLDivElement>(null);

  const lastMessage = entry.messages[entry.messages.length - 1];
  const awaitingAi =
    entry.status === "in_progress" && lastMessage?.role === "user";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entry.messages.length, loading]);

  useEffect(() => {
    if (!awaitingAi) return;
    const requestKey = `${entry.id}:${entry.messages.length}`;
    if (requestedForRef.current === requestKey) return;
    requestedForRef.current = requestKey;

    setLoading(true);
    fetch("/api/reflect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: entry.messages,
        apiKey: apiKey || undefined,
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong");
        if (data.step === "question") {
          onAppendMessage(entry.id, {
            role: "assistant",
            content: data.question,
          });
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
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {entry.messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap animate-fade-in ${
                m.role === "user"
                  ? "self-end bg-accent text-white shadow-sm"
                  : "self-start border border-border bg-card text-foreground"
              }`}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div className="self-start flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted">
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
                <span
                  className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent"
                  style={{ animationDelay: "0.2s" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent"
                  style={{ animationDelay: "0.4s" }}
                />
              </span>
              Thinking…
            </div>
          )}

          {entry.status === "complete" && entry.summary && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm animate-fade-in">
              <SummaryView summary={entry.summary} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {entry.status === "in_progress" && !awaitingAi && (
        <div className="border-t border-border bg-card/50 p-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-2xl gap-3">
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
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <button
              onClick={submitAnswer}
              disabled={!answer.trim()}
              className="self-end rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
