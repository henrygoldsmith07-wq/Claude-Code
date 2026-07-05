"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { createCard, reviewCard } from "./fsrs";
import { computeStreak } from "./stats";
import {
  XP_LESSON_COMPLETE_BONUS,
  XP_PER_CARD_GRADE,
  XP_PER_LESSON_SECTION,
  XP_PER_QUIZ_CORRECT,
  XP_PER_STUDY_DAY,
} from "./gamification";
import type {
  Flashcard,
  LessonSection,
  QuizAttempt,
  QuizQuestion,
  RecallGrade,
  SubjectId,
} from "./types";
import type { GeneratedFlashcard, GeneratedLessonSection, GeneratedQuizQuestion } from "./anthropic";

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function useStudyData() {
  const [cards, setCards] = useLocalStorage<Record<string, Flashcard>>("wjec-study-cards", {});
  const [quizBank, setQuizBank] = useLocalStorage<Record<string, QuizQuestion[]>>(
    "wjec-study-quiz-bank",
    {},
  );
  const [quizAttempts, setQuizAttempts] = useLocalStorage<QuizAttempt[]>(
    "wjec-study-quiz-attempts",
    [],
  );
  const [studyDays, setStudyDays] = useLocalStorage<string[]>("wjec-study-days", []);
  const [apiKey, setApiKey] = useLocalStorage<string>("wjec-study-api-key", "");
  const [examDates, setExamDates] = useLocalStorage<Record<string, string>>(
    "wjec-study-exam-dates",
    {},
  );
  const [lessonBank, setLessonBank] = useLocalStorage<Record<string, LessonSection[]>>(
    "wjec-study-lesson-bank",
    {},
  );
  const [lessonCompletions, setLessonCompletions] = useLocalStorage<string[]>(
    "wjec-study-lesson-completions",
    [],
  );
  const [notebookLinks, setNotebookLinks] = useLocalStorage<Record<string, string>>(
    "wjec-study-notebook-links",
    {},
  );
  const [xp, setXp] = useLocalStorage<number>("wjec-study-xp", 0);
  const [totalReviews, setTotalReviews] = useLocalStorage<number>("wjec-study-total-reviews", 0);
  const [longestStreak, setLongestStreak] = useLocalStorage<number>(
    "wjec-study-longest-streak",
    0,
  );

  const cardList = useMemo(() => Object.values(cards), [cards]);

  const cardsForTopic = useCallback(
    (topicId: string) => cardList.filter((c) => c.topicId === topicId),
    [cardList],
  );

  const cardsForSubject = useCallback(
    (subjectId: SubjectId) => cardList.filter((c) => c.subjectId === subjectId),
    [cardList],
  );

  const recordStudyDay = useCallback(() => {
    const today = toDateOnly(new Date());
    if (studyDays.includes(today)) return;
    setStudyDays((prev) => (prev.includes(today) ? prev : [...prev, today]));
    setXp((prev) => prev + XP_PER_STUDY_DAY);
    const newStreak = computeStreak([...studyDays, today]);
    setLongestStreak((prev) => Math.max(prev, newStreak));
  }, [studyDays, setStudyDays, setXp, setLongestStreak]);

  const addGeneratedCards = useCallback(
    (subjectId: SubjectId, topicId: string, generated: GeneratedFlashcard[]) => {
      setCards((prev) => {
        const next = { ...prev };
        generated.forEach((g, i) => {
          const id = `${topicId}-card-${Date.now()}-${i}`;
          next[id] = createCard(id, subjectId, topicId, g.front, g.back);
        });
        return next;
      });
    },
    [setCards],
  );

  const setQuizForTopic = useCallback(
    (subjectId: SubjectId, topicId: string, generated: GeneratedQuizQuestion[]) => {
      const questions: QuizQuestion[] = generated.map((g, i) => ({
        id: `${topicId}-quiz-${Date.now()}-${i}`,
        subjectId,
        topicId,
        question: g.question,
        options: g.options,
        correctIndex: g.correctIndex,
        explanation: g.explanation,
      }));
      setQuizBank((prev) => ({ ...prev, [topicId]: questions }));
    },
    [setQuizBank],
  );

  const setLessonForTopic = useCallback(
    (topicId: string, generated: GeneratedLessonSection[]) => {
      setLessonBank((prev) => ({ ...prev, [topicId]: generated }));
    },
    [setLessonBank],
  );

  const gradeCard = useCallback(
    (cardId: string, grade: RecallGrade) => {
      setCards((prev) => {
        const card = prev[cardId];
        if (!card) return prev;
        return { ...prev, [cardId]: reviewCard(card, grade) };
      });
      setTotalReviews((prev) => prev + 1);
      setXp((prev) => prev + XP_PER_CARD_GRADE[grade]);
      recordStudyDay();
    },
    [setCards, setTotalReviews, setXp, recordStudyDay],
  );

  const recordQuizAttempt = useCallback(
    (subjectId: SubjectId, topicId: string, score: number, total: number) => {
      const attempt: QuizAttempt = {
        id: `${topicId}-attempt-${Date.now()}`,
        subjectId,
        topicId,
        score,
        total,
        completedAt: new Date().toISOString(),
      };
      setQuizAttempts((prev) => [...prev, attempt]);
      setXp((prev) => prev + score * XP_PER_QUIZ_CORRECT);
      recordStudyDay();
    },
    [setQuizAttempts, setXp, recordStudyDay],
  );

  const completeLesson = useCallback(
    (topicId: string, sectionCount: number) => {
      setLessonCompletions((prev) => (prev.includes(topicId) ? prev : [...prev, topicId]));
      setXp((prev) => prev + sectionCount * XP_PER_LESSON_SECTION + XP_LESSON_COMPLETE_BONUS);
      recordStudyDay();
    },
    [setLessonCompletions, setXp, recordStudyDay],
  );

  const setExamDate = useCallback(
    (subjectId: SubjectId, date: string) => {
      setExamDates((prev) => ({ ...prev, [subjectId]: date }));
    },
    [setExamDates],
  );

  const clearExamDate = useCallback(
    (subjectId: SubjectId) => {
      setExamDates((prev) => {
        const next = { ...prev };
        delete next[subjectId];
        return next;
      });
    },
    [setExamDates],
  );

  const setNotebookLink = useCallback(
    (topicId: string, url: string) => {
      setNotebookLinks((prev) => {
        if (!url) {
          const next = { ...prev };
          delete next[topicId];
          return next;
        }
        return { ...prev, [topicId]: url };
      });
    },
    [setNotebookLinks],
  );

  const bulkImportNotebookLinks = useCallback(
    (links: Record<string, string>) => {
      setNotebookLinks((prev) => ({ ...prev, ...links }));
    },
    [setNotebookLinks],
  );

  return {
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
  };
}
