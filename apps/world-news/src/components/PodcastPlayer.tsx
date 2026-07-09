"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Speaker = "Host" | "Cohost";
interface PodcastLine {
  speaker: Speaker;
  text: string;
}

type Status = "idle" | "loading" | "playing" | "paused" | "error" | "unsupported";

interface Props {
  scope: "country" | "world";
  code?: string;
  title: string;
}

// Pick two distinct voices (prefer English) so the two hosts sound different.
function pickVoices(): [SpeechSynthesisVoice | null, SpeechSynthesisVoice | null] {
  const all = window.speechSynthesis.getVoices();
  const en = all.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : all;
  if (pool.length === 0) return [null, null];
  const host = pool[0];
  const cohost = pool.find((v) => v.name !== host.name) ?? pool[0];
  return [host, cohost];
}

// A NotebookLM-style "audio briefing": fetches a two-host script for the current
// news and reads it aloud via the browser's speech synthesis, alternating two
// voices. No backend TTS — everything after the script fetch runs client-side.
export default function PodcastPlayer({ scope, code, title }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<PodcastLine[] | null>(null);
  const [current, setCurrent] = useState(-1);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState("");

  const idxRef = useRef(0);
  const linesRef = useRef<PodcastLine[]>([]);
  const voicesRef = useRef<[SpeechSynthesisVoice | null, SpeechSynthesisVoice | null]>([null, null]);

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  // Warm the voice list (some browsers populate it asynchronously).
  useEffect(() => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    const load = () => {
      voicesRef.current = pickVoices();
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const speakFrom = useCallback((i: number) => {
    const items = linesRef.current;
    if (i >= items.length) {
      setStatus("idle");
      setCurrent(-1);
      return;
    }
    idxRef.current = i;
    setCurrent(i);
    const line = items[i];
    const utter = new SpeechSynthesisUtterance(line.text);
    const [hostVoice, cohostVoice] = voicesRef.current;
    if (line.speaker === "Host") {
      if (hostVoice) utter.voice = hostVoice;
      utter.pitch = 1;
      utter.rate = 1.02;
    } else {
      if (cohostVoice) utter.voice = cohostVoice;
      utter.pitch = 1.15;
      utter.rate = 1.06;
    }
    utter.onend = () => {
      // Only advance if we're still meant to be playing (not stopped).
      if (window.speechSynthesis.speaking || idxRef.current === i) speakFrom(i + 1);
    };
    window.speechSynthesis.speak(utter);
  }, []);

  // Chrome pauses long speech queues after ~15s; nudge it to keep going.
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      if (!window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 10_000);
    return () => clearInterval(id);
  }, [status]);

  const start = useCallback(async () => {
    if (!supported) return;
    let items = linesRef.current;
    if (items.length === 0) {
      setStatus("loading");
      setError("");
      try {
        const qs =
          scope === "world" ? "scope=world" : `scope=country&code=${encodeURIComponent(code ?? "")}`;
        const res = await fetch(`/api/podcast?${qs}`);
        if (!res.ok) {
          setError(
            res.status === 429
              ? "The news source is rate-limited right now — try again shortly."
              : "Couldn't build the audio briefing right now.",
          );
          setStatus("error");
          return;
        }
        const data = (await res.json()) as { lines?: PodcastLine[] };
        items = Array.isArray(data.lines) ? data.lines : [];
        if (items.length === 0) {
          setError("No briefing available.");
          setStatus("error");
          return;
        }
        linesRef.current = items;
        setLines(items);
      } catch {
        setError("Couldn't build the audio briefing right now.");
        setStatus("error");
        return;
      }
    }
    window.speechSynthesis.cancel();
    voicesRef.current = pickVoices();
    setStatus("playing");
    speakFrom(0);
  }, [supported, scope, code, speakFrom]);

  const pause = useCallback(() => {
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis.resume();
    setStatus("playing");
  }, []);

  const stop = useCallback(() => {
    idxRef.current = -1;
    window.speechSynthesis.cancel();
    setStatus("idle");
    setCurrent(-1);
  }, []);

  if (!supported) return null;

  const playing = status === "playing";
  const paused = status === "paused";
  const loading = status === "loading";

  return (
    <section className="rounded-xl border border-rule bg-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg" aria-hidden>
          🎙
        </span>
        <div className="mr-auto">
          <p className="text-sm font-semibold tracking-tight">Audio briefing</p>
          <p className="text-xs text-muted">Two hosts discuss {title}, read aloud.</p>
        </div>

        {status === "idle" && (
          <button
            type="button"
            onClick={start}
            className="rounded-lg border border-rule bg-panel-soft px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent"
          >
            ▶ Play
          </button>
        )}
        {loading && <span className="text-xs text-muted">Preparing…</span>}
        {playing && (
          <button
            type="button"
            onClick={pause}
            className="rounded-lg border border-rule bg-panel-soft px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent"
          >
            ⏸ Pause
          </button>
        )}
        {paused && (
          <button
            type="button"
            onClick={resume}
            className="rounded-lg border border-rule bg-panel-soft px-3 py-1.5 text-sm font-medium hover:border-accent hover:text-accent"
          >
            ▶ Resume
          </button>
        )}
        {(playing || paused) && (
          <button
            type="button"
            onClick={stop}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            ⏹ Stop
          </button>
        )}
        {lines && lines.length > 0 && (
          <button
            type="button"
            onClick={() => setShowTranscript((s) => !s)}
            className="rounded-lg border border-rule px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent"
          >
            {showTranscript ? "Hide" : "Transcript"}
          </button>
        )}
      </div>

      {status === "error" && <p className="mt-3 text-xs text-red-300">{error}</p>}

      {showTranscript && lines && (
        <ol className="mt-4 space-y-2 border-t border-rule pt-4">
          {lines.map((line, i) => (
            <li
              key={i}
              className={`flex gap-2 text-sm leading-relaxed ${
                i === current ? "text-foreground" : "text-muted"
              }`}
            >
              <span
                className={`flex-none font-semibold ${
                  line.speaker === "Host" ? "text-accent" : "text-amber-300"
                }`}
              >
                {line.speaker === "Host" ? "Alex" : "Sam"}:
              </span>
              <span className={i === current ? "rounded bg-accent/10 px-1" : ""}>{line.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
