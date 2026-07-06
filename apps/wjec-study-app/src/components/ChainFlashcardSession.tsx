"use client";

import { useState } from "react";
import type { ChainFlashcard } from "@/lib/types";

interface Props {
  chain: ChainFlashcard;
  onComplete: () => void;
  onFinish: () => void;
}

// Walks through a chained sequence of question/answer steps one at a time —
// each step's answer is the stepping stone to the next question — so the
// student actively builds the full extended-response answer themselves
// instead of reading it as one finished block.
export default function ChainFlashcardSession({ chain, onComplete, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  const step = chain.steps[index];
  const isLastStep = index === chain.steps.length - 1;

  function handleNext() {
    if (isLastStep) {
      setDone(true);
      onComplete();
      return;
    }
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (done) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Full answer, built step by step
        </p>
        <h3 className="text-lg font-semibold">{chain.title}</h3>
        <ol className="flex flex-col gap-3">
          {chain.steps.map((s, i) => (
            <li key={i} className="flex flex-col gap-1 border-l-2 border-emerald-400 pl-3">
              <p className="text-sm font-medium">{s.question}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.answer}</p>
            </li>
          ))}
        </ol>
        <button
          onClick={onFinish}
          className="self-start rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
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
          Step {index + 1} of {chain.steps.length} — {chain.title}
        </span>
        <button onClick={onFinish} className="hover:underline">
          Stop
        </button>
      </div>

      {index > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <p className="font-medium text-zinc-600 dark:text-zinc-300">So far:</p>
          {chain.steps.slice(0, index).map((s, i) => (
            <p key={i} className="mt-1">
              {s.answer}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-300 bg-white p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-base font-medium">{step.question}</p>
        {revealed ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.answer}</p>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="self-center rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Reveal answer
          </button>
        )}
      </div>

      {revealed && (
        <button
          onClick={handleNext}
          className="self-start rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
        >
          {isLastStep ? "Finish" : "Next step →"}
        </button>
      )}
    </div>
  );
}
