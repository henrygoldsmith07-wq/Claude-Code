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
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">Study plan</p>
        <input
          type="date"
          value={examDate ?? ""}
          onChange={(e) => onSetExamDate(e.target.value)}
          className="rounded border border-line px-2 py-1 text-sm"
        />
        {examDate && (
          <>
            <span className="text-xs text-ink3">
              {daysUntil(examDate)} days until exam
            </span>
            <button
              onClick={onClearExamDate}
              className="text-xs text-ink3 hover:underline"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {!examDate && (
        <p className="text-xs text-ink3">
          Set an exam date to get a daily plan that covers every topic in time, prioritising
          weaker ones.
        </p>
      )}

      {examDate && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink3">
            Today&apos;s focus
          </p>
          {todaysFocus.length === 0 ? (
            <p className="text-sm text-ink3">
              Every topic is mastered — nice work.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {todaysFocus.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => onSelectTopic(topic.id)}
                  className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-surface2 dark:hover:bg-surface"
                >
                  {topic.title}
                </button>
              ))}
            </div>
          )}

          {upcomingDays.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 border-t border-dashed border-line pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-ink3">
                Coming up
              </p>
              {upcomingDays.map((dayTopics, i) => (
                <p key={i} className="text-xs text-ink3">
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
