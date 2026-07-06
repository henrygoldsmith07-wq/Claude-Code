"use client";

import { useMemo, useRef, useState } from "react";
import { SUBJECTS, TOPICS, findTopic, topicsForSubject } from "@/lib/curriculum";
import { buildInterleavedQueue } from "@/lib/scheduler";
import { computeStreak, dueCount, masteryPercent, recentAttemptsForTopic } from "@/lib/stats";
import { computeBadges, levelForXp, xpIntoLevel } from "@/lib/gamification";
import { mapWithConcurrency } from "@/lib/concurrency";
import { useStudyData } from "@/lib/useStudyData";
import { useTimeLog } from "@/lib/useTimeLog";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { setAccentThemeAction } from "@/lib/supabase/actions";
import type { InitialStudyData } from "@/lib/supabase/loadInitialData";
import type { Flashcard, RecallGrade, SessionKind, SubjectId, Topic } from "@/lib/types";
import ApiKeyBar from "./ApiKeyBar";
import NotebookLinksPanel from "./NotebookLinksPanel";
import TabBar from "./TabBar";
import Dashboard, { type SubjectSummary } from "./Dashboard";
import StudySession from "./StudySession";
import QuizSession from "./QuizSession";
import LessonSession from "./LessonSession";
import QaPanel from "./QaPanel";
import MindMapPanel from "./MindMapPanel";
import PracticeTestPanel from "./PracticeTestPanel";
import NoteBank from "./NoteBank";
import TaskBoard from "./TaskBoard";
import FocusTimer from "./FocusTimer";
import AudioOverviewPanel from "./AudioOverviewPanel";
import TimeAnalyticsPanel from "./TimeAnalyticsPanel";
import ShopPanel from "./ShopPanel";
import StudyRoomPanel from "./StudyRoomPanel";
import RevisionTrackerPanel from "./RevisionTrackerPanel";

type View =
  | { mode: "dashboard" }
  | { mode: "study"; queue: Flashcard[]; subjectId: SubjectId | null }
  | { mode: "quiz"; subjectId: SubjectId; topicId: string }
  | { mode: "lesson"; subjectId: SubjectId; topicId: string };

const SESSION_LIMIT = 30;

