"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { createCard, reviewCard } from "./sm2";
import type { Flashcard, QuizAttempt, QuizQuestion, RecallGrade, SubjectId } from "./types";
import type { GeneratedFlashcard, GeneratedQuizQuestion } from "./anthropic";

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
    setStudyDays((prev) => (prev.includes(today) ? prev : [...prev, today]));
  }, [setStudyDays]);

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

  const gradeCard = useCallback(
    (cardId: string, grade: RecallGrade) => {
      setCards((prev) => {
        const card = prev[cardId];
        if (!card) return prev;
        return { ...prev, [cardId]: reviewCard(card, grade) };
      });
      recordStudyDay();
    },
    [setCards, recordStudyDay],
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
      recordStudyDay();
    },
    [setQuizAttempts, recordStudyDay],
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
    addGeneratedCards,
    setQuizForTopic,
    gradeCard,
    recordQuizAttempt,
  };
}
