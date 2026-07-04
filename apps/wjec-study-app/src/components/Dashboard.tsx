"use client";

import { useState } from "react";
import { TOPICS } from "@/lib/curriculum";
import type { Badge } from "@/lib/gamification";
import type { Flashcard, LessonSection, QuizAttempt, QuizQuestion, SubjectId, Topic } from "@/lib/types";
import GamificationPanel from "./GamificationPanel";
import TopicList from "./TopicList";

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
  level: number;
  xpProgress: number;
  badges: Badge[];
  accent?: string;
  cardsForTopic: (topicId: string) => Flashcard[];
  quizBank: Record<string, QuizQuestion[]>;
  quizAttempts: QuizAttempt[];
  lessonBank: Record<string, LessonSection[]>;
  notebookLinks: Record<string, string>;
  examDates: Record<string, string>;
  onSetExamDate: (subjectId: SubjectId, date: string) => void;
  onClearExamDate: (subjectId: SubjectId) => void;
  onSetNotebookLink: (topicId: string, url: string) => void;
  onGenerateCards: (topicId: string) => Promise<void>;
  onGenerateQuiz: (topicId: string) => Promise<void>;
  onGenerateLesson: (topicId: string) => Promise<void>;
  onStudyTopic: (topicId: string) => void;
  onStartQuiz: (topicId: string) => void;
  onStartLesson: (topicId: string) => void;
  onStudyAllDue: () => void;
  onGenerateAllLessons: (topics: Topic[]) => void;
  bulkLessonProgress: { done: number; total: number } | null;
}

export default function Dashboard({
  streak,
  totalDue,
  subjects,
  level,
  xpProgress,
  badges,
  accent,
  cardsForTopic,
  quizBank,
  quizAttempts,
  lessonBank,
  notebookLinks,
  examDates,
  onSetExamDate,
  onClearExamDate,
  onSetNotebookLink,
  onGenerateCards,
  onGenerateQuiz,
  onGenerateLesson,
  onStudyTopic,
  onStartQuiz,
  onStartLesson,
  onStudyAllDue,
  onGenerateAllLessons,
  bulkLessonProgress,
}: Props) {
  const [expanded, setExpanded] = useState<Partial<Record<SubjectId, boolean>>>({});

  return (
    <div className="flex w-full flex-col gap-4">
      <GamificationPanel level={level} xpProgress={xpProgress} badges={badges} accent={accent} />

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <p className="text-2xl font-semibold">{streak}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">day streak</p>
        </div>
        <div>
          <p className="text-2xl font-semibold">{totalDue}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">cards due across all subjects</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => onGenerateAllLessons(TOPICS)}
            disabled={bulkLessonProgress !== null}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Generate all lessons
          </button>
          <button
            onClick={onStudyAllDue}
            disabled={totalDue === 0}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            Study all due (interleaved)
          </button>
        </div>
      </div>

      {bulkLessonProgress && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-300 bg-white p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900">
          <span className="shrink-0">
            Generating lessons: {bulkLessonProgress.done} / {bulkLessonProgress.total}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${(bulkLessonProgress.done / bulkLessonProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {subjects.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          >
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
              className="flex w-full flex-col gap-2 p-4 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">📁 {s.name}</p>
                <div className="flex items-center gap-2">
                  {s.due > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                      {s.due} due
                    </span>
                  )}
                  <span
                    className="text-zinc-400 transition-transform dark:text-zinc-500"
                    style={{ transform: expanded[s.id] ? "rotate(90deg)" : "none" }}
                  >
                    ▶
                  </span>
                </div>
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

            {expanded[s.id] && (
              <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
                <TopicList
                  subjectId={s.id}
                  cardsForTopic={cardsForTopic}
                  quizBank={quizBank}
                  quizAttempts={quizAttempts}
                  lessonBank={lessonBank}
                  notebookLinks={notebookLinks}
                  examDate={examDates[s.id]}
                  onSetExamDate={(date) => onSetExamDate(s.id, date)}
                  onClearExamDate={() => onClearExamDate(s.id)}
                  onSetNotebookLink={onSetNotebookLink}
                  onGenerateCards={onGenerateCards}
                  onGenerateQuiz={onGenerateQuiz}
                  onGenerateLesson={onGenerateLesson}
                  onStudyTopic={onStudyTopic}
                  onStartQuiz={onStartQuiz}
                  onStartLesson={onStartLesson}
                  onGenerateAllLessons={onGenerateAllLessons}
                  bulkLessonProgress={bulkLessonProgress}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
