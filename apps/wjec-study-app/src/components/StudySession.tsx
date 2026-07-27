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
  { grade: "again", label: "Again", className: "bg-dangersoft hover:bg-dangersoft dark:hover:bg-danger" },
  { grade: "hard", label: "Hard", className: "bg-reviewsoft hover:bg-reviewsoft dark:hover:bg-review" },
  { grade: "good", label: "Good", className: "bg-successsoft hover:bg-successsoft dark:hover:bg-success" },
  { grade: "easy", label: "Easy", className: "bg-speaksoft hover:bg-speaksoft dark:hover:bg-speak" },
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
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-lg font-medium">Session complete.</p>
        <button
          onClick={onFinish}
          className="rounded-full border border-line px-4 py-1.5 text-sm hover:bg-surface2 dark:hover:bg-surface"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between text-xs text-ink3">
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
              className={`rounded-lg px-3 py-2 text-sm font-medium text-ink ${b.className}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
