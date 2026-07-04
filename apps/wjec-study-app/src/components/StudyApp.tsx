"use client";

import { useMemo, useState } from "react";
import { SUBJECTS, TOPICS, findTopic, topicsForSubject } from "@/lib/curriculum";
import { buildInterleavedQueue } from "@/lib/scheduler";
import { computeStreak, dueCount, masteryPercent, recentAttemptsForTopic } from "@/lib/stats";
import { computeBadges, levelForXp, xpIntoLevel } from "@/lib/gamification";
import { useStudyData } from "@/lib/useStudyData";
import type { Flashcard, RecallGrade, SubjectId } from "@/lib/types";
import ApiKeyBar from "./ApiKeyBar";
import NotebookLinksPanel from "./NotebookLinksPanel";
import Dashboard, { type SubjectSummary } from "./Dashboard";
import TopicList from "./TopicList";
import StudySession from "./StudySession";
import QuizSession from "./QuizSession";
import LessonSession from "./LessonSession";

type View =
  | { mode: "dashboard" }
  | { mode: "subject"; subjectId: SubjectId }
  | { mode: "study"; queue: Flashcard[]; returnTo: View }
  | { mode: "quiz"; subjectId: SubjectId; topicId: string; returnTo: View }
  | { mode: "lesson"; subjectId: SubjectId; topicId: string; returnTo: View };

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
    examDates,
    setExamDate,
    clearExamDate,
    lessonBank,
    lessonCompletions,
    notebookLinks,
    setNotebookLink,
    bulkImportNotebookLinks,
    xp,
    totalReviews,
    longestStreak,
    addGeneratedCards,
    setQuizForTopic,
    setLessonForTopic,
    gradeCard,
    recordQuizAttempt,
    completeLesson,
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

  const level = levelForXp(xp);
  const xpProgress = xpIntoLevel(xp);
  const badges = useMemo(() => {
    const perfectQuiz = quizAttempts.some((a) => a.total > 0 && a.score === a.total);
    const hasCardsInAllSubjects = subjectSummaries.every((s) => s.cardCount > 0);
    const anyTopicMastered = TOPICS.some((t) => {
      const cards = cardsForTopic(t.id);
      if (cards.length === 0) return false;
      return masteryPercent(cards, recentAttemptsForTopic(quizAttempts, t.id)) >= 100;
    });
    return computeBadges({
      totalReviews,
      longestStreak,
      perfectQuiz,
      hasCardsInAllSubjects,
      lessonsCompletedCount: lessonCompletions.length,
      anyTopicMastered,
      level,
    });
  }, [
    quizAttempts,
    subjectSummaries,
    cardsForTopic,
    totalReviews,
    longestStreak,
    lessonCompletions,
    level,
  ]);

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

  async function generateLessonForTopic(topicId: string) {
    setError(null);
    const topic = findTopic(topicId);
    if (!topic) return;
    try {
      const res = await fetch("/api/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, apiKey: apiKey || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate lesson");
      setLessonForTopic(topicId, data.sections);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate lesson");
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

  function startLesson(topicId: string) {
    const topic = findTopic(topicId);
    if (!topic) return;
    setView({ mode: "lesson", subjectId: topic.subjectId, topicId, returnTo: view });
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
        <NotebookLinksPanel
          linkedCount={Object.keys(notebookLinks).length}
          onImport={bulkImportNotebookLinks}
        />
        <ApiKeyBar apiKey={apiKey} onApiKeyChange={setApiKey} />
      </div>

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
          level={level}
          xpProgress={xpProgress}
          badges={badges}
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
          lessonBank={lessonBank}
          notebookLinks={notebookLinks}
          examDate={examDates[view.subjectId]}
          onSetExamDate={(date) => setExamDate(view.subjectId, date)}
          onClearExamDate={() => clearExamDate(view.subjectId)}
          onSetNotebookLink={setNotebookLink}
          onGenerateCards={generateCardsForTopic}
          onGenerateQuiz={generateQuizForTopic}
          onGenerateLesson={generateLessonForTopic}
          onStudyTopic={studyTopic}
          onStartQuiz={startQuiz}
          onStartLesson={startLesson}
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

      {view.mode === "lesson" && (
        <LessonSession
          sections={lessonBank[view.topicId] ?? []}
          onComplete={(sectionCount) => completeLesson(view.topicId, sectionCount)}
          onFinish={() => setView(view.returnTo)}
        />
      )}
    </div>
  );
}
