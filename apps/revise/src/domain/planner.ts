import { daysToExam, examUrgency } from "./recommender";
import { toDateOnly } from "./scheduling";
import type {
  ActivityKind,
  Availability,
  ExamDate,
  Id,
  IsoDate,
  PlannedSession,
  Topic,
  TopicMastery,
} from "./types";

// ---------------------------------------------------------------------------
// The adaptive planner turns "I have these hours and these exams" into a
// concrete timetable. It is deliberately re-runnable: the plan is derived
// state, so regenerating after every session is cheap and keeps the timetable
// honest rather than letting it drift into fiction. Completed sessions are
// always preserved; only pending future ones are rewritten.
// ---------------------------------------------------------------------------

export interface PlanInput {
  userId: Id;
  topics: Topic[];
  mastery: TopicMastery[];
  exams: ExamDate[];
  availability: Availability[];
  sessionLengthMinutes: number;
  subjectIds: Id[];
  /** Minutes from midnight the study day starts at. */
  dayStartMinute?: number;
  horizonDays?: number;
  /** Existing plan; done/skipped entries are carried through untouched. */
  existing?: PlannedSession[];
  now?: Date;
  /** Injected so plans are reproducible in tests. */
  idFactory?: () => string;
}

const DEFAULT_HORIZON = 14;
const DEFAULT_DAY_START = 16 * 60; // 16:00 — after school, the realistic default.

export function buildPlan(input: PlanInput): PlannedSession[] {
  const now = input.now ?? new Date();
  const today = toDateOnly(now);
  const horizon = input.horizonDays ?? DEFAULT_HORIZON;
  const blockLength = input.sessionLengthMinutes;
  const nextId = input.idFactory ?? (() => crypto.randomUUID());

  const kept = (input.existing ?? []).filter((s) => s.status !== "pending" || s.date < today);
  const topicById = new Map(input.topics.map((t) => [t.id, t]));

  // Working copy of mastery so the planner can "spend" attention within one
  // build: a topic scheduled on Monday looks less urgent by Wednesday.
  const projected = new Map(input.mastery.map((m) => [m.topicId, m.mastery]));
  const lastScheduled = new Map<Id, IsoDate>();

  const out: PlannedSession[] = [...kept];

  for (let dayOffset = 0; dayOffset < horizon; dayOffset++) {
    const date = toDateOnly(new Date(new Date(`${today}T00:00:00Z`).getTime() + dayOffset * 86_400_000));
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const minutes = input.availability.find((a) => a.weekday === weekday)?.minutes ?? 0;
    if (minutes < 10) continue;

    const blocks = Math.max(1, Math.floor(minutes / blockLength));
    let cursor = input.dayStartMinute ?? DEFAULT_DAY_START;

    const shares = allocateBlocks(blocks, input.subjectIds, (subjectId) =>
      subjectWeight(subjectId, input.mastery, input.exams, date),
    );

    for (const subjectId of input.subjectIds) {
      const count = shares.get(subjectId) ?? 0;
      for (let b = 0; b < count; b++) {
        const pick = chooseActivity({
          subjectId,
          date,
          dayOffset,
          blockIndex: b,
          topics: input.topics,
          projected,
          lastScheduled,
          exams: input.exams,
          topicById,
        });
        out.push({
          id: nextId(),
          userId: input.userId,
          date,
          startMinute: cursor,
          minutes: blockLength,
          subjectId,
          topicId: pick.topicId,
          activity: pick.activity,
          reason: pick.reason,
          status: "pending",
        });
        cursor += blockLength + 5; // a five-minute breather between blocks
        if (pick.topicId) {
          projected.set(pick.topicId, Math.min(1, (projected.get(pick.topicId) ?? 0) + 0.12));
          lastScheduled.set(pick.topicId, date);
        }
      }
    }
  }

  return out.sort((a, b) => (a.date === b.date ? a.startMinute - b.startMinute : a.date < b.date ? -1 : 1));
}

/** How much of a day's attention a subject has earned. */
function subjectWeight(subjectId: Id, mastery: TopicMastery[], exams: ExamDate[], date: IsoDate): number {
  const rows = mastery.filter((m) => m.subjectId === subjectId);
  const avg = rows.length ? rows.reduce((a, m) => a + m.mastery, 0) / rows.length : 0.3;
  const urgency = examUrgency(daysToExam(exams, subjectId, date));
  // Deficit-driven: a subject at 30% mastery pulls more than twice the weight
  // of one at 70%, then exam proximity scales it again.
  return (0.15 + (1 - avg)) * urgency;
}

/**
 * Distribute whole blocks across subjects by weight using largest-remainder,
 * so small allocations never round away to nothing and the totals always add
 * back up to the number of blocks actually available.
 */
