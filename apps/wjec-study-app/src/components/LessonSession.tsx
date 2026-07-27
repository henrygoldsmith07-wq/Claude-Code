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
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const section = queue[index];

  function handleSelect(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
  }

  function handleNext() {
    const correct = selected === section.correctIndex;
    let nextQueue = queue;
    if (!correct) {
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
    setSelected(null);
  }

  if (done) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-lg font-medium">Lesson complete.</p>
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
          Section {index + 1} of {queue.length}
        </span>
        <button onClick={onFinish} className="hover:underline">
          Stop lesson
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <div>
          <p className="text-lg font-medium">{section.heading}</p>
          <p className="mt-2 text-ink2">{section.explanation}</p>
        </div>

        <div className="border-t border-dashed border-line pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink3">
            Check your understanding
          </p>
          <p className="mt-1 text-sm">{section.checkQuestion}</p>

          <div className="mt-2 flex flex-col gap-2">
            {section.checkOptions.map((option, i) => {
              const isCorrect = i === section.correctIndex;
              const isSelected = i === selected;
              let className =
                "rounded-lg border border-line px-4 py-2 text-left text-sm hover:bg-surface2 dark:hover:bg-surface";
              if (selected !== null && isCorrect) {
                className =
                  "rounded-lg border border-success bg-successsoft px-4 py-2 text-left text-sm";
              } else if (isSelected) {
                className =
                  "rounded-lg border border-danger bg-dangersoft px-4 py-2 text-left text-sm";
              }
              return (
                <button key={i} onClick={() => handleSelect(i)} className={className}>
                  {selected !== null && isCorrect ? "✓ " : ""}
                  {option}
                </button>
              );
            })}
          </div>

          {selected !== null && (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-ink2">{section.checkExplanation}</p>
              <button
                onClick={handleNext}
                className="self-start rounded-full bg-surface px-4 py-1.5 text-sm text-onaccent dark:bg-surface"
              >
                {index + 1 >= queue.length ? "Finish" : "Next section"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