const TABS = [
  { id: "study", label: "Study" },
  { id: "tracker", label: "Revision Tracker" },
  { id: "ask", label: "Ask AI" },
  { id: "tests", label: "Practice Tests" },
  { id: "mindmap", label: "Mind Maps" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tasks" },
  { id: "focus", label: "Focus Timer" },
  { id: "rooms", label: "Study Room" },
  { id: "audio", label: "Audio Overviews" },
  { id: "analytics", label: "Analytics" },
  { id: "shop", label: "Shop" },
];

export default function StudyApp({ userId, initialData }: { userId: string; initialData: InitialStudyData }) {
  const {
    cardList,
    cardsForTopic,
    cardsForSubject,
    quizBank,
    quizAttempts,
    studyDays,
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
  } = useStudyData(initialData);
  const { sessions, logSession } = useTimeLog(initialData.timeSessions);

  // The visitor's own Anthropic API key is a device-level secret, not synced
  // account data, so it stays in localStorage.
  const [apiKey, setApiKey] = useLocalStorage<string>("wjec-study-api-key", "");

  const [view, setView] = useState<View>({ mode: "dashboard" });
  const [activeTab, setActiveTab] = useState("study");
  const [error, setError] = useState<string | null>(null);
  const [accent, setAccent] = useState<string>(initialData.profile.accentTheme);
  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(initialData.profile.unlockedThemes);
  const [bulkLessonProgress, setBulkLessonProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const sessionStartRef = useRef(0);

  const streak = computeStreak(studyDays);
  const totalDue = dueCount(cardList);

  function applyTheme(nextAccent: string, nextUnlocked: string[]) {
    setAccent(nextAccent);
    setUnlockedThemes(nextUnlocked);
    void setAccentThemeAction(nextAccent, nextUnlocked);
  }

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

  async function generateAllLessons(topics: Topic[]) {
    if (bulkLessonProgress) return;
    const pending = topics.filter((t) => !lessonBank[t.id]);
    if (pending.length === 0) return;
    setError(null);
    setBulkLessonProgress({ done: 0, total: pending.length });
    let done = 0;
    await mapWithConcurrency(pending, 3, async (topic) => {
      await generateLessonForTopic(topic.id);
      done += 1;
      setBulkLessonProgress({ done, total: pending.length });
    });
    setBulkLessonProgress(null);
  }

  function enterSession(next: View) {
    sessionStartRef.current = Date.now();
    setView(next);
  }

  function finishSession(kind: SessionKind, subjectId: SubjectId | null) {
    logSession(kind, subjectId, Date.now() - sessionStartRef.current);
    setView({ mode: "dashboard" });
  }

  function studyTopic(topicId: string) {
    const topic = findTopic(topicId);
    const queue = buildInterleavedQueue(cardsForTopic(topicId), SESSION_LIMIT);
    if (queue.length === 0) return;
    enterSession({ mode: "study", queue, subjectId: topic?.subjectId ?? null });
  }

  function studyAllDue() {
    const queue = buildInterleavedQueue(cardList, SESSION_LIMIT);
    if (queue.length === 0) return;
    enterSession({ mode: "study", queue, subjectId: null });
  }

  function startQuiz(topicId: string) {
    const topic = findTopic(topicId);
    if (!topic) return;
    enterSession({ mode: "quiz", subjectId: topic.subjectId, topicId });
  }

  function startLesson(topicId: string) {
    const topic = findTopic(topicId);
    if (!topic) return;
    enterSession({ mode: "lesson", subjectId: topic.subjectId, topicId });
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

      {view.mode === "study" && (
        <StudySession
          initialQueue={view.queue}
          onGrade={(cardId, grade: RecallGrade) => gradeCard(cardId, grade)}
          onFinish={() => finishSession("study", view.subjectId)}
        />
      )}

      {view.mode === "quiz" && (
        <QuizSession
          questions={quizBank[view.topicId] ?? []}
          onComplete={(score, total) => recordQuizAttempt(view.subjectId, view.topicId, score, total)}
          onFinish={() => finishSession("quiz", view.subjectId)}
        />
      )}

      {view.mode === "lesson" && (
        <LessonSession
          sections={lessonBank[view.topicId] ?? []}
          onComplete={(sectionCount) => completeLesson(view.topicId, sectionCount)}
          onFinish={() => finishSession("lesson", view.subjectId)}
        />
      )}

      {view.mode === "dashboard" && (
        <>
          <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

          {activeTab === "study" && (
            <Dashboard
              streak={streak}
              totalDue={totalDue}
              subjects={subjectSummaries}
              level={level}
              xpProgress={xpProgress}
              badges={badges}
              accent={accent}
              cardsForTopic={cardsForTopic}
              quizBank={quizBank}
              quizAttempts={quizAttempts}
              lessonBank={lessonBank}
              notebookLinks={notebookLinks}
              examDates={examDates}
              onSetExamDate={setExamDate}
              onClearExamDate={clearExamDate}
              onSetNotebookLink={setNotebookLink}
              onGenerateCards={generateCardsForTopic}
              onGenerateQuiz={generateQuizForTopic}
              onGenerateLesson={generateLessonForTopic}
              onStudyTopic={studyTopic}
              onStartQuiz={startQuiz}
              onStartLesson={startLesson}
              onStudyAllDue={studyAllDue}
              onGenerateAllLessons={generateAllLessons}
              bulkLessonProgress={bulkLessonProgress}
            />
          )}
          {activeTab === "tracker" && (
            <RevisionTrackerPanel
              cardsForTopic={cardsForTopic}
              quizAttempts={quizAttempts}
              onStudyTopic={studyTopic}
            />
          )}
          {activeTab === "ask" && (
            <QaPanel
              apiKey={apiKey}
              initialDocuments={initialData.anchorDocuments}
              initialHistory={initialData.qaHistory}
            />
          )}
          {activeTab === "tests" && <PracticeTestPanel apiKey={apiKey} />}
          {activeTab === "mindmap" && <MindMapPanel apiKey={apiKey} />}
          {activeTab === "notes" && <NoteBank apiKey={apiKey} initialNotes={initialData.notes} />}
          {activeTab === "tasks" && <TaskBoard initialTasks={initialData.tasks} />}
          {activeTab === "focus" && (
            <FocusTimer onLogFocus={(ms) => logSession("focus", null, ms)} />
          )}
          {activeTab === "rooms" && (
            <StudyRoomPanel userId={userId} displayName={initialData.profile.displayName ?? ""} />
          )}
          {activeTab === "audio" && (
            <AudioOverviewPanel apiKey={apiKey} initialOverviews={initialData.audioOverviews} />
          )}
          {activeTab === "analytics" && (
            <TimeAnalyticsPanel studyDays={studyDays} sessions={sessions} />
          )}
          {activeTab === "shop" && (
            <ShopPanel
              xp={xp}
              accent={accent}
              unlockedThemes={unlockedThemes}
              onChange={applyTheme}
            />
          )}
        </>
      )}
    </div>
  );
}