export function allocateBlocks(
  blocks: number,
  subjectIds: Id[],
  weight: (id: Id) => number,
): Map<Id, number> {
  const out = new Map<Id, number>(subjectIds.map((s) => [s, 0]));
  if (!subjectIds.length || blocks <= 0) return out;
  const weights = subjectIds.map((s) => ({ id: s, w: Math.max(0.0001, weight(s)) }));
  const total = weights.reduce((a, x) => a + x.w, 0);
  const exact = weights.map((x) => ({ id: x.id, exact: (x.w / total) * blocks }));
  let assigned = 0;
  for (const e of exact) {
    const floor = Math.floor(e.exact);
    out.set(e.id, floor);
    assigned += floor;
  }
  const remainders = exact
    .map((e) => ({ id: e.id, rem: e.exact - Math.floor(e.exact) }))
    .sort((a, b) => b.rem - a.rem);
  let i = 0;
  while (assigned < blocks && remainders.length) {
    const target = remainders[i % remainders.length];
    out.set(target.id, (out.get(target.id) ?? 0) + 1);
    assigned++;
    i++;
  }
  return out;
}

interface ChooseInput {
  subjectId: Id;
  date: IsoDate;
  dayOffset: number;
  blockIndex: number;
  topics: Topic[];
  projected: Map<Id, number>;
  lastScheduled: Map<Id, IsoDate>;
  exams: ExamDate[];
  topicById: Map<Id, Topic>;
}

function chooseActivity(input: ChooseInput): { activity: ActivityKind; topicId?: Id; reason: string } {
  const days = daysToExam(input.exams, input.subjectId, input.date);

  // Every study day opens with due cards: reviews are time-sensitive in a way
  // nothing else is, and clearing them first stops the backlog compounding.
  if (input.blockIndex === 0) {
    return {
      activity: "flashcards",
      reason: "Clear today's due cards first — spaced repetition only works on time.",
    };
  }

  // Inside the last fortnight, alternate weak-topic practice with full papers.
  if (days != null && days <= 14 && input.blockIndex % 3 === 2) {
    return { activity: "paper", reason: `${days} days out — timed paper practice.` };
  }

  const candidates = input.topics
    .filter((t) => t.subjectId === input.subjectId)
    .map((t) => {
      const mastery = input.projected.get(t.id) ?? 0;
      const last = input.lastScheduled.get(t.id);
      // Spacing penalty: revisiting a topic the very next day wastes the
      // spacing effect, so push it back unless nothing else needs the slot.
      const spacing = last === input.date ? 0.5 : last ? 0.85 : 1;
      return { topic: t, score: (1 - mastery) * spacing * (1 + (t.intrinsicDifficulty - 3) * 0.05) };
    })
    .sort((a, b) => b.score - a.score);

  const pick = candidates[0];
  if (!pick) return { activity: "flashcards", reason: "Keep recall warm." };

  const mastery = input.projected.get(pick.topic.id) ?? 0;
  if (mastery === 0) {
    return {
      activity: "learn",
      topicId: pick.topic.id,
      reason: `First pass over ${pick.topic.title}.`,
    };
  }
  if (mastery < 0.55) {
    return {
      activity: "practice",
      topicId: pick.topic.id,
      reason: `${pick.topic.title} is below target — exam questions with marking.`,
    };
  }
  return {
    activity: "recall",
    topicId: pick.topic.id,
    reason: `Blank-page recall on ${pick.topic.title} to prove it is secure.`,
  };
}

/**
 * Missed-session recovery. Anything still pending on a past day is marked
 * `missed` and its work is re-queued onto the next day that has room, oldest
 * first, so nothing silently disappears from the plan.
 */
export function rescheduleMissed(
  plan: PlannedSession[],
  today: IsoDate,
  dailyBlockCap: number,
  idFactory: () => string = () => crypto.randomUUID(),
): PlannedSession[] {
  const out = plan.map((s) => ({ ...s }));
  const stale = out.filter((s) => s.date < today && s.status === "pending");
  if (!stale.length) return out;

  const countByDate = new Map<IsoDate, number>();
  for (const s of out) {
    if (s.date >= today) countByDate.set(s.date, (countByDate.get(s.date) ?? 0) + 1);
  }

  for (const session of stale) {
    session.status = "missed";
    let target = today;
    for (let i = 0; i < 14; i++) {
      const candidate = toDateOnly(new Date(new Date(`${today}T00:00:00Z`).getTime() + i * 86_400_000));
      if ((countByDate.get(candidate) ?? 0) < dailyBlockCap) {
        target = candidate;
        break;
      }
    }
    countByDate.set(target, (countByDate.get(target) ?? 0) + 1);
    const lastOfDay = out
      .filter((s) => s.date === target)
      .sort((a, b) => a.startMinute - b.startMinute)
      .pop();
    out.push({
      ...session,
      id: idFactory(),
      date: target,
      startMinute: lastOfDay ? lastOfDay.startMinute + lastOfDay.minutes + 5 : DEFAULT_DAY_START,
      status: "pending",
      reason: `Rescheduled from ${session.date}. ${session.reason}`.trim(),
    });
  }

  return out.sort((a, b) => (a.date === b.date ? a.startMinute - b.startMinute : a.date < b.date ? -1 : 1));
}

export function formatTime(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function planForDate(plan: PlannedSession[], date: IsoDate): PlannedSession[] {
  return plan.filter((s) => s.date === date).sort((a, b) => a.startMinute - b.startMinute);
}
