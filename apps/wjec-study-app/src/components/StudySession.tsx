"use client";

import { useEffect, useState } from "react";
import Flashcard from "./Flashcard";
import type { Flashcard as FlashcardType, RecallGrade } from "@/lib/types";

interface Props {
  initialQueue: FlashcardType[];
  onGrade: (cardId: string, grade: RecallGrade) => void;
  onFinish: () => void;
}

const GRADE_BUTTONS: { grade: RecallGrade; label: string; key: string; className: string }[] = [
  { grade: "again", label: "Again", key: "1", className: "bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900" },
  { grade: "hard", label: "Hard", key: "2", className: "bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900" },
  { grade: "good", label: "Good", key: "3", className: "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900" },
  { grade: "easy", label: "Easy", key: "4", className: "bg-sky-100 hover:bg-sky-200 dark:bg-sky-950 dark:hover:bg-sky-900" },
];

interface GradeHistoryEntry {
  card: FlashcardType;
  grade: RecallGrade;
  indexAtGrade: number;
  queueSnapshot: FlashcardType[];
}

export default function StudySession({ initialQueue, onGrade, onFinish }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reversed, setReversed] = useState(false);
  const [history, setHistory] = useState<GradeHistoryEntry[]>([]);
  const [stats, setStats] = useState<Record<RecallGrade, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  const card = queue[index];
  const gradedCount = stats.again + stats.hard + stats.good + stats.easy;
  const progress = queue.length > 0 ? Math.min(100, (index / Math.max(queue.length, 1)) * 100) : 100;

  function handleGrade(grade: RecallGrade) {
    if (!card) return;

    setHistory((h) => [
      ...h,
      { card, grade, indexAtGrade: index, queueSnapshot: queue },
    ]);
    setStats((s) => ({ ...s, [grade]: s[grade] + 1 }));
    onGrade(card.id, grade);

    if (grade === "again") {
      setQueue((prev) => {
        const next = [...prev];
        const insertAt = Math.min(next.length, index + 4);
        next.splice(insertAt, 0, card);
        return next;
      });
    }
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function undoLast() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setStats((s) => ({ ...s, [last.grade]: Math.max(0, s[last.grade] - 1) }));
    setQueue(last.queueSnapshot);
    setIndex(last.indexAtGrade);
    setRevealed(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!card) return;

      if ((e.key === "u" || e.key === "U") && history.length > 0) {
        e.preventDefault();
        undoLast();
        return;
      }

      if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setReversed((v) => !v);
        setRevealed(false);
        return;
      }

      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
        return;
      }

      if (revealed) {
        const map: Record<string, RecallGrade> = {
          "1": "again",
          "2": "hard",
          "3": "good",
          "4": "easy",
        };
        const grade = map[e.key];
        if (grade) {
          e.preventDefault();
          handleGrade(grade);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, revealed, index, queue, history]);

  if (!card) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">Session complete</p>
        <p className="text-sm text-zinc-500">You graded {gradedCount} card{gradedCount === 1 ? "" : "s"} this session.</p>
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {GRADE_BUTTONS.map((b) => (
            <span key={b.grade} className={`rounded-full px-3 py-1 ${b.className}`}>
              {b.label}: {stats[b.grade]}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={undoLast}
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Undo last
            </button>
          )}
          <button
            type="button"
            onClick={onFinish}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-white dark:text-zinc-900"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const front = reversed ? card.back : card.front;
  const back = reversed ? card.front : card.back;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Card {index + 1} of {queue.length}
          {reversed && <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-800">Reverse</span>}
        </span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setReversed((v) => !v); setRevealed(false); }} className="hover:underline">
            {reversed ? "Front → back" : "Back → front"}
          </button>
          {history.length > 0 && (
            <button type="button" onClick={undoLast} className="hover:underline">
              Undo (U)
            </button>
          )}
          <button type="button" onClick={onFinish} className="hover:underline">
            Stop session
          </button>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-[#3b4a6b] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Flashcard front={front} back={back} revealed={revealed} onReveal={() => setRevealed(true)} />

      {revealed && (
        <div className="grid grid-cols-4 gap-2">
          {GRADE_BUTTONS.map((b) => (
            <button
              key={b.grade}
              type="button"
              onClick={() => handleGrade(b.grade)}
              className={`rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 ${b.className}`}
            >
              {b.label}
              <span className="ml-1 text-[10px] opacity-50">{b.key}</span>
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-[10px] text-zinc-400">
        Space reveals · 1–4 grades · R reverses · U undoes
      </p>
    </div>
  );
}
