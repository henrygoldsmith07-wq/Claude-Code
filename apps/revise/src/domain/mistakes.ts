import { createCard } from "./scheduling";
import type { Attempt, Card, Id, Mistake, Question } from "./types";

// ---------------------------------------------------------------------------
// Mistake tracking closes the loop: a dropped mark becomes a classified
// mistake, a mistake becomes a flashcard, and the card comes back until it is
// answered reliably. Nothing a student gets wrong is allowed to just scroll
// off the screen.
// ---------------------------------------------------------------------------

export type MistakeCategory = Mistake["category"];

const CATEGORY_HINTS: { category: MistakeCategory; patterns: RegExp[] }[] = [
  { category: "arithmetic", patterns: [/\bsig(?:nificant)? ?fig/i, /\bunit(s)?\b/i, /\brounding\b/i, /\bcalculat/i] },
  { category: "method", patterns: [/\bmethod\b/i, /\bderiv/i, /\bshow that\b/i, /\bequation\b/i, /\bsubstitut/i] },
  { category: "interpretation", patterns: [/\bgraph\b/i, /\bdata\b/i, /\btable\b/i, /\bconclude\b/i, /\bevaluat/i] },
  { category: "communication", patterns: [/\bexplain\b/i, /\bdescribe\b/i, /\bstate\b/i, /\bcompare\b/i] },
  { category: "recall", patterns: [/\bdefin/i, /\bname\b/i, /\bidentify\b/i, /\brecall\b/i] },
];

/** Best-effort classification from the question stem and the missed points. */
export function classifyMistake(questionStem: string, missedPoints: string[]): MistakeCategory {
  const haystack = `${questionStem} ${missedPoints.join(" ")}`;
  for (const { category, patterns } of CATEGORY_HINTS) {
    if (patterns.some((p) => p.test(haystack))) return category;
  }
  return "unclassified";
}

export interface MistakeDraft {
  mistake: Mistake;
  card: Card;
}

/**
 * Turn every dropped mark in an attempt into a mistake plus a card. Parts that
 * scored full marks produce nothing — the point is signal, not noise.
 */
export function mistakesFromAttempt(
  attempt: Attempt,
  question: Question,
  idFactory: () => string = () => crypto.randomUUID(),
  now: Date = new Date(),
): MistakeDraft[] {
  const drafts: MistakeDraft[] = [];
  const topicId = question.topicIds[0] ?? attempt.topicIds[0];
  if (!topicId) return drafts;

  for (const marked of attempt.marked) {
    if (marked.awarded >= marked.max) continue;
    const part = question.parts.find((p) => p.id === marked.partId);
    const prompt = part ? `${question.stem}\n\n${part.label} ${part.prompt}` : question.stem;
    const mistakeId = idFactory();

    const mistake: Mistake = {
      id: mistakeId,
      userId: attempt.userId,
      subjectId: attempt.subjectId,
      topicId,
      questionId: question.id,
      attemptId: attempt.id,
      description: marked.missedPoints.length
        ? `Dropped ${marked.max - marked.awarded} mark(s): ${marked.missedPoints.slice(0, 2).join("; ")}`
        : `Dropped ${marked.max - marked.awarded} mark(s) on "${part?.label ?? "this question"}"`,
      category: classifyMistake(question.stem, marked.missedPoints),
      resolved: false,
      createdAt: now.toISOString(),
    };

    const card = createCard(
      {
        id: idFactory(),
        userId: attempt.userId,
        subjectId: attempt.subjectId,
        topicId,
        kind: "mistake",
        origin: "mistake",
        sourceMistakeId: mistakeId,
        front: prompt,
        back: part?.modelAnswer ?? marked.missedPoints.join("; "),
      },
      now,
    );
    mistake.cardId = card.id;
    drafts.push({ mistake, card });
  }

  return drafts;
}

/** A mistake is repaired once its card has been recalled well twice running. */
export function shouldResolve(card: Card): boolean {
  return card.reps >= 2 && card.stability >= 7 && card.lapses === 0;
}

export interface MistakePattern {
  category: MistakeCategory;
  count: number;
  topicIds: Id[];
  /** Shown verbatim in the analytics view. */
  insight: string;
}

const PATTERN_INSIGHT: Record<MistakeCategory, string> = {
  arithmetic: "Marks are going on units, significant figures and slips — not on understanding. Slow the final line down and check units every time.",
  method: "You know the content but the route through the question is breaking down. Practise writing the method before touching numbers.",
  interpretation: "Reading data and graphs is where marks are leaking. Annotate the stimulus before you start answering.",
  communication: "The physics/chemistry/biology is right but the wording is not earning marks. Use the command word's verb explicitly.",
  recall: "Straight recall is the gap. This is exactly what spaced repetition fixes — keep the daily cards clear.",
  unclassified: "A mixed set of dropped marks with no single pattern yet.",
};

export function mistakePatterns(mistakes: Mistake[]): MistakePattern[] {
  const byCategory = new Map<MistakeCategory, Mistake[]>();
  for (const m of mistakes) {
    const list = byCategory.get(m.category) ?? [];
    list.push(m);
    byCategory.set(m.category, list);
  }
  return [...byCategory.entries()]
    .map(([category, list]) => ({
      category,
      count: list.length,
      topicIds: [...new Set(list.map((m) => m.topicId))],
      insight: PATTERN_INSIGHT[category],
    }))
    .sort((a, b) => b.count - a.count);
}
