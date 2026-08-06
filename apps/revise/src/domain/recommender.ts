import { isDue } from "./scheduling";
import { untouchedTopics, weakTopics } from "./mastery";
import type {
  ActivityKind,
  Card,
  ExamDate,
  Id,
  IsoDate,
  Mistake,
  PlannedSession,
  Recommendation,
  Topic,
  TopicMastery,
} from "./types";

// ---------------------------------------------------------------------------
// "What should I do right now?" — the single question the whole product is
// built around. Every candidate activity is scored on the same scale so they
// can be compared directly, and every score carries a plain-English reason
// the student sees. No candidate is ever hidden: the dashboard shows the top
// pick plus the runners-up, so the student can always override the engine.
// ---------------------------------------------------------------------------

export interface RecommendInput {
  topics: Topic[];
  mastery: TopicMastery[];
  cards: Card[];
  mistakes: Mistake[];
  exams: ExamDate[];
  plan: PlannedSession[];
  sessionLengthMinutes: number;
  /** Subjects the student is actually taking. */
  subjectIds: Id[];
  now?: Date;
}

/** Days until the exam, or null when no exam is set for that subject. */
export function daysToExam(exams: ExamDate[], subjectId: Id, today: IsoDate): number | null {
  const dates = exams
    .filter((e) => e.subjectId === subjectId && e.date >= today)
    .map((e) => e.date)
    .sort();
  if (!dates.length) return null;
  return Math.round(
    (new Date(`${dates[0]}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/**
 * Urgency multiplier from exam proximity. 1.0 when the exam is far away or
 * unset, rising smoothly to ~2.0 in the final fortnight. Deliberately smooth:
 * a cliff would make the plan lurch the moment a threshold is crossed.
 */
export function examUrgency(days: number | null): number {
  if (days == null) return 1;
  if (days <= 0) return 2;
  return 1 + Math.min(1, 30 / (days + 15));
}

export function recommend(input: RecommendInput): Recommendation[] {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const block = input.sessionLengthMinutes;
  const topicById = new Map(input.topics.map((t) => [t.id, t]));
  const out: Recommendation[] = [];

  const urgencyBySubject = new Map(
    input.subjectIds.map((s) => [s, examUrgency(daysToExam(input.exams, s, today))]),
  );
  const urgency = (subjectId: Id) => urgencyBySubject.get(subjectId) ?? 1;

  // --- 1. Due reviews. Decayed memory is the cheapest thing to fix. --------
  const dueBySubject = new Map<Id, Card[]>();
  for (const card of input.cards) {
    if (!isDue(card, today)) continue;
    if (!input.subjectIds.includes(card.subjectId)) continue;
    const list = dueBySubject.get(card.subjectId) ?? [];
    list.push(card);
    dueBySubject.set(card.subjectId, list);
  }
  for (const [subjectId, cards] of dueBySubject) {
    const overdue = cards.filter((c) => c.due < today).length;
    // Saturating: 30 due cards is already "a lot"; 300 is not ten times worse.
    const volume = Math.min(1, cards.length / 30);
    const score = (55 + volume * 30 + Math.min(15, overdue)) * urgency(subjectId);
    out.push({
      activity: "flashcards",
      subjectId,
      minutes: Math.min(block, Math.max(5, Math.ceil(cards.length * 0.4))),
      score,
      reason:
        overdue > 0
          ? `${cards.length} cards due, ${overdue} already overdue — recall them before they fade further.`
          : `${cards.length} cards due today. Clearing them keeps every topic warm.`,
    });
  }

  // --- 2. Unrepaired mistakes. A mistake left alone is a mistake repeated. --
  const openMistakes = input.mistakes.filter((m) => !m.resolved);
  const mistakesBySubject = new Map<Id, Mistake[]>();
  for (const m of openMistakes) {
    if (!input.subjectIds.includes(m.subjectId)) continue;
    const list = mistakesBySubject.get(m.subjectId) ?? [];
    list.push(m);
    mistakesBySubject.set(m.subjectId, list);
  }
  for (const [subjectId, list] of mistakesBySubject) {
    if (list.length < 3) continue;
    out.push({
      activity: "mistakes",
      subjectId,
      minutes: Math.min(block, 15),
      score: (50 + Math.min(25, list.length * 2)) * urgency(subjectId),
      reason: `${list.length} mistakes are still unrepaired. Re-answering them is the highest-value 15 minutes you have.`,
    });
  }

  // --- 3. Weak topics → exam-style practice. -------------------------------
  for (const weak of weakTopics(input.mastery, 12)) {
    if (!input.subjectIds.includes(weak.subjectId)) continue;
    const topic = topicById.get(weak.topicId);
    if (!topic) continue;
    const deficit = 1 - weak.mastery;
    out.push({
      activity: "practice",
      subjectId: weak.subjectId,
      topicId: weak.topicId,
      minutes: block,
      score: (30 + deficit * 45) * urgency(weak.subjectId),
      reason: `${topic.title} is your weakest topic here (${Math.round(weak.mastery * 100)}% mastery). Exam questions on it will move your grade most.`,
    });
  }

  // --- 4. Never-studied topics → first-pass learn. -------------------------
  for (const fresh of untouchedTopics(input.mastery)) {
    if (!input.subjectIds.includes(fresh.subjectId)) continue;
    const topic = topicById.get(fresh.topicId);
    if (!topic) continue;
    out.push({
      activity: "learn",
      subjectId: fresh.subjectId,
      topicId: fresh.topicId,
      minutes: Math.min(block, 20),
      // Coverage matters, but not more than repairing what is already broken.
      score: (26 + (6 - topic.intrinsicDifficulty) * 2) * urgency(fresh.subjectId),
      reason: `You have not started ${topic.title} yet. A 20-minute first pass turns a blank into something revisable.`,
    });
  }

  // --- 5. Full past paper once a subject is broadly solid or the exam nears -
  for (const subjectId of input.subjectIds) {
    const rows = input.mastery.filter((m) => m.subjectId === subjectId);
    if (!rows.length) continue;
    const avg = rows.reduce((a, m) => a + m.mastery, 0) / rows.length;
    const days = daysToExam(input.exams, subjectId, today);
    if (avg < 0.6 && (days == null || days > 21)) continue;
    out.push({
      activity: "paper",
      subjectId,
      minutes: Math.min(block * 2, 90),
      score: (24 + avg * 30) * urgency(subjectId),
      reason:
        days != null && days <= 21
          ? `${days} days to the exam — full papers under timed conditions are what is left to gain.`
          : `You are solid across this subject. A timed paper tests whether it holds up under exam pressure.`,
    });
  }

  // --- 6. The student's own plan wins ties. --------------------------------
  const todaysPlan = input.plan.filter((p) => p.date === today && p.status === "pending");
  for (const session of todaysPlan) {
    const match = out.find(
      (r) =>
        r.activity === session.activity &&
        r.subjectId === session.subjectId &&
        (session.topicId == null || r.topicId === session.topicId),
    );
    if (match) {
      match.score += 12;
      match.plannedSessionId = session.id;
    } else {
      out.push({
        activity: session.activity,
        subjectId: session.subjectId,
        topicId: session.topicId,
        minutes: session.minutes,
        score: 28 * urgency(session.subjectId),
        reason: session.reason || "Scheduled in today's plan.",
        plannedSessionId: session.id,
      });
    }
  }

  // Missed sessions from previous days are a signal, not a scolding: they get
  // a small nudge so the plan self-heals without burying today's work.
  const missed = input.plan.filter((p) => p.date < today && p.status === "pending");
  for (const session of missed.slice(0, 3)) {
    const match = out.find((r) => r.activity === session.activity && r.subjectId === session.subjectId);
    if (match) match.score += 4;
  }

  return dedupe(out).sort((a, b) => b.score - a.score);
}

/** Keep the strongest candidate per activity+subject+topic triple. */
function dedupe(list: Recommendation[]): Recommendation[] {
  const best = new Map<string, Recommendation>();
  for (const r of list) {
    const key = `${r.activity}:${r.subjectId}:${r.topicId ?? "-"}`;
    const existing = best.get(key);
    if (!existing || r.score > existing.score) best.set(key, r);
  }
  return [...best.values()];
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  learn: "Learn",
  flashcards: "Flashcards",
  recall: "Active recall",
  practice: "Exam questions",
  paper: "Past paper",
  mistakes: "Mistake repair",
};

export const ACTIVITY_BLURB: Record<ActivityKind, string> = {
  learn: "First pass over new material, then immediate self-testing.",
  flashcards: "Spaced-repetition review of cards that are due today.",
  recall: "Blank-page recall against the spec, marked as you go.",
  practice: "Exam-style questions with examiner-style marking.",
  paper: "A full paper under timed conditions.",
  mistakes: "Re-answer the questions you got wrong until they stick.",
};
