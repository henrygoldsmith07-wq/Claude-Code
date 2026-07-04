"use client";

import { useState } from "react";
import { topicsForSubject } from "@/lib/curriculum";
import { dueCount, masteryPercent, recentAttemptsForTopic } from "@/lib/stats";
import { daysUntil, topicsForToday } from "@/lib/studyPlan";
import type { Flashcard, LessonSection, QuizAttempt, QuizQuestion, SubjectId } from "@/lib/types";
import StudyPlanPanel from "./StudyPlanPanel";
import TopicRow from "./TopicRow";

interface Props {
  subjectId: SubjectId;
  cardsForTopic: (topicId: string) => Flashcard[];
  quizBank: Record<string, QuizQuestion[]>;
  quizAttempts: QuizAttempt[];
  lessonBank: Record<string, LessonSection[]>;
  notebookLinks: Record<string, string>;
  examDate: string | undefined;
  onSetExamDate: (date: string) => void;
  onClearExamDate: () => void;
  onSetNotebookLink: (topicId: string, url: string) => void;
  onGenerateCards: (topicId: string) => Promise<void>;
  onGenerateQuiz: (topicId: string) => Promise<void>;
  onGenerateLesson: (topicId: string) => Promise<void>;
  onStudyTopic: (topicId: string) => void;
  onStartQuiz: (topicId: string) => void;
  onStartLesson: (topicId: string) => void;
}

type Busy = "cards" | "quiz" | "lesson" | undefined;

export default function TopicList({
  subjectId,
  cardsForTopic,
  quizBank,
  quizAttempts,
  lessonBank,
  notebookLinks,
  examDate,
  onSetExamDate,
  onClearExamDate,
  onSetNotebookLink,
  onGenerateCards,
  onGenerateQuiz,
  onGenerateLesson,
  onStudyTopic,
  onStartQuiz,
  onStartLesson,
}: Props) {
  const topics = topicsForSubject(subjectId);
  const [loading, setLoading] = useState<Record<string, Busy>>({});

  async function handleGenerate(topicId: string, kind: "cards" | "quiz" | "lesson", run: () => Promise<void>) {
    setLoading((prev) => ({ ...prev, [topicId]: kind }));
    try {
      await run();
    } finally {
      setLoading((prev) => ({ ...prev, [topicId]: undefined }));
    }
  }

  const todaysFocus = examDate
    ? topicsForToday(topics, cardsForTopic, quizAttempts, daysUntil(examDate))
    : [];

  return (
    <div className="flex w-full flex-col gap-3">
      <StudyPlanPanel
        examDate={examDate}
        todaysFocus={todaysFocus}
        onSetExamDate={onSetExamDate}
        onClearExamDate={onClearExamDate}
        onSelectTopic={(topicId) => {
          if (cardsForTopic(topicId).length === 0) {
            handleGenerate(topicId, "cards", () => onGenerateCards(topicId));
          } else {
            onStudyTopic(topicId);
          }
        }}
      />

      {topics.map((topic) => {
        const cards = cardsForTopic(topic.id);
        const due = dueCount(cards);
        const mastery = masteryPercent(cards, recentAttemptsForTopic(quizAttempts, topic.id));

        return (
          <TopicRow
            key={topic.id}
            topic={topic}
            cards={cards}
            due={due}
            mastery={mastery}
            quiz={quizBank[topic.id]}
            lessonSections={lessonBank[topic.id]}
            notebookLink={notebookLinks[topic.id]}
            busy={loading[topic.id]}
            onGenerateCards={() => handleGenerate(topic.id, "cards", () => onGenerateCards(topic.id))}
            onGenerateQuiz={() => handleGenerate(topic.id, "quiz", () => onGenerateQuiz(topic.id))}
            onGenerateLesson={() =>
              handleGenerate(topic.id, "lesson", () => onGenerateLesson(topic.id))
            }
            onStudy={() => onStudyTopic(topic.id)}
            onStartQuiz={() => onStartQuiz(topic.id)}
            onStartLesson={() => onStartLesson(topic.id)}
            onSetNotebookLink={(url) => onSetNotebookLink(topic.id, url)}
          />
        );
      })}
    </div>
  );
}
