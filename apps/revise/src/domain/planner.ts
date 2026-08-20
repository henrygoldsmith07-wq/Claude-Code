import { daysToExam, examUrgency } from "./recommender";
import { isDue, toDateOnly } from "./scheduling";
import { actionableErrors, buildErrorModel, type ErrorModelEntry } from "./error-model";
import { predictQuestionMarks, questionMarkModelForSubject, type CalibrationModel } from "./calibration";
import type {
  ActivityKind,
  Attempt,
  Availability,
  Card,
  ExamDate,
  Id,
  IsoDate,
  Mistake,
  PlannedSession,
  Subject,
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
  /** Hard cap on minutes per day (fatigue guard). When absent, availability is the cap. */
  dailyMinutesCap?: number;
  /** Max consecutive heavy days before a throttle (0 = disabled). */
  fatigueThresholdDays?: number;
  /** Minutes from midnight the study day starts at. */
  dayStartMinute?: number;
  horizonDays?: number;
  /** Subjects (with grade boundaries) so target grades can be compared to attainment. */
  subjects?: Subject[];
  /** Per-subject target grade letters; boosts subjects that are furthest below target. */
  targetGrades?: Record<Id, string>;
  /** As-of question-mark model used for target-grade gaps; defaults to the population prior. */
  calibrationModel?: CalibrationModel;
  /** Existing plan; done/skipped entries are carried through untouched. */
  existing?: PlannedSession[];
  /** Learner evidence used to select an intervention, not just a weak topic. */
  cards?: Card[];
  mistakes?: Mistake[];
  attempts?: Attempt[];
  errorModel?: ErrorModelEntry[];
  /** Optional one-off time budgets for a date, e.g. illness or a free afternoon. */
  availabilityOverrides?: Record<IsoDate, number>;
  /** Completed minutes by date, used to avoid stacking unrealistic workload. */
  recentWorkloadMinutes?: Record<IsoDate, number>;
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
  const blockLength = Math.max(10, input.sessionLengthMinutes || 25);
  const nextId = input.idFactory ?? (() => crypto.randomUUID());

  const kept = (input.existing ?? [])
    .filter((s) => s.status !== "pending" || s.date < today)
    .map((s) => s.status === "pending" && s.date < today ? { ...s, status: "missed" as const } : s);
  const cardsByTopic = groupBy(input.cards ?? [], (card) => card.topicId);
  const mistakesByTopic = groupBy(input.mistakes ?? [], (mistake) => mistake.topicId);
  const attemptsByTopic = groupByMany(input.attempts ?? [], (attempt) => attempt.topicIds);
  const errorModel = input.errorModel ?? buildErrorModel({ mistakes: input.mistakes ?? [], now });
  const cardsProvided = input.cards !== undefined;

  // Working copy of mastery so the planner can "spend" attention within one
  // build: a topic scheduled on Monday looks less urgent by Wednesday.
  const projected = new Map(input.mastery.map((m) => [m.topicId, m.mastery]));
  const masteryByTopic = new Map(input.mastery.map((m) => [m.topicId, m]));
  const lastScheduled = new Map<Id, IsoDate>();

  const out: PlannedSession[] = [...kept];

  for (let dayOffset = 0; dayOffset < horizon; dayOffset++) {
    const date = toDateOnly(new Date(new Date(`${today}T00:00:00Z`).getTime() + dayOffset * 86_400_000));
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    let minutes = availableMinutes(input, date, weekday);
    if (input.dailyMinutesCap != null) minutes = Math.min(minutes, input.dailyMinutesCap);
    if (minutes < 10) continue;

    // Fatigue: if the previous N days were heavy, throttle today by 40% so the plan is recoverable.
    const fatigueN = input.fatigueThresholdDays ?? 0;
    if (fatigueN > 0 && dayOffset >= fatigueN) {
      let heavyStreak = 0;
      for (let k = dayOffset - fatigueN; k < dayOffset; k++) {
        const d = toDateOnly(new Date(new Date(`${today}T00:00:00Z`).getTime() + k * 86_400_000));
        const wk = new Date(`${d}T00:00:00Z`).getUTCDay();
        const recordedWorkload = input.recentWorkloadMinutes
          ? input.recentWorkloadMinutes[d] ?? 0
          : availableMinutes(input, d, wk);
        const m = Math.min(recordedWorkload, input.dailyMinutesCap ?? 9999);
        if (m >= 90) heavyStreak++;
      }
      if (heavyStreak >= fatigueN) minutes = Math.max(10, Math.round(minutes * 0.6));
    }

    const blocks = Math.floor(minutes / blockLength);
    if (blocks <= 0) continue;
    let cursor = input.dayStartMinute ?? DEFAULT_DAY_START;

    const shares = allocateBlocks(blocks, input.subjectIds, (subjectId) =>
      subjectWeight(subjectId, input.mastery, input.exams, date, input.subjects, input.targetGrades, errorModel, input.calibrationModel),
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
          masteryByTopic,
          cardsByTopic,
          mistakesByTopic,
          attemptsByTopic,
          errorModel,
          cardsProvided,
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
          priority: pick.priority,
          intervention: pick.intervention,
          purpose: pick.purpose,
        });
        cursor += blockLength + 5; // a five-minute breather between blocks
        if (pick.topicId) {
          const projectedGain = pick.activity === "learn" ? 0.12 : pick.activity === "flashcards" || pick.activity === "recall" ? 0.08 : 0.05;
          projected.set(pick.topicId, Math.min(1, (projected.get(pick.topicId) ?? 0) + projectedGain));
          lastScheduled.set(pick.topicId, date);
        }
      }
    }
  }

  return out.sort((a, b) => (a.date === b.date ? a.startMinute - b.startMinute : a.date < b.date ? -1 : 1));
}

