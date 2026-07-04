import type { Flashcard, RecallGrade, SubjectId } from "./types";

// SM-2 spaced repetition (SuperMemo 2): the interval between reviews grows
// each time a card is recalled successfully, and resets when it's forgotten,
// so review effort concentrates on material that's about to be forgotten
// (the "spacing effect") rather than material already well known.
export const MASTERED_INTERVAL_DAYS = 21;

const GRADE_QUALITY: Record<RecallGrade, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function createCard(
  id: string,
  subjectId: SubjectId,
  topicId: string,
  front: string,
  back: string,
): Flashcard {
  return {
    id,
    subjectId,
    topicId,
    front,
    back,
    repetitions: 0,
    easinessFactor: 2.5,
    intervalDays: 0,
    dueDate: toDateOnly(new Date()),
    lastReviewedAt: null,
  };
}

export function reviewCard(card: Flashcard, grade: RecallGrade, now = new Date()): Flashcard {
  const quality = GRADE_QUALITY[grade];

  let easinessFactor =
    card.easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easinessFactor = Math.max(1.3, easinessFactor);

  let repetitions: number;
  let intervalDays: number;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = card.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(card.intervalDays * easinessFactor);
  }

  return {
    ...card,
    repetitions,
    easinessFactor,
    intervalDays,
    dueDate: toDateOnly(addDays(now, intervalDays)),
    lastReviewedAt: now.toISOString(),
  };
}

export function isDue(card: Flashcard, now = new Date()): boolean {
  return card.dueDate <= toDateOnly(now);
}

export function isMastered(card: Flashcard): boolean {
  return card.intervalDays >= MASTERED_INTERVAL_DAYS;
}
