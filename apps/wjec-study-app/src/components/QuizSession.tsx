"use client";

import { useEffect, useRef, useState } from "react";
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
  const scoreRef = useRef(0);

  const question = questions[index];
  const progress =
    questions.length > 0 ? ((index + (selected !== null ? 1 : 0)) / questions.length) * 100 : 0;

  function selectOption(optionIndex: number) {
    if (selected !== null) return;
    const isCorrect = optionIndex === question.correctIndex;
    const nextScore = scoreRef.current + (isCorrect ? 1 : 0);
    scoreRef.current = nextScore;
    setSelected(optionIndex);
    setScore(nextScore);
  }

  function goNext() {
    if (selected === null) return;
    if (index + 1 >= questions.length) {
      onComplete(scoreRef.current, questions.length);
      setDone(true);
      return;
    }
    setSelected(null);
    setIndex((i) => i + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (done || !question) return;

      if (selected === null && e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        if (idx < question.options.length) {
          e.preventDefault();
          selectOption(idx);
        }
        return;
      }

      if (selected !== null && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, index, done, question]);

  if (done) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">
          Quiz complete: {score} / {questions.length}
        </p>
        <button
          type="button"
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
        <button type="button" onClick={onFinish} className="hover:underline">
          Stop quiz
        </button>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-[#3b4a6b] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="rounded-2xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">{question.question}</p>
        <div className="mt-4 flex flex-col gap-2" role="listbox" aria-label="Answer options">
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
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(i)}
                className={className}
              >
                <span className="mr-2 text-[10px] text-zinc-400">{i + 1}</span>
                {option}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-zinc-300 pt-4 dark:border-zinc-700">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{question.explanation}</p>
            <button
              type="button"
              onClick={goNext}
              className="self-start rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {index + 1 >= questions.length ? "Finish" : "Next question"}{" "}
              <span className="text-xs opacity-60">(Enter)</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-zinc-400">1–4 select an option · Enter advances</p>
    </div>
  );
}
