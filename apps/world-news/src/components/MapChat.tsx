"use client";

import { useState, useRef, useEffect } from "react";
import type { NewsPoint, ConflictLine } from "@/lib/gemini";

interface MapChatProps {
  /** Current camera centre (approx region). */
  regionLabel?: string;
  altitude?: number;
  hoveredCountry?: string | null;
  /** Currently visible / prioritised points (already viewport-filtered). */
  visiblePoints?: NewsPoint[];
  openConflict?: ConflictLine | null;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface Msg {
  role: "user" | "assistant";
  text: string;
}

export default function MapChat({
  regionLabel,
  altitude,
  hoveredCountry,
  visiblePoints = [],
  openConflict,
  open: controlledOpen,
  onOpenChange,
}: MapChatProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    setInternalOpen(v);
    onOpenChange?.(v);
  };

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Hi — I’m Marco. Ask me about the stories you can see on the map right now.",
    },
  ]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          context: {
            region: regionLabel,
            altitude,
            country: hoveredCountry || undefined,
            points: visiblePoints.slice(0, 12).map((p) => ({
              headline: p.headline,
              location: p.location,
              topic: p.topic,
            })),
            conflict: openConflict?.label,
          },
        }),
      });
      const data = await res.json();
      const answer =
        typeof data.answer === "string"
          ? data.answer
          : "Sorry, I couldn’t get an answer right now.";
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Network error — try again in a moment." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="absolute bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-panel/95 text-lg shadow-lg backdrop-blur hover:border-accent"
        title={open ? "Close chat" : "Ask about this view"}
        aria-label={open ? "Close map chat" : "Open map chat"}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="absolute bottom-20 right-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-rule bg-panel/95 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-rule px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Marco</p>
              <p className="text-[11px] text-muted">
                Map-aware · {visiblePoints.length} stories in view
                {hoveredCountry ? ` · ${hoveredCountry}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-0.5 text-sm text-muted hover:bg-panel-soft"
            >
              ✕
            </button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto px-3 py-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg px-2.5 py-1.5 ${
                  m.role === "user"
                    ? "ml-6 bg-accent/15 text-foreground"
                    : "mr-4 bg-panel-soft text-muted"
                }`}
              >
                {m.text}
              </div>
            ))}
            {busy && (
              <div className="mr-4 rounded-lg bg-panel-soft px-2.5 py-1.5 text-muted">
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-rule p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What’s happening here?"
              disabled={busy}
              className="flex-1 rounded-lg border border-rule bg-panel-soft px-2.5 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
