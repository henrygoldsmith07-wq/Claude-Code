import { createEmptyCard, fsrs, generatorParameters, Rating, State } from "ts-fsrs";
import type { Card as FsrsCard } from "ts-fsrs";
import type { Flashcard, RecallGrade, SubjectId } from "./types";

// FSRS (Free Spaced Repetition Scheduler) — the modern, empirically-fit
// successor to SM-2 used by current Anki. Instead of one "easiness"
// multiplier per card, it tracks memory stability and difficulty
// separately and schedules the next review for the point where predicted
// recall probability decays to the target retention (90% here).
const scheduler = fsrs(
  generatorParameters({
    // Spreads reviews scheduled for the same day so they don't all clump
    // together in future sessions.
    enable_fuzz: true,
    // Skips Anki-style minute-scale learning steps: our own "Again" cards
    // are already re-inserted a few cards later within the same session
    // (see scheduler.ts), so short-term re-drilling is handled separately
    // from FSRS's day-granularity long-term scheduling.
    enable_short_term: false,
  }),
);

export const MASTERED_STABILITY_DAYS = 21;

const GRADE_TO_RATING: Record<RecallGrade, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toFlashcard(
  id: string,
  subjectId: SubjectId,
  topicId: string,
  front: string,
  back: string,
  fsrsCard: FsrsCard,
): Flashcard {
  return {
    id,
    subjectId,
    topicId,
    front,
    back,
    dueDate: toDateOnly(fsrsCard.due),
    stability: fsrsCard.stability,
    difficulty: fsrsCard.difficulty,
    reps: fsrsCard.reps,
    lapses: fsrsCard.lapses,
    state: fsrsCard.state,
    lastReviewedAt: fsrsCard.last_review ? fsrsCard.last_review.toISOString() : null,
  };
}

export function createCard(
  id: string,
  subjectId: SubjectId,
  topicId: string,
  front: string,
  back: string,
): Flashcard {
  return toFlashcard(id, subjectId, topicId, front, back, createEmptyCard(new Date()));
}

export function reviewCard(card: Flashcard, grade: RecallGrade, now = new Date()): Flashcard {
  const fsrsCard: FsrsCard = {
    due: new Date(card.dueDate + "T00:00:00Z"),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReviewedAt ? new Date(card.lastReviewedAt) : undefined,
  };

  const { card: updated } = scheduler.next(fsrsCard, now, GRADE_TO_RATING[grade]);
  return toFlashcard(card.id, card.subjectId, card.topicId, card.front, card.back, updated);
}

export function isDue(card: Flashcard, now = new Date()): boolean {
  return card.dueDate <= toDateOnly(now);
}

// A card is treated as mastered once its stability (the interval at which
// predicted recall is ~90%) reaches this many days.
export function isMastered(card: Flashcard): boolean {
  return card.stability >= MASTERED_STABILITY_DAYS;
}
