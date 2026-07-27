"use client";

import { useEffect, useRef, useState } from "react";
import { playAmbientSound, stopAmbientSound, type AmbientSound } from "@/lib/ambientSound";

const AMBIENT_OPTIONS: { id: AmbientSound; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "white", label: "White noise" },
  { id: "brown", label: "Brown noise" },
  { id: "rain", label: "Rain-like" },
];

// Persisted so a refresh or tab switch mid-session doesn't lose the countdown.
const PERSIST_KEY = "wjec-focus-timer";
interface PersistedTimer {
  phase: "study" | "break";
  secondsLeft: number;
  running: boolean;
  studyMinutes: number;
  breakMinutes: number;
  savedAt: number;
}

interface Props {
  onLogFocus: (durationMs: number) => void;
}

// Reads any persisted in-progress timer once, advancing it by however long
// the tab was closed using the saved wall-clock timestamp. FocusTimer only
// mounts client-side (when its tab is opened), so reading localStorage during
// lazy state init is safe and avoids a setState-in-effect cascade.
function restore(): PersistedTimer | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PERSIST_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as PersistedTimer;
    const elapsedWhileAway = saved.running ? Math.floor((Date.now() - saved.savedAt) / 1000) : 0;
    return { ...saved, secondsLeft: Math.max(0, saved.secondsLeft - elapsedWhileAway) };
  } catch {
    return null;
  }
}

export default function FocusTimer({ onLogFocus }: Props) {
  const saved = restore();
  const [studyMinutes, setStudyMinutes] = useState(saved?.studyMinutes ?? 25);
  const [breakMinutes, setBreakMinutes] = useState(saved?.breakMinutes ?? 5);
  const [phase, setPhase] = useState<"study" | "break">(saved?.phase ?? "study");
  const [secondsLeft, setSecondsLeft] = useState(saved?.secondsLeft ?? 25 * 60);
  const [running, setRunning] = useState(saved?.running ?? false);
  const [ambient, setAmbient] = useState<AmbientSound>("off");
  const elapsedRef = useRef(0);

  useEffect(() => {
    const state: PersistedTimer = {
      phase,
      secondsLeft,
      running,
      studyMinutes,
      breakMinutes,
      savedAt: Date.now(),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
    }
  }, [phase, secondsLeft, running, studyMinutes, breakMinutes]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (phase === "study") onLogFocus(elapsedRef.current * 1000 + 1000);
          elapsedRef.current = 0;
          const nextPhase = phase === "study" ? "break" : "study";
          setPhase(nextPhase);
          return (nextPhase === "study" ? studyMinutes : breakMinutes) * 60;
        }
        elapsedRef.current += 1;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running, phase, studyMinutes, breakMinutes, onLogFocus]);

  useEffect(() => {
    playAmbientSound(running ? ambient : "off");
    return () => stopAmbientSound();
  }, [running, ambient]);

  function handleStop() {
    if (phase === "study" && elapsedRef.current > 0) {
      onLogFocus(elapsedRef.current * 1000);
    }
    elapsedRef.current = 0;
    setRunning(false);
  }

  function applyDurations(nextStudy: number, nextBreak: number) {
    setStudyMinutes(nextStudy);
    setBreakMinutes(nextBreak);
    if (!running) setSecondsLeft((phase === "study" ? nextStudy : nextBreak) * 60);
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6">
      <p className="text-xs uppercase tracking-wide text-ink3">
        {phase === "study" ? "Focus" : "Break"}
      </p>
      <p className="text-6xl font-semibold tabular-nums">
        {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          className="rounded-full bg-accent px-5 py-2 text-sm text-onaccent"
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={handleStop}
          className="rounded-full border border-line px-5 py-2 text-sm hover:bg-surface2 dark:hover:bg-surface"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <label className="flex items-center gap-1">
          Study
          <input
            type="number"
            min={1}
            max={120}
            value={studyMinutes}
            onChange={(e) => applyDurations(Number(e.target.value) || 1, breakMinutes)}
            className="w-14 rounded border border-line px-1 py-0.5"
          />
          min
        </label>
        <label className="flex items-center gap-1">
          Break
          <input
            type="number"
            min={1}
            max={60}
            value={breakMinutes}
            onChange={(e) => applyDurations(studyMinutes, Number(e.target.value) || 1)}
            className="w-14 rounded border border-line px-1 py-0.5"
          />
          min
        </label>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {AMBIENT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setAmbient(opt.id)}
            className={
              ambient === opt.id
                ? "rounded-full bg-surface px-3 py-1 text-xs text-onaccent dark:bg-surface"
                : "rounded-full border border-line px-3 py-1 text-xs"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
