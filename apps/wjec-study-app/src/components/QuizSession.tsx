"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/types";

interface Props {
  questions: QuizQuestion[];
  onComplete: (score: number, total: number) => void;
  onFinish: () => void;
}

export default function QuizSession({ questions, onComplete, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const question = questions[index];

  function handleSelect(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.correctIndex) setScore((s) => s + 1);
  }

  function handleNext() {
    if (index + 1 >= questions.length) {
      onComplete(score, questions.length);
      setDone(true);
      return;
    }
    setSelected(null);
    setIndex((i) => i + 1);
  }

  if (done) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">
          Quiz complete: {score} / {questions.length}
        </p>
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
          Question {index + 1} of {questions.length}
        </span>
        <button onClick={onFinish} className="hover:underline">
          Stop quiz
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">{question.question}</p>
        <div className="mt-4 flex flex-col gap-2">
          {question.options.map((option, i) => {
            const isCorrect = i === question.correctIndex;
            const isSelected = i === selected;
            let className =
              "rounded-lg border px-4 py-2 text-left text-sm border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800";
            if (selected !== null) {
              if (isCorrect) {
                className =
                  "rounded-lg border px-4 py-2 text-left text-sm border-emerald-500 bg-emerald-100 dark:bg-emerald-950";
              } else if (isSelected) {
                className =
                  "rounded-lg border px-4 py-2 text-left text-sm border-red-500 bg-red-100 dark:bg-red-950";
              }
            }
            return (
              <button key={i} onClick={() => handleSelect(i)} className={className}>
                {option}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-zinc-300 pt-4 dark:border-zinc-700">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{question.explanation}</p>
            <button
              onClick={handleNext}
              className="self-start rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {index + 1 >= questions.length ? "Finish" : "Next question"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
