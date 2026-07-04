"use client";

import { useMemo, useState } from "react";
import { SUBJECTS, findTopic, topicsForSubject } from "@/lib/curriculum";
import { buildInterleavedQueue } from "@/lib/scheduler";
import { computeStreak, dueCount, masteryPercent } from "@/lib/stats";
import { useStudyData } from "@/lib/useStudyData";
import type { Flashcard, RecallGrade, SubjectId } from "@/lib/types";
import ApiKeyBar from "./ApiKeyBar";
import Dashboard, { type SubjectSummary } from "./Dashboard";
import TopicList from "./TopicList";
import StudySession from "./StudySession";
import QuizSession from "./QuizSession";

type View =
  | { mode: "dashboard" }
  | { mode: "subject"; subjectId: SubjectId }
  | { mode: "study"; queue: Flashcard[]; returnTo: View }
  | { mode: "quiz"; subjectId: SubjectId; topicId: string; returnTo: View };

const SESSION_LIMIT = 30;

export default function StudyApp() {
  const {
    cardList,
    cardsForTopic,
    cardsForSubject,
    quizBank,
    quizAttempts,
    studyDays,
    apiKey,
    setApiKey,
    addGeneratedCards,
    setQuizForTopic,
    gradeCard,
    recordQuizAttempt,
  } = useStudyData();

  const [view, setView] = useState<View>({ mode: "dashboard" });
  const [error, setError] = useState<string | null>(null);

  const streak = computeStreak(studyDays);
  const totalDue = dueCount(cardList);

  const subjectSummaries: SubjectSummary[] = useMemo(
    () =>
      SUBJECTS.map((s) => {
        const cards = cardsForSubject(s.id);
        const attempts = quizAttempts.filter((a) => a.subjectId === s.id).slice(-20);
        return {
          id: s.id,
          name: s.name,
          topicCount: topicsForSubject(s.id).length,
          cardCount: cards.length,
          due: dueCount(cards),
          mastery: masteryPercent(cards, attempts),
        };
      }),
    [cardsForSubject, quizAttempts],
  );

  async function generateCardsForTopic(topicId: string) {
    setError(null);
    const topic = findTopic(topicId);
    if (!topic) return;
    try {
      const res = await fetch("/api/generate-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate flashcards");
      addGeneratedCards(topic.subjectId, topicId, data.cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate flashcards");
    }
  }

  async function generateQuizForTopic(topicId: string) {
    setError(null);
    const topic = findTopic(topicId);
    if (!topic) return;
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate quiz");
      setQuizForTopic(topic.subjectId, topicId, data.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate quiz");
    }
  }

  function studyTopic(topicId: string) {
    const queue = buildInterleavedQueue(cardsForTopic(topicId), SESSION_LIMIT);
    if (queue.length === 0) return;
    setView({ mode: "study", queue, returnTo: view });
  }

  function studyAllDue() {
    const queue = buildInterleavedQueue(cardList, SESSION_LIMIT);
    if (queue.length === 0) return;
    setView({ mode: "study", queue, returnTo: { mode: "dashboard" } });
  }

  function startQuiz(topicId: string) {
    const topic = findTopic(topicId);
    if (!topic) return;
    setView({ mode: "quiz", subjectId: topic.subjectId, topicId, returnTo: view });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <ApiKeyBar apiKey={apiKey} onApiKeyChange={setApiKey} />

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {view.mode === "dashboard" && (
        <Dashboard
          streak={streak}
          totalDue={totalDue}
          subjects={subjectSummaries}
          onOpenSubject={(subjectId) => setView({ mode: "subject", subjectId })}
          onStudyAllDue={studyAllDue}
        />
      )}

      {view.mode === "subject" && (
        <TopicList
          subjectId={view.subjectId}
          cardsForTopic={cardsForTopic}
          quizBank={quizBank}
          quizAttempts={quizAttempts}
          onGenerateCards={generateCardsForTopic}
          onGenerateQuiz={generateQuizForTopic}
          onStudyTopic={studyTopic}
          onStartQuiz={startQuiz}
          onBack={() => setView({ mode: "dashboard" })}
        />
      )}

      {view.mode === "study" && (
        <StudySession
          initialQueue={view.queue}
          onGrade={(cardId, grade: RecallGrade) => gradeCard(cardId, grade)}
          onFinish={() => setView(view.returnTo)}
        />
      )}

      {view.mode === "quiz" && (
        <QuizSession
          questions={quizBank[view.topicId] ?? []}
          onComplete={(score, total) => recordQuizAttempt(view.subjectId, view.topicId, score, total)}
          onFinish={() => setView(view.returnTo)}
        />
      )}
    </div>
  );
}
