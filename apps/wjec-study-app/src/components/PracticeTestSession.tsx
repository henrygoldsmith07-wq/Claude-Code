"use client";

import { useMemo, useRef, useState } from "react";
import type { PracticeItem } from "@/lib/types";

interface Props {
  items: PracticeItem[];
  onFinish: () => void;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function McqItem({ item, onAnswered }: { item: PracticeItem; onAnswered: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<number | null>(null);

  function select(i: number) {
    if (selected !== null) return;
    setSelected(i);
    onAnswered(i === item.correctIndex);
  }

  return (
    <div className="flex flex-col gap-2">
      {(item.options ?? []).map((option, i) => {
        const isCorrect = i === item.correctIndex;
        const isSelected = i === selected;
        let className = "rounded-lg border border-zinc-300 px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
        if (selected !== null && isCorrect) {
          className = "rounded-lg border border-emerald-500 bg-emerald-100 px-4 py-2 text-left text-sm dark:bg-emerald-950";
        } else if (isSelected) {
          className = "rounded-lg border border-red-500 bg-red-100 px-4 py-2 text-left text-sm dark:bg-red-950";
        }
        return (
          <button key={i} onClick={() => select(i)} className={className}>
            {selected !== null && isCorrect ? "✓ " : ""}
            {option}
          </button>
        );
      })}
    </div>
  );
}

function FillBlankItem({ item, onAnswered }: { item: PracticeItem; onAnswered: (correct: boolean) => void }) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const correct = submitted && value.trim().toLowerCase() === (item.answer ?? "").trim().toLowerCase();

  function submit() {
    if (submitted || !value.trim()) return;
    setSubmitted(true);
    onAnswered(value.trim().toLowerCase() === (item.answer ?? "").trim().toLowerCase());
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          disabled={submitted}
          placeholder="Your answer…"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {!submitted && (
          <button
            onClick={submit}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
          >
            Check
          </button>
        )}
      </div>
      {submitted && (
        <p className={correct ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-red-600 dark:text-red-400"}>
          {correct ? "✓ Correct" : `✗ Correct answer: ${item.answer}`}
        </p>
      )}
    </div>
  );
}

function MatchingItem({ item, onAnswered }: { item: PracticeItem; onAnswered: (correct: boolean) => void }) {
  const pairs = item.pairs ?? [];
  const rightOrder = useMemo(() => shuffle((item.pairs ?? []).map((p) => p.right)), [item.pairs]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const reported = useRef(false);

  function pickLeft(left: string) {
    if (matched.has(left)) return;
    setSelectedLeft(left);
  }

  function pickRight(right: string) {
    if (!selectedLeft) return;
    const pair = pairs.find((p) => p.left === selectedLeft);
    if (pair && pair.right === right) {
      const next = new Set(matched);
      next.add(selectedLeft);
      setMatched(next);
      setSelectedLeft(null);
      if (next.size === pairs.length && !reported.current) {
        reported.current = true;
        onAnswered(true);
      }
    } else {
      setWrong(right);
      setTimeout(() => setWrong(null), 600);
      setSelectedLeft(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-2">
        {pairs.map((p) => (
          <button
            key={p.left}
            onClick={() => pickLeft(p.left)}
            disabled={matched.has(p.left)}
            className={
              matched.has(p.left)
                ? "rounded-lg border border-emerald-500 bg-emerald-100 px-3 py-2 text-left text-sm dark:bg-emerald-950"
                : selectedLeft === p.left
                  ? "rounded-lg border border-violet-500 bg-violet-100 px-3 py-2 text-left text-sm dark:bg-violet-950"
                  : "rounded-lg border border-zinc-300 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }
          >
            {p.left}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rightOrder.map((right) => {
          const isMatched = pairs.some((p) => p.right === right && matched.has(p.left));
          return (
            <button
              key={right}
              onClick={() => pickRight(right)}
              disabled={isMatched}
              className={
                isMatched
                  ? "rounded-lg border border-emerald-500 bg-emerald-100 px-3 py-2 text-left text-sm dark:bg-emerald-950"
                  : wrong === right
                    ? "rounded-lg border border-red-500 bg-red-100 px-3 py-2 text-left text-sm dark:bg-red-950"
                    : "rounded-lg border border-zinc-300 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }
            >
              {right}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PracticeTestSession({ items, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [done, setDone] = useState(false);

  const item = items[index];

  function handleAnswered(correct: boolean) {
    if (answered) return;
    setAnswered(true);
    if (correct) setScore((s) => s + 1);
  }

  function handleNext() {
    if (index + 1 >= items.length) {
      setDone(true);
      return;
    }
    setIndex((i) => i + 1);
    setAnswered(false);
  }

  if (done) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">
          Practice test complete: {score} / {items.length}
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
          Item {index + 1} of {items.length}
        </span>
        <button onClick={onFinish} className="hover:underline">
          Stop test
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-lg font-medium">{item.prompt}</p>

        {item.format === "mcq" && <McqItem key={item.id} item={item} onAnswered={handleAnswered} />}
        {item.format === "fill-blank" && (
          <FillBlankItem key={item.id} item={item} onAnswered={handleAnswered} />
        )}
        {item.format === "matching" && (
          <MatchingItem key={item.id} item={item} onAnswered={handleAnswered} />
        )}

        {answered && (
          <div className="flex flex-col gap-3 border-t border-dashed border-zinc-300 pt-4 dark:border-zinc-700">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.explanation}</p>
            <button
              onClick={handleNext}
              className="self-start rounded-full bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-white dark:text-zinc-900"
            >
              {index + 1 >= items.length ? "Finish" : "Next item"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
