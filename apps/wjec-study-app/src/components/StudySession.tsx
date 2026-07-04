"use client";

import { useState } from "react";
import Flashcard from "./Flashcard";
import type { Flashcard as FlashcardType, RecallGrade } from "@/lib/types";

interface Props {
  initialQueue: FlashcardType[];
  onGrade: (cardId: string, grade: RecallGrade) => void;
  onFinish: () => void;
}

const GRADE_BUTTONS: { grade: RecallGrade; label: string; className: string }[] = [
  { grade: "again", label: "Again", className: "bg-red-100 hover:bg-red-200 dark:bg-red-950 dark:hover:bg-red-900" },
  { grade: "hard", label: "Hard", className: "bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900" },
  { grade: "good", label: "Good", className: "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900" },
  { grade: "easy", label: "Easy", className: "bg-sky-100 hover:bg-sky-200 dark:bg-sky-950 dark:hover:bg-sky-900" },
];

export default function StudySession({ initialQueue, onGrade, onFinish }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const card = queue[index];

  function handleGrade(grade: RecallGrade) {
    onGrade(card.id, grade);
    if (grade === "again") {
      // Give a forgotten card another retrieval attempt later in this same
      // session instead of only picking it up again tomorrow.
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

  if (!card) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">Session complete.</p>
        <button
          onClick={onFinish}
          className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Card {index + 1} of {queue.length}
        </span>
        <button onClick={onFinish} className="hover:underline">
          Stop session
        </button>
      </div>

      <Flashcard
        front={card.front}
        back={card.back}
        revealed={revealed}
        onReveal={() => setRevealed(true)}
      />

      {revealed && (
        <div className="grid grid-cols-4 gap-2">
          {GRADE_BUTTONS.map((b) => (
            <button
              key={b.grade}
              onClick={() => handleGrade(b.grade)}
              className={`rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 ${b.className}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
