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
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-lg font-medium">
          Quiz complete: {score} / {questions.length}
        </p>
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
          Question {index + 1} of {questions.length}
        </span>
        <button onClick={onFinish} className="hover:underline">
          Stop quiz
        </button>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-lg font-medium">{question.question}</p>
        <div className="mt-4 flex flex-col gap-2">
          {question.options.map((option, i) => {
            const isCorrect = i === question.correctIndex;
            const isSelected = i === selected;
            let className =
              "rounded-lg border px-4 py-2 text-left text-sm border-line hover:bg-surface2 dark:hover:bg-surface";
            if (selected !== null) {
              if (isCorrect) {
                className =
                  "rounded-lg border px-4 py-2 text-left text-sm border-success bg-successsoft";
              } else if (isSelected) {
                className =
                  "rounded-lg border px-4 py-2 text-left text-sm border-danger bg-dangersoft";
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
          <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-line pt-4">
            <p className="text-sm text-ink2">{question.explanation}</p>
            <button
              onClick={handleNext}
              className="self-start rounded-full bg-accent px-4 py-1.5 text-sm text-onaccent hover:bg-surface2 dark:hover:bg-surface2"
            >
              {index + 1 >= questions.length ? "Finish" : "Next question"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
