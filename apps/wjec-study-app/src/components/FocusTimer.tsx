"use client";

import { useEffect, useRef, useState } from "react";
import { playAmbientSound, stopAmbientSound, type AmbientSound } from "@/lib/ambientSound";
import { useTimeLog } from "@/lib/useTimeLog";

const AMBIENT_OPTIONS: { id: AmbientSound; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "white", label: "White noise" },
  { id: "brown", label: "Brown noise" },
  { id: "rain", label: "Rain-like" },
];

export default function FocusTimer() {
  const { logSession } = useTimeLog();
  const [studyMinutes, setStudyMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [phase, setPhase] = useState<"study" | "break">("study");
  const [secondsLeft, setSecondsLeft] = useState(studyMinutes * 60);
  const [running, setRunning] = useState(false);
  const [ambient, setAmbient] = useState<AmbientSound>("off");
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (phase === "study") logSession("focus", null, elapsedRef.current * 1000 + 1000);
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
  }, [running, phase, studyMinutes, breakMinutes, logSession]);

  useEffect(() => {
    playAmbientSound(running ? ambient : "off");
    return () => stopAmbientSound();
  }, [running, ambient]);

  function handleStop() {
    if (phase === "study" && elapsedRef.current > 0) {
      logSession("focus", null, elapsedRef.current * 1000);
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
    <div className="flex w-full flex-col items-center gap-4 rounded-xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {phase === "study" ? "Focus" : "Break"}
      </p>
      <p className="text-6xl font-semibold tabular-nums">
        {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setRunning((r) => !r)}
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          onClick={handleStop}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
            className="w-14 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
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
            className="w-14 rounded border border-zinc-300 px-1 py-0.5 dark:border-zinc-700 dark:bg-zinc-900"
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
                ? "rounded-full bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-white dark:text-zinc-900"
                : "rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
