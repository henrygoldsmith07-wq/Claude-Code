"use client";

import type { SubjectId } from "@/lib/types";

export interface SubjectSummary {
  id: SubjectId;
  name: string;
  topicCount: number;
  cardCount: number;
  due: number;
  mastery: number;
}

interface Props {
  streak: number;
  totalDue: number;
  subjects: SubjectSummary[];
  onOpenSubject: (id: SubjectId) => void;
  onStudyAllDue: () => void;
}

export default function Dashboard({ streak, totalDue, subjects, onOpenSubject, onStudyAllDue }: Props) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <p className="text-2xl font-semibold">{streak}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">day streak</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{totalDue}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">cards due across all subjects</p>
        </div>
        <button
          onClick={onStudyAllDue}
          disabled={totalDue === 0}
          className="ml-auto rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          Study all due (interleaved)
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {subjects.map((s) => (
          <button
            key={s.id}
            onClick={() => onOpenSubject(s.id)}
            className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4 text-left hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
          >
            <div className="flex items-center justify-between">
              <p className="font-medium">{s.name}</p>
              {s.due > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                  {s.due} due
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {s.topicCount} topics · {s.cardCount} cards
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${s.mastery}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.mastery}% mastered</p>
          </button>
        ))}
      </div>
    </div>
  );
}