/**
 * How much of a day's attention a subject has earned: deficit-driven, scaled
 * by exam proximity, then boosted when the subject is chasing a target grade
 * its current attainment is still short of.
 */
function subjectWeight(
  subjectId: Id,
  mastery: TopicMastery[],
  exams: ExamDate[],
  date: IsoDate,
  subjects: Subject[] = [],
  targetGrades: Record<Id, string> = {},
  errorModel: ErrorModelEntry[] = [],
  calibrationModel?: CalibrationModel,
): number {
  const rows = mastery.filter((m) => m.subjectId === subjectId);
  const avg = rows.length ? rows.reduce((a, m) => a + m.mastery, 0) / rows.length : 0.3;
  const urgency = examUrgency(daysToExam(exams, subjectId, date));
  // Deficit-driven: a subject at 30% mastery pulls more than twice the weight
  // of one at 70%, then exam proximity scales it again.
  let weight = (0.15 + (1 - avg)) * urgency;

  const subject = subjects.find((s) => s.id === subjectId);
  const target = targetGrades[subjectId];
  if (subject && target) {
    const boundary = subject.gradeBoundaries.find((b) => b.grade === target);
    if (boundary) {
      // Use the same question-mark model as grade/paper prediction. With no
      // observations this is the explicitly labelled population prior; it is
      // never a second hand-selected mastery→percent formula.
      const questionModel = questionMarkModelForSubject(calibrationModel, subjectId);
      const predicted = rows.length
        ? rows.reduce((sum, row) => sum + predictQuestionMarks({
            model: questionModel,
            baselineMastery: row.mastery,
            durationMinutes: 0,
            action: "paper",
          }).value, 0) / rows.length * 100
        : 0;
      const gap = boundary.percent - predicted;
      if (gap > 0) weight *= 1 + Math.min(0.6, (gap / 100) * 2);
    }
  }

  const errorSeverity = errorModel
    .filter((entry) => entry.subjectIds.includes(subjectId) && entry.openCount > 0)
    .slice(0, 4)
    .reduce((sum, entry) => sum + entry.severity * entry.recencyWeight, 0);
  if (errorSeverity > 0) weight *= 1 + Math.min(0.5, errorSeverity / 20);

  return weight;
}

function availableMinutes(input: PlanInput, date: IsoDate, weekday: number): number {
  const value = input.availabilityOverrides?.[date]
    ?? input.availability.find((availability) => availability.weekday === weekday)?.minutes
    ?? 0;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
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
  masteryByTopic: Map<Id, TopicMastery>;
  cardsByTopic: Map<Id, Card[]>;
  mistakesByTopic: Map<Id, Mistake[]>;
  attemptsByTopic: Map<Id, Attempt[]>;
  errorModel: ErrorModelEntry[];
  cardsProvided: boolean;
}

