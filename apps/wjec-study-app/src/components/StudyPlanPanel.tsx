"use client";

import { daysUntil } from "@/lib/studyPlan";
import type { CalendarBlock, StudyPlanMode, Topic } from "@/lib/types";
import StudyCalendar from "./StudyCalendar";

interface Props {
  examDate: string | undefined;
  todaysFocus: Topic[];
  upcomingDays: Topic[][];
  onSetExamDate: (date: string) => void;
  onClearExamDate: () => void;
  onSelectTopic: (topicId: string) => void;
  mode: StudyPlanMode;
  onModeChange: (mode: StudyPlanMode) => void;
  calendarBlocks: CalendarBlock[];
  onScheduleTopic: (topic: Topic, day: string, startHour: number) => void;
  onMoveBlock: (id: string, day: string, startHour: number) => void;
  onDeleteBlock: (id: string) => void;
}

export default function StudyPlanPanel({
  examDate,
  todaysFocus,
  upcomingDays,
  onSetExamDate,
  onClearExamDate,
  onSelectTopic,
  mode,
  onModeChange,
  calendarBlocks,
  onScheduleTopic,
  onMoveBlock,
  onDeleteBlock,
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

        {examDate && (
          <div className="ml-auto flex gap-1 rounded-full border border-zinc-300 p-0.5 text-xs dark:border-zinc-700">
            <button
              onClick={() => onModeChange("list")}
              aria-pressed={mode === "list"}
              className={
                mode === "list"
                  ? "rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
                  : "rounded-full px-3 py-1 text-zinc-600 dark:text-zinc-400"
              }
            >
              List
            </button>
            <button
              onClick={() => onModeChange("calendar")}
              aria-pressed={mode === "calendar"}
              className={
                mode === "calendar"
                  ? "rounded-full bg-zinc-900 px-3 py-1 text-white dark:bg-white dark:text-zinc-900"
                  : "rounded-full px-3 py-1 text-zinc-600 dark:text-zinc-400"
              }
            >
              Calendar
            </button>
          </div>
        )}
      </div>

      {!examDate && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Set an exam date to get a daily plan that covers every topic in time, prioritising
          weaker ones.
        </p>
      )}

      {examDate && mode === "list" && (
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

      {examDate && mode === "calendar" && (
        <StudyCalendar
          unscheduledTopics={[...todaysFocus, ...upcomingDays.flat()].filter(
            (t, i, arr) => arr.findIndex((x) => x.id === t.id) === i,
          )}
          blocks={calendarBlocks}
          onScheduleTopic={onScheduleTopic}
          onMoveBlock={onMoveBlock}
          onDeleteBlock={onDeleteBlock}
          onSelectTopic={onSelectTopic}
        />
      )}
    </div>
  );
}
