"use client";

import { useCallback, useMemo, useState } from "react";
import { reviewCard } from "./fsrs";
import {
  XP_LESSON_COMPLETE_BONUS,
  XP_PER_CARD_GRADE,
  XP_PER_LESSON_SECTION,
  XP_PER_QUIZ_CORRECT,
  XP_PER_STUDY_DAY,
} from "./gamification";
import { computeStreak } from "./stats";
import {
  clearExamDateAction,
  completeLessonAction,
  gradeCardAction,
  recordQuizAttemptAction,
  setExamDateAction,
  setNotebookLinkAction,
  bulkImportNotebookLinksAction,
} from "./supabase/actions";
import type { InitialStudyData } from "./supabase/loadInitialData";
import type {
  Flashcard,
  LessonSection,
  QuizAttempt,
  QuizQuestion,
  RecallGrade,
  SubjectId,
} from "./types";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Holds a mirror of the user's Supabase-backed study data in React state,
// hydrated once from the server on load. Writes update local state
// immediately (optimistic) and are persisted via Server Actions in the
// background, so the UI stays instant while the database is the source of
// truth across devices.
export function useStudyData(initial: InitialStudyData) {
  const [cards, setCards] = useState<Record<string, Flashcard>>(initial.cards);
  const [quizBank, setQuizBank] = useState<Record<string, QuizQuestion[]>>(initial.quizBank);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>(initial.quizAttempts);
  const [studyDays, setStudyDays] = useState<string[]>(initial.studyDays);
  const [examDates, setExamDates] = useState<Record<string, string>>(initial.examDates);
  const [lessonBank, setLessonBank] = useState<Record<string, LessonSection[]>>(initial.lessonBank);
  const [lessonCompletions, setLessonCompletions] = useState<string[]>(initial.lessonCompletions);
  const [notebookLinks, setNotebookLinks] = useState<Record<string, string>>(initial.notebookLinks);
  const [xp, setXp] = useState<number>(initial.profile.xp);
  const [totalReviews, setTotalReviews] = useState<number>(initial.profile.totalReviews);
  const [longestStreak, setLongestStreak] = useState<number>(initial.profile.longestStreak);

  const cardList = useMemo(() => Object.values(cards), [cards]);

  const cardsForTopic = useCallback(
    (topicId: string) => cardList.filter((c) => c.topicId === topicId),
    [cardList],
  );

  const cardsForSubject = useCallback(
    (subjectId: SubjectId) => cardList.filter((c) => c.subjectId === subjectId),
    [cardList],
  );

  const markStudyDayLocally = useCallback(() => {
    const today = toDateOnly(new Date());
    setStudyDays((prev) => {
      if (prev.includes(today)) return prev;
      const next = [...prev, today];
      setXp((x) => x + XP_PER_STUDY_DAY);
      setLongestStreak((l) => Math.max(l, computeStreak(next)));
      return next;
    });
  }, []);

  // Flashcards/quizzes/lessons are fetched (and cached in Supabase) by the
  // API routes, which return the full hydrated objects; these setters just
  // merge the results into local state.
  const addGeneratedCards = useCallback(
    (_subjectId: SubjectId, _topicId: string, generatedCards: Flashcard[]) => {
      setCards((prev) => {
        const next = { ...prev };
        for (const c of generatedCards) next[c.id] = c;
        return next;
      });
    },
    [],
  );

  const setQuizForTopic = useCallback(
    (_subjectId: SubjectId, topicId: string, questions: QuizQuestion[]) => {
      setQuizBank((prev) => ({ ...prev, [topicId]: questions }));
    },
    [],
  );

  const setLessonForTopic = useCallback((topicId: string, sections: LessonSection[]) => {
    setLessonBank((prev) => ({ ...prev, [topicId]: sections }));
  }, []);

  const gradeCard = useCallback(
    (cardId: string, grade: RecallGrade) => {
      setCards((prev) => {
        const card = prev[cardId];
        if (!card) return prev;
        return { ...prev, [cardId]: reviewCard(card, grade) };
      });
      setTotalReviews((prev) => prev + 1);
      setXp((prev) => prev + XP_PER_CARD_GRADE[grade]);
      markStudyDayLocally();
      void gradeCardAction(cardId, grade);
    },
    [markStudyDayLocally],
  );

  const recordQuizAttempt = useCallback(
    (subjectId: SubjectId, topicId: string, score: number, total: number) => {
      const attempt: QuizAttempt = {
        id: `local-${Date.now()}`,
        subjectId,
        topicId,
        score,
        total,
        completedAt: new Date().toISOString(),
      };
      setQuizAttempts((prev) => [...prev, attempt]);
      setXp((prev) => prev + score * XP_PER_QUIZ_CORRECT);
      markStudyDayLocally();
      void recordQuizAttemptAction(subjectId, topicId, score, total);
    },
    [markStudyDayLocally],
  );

  const completeLesson = useCallback(
    (topicId: string, sectionCount: number) => {
      setLessonCompletions((prev) => (prev.includes(topicId) ? prev : [...prev, topicId]));
      setXp((prev) => prev + sectionCount * XP_PER_LESSON_SECTION + XP_LESSON_COMPLETE_BONUS);
      markStudyDayLocally();
      void completeLessonAction(topicId, sectionCount);
    },
    [markStudyDayLocally],
  );

  const setExamDate = useCallback((subjectId: SubjectId, date: string) => {
    setExamDates((prev) => ({ ...prev, [subjectId]: date }));
    void setExamDateAction(subjectId, date);
  }, []);

  const clearExamDate = useCallback((subjectId: SubjectId) => {
    setExamDates((prev) => {
      const next = { ...prev };
      delete next[subjectId];
      return next;
    });
    void clearExamDateAction(subjectId);
  }, []);

  const setNotebookLink = useCallback((topicId: string, url: string) => {
    setNotebookLinks((prev) => {
      if (!url) {
        const next = { ...prev };
        delete next[topicId];
        return next;
      }
      return { ...prev, [topicId]: url };
    });
    void setNotebookLinkAction(topicId, url);
  }, []);

  const bulkImportNotebookLinks = useCallback((links: Record<string, string>) => {
    setNotebookLinks((prev) => ({ ...prev, ...links }));
    void bulkImportNotebookLinksAction(links);
  }, []);

  return {
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
  };
}