interface ActivityPick {
  activity: ActivityKind;
  topicId?: Id;
  reason: string;
  priority: PlannedSession["priority"];
  intervention: PlannedSession["intervention"];
  purpose: string;
}

function chooseActivity(input: ChooseInput): ActivityPick {
  const days = daysToExam(input.exams, input.subjectId, input.date);

  const candidates = input.topics
    .filter((t) => t.subjectId === input.subjectId)
    .map((t) => {
      const mastery = input.projected.get(t.id) ?? 0;
      const cards = input.cardsByTopic.get(t.id) ?? [];
      const dueCards = cards.filter((card) => isDue(card, input.date));
      const mistakes = (input.mistakesByTopic.get(t.id) ?? []).filter((mistake) => !mistake.resolved);
      // Recall sessions prove retrieval but are not marked exam application;
      // counting them here would make the planner prescribe practice based on
      // evidence that never contained a mark scheme.
      const attempts = (input.attemptsByTopic.get(t.id) ?? []).filter((attempt) => attempt.mode !== "recall");
      const marksAvailable = attempts.reduce((sum, attempt) => sum + Math.max(0, attempt.max), 0);
      const applicationAccuracy = marksAvailable
        ? attempts.reduce((sum, attempt) => sum + Math.max(0, Math.min(attempt.max, attempt.awarded)), 0) / marksAvailable
        : null;
      const techniqueMarks = mistakes
        .filter((mistake) => mistake.timing === "rushed" || mistake.timing === "slow" || mistake.category === "communication" || mistake.category === "interpretation" || mistake.misconception === "misread-command")
        .reduce((sum, mistake) => sum + mistake.marksLost, 0);
      const errorSeverity = actionableErrors(input.errorModel, input.subjectId, 8)
        .filter((entry) => entry.topicIds.includes(t.id))
        .reduce((sum, entry) => sum + entry.severity * entry.recencyWeight, 0);
      const last = input.lastScheduled.get(t.id);
      // Spacing penalty: revisiting a topic the very next day wastes the
      // spacing effect, so push it back unless nothing else needs the slot.
      const spacing = last === input.date ? 0.5 : last ? 0.85 : 1;
      const retention = input.masteryByTopic.get(t.id)?.retention ?? 0;
      // The planner uses independent signals: due retrieval, known errors,
      // application marks and exam technique should not all collapse into a
      // single mastery number.
      const signalScore =
        (1 - mastery) * 1.1
        + Math.min(2, dueCards.length * 0.35)
        + Math.min(2.5, mistakes.reduce((sum, mistake) => sum + mistake.marksLost, 0) * 0.22)
        + (applicationAccuracy != null ? Math.max(0, 0.75 - applicationAccuracy) * 1.4 : 0.4)
        + Math.min(1.5, techniqueMarks * 0.18)
        + Math.min(1.5, errorSeverity * 0.12)
        + (t.intrinsicDifficulty - 3) * 0.05;
      return {
        topic: t,
        mastery,
        cards,
        dueCards,
        mistakes,
        attempts,
        applicationAccuracy,
        techniqueMarks,
        errorSeverity,
        hasEvidence: cards.length > 0 || attempts.length > 0 || mistakes.length > 0,
        retention,
        score: signalScore * spacing,
      };
    })
    .sort((a, b) => b.score - a.score);

  const pick = candidates[0];
  if (!pick) {
    return {
      activity: "flashcards",
      reason: "Keep recall warm while you build your subject evidence.",
      priority: "maintenance",
      intervention: "retrieval",
      purpose: "Keep the study habit active.",
    };
  }

  const priority: PlannedSession["priority"] = days != null && days <= 7
    ? "critical"
    : pick.mistakes.length || pick.dueCards.length || pick.errorSeverity >= 1.5
      ? "high"
      : pick.mastery < 0.45
        ? "high"
        : pick.mastery >= 0.75
          ? "maintenance"
          : "standard";

  // Every study day opens with due cards only when there are real due cards.
  // The fallback preserves the old cold-start contract for callers that have
  // not supplied card evidence yet.
  if ((pick.dueCards.length > 0 && input.blockIndex === 0) || (!input.cardsProvided && input.blockIndex === 0)) {
    const overdue = pick.dueCards.filter((card) => card.due < input.date).length;
    return {
      activity: "flashcards",
      topicId: pick.dueCards.length ? pick.topic.id : undefined,
      reason: overdue
        ? `${pick.topic.title}: ${overdue} review${overdue === 1 ? " is" : "s are"} overdue, so retrieve it before it fades further.`
        : `${pick.topic.title}: clear today's due retrieval before adding new material.`,
      priority: overdue ? "critical" : "high",
      intervention: "retrieval",
      purpose: "Restore recall before it becomes a larger backlog.",
    };
  }

  if (pick.mistakes.length > 0) {
    const topError = actionableErrors(input.errorModel, input.subjectId, 8).find((entry) => entry.topicIds.includes(pick.topic.id));
    return {
      activity: "mistakes",
      topicId: pick.topic.id,
      reason: topError
        ? `${pick.topic.title}: ${topError.label.toLowerCase()} are recurring — repair the example and retest it.`
        : `${pick.topic.title}: ${pick.mistakes.length} open mistake${pick.mistakes.length === 1 ? "" : "s"} still cost marks.`,
      priority,
      intervention: topError?.misconception ? "misconception-correction" : "application",
      purpose: "Turn a known lost mark into a reliable answer.",
    };
  }

  // Near an exam, execution practice is useful once there is enough knowledge
  // to make the result diagnostic rather than just discouraging.
  if (days != null && days <= 14 && input.blockIndex % 3 === 2 && pick.mastery >= 0.55) {
    return {
      activity: "paper",
      topicId: pick.topic.id,
      reason: `${days} days to the exam: test ${pick.topic.title} under timed conditions and expose execution gaps.`,
      priority: days <= 7 ? "critical" : "high",
      intervention: "timed-execution",
      purpose: "Convert topic knowledge into marks at exam pace.",
    };
  }

  if (pick.applicationAccuracy != null && pick.applicationAccuracy < 0.6) {
    return {
      activity: "practice",
      topicId: pick.topic.id,
      reason: `${pick.topic.title}: marked application is ${Math.round(pick.applicationAccuracy * 100)}%, so practise the exam move rather than rereading notes.`,
      priority,
      intervention: "application",
      purpose: "Raise marks on unseen exam questions.",
    };
  }

  if (pick.techniqueMarks > 0) {
    return {
      activity: "practice",
      topicId: pick.topic.id,
      reason: `${pick.topic.title}: ${pick.techniqueMarks} mark${pick.techniqueMarks === 1 ? "" : "s"} were lost to timing or answer execution.`,
      priority,
      intervention: "exam-technique",
      purpose: "Answer the command word accurately within the mark budget.",
    };
  }

  if (!pick.hasEvidence || pick.mastery === 0) {
    return {
      activity: "learn",
      topicId: pick.topic.id,
      reason: `First pass over ${pick.topic.title}.`,
      priority: "high",
      intervention: "coverage",
      purpose: "Create a first evidence point for this specification topic.",
    };
  }

  if (pick.mastery < 0.55 && pick.retention < 0.65) {
    return {
      activity: "recall",
      topicId: pick.topic.id,
      reason: `${pick.topic.title}: recall is fading, so prove the key points from a blank page before practising them.`,
      priority,
      intervention: "retrieval",
      purpose: "Rebuild retrievability so later application is durable.",
    };
  }
  if (pick.mastery < 0.55) {
    return {
      activity: "practice",
      topicId: pick.topic.id,
      reason: `${pick.topic.title} is below target — exam questions with marking.`,
      priority,
      intervention: "application",
      purpose: "Find and repair the next mark-scheme gap.",
    };
  }
  return {
    activity: "recall",
    topicId: pick.topic.id,
    reason: `Blank-page recall on ${pick.topic.title} to prove it is secure.`,
    priority: priority === "high" ? "standard" : priority,
    intervention: "consolidation",
    purpose: "Check that strong knowledge remains retrievable without cues.",
  };
}

