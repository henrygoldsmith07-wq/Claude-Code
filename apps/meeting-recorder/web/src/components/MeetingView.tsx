"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mmss } from "@/lib/format";
import type { Meeting, ChatMessage } from "@/lib/types";
import { TimestampedText } from "./TimestampedText";

interface Props {
  meeting: Meeting;
  playbackUrl: string | null;
  initialChat: ChatMessage[];
  readOnly?: boolean;
}

const ACTIVE_STATUSES = new Set(["created", "uploading", "uploaded", "processing"]);

export function MeetingView({ meeting: initial, playbackUrl, initialChat, readOnly }: Props) {
  const [meeting, setMeeting] = useState<Meeting>(initial);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Poll while the recording is still uploading / transcribing.
  useEffect(() => {
    if (!ACTIVE_STATUSES.has(meeting.status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/meetings/${meeting.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { meeting: Meeting };
        setMeeting(data.meeting);
        if (!ACTIVE_STATUSES.has(data.meeting.status)) clearInterval(timer);
      } catch {
        /* transient — keep polling */
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [meeting.id, meeting.status]);

  const seek = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
    void v.play().catch(() => undefined);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">{meeting.title}</h1>
          <p className="mt-1 text-xs text-white/40">
            {meeting.durationSec > 0 && <>{mmss(meeting.durationSec)} · </>}
            <StatusPill status={meeting.status} />
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-edge bg-black">
          {playbackUrl ? (
            <video
              ref={videoRef}
              src={playbackUrl}
              controls
              className="aspect-video w-full"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            />
          ) : (
            <div className="grid aspect-video w-full place-items-center text-sm text-white/40">
              {meeting.status === "error"
                ? "Recording unavailable"
                : "Waiting for the recording to finish uploading…"}
            </div>
          )}
        </div>

        {meeting.summary && (
          <section className="rounded-xl border border-edge bg-panel p-4">
            <h2 className="mb-2 text-sm font-semibold text-white/70">Summary</h2>
            <div className="text-sm leading-relaxed text-white/80">
              <TimestampedText text={meeting.summary} onSeek={seek} />
            </div>
          </section>
        )}

        {meeting.error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {meeting.error}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <Transcript meeting={meeting} currentTime={currentTime} onSeek={seek} />
        {!readOnly && meeting.transcript && (
          <ChatPanel meetingId={meeting.id} initial={initialChat} onSeek={seek} />
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Meeting["status"] }) {
  const map: Record<Meeting["status"], string> = {
    created: "text-white/50",
    uploading: "text-amber-300",
    uploaded: "text-amber-300",
    processing: "text-brand-soft",
    ready: "text-emerald-400",
    error: "text-red-400",
  };
  const label: Record<Meeting["status"], string> = {
    created: "Waiting for upload",
    uploading: "Uploading",
    uploaded: "Uploaded",
    processing: "Transcribing…",
    ready: "Ready",
    error: "Error",
  };
  return <span className={map[status]}>{label[status]}</span>;
}

function Transcript({
  meeting,
  currentTime,
  onSeek,
}: {
  meeting: Meeting;
  currentTime: number;
  onSeek: (s: number) => void;
}) {
  const segments = meeting.transcript?.segments ?? [];
  const activeIndex = useMemo(() => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (currentTime >= segments[i].start) return i;
    }
    return -1;
  }, [segments, currentTime]);

  const activeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <section className="rounded-xl border border-edge bg-panel">
      <h2 className="border-b border-edge px-4 py-3 text-sm font-semibold text-white/70">
        Transcript
      </h2>
      <div className="scroll-thin max-h-[420px] overflow-y-auto p-2">
        {segments.length === 0 ? (
          <p className="p-4 text-sm text-white/40">
            {meeting.status === "processing"
              ? "Transcribing the recording…"
              : "No transcript yet."}
          </p>
        ) : (
          segments.map((seg, i) => (
            <button
              key={i}
              ref={i === activeIndex ? activeRef : null}
              onClick={() => onSeek(seg.start)}
              className={`flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                i === activeIndex ? "bg-brand/15" : "hover:bg-white/5"
              }`}
            >
              <span className="mt-0.5 w-12 shrink-0 font-mono text-xs text-brand-soft">
                {mmss(seg.start)}
              </span>
              <span className="text-white/80">{seg.text}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function ChatPanel({
  meetingId,
  initial,
  onSeek,
}: {
  meetingId: string;
  initial: ChatMessage[];
  onSeek: (s: number) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    const now = new Date().toISOString();
    setMessages((m) => [...m, { role: "user", content: question, createdAt: now }]);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !data.answer) throw new Error(data.error || "Chat failed");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.answer!, createdAt: new Date().toISOString() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col rounded-xl border border-edge bg-panel">
      <h2 className="border-b border-edge px-4 py-3 text-sm font-semibold text-white/70">
        Ask about this meeting
      </h2>
      <div className="scroll-thin max-h-[320px] min-h-[120px] space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-white/40">
            Ask anything — “What were the action items?”, “What did they decide about pricing?”
            Answers cite clickable timestamps.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-sm ${m.role === "user" ? "text-white/90" : "text-white/70"}`}
          >
            <span className="mr-2 text-xs uppercase tracking-wide text-white/30">
              {m.role === "user" ? "You" : "Claude"}
            </span>
            {m.role === "assistant" ? (
              <TimestampedText text={m.content} onSeek={onSeek} />
            ) : (
              <span className="whitespace-pre-wrap">{m.content}</span>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-white/40">Thinking…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      <div className="flex gap-2 border-t border-edge p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask a question…"
          className="flex-1 rounded-lg border border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </section>
  );
}
