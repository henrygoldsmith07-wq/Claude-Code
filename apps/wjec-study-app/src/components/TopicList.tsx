"use client";

import { useState } from "react";
import { topicsForSubject } from "@/lib/curriculum";
import { dueCount, masteryPercent, recentAttemptsForTopic } from "@/lib/stats";
import type { Flashcard, QuizAttempt, QuizQuestion, SubjectId } from "@/lib/types";

interface Props {
  subjectId: SubjectId;
  cardsForTopic: (topicId: string) => Flashcard[];
  quizBank: Record<string, QuizQuestion[]>;
  quizAttempts: QuizAttempt[];
  onGenerateCards: (topicId: string) => Promise<void>;
  onGenerateQuiz: (topicId: string) => Promise<void>;
  onStudyTopic: (topicId: string) => void;
  onStartQuiz: (topicId: string) => void;
  onBack: () => void;
}

export default function TopicList({
  subjectId,
  cardsForTopic,
  quizBank,
  quizAttempts,
  onGenerateCards,
  onGenerateQuiz,
  onStudyTopic,
  onStartQuiz,
  onBack,
}: Props) {
  const topics = topicsForSubject(subjectId);
  const [loading, setLoading] = useState<Record<string, "cards" | "quiz" | undefined>>({});

  async function handleGenerateCards(topicId: string) {
    setLoading((prev) => ({ ...prev, [topicId]: "cards" }));
    try {
      await onGenerateCards(topicId);
    } finally {
      setLoading((prev) => ({ ...prev, [topicId]: undefined }));
    }
  }

  async function handleGenerateQuiz(topicId: string) {
    setLoading((prev) => ({ ...prev, [topicId]: "quiz" }));
    try {
      await onGenerateQuiz(topicId);
    } finally {
      setLoading((prev) => ({ ...prev, [topicId]: undefined }));
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        onClick={onBack}
        className="self-start text-xs text-zinc-500 hover:underline dark:text-zinc-400"
      >
        Back to dashboard
      </button>

      {topics.map((topic) => {
        const cards = cardsForTopic(topic.id);
        const due = dueCount(cards);
        const mastery = masteryPercent(cards, recentAttemptsForTopic(quizAttempts, topic.id));
        const quiz = quizBank[topic.id];
        const busy = loading[topic.id];

        return (
          <div
            key={topic.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <p className="font-medium">{topic.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {cards.length} cards · {due} due · {mastery}% mastered
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {cards.length === 0 ? (
                <button
                  onClick={() => handleGenerateCards(topic.id)}
                  disabled={busy === "cards"}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {busy === "cards" ? "Generating…" : "Generate cards"}
                </button>
              ) : (
                <button
                  onClick={() => onStudyTopic(topic.id)}
                  disabled={due === 0}
                  className="rounded-full bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
                >
                  Study {due > 0 ? `(${due})` : ""}
                </button>
              )}

              {quiz ? (
                <button
                  onClick={() => onStartQuiz(topic.id)}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Quiz ({quiz.length})
                </button>
              ) : (
                <button
                  onClick={() => handleGenerateQuiz(topic.id)}
                  disabled={busy === "quiz"}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  {busy === "quiz" ? "Generating…" : "Generate quiz"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