function groupBy<T>(items: T[], key: (item: T) => Id): Map<Id, T[]> {
  const result = new Map<Id, T[]>();
  for (const item of items) {
    const value = key(item);
    const rows = result.get(value) ?? [];
    rows.push(item);
    result.set(value, rows);
  }
  return result;
}

function groupByMany<T>(items: T[], keys: (item: T) => Id[]): Map<Id, T[]> {
  const result = new Map<Id, T[]>();
  for (const item of items) {
    for (const value of new Set(keys(item))) {
      const rows = result.get(value) ?? [];
      rows.push(item);
      result.set(value, rows);
    }
  }
  return result;
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
    if (s.date >= today && s.status === "pending") countByDate.set(s.date, (countByDate.get(s.date) ?? 0) + 1);
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

// ---------------------------------------------------------------------------
// Plan realism & diminishing returns (Phase 5)
// ---------------------------------------------------------------------------

export interface PlanRealismIssue {
  severity: "warning" | "blocking";
  message: string;
  remedy?: string;
}

export interface PlanRealismReport {
  feasible: boolean;
  issues: PlanRealismIssue[];
  /** 0–1: planned minutes / available minutes over horizon. >1 is impossible. */
  utilisation: number;
  totalPlannedMinutes: number;
  totalAvailableMinutes: number;
  /** Longest single day in the plan. */
  peakDayMinutes: number;
  /** Suggested remedy when infeasible, or null. */
  suggestion: string | null;
}

/**
 * Diminishing returns: the nth minute of a continuous block is worth less than
 * the first. Curve is piecewise so it is explainable in the UI.
 *
 * - 0–25 min: 100% (fresh attention)
 * - 25–50 min: 75%
 * - 50–90 min: 55%
 * - 90+ min: 35%  (fatigue, context switching)
 *
 * Returns an effective-minutes value — multiply by nominal marks/hour.
 */
export function effectiveMinutes(minutes: number): number {
  if (minutes <= 0) return 0;
  let eff = 0;
  const segments: Array<{ cap: number; factor: number }> = [
    { cap: 25, factor: 1 },
    { cap: 25, factor: 0.75 },
    { cap: 40, factor: 0.55 },
    { cap: Infinity, factor: 0.35 },
  ];
  let remaining = minutes;
  for (const seg of segments) {
    const take = Math.min(remaining, seg.cap);
    eff += take * seg.factor;
    remaining -= take;
    if (remaining <= 0) break;
  }
  return Math.round(eff * 10) / 10;
}

export function diminishingReturnsFactor(minutes: number): number {
  if (minutes <= 0) return 1;
  return Math.round((effectiveMinutes(minutes) / minutes) * 100) / 100;
}

/**
 * Pre-flight realism check. Call before (or after) buildPlan to surface
 * "this can never work in the hours you have" rather than silently producing
 * an under-filled timetable.
 */
export function assessPlanRealism(input: PlanInput, plan: PlannedSession[]): PlanRealismReport {
  const today = toDateOnly(input.now ?? new Date());
  const horizon = input.horizonDays ?? DEFAULT_HORIZON;
  const start = new Date(`${today}T00:00:00Z`);
  let totalAvailable = 0;
  for (let i = 0; i < horizon; i++) {
    const d = toDateOnly(new Date(start.getTime() + i * 86_400_000));
    const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
    let m = availableMinutes(input, d, weekday);
    if (input.dailyMinutesCap != null) m = Math.min(m, input.dailyMinutesCap);
    totalAvailable += m;
  }
  const totalPlanned = plan.filter((p) => p.status === "pending" && p.date >= today).reduce((a, p) => a + p.minutes, 0);
  const utilisation = totalAvailable ? totalPlanned / totalAvailable : (totalPlanned > 0 ? Infinity : 0);

  const byDate = new Map<IsoDate, number>();
  for (const p of plan) if (p.status === "pending" && p.date >= today) byDate.set(p.date, (byDate.get(p.date) ?? 0) + p.minutes);
  const peakDayMinutes = Math.max(0, ...byDate.values());

  const issues: PlanRealismIssue[] = [];
  if (!Number.isFinite(utilisation) || utilisation > 1.05) {
    issues.push({
      severity: "blocking",
      message: `Plan needs ${totalPlanned} min but only ${totalAvailable} min are available in the next ${horizon} days (${Math.round(utilisation * 100)}% load).`,
      remedy: "Add availability, extend the horizon, or shorten sessions.",
    });
  } else if (utilisation > 0.88) {
    issues.push({
      severity: "warning",
      message: `Plan is at ${Math.round(utilisation * 100)}% of available time — one missed day will cascade.`,
      remedy: "Leave 10–15% buffer for missed sessions.",
    });
  }
  if (peakDayMinutes > 180) {
    issues.push({
      severity: "warning",
      message: `Peak day has ${peakDayMinutes} min (~${(peakDayMinutes / 60).toFixed(1)}h) — diminishing returns above 90 min and fatigue risk.`,
      remedy: "Cap daily minutes or split long blocks.",
    });
  }
  if (input.sessionLengthMinutes > 90) {
    issues.push({
      severity: "warning",
      message: `Sessions of ${input.sessionLengthMinutes} min are inefficient — effective learning is ~${Math.round(effectiveMinutes(input.sessionLengthMinutes))} min.`,
      remedy: "Use 25–50 min blocks with breaks.",
    });
  }
  const zeroDays = (() => {
    let z = 0;
    for (let i = 0; i < horizon; i++) {
      const d = toDateOnly(new Date(start.getTime() + i * 86_400_000));
      const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
      let m = availableMinutes(input, d, weekday);
      if (input.dailyMinutesCap != null) m = Math.min(m, input.dailyMinutesCap);
      if (m < 10) z++;
    }
    return z;
  })();
  if (zeroDays >= Math.floor(horizon * 0.6)) {
    issues.push({
      severity: "blocking",
      message: `Only ${horizon - zeroDays}/${horizon} days have time available — not enough to cover ${input.subjectIds.length} subjects.`,
      remedy: "Add at least 2–3 study days per week.",
    });
  }

  const feasible = !issues.some((i) => i.severity === "blocking");
  const suggestion = !feasible
    ? (issues.find((i) => i.remedy)?.remedy ?? null)
    : (issues[0]?.remedy ?? null);

  return { feasible, issues, utilisation: Math.round(utilisation * 1000) / 1000, totalPlannedMinutes: totalPlanned, totalAvailableMinutes: totalAvailable, peakDayMinutes, suggestion };
}

/**
 * Prioritised recovery: re-queues missed work ordered by urgency × deficit
 * so exam-near weak topics jump the queue. Falls back to oldest-first when
 * mastery/exam data are absent, preserving the existing behaviour.
 */
export function rescheduleMissedPrioritised(
  plan: PlannedSession[],
  today: IsoDate,
  dailyBlockCap: number,
  mastery: TopicMastery[] = [],
  exams: ExamDate[] = [],
  idFactory: () => string = () => crypto.randomUUID(),
): PlannedSession[] {
  const masteryByTopic = new Map(mastery.map((m) => [m.topicId, m.mastery]));
  const stale = plan.map((s) => ({ ...s })).filter((s) => s.date < today && s.status === "pending");
  if (!stale.length) return plan.map((s) => ({ ...s }));

  // Rank stale sessions: lower mastery + closer exam = higher priority.
  const urgencyFor = (subjectId: Id, date: IsoDate) => examUrgency(daysToExam(exams, subjectId, date));
  stale.sort((a, b) => {
    const ma = a.topicId ? (masteryByTopic.get(a.topicId) ?? 0.5) : 0.5;
    const mb = b.topicId ? (masteryByTopic.get(b.topicId) ?? 0.5) : 0.5;
    const scoreA = (1 - ma) * urgencyFor(a.subjectId, today);
    const scoreB = (1 - mb) * urgencyFor(b.subjectId, today);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.date.localeCompare(b.date);
  });

  const out = plan.map((s) => ({ ...s }));
  // Mark originals missed
  for (const s of stale) {
    const orig = out.find((x) => x.id === s.id);
    if (orig) orig.status = "missed";
  }

  const countByDate = new Map<IsoDate, number>();
  for (const s of out) if (s.date >= today && s.status === "pending") countByDate.set(s.date, (countByDate.get(s.date) ?? 0) + 1);

  for (const session of stale) {
    let target = today;
    for (let i = 0; i < 14; i++) {
      const candidate = toDateOnly(new Date(new Date(`${today}T00:00:00Z`).getTime() + i * 86_400_000));
      if ((countByDate.get(candidate) ?? 0) < dailyBlockCap) { target = candidate; break; }
    }
    countByDate.set(target, (countByDate.get(target) ?? 0) + 1);
    const lastOfDay = out.filter((s) => s.date === target).sort((a, b) => a.startMinute - b.startMinute).pop();
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
