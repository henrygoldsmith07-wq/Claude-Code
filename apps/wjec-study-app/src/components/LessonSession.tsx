"use client";

import { useState } from "react";
import type { LessonSection } from "@/lib/types";

interface Props {
  sections: LessonSection[];
  onComplete: (sectionCount: number) => void;
  onFinish: () => void;
}

export default function LessonSession({ sections, onComplete, onFinish }: Props) {
  const [queue, setQueue] = useState(sections);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [done, setDone] = useState(false);

  const section = queue[index];

  function handleNext(needsReview: boolean) {
    let nextQueue = queue;
    if (needsReview) {
      nextQueue = [...queue];
      const insertAt = Math.min(nextQueue.length, index + 3);
      nextQueue.splice(insertAt, 0, section);
    }
    const nextIndex = index + 1;
    if (nextIndex >= nextQueue.length) {
      onComplete(sections.length);
      setDone(true);
    } else {
      setQueue(nextQueue);
      setIndex(nextIndex);
    }
    setRevealed(false);
    setAttempt("");
  }

  if (done) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">Lesson complete.</p>
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
          Section {index + 1} of {queue.length}
        </span>
        <button onClick={onFinish} className="hover:underline">
          Stop lesson
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <p className="text-lg font-medium">{section.heading}</p>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">{section.explanation}</p>
        </div>

        <div className="border-t border-dashed border-zinc-300 pt-4 dark:border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Check your understanding
          </p>
          <p className="mt-1 text-sm">{section.checkQuestion}</p>

          {!revealed ? (
            <>
              <textarea
                value={attempt}
                onChange={(e) => setAttempt(e.target.value)}
                placeholder="Type your answer attempt (not graded — just for you)…"
                rows={3}
                className="mt-2 w-full rounded-lg border border-zinc-300 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                onClick={() => setRevealed(true)}
                className="mt-2 rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                Show answer
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                {section.checkAnswer}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleNext(false)}
                  className="rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900"
                >
                  Got it
                </button>
                <button
                  onClick={() => handleNext(true)}
                  className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-medium hover:bg-amber-200 dark:bg-amber-950 dark:hover:bg-amber-900"
                >
                  Need review
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
