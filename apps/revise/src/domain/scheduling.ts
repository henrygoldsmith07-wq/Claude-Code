import { createEmptyCard, fsrs, generatorParameters, Rating, State } from "ts-fsrs";
import type { Card as FsrsCard } from "ts-fsrs";
import type { Card, CardKind, Id, IsoDate, RecallGrade } from "./types";

// FSRS is the empirically-fit successor to SM-2 (it is what current Anki
// ships). It tracks memory *stability* and *difficulty* separately rather than
// folding both into one ease multiplier, and schedules the next review for the
// day predicted recall decays to the target retention.
const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    // Spread same-day reviews so they don't clump into one brutal session.
    enable_fuzz: true,
    // Minute-scale learning steps are handled inside the session queue
    // (see buildReviewQueue) rather than by FSRS's day-granularity model.
    enable_short_term: false,
  }),
);

/** A card this stable is safe to call "mastered" for progress reporting. */
export const MASTERED_STABILITY_DAYS = 21;

const GRADE_TO_RATING: Record<RecallGrade, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function toDateOnly(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toDateOnly(now);
}

function fromCard(card: Card): FsrsCard {
  const empty = createEmptyCard(new Date(card.createdAt));
  return {
    ...empty,
    due: new Date(`${card.due}T00:00:00.000Z`),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as State,
    last_review: card.lastReviewedAt ? new Date(card.lastReviewedAt) : undefined,
  };
}

export interface NewCardInput {
  id: Id;
  userId: Id;
  subjectId: Id;
  topicId: Id;
  front: string;
  back: string;
  kind?: CardKind;
  origin?: Card["origin"];
  clozeSource?: string;
  imageUrl?: string;
  sourceMistakeId?: Id;
}

export function createCard(input: NewCardInput, now: Date = new Date()): Card {
  const empty = createEmptyCard(now);
  return {
    id: input.id,
    userId: input.userId,
    subjectId: input.subjectId,
    topicId: input.topicId,
    kind: input.kind ?? "basic",
    front: input.front,
    back: input.back,
    clozeSource: input.clozeSource,
    imageUrl: input.imageUrl,
    sourceMistakeId: input.sourceMistakeId,
    origin: input.origin ?? "manual",
    due: toDateOnly(empty.due),
    stability: empty.stability,
    difficulty: empty.difficulty,
    reps: empty.reps,
    lapses: empty.lapses,
    state: empty.state,
    lastReviewedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Apply a grade and return the rescheduled card. Pure: never mutates input. */
export function gradeCard(card: Card, grade: RecallGrade, now: Date = new Date()): Card {
  const result = scheduler.next(fromCard(card), now, GRADE_TO_RATING[grade]);
  const next = result.card;
  return {
    ...card,
    due: toDateOnly(next.due),
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    lastReviewedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Interval in days each grade would produce — shown on the review buttons. */
export function previewIntervals(card: Card, now: Date = new Date()): Record<RecallGrade, number> {
  const grades: RecallGrade[] = ["again", "hard", "good", "easy"];
  const out = {} as Record<RecallGrade, number>;
  for (const g of grades) {
    const next = scheduler.next(fromCard(card), now, GRADE_TO_RATING[g]).card;
    const days = Math.round((next.due.getTime() - now.getTime()) / 86_400_000);
    out[g] = Math.max(0, days);
  }
  return out;
}

/**
 * Predicted probability the card is still recallable today. FSRS's forgetting
 * curve: R = (1 + FACTOR * t/S)^DECAY with the v5 constants.
 */
export function retrievability(card: Card, now: Date = new Date()): number {
  if (!card.lastReviewedAt || card.stability <= 0) return 0;
  const elapsedDays = (now.getTime() - new Date(card.lastReviewedAt).getTime()) / 86_400_000;
  if (elapsedDays <= 0) return 1;
  const DECAY = -0.5;
  const FACTOR = 19 / 81;
  return Math.pow(1 + FACTOR * (elapsedDays / card.stability), DECAY);
}

export function isDue(card: Card, on: IsoDate = todayIso()): boolean {
  return !card.suspended && card.due <= on;
}

export function isMastered(card: Card): boolean {
  return card.stability >= MASTERED_STABILITY_DAYS;
}

/**
 * Order a review session. Due cards come first, most-overdue first, with new
 * cards interleaved so a session never opens with a wall of unseen material.
 * `limit` caps the session so it fits the planned block.
 */
export function buildReviewQueue(cards: Card[], limit: number, on: IsoDate = todayIso()): Card[] {
  const live = cards.filter((c) => !c.suspended);
  const due = live
    .filter((c) => c.state !== State.New && c.due <= on)
    .sort((a, b) => (a.due === b.due ? b.lapses - a.lapses : a.due < b.due ? -1 : 1));
  const fresh = live.filter((c) => c.state === State.New).slice(0, Math.ceil(limit / 4));

  const out: Card[] = [];
  const everyNth = fresh.length ? Math.max(1, Math.floor(due.length / fresh.length) || 1) : 0;
  let f = 0;
  due.forEach((card, i) => {
    out.push(card);
    if (everyNth && (i + 1) % everyNth === 0 && f < fresh.length) out.push(fresh[f++]);
  });
  while (f < fresh.length) out.push(fresh[f++]);
  return out.slice(0, limit);
}

/**
 * "Again" cards come back inside the same session rather than tomorrow: the
 * card is reinserted a few positions later so the student re-earns it now.
 */
export function reinsert<T>(queue: T[], card: T, gap = 4): T[] {
  const next = [...queue];
  next.splice(Math.min(gap, next.length), 0, card);
  return next;
}

export function dueCountByDay(cards: Card[], days: number, from: IsoDate = todayIso()): { date: IsoDate; count: number }[] {
  const start = new Date(`${from}T00:00:00.000Z`);
  const out: { date: IsoDate; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const iso = toDateOnly(d);
    const count = cards.filter((c) => !c.suspended && (i === 0 ? c.due <= iso : c.due === iso)).length;
    out.push({ date: iso, count });
  }
  return out;
}
