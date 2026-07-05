"use client";

import { daysUntil } from "@/lib/studyPlan";
import type { Topic } from "@/lib/types";

interface Props {
  examDate: string | undefined;
  todaysFocus: Topic[];
  upcomingDays: Topic[][];
  onSetExamDate: (date: string) => void;
  onClearExamDate: () => void;
  onSelectTopic: (topicId: string) => void;
}

export default function StudyPlanPanel({
  examDate,
  todaysFocus,
  upcomingDays,
  onSetExamDate,
  onClearExamDate,
  onSelectTopic,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">Study plan</p>
        <input
          type="date"
          value={examDate ?? ""}
          onChange={(e) => onSetExamDate(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {examDate && (
          <>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {daysUntil(examDate)} days until exam
            </span>
            <button
              onClick={onClearExamDate}
              className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {!examDate && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Set an exam date to get a daily plan that covers every topic in time, prioritising
          weaker ones.
        </p>
      )}

      {examDate && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Today&apos;s focus
          </p>
          {todaysFocus.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Every topic is mastered — nice work.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {todaysFocus.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => onSelectTopic(topic.id)}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {topic.title}
                </button>
              ))}
            </div>
          )}

          {upcomingDays.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 border-t border-dashed border-zinc-200 pt-2 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Coming up
              </p>
              {upcomingDays.map((dayTopics, i) => (
                <p key={i} className="text-xs text-zinc-500 dark:text-zinc-400">
                  Day {i + 2}: {dayTopics.length === 0 ? "—" : dayTopics.map((t) => t.title).join(", ")}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
