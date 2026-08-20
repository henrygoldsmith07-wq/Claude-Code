import { buildPlan, rescheduleMissedPrioritised } from "./planner";
import { toDateOnly } from "./scheduling";
import type { ErrorModelEntry } from "./error-model";
import type {
  Attempt,
  Availability,
  Card,
  ExamDate,
  Id,
  Mistake,
  PlannedSession,
  Subject,
  Topic,
  TopicMastery,
} from "./types";
import type { CalibrationModel } from "./calibration";

// ---------------------------------------------------------------------------
// Dynamic session replanning. The timetable is derived state, so it should
// react to the things that invalidate it — a missed session, a moved exam, a
// changed target grade, different availability — instead of waiting for a
// manual rebuild. This module fingerprints those inputs, detects what changed,
// and applies the smallest correct repair (roll missed work forward, or do a
// full rebuild of pending future sessions while preserving history).
// ---------------------------------------------------------------------------

export type ReplanReason =
  | "sessions-missed"
  | "exam-changed"
  | "target-changed"
  | "availability-changed"
  | "learner-evidence-changed"
  | "session-length-changed"
  | "subject-set-changed";

/** The replan-relevant inputs, reduced to comparable strings/values. */
export interface ReplanFingerprint {
  exams: string;
  targets: string;
  availability: string;
  availabilityOverrides: string;
  sessionLength: number;
  subjects: string;
  learner: string;
}

/** Compact evidence signature used to invalidate future work after outcomes. */
export function learnerStateKey(input: {
  mastery: TopicMastery[];
  cards: Card[];
  mistakes: Mistake[];
  attempts: Attempt[];
}): string {
  const mastery = [...input.mastery]
    .sort((a, b) => a.topicId.localeCompare(b.topicId))
    .map((row) => `${row.topicId}:${Math.round(row.mastery * 100)}:${Math.round(row.retention * 100)}:${row.cardsDue}:${row.attempts}:${Math.round(row.accuracy * 100)}`)
    .join("|");
  const cards = [...input.cards]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((card) => `${card.id}:${card.due}:${card.state}:${Math.round(card.stability * 10)}:${card.reps}:${card.lapses}`)
    .join("|");
  const mistakes = [...input.mistakes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((mistake) => `${mistake.id}:${mistake.topicId}:${mistake.category}:${mistake.misconception ?? ""}:${mistake.marksLost}:${mistake.resolved}:${mistake.retestCount ?? 0}`)
    .join("|");
  const attempts = [...input.attempts]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-24)
    .map((attempt) => `${attempt.id}:${attempt.subjectId}:${attempt.topicIds.join(",")}:${attempt.awarded}/${attempt.max}:${attempt.mode}`)
    .join("|");
  return `${mastery}||${cards}||${mistakes}||${attempts}`;
}

export function computeFingerprint(input: {
  exams: ExamDate[];
  targetGrades: Record<Id, string>;
  calibrationModel?: CalibrationModel;
  availability: Availability[];
  availabilityOverrides?: Record<string, number>;
  sessionLengthMinutes: number;
  subjectIds: Id[];
  learnerStateKey?: string;
}): ReplanFingerprint {
  return {
    exams: input.exams
      .map((e) => `${e.subjectId}:${e.date}`)
      .sort()
      .join("|"),
    targets: Object.entries(input.targetGrades)
      .map(([id, grade]) => `${id}:${grade}`)
      .sort()
      .join("|"),
    availability: input.availability
      .map((a) => `${a.weekday}:${a.minutes}`)
      .sort()
      .join("|"),
    availabilityOverrides: Object.entries(input.availabilityOverrides ?? {})
      .map(([date, minutes]) => `${date}:${minutes}`)
      .sort()
      .join("|"),
    sessionLength: input.sessionLengthMinutes,
    subjects: [...input.subjectIds].sort().join("|"),
    learner: input.learnerStateKey ?? "",
  };
}

export function fingerprintKey(fp: ReplanFingerprint): string {
  return JSON.stringify(fp);
}

export interface ReplanInput {
  userId: Id;
  topics: Topic[];
  subjects: Subject[];
  mastery: TopicMastery[];
  exams: ExamDate[];
  availability: Availability[];
  availabilityOverrides?: Record<string, number>;
  sessionLengthMinutes: number;
  subjectIds: Id[];
  targetGrades: Record<Id, string>;
  calibrationModel?: CalibrationModel;
  cards?: Card[];
  mistakes?: Mistake[];
  attempts?: Attempt[];
  errorModel?: ErrorModelEntry[];
  learnerStateKey?: string;
  recentWorkloadMinutes?: Record<string, number>;
  fatigueThresholdDays?: number;
  existing: PlannedSession[];
  /** Fingerprint of the inputs the current plan was built from, when known. */
  previous?: ReplanFingerprint;
  now?: Date;
  horizonDays?: number;
  /** Daily block cap used when rolling missed sessions forward. */
  dailyBlockCap?: number;
  idFactory?: () => string;
}

export interface ReplanResult {
  plan: PlannedSession[];
  changed: boolean;
  reasons: ReplanReason[];
  fingerprint: ReplanFingerprint;
  /** Human summary of what moved and why, or null when nothing changed. */
  summary: string | null;
}

export function replanDynamically(input: ReplanInput): ReplanResult {
  const now = input.now ?? new Date();
  const today = toDateOnly(now);
  const nextId = input.idFactory ?? (() => crypto.randomUUID());
  const fingerprint = computeFingerprint(input);
  const previous = input.previous;

  const reasons: ReplanReason[] = [];
  if (previous) {
    if (fingerprint.exams !== previous.exams) reasons.push("exam-changed");
    if (fingerprint.targets !== previous.targets) reasons.push("target-changed");
    if (fingerprint.availability !== previous.availability) reasons.push("availability-changed");
    if (fingerprint.availabilityOverrides !== previous.availabilityOverrides) reasons.push("availability-changed");
    if (fingerprint.learner !== previous.learner) reasons.push("learner-evidence-changed");
    if (fingerprint.sessionLength !== previous.sessionLength) reasons.push("session-length-changed");
    if (fingerprint.subjects !== previous.subjects) reasons.push("subject-set-changed");
  }
  const structural = reasons.length > 0;

  const hadMissed = input.existing.some((s) => s.status === "pending" && s.date < today);
  if (hadMissed) reasons.push("sessions-missed");

  let plan = input.existing;
  if (hadMissed) {
    plan = rescheduleMissedPrioritised(plan, today, input.dailyBlockCap ?? 6, input.mastery, input.exams, nextId);
  }
  if (structural) {
    plan = buildPlan({
      userId: input.userId,
      topics: input.topics,
      subjects: input.subjects,
      mastery: input.mastery,
      exams: input.exams,
      availability: input.availability,
      sessionLengthMinutes: input.sessionLengthMinutes,
      subjectIds: input.subjectIds,
      targetGrades: input.targetGrades,
      calibrationModel: input.calibrationModel,
      cards: input.cards,
      mistakes: input.mistakes,
      attempts: input.attempts,
      errorModel: input.errorModel,
      availabilityOverrides: input.availabilityOverrides,
      recentWorkloadMinutes: input.recentWorkloadMinutes,
      fatigueThresholdDays: input.fatigueThresholdDays,
      horizonDays: input.horizonDays,
      now,
      existing: plan,
      idFactory: nextId,
    });
  }

  const changed = hadMissed || structural;
  return {
    plan,
    changed,
    reasons,
    fingerprint,
    summary: changed ? describeReplan(reasons) : null,
  };
}

function describeReplan(reasons: ReplanReason[]): string {
  const parts: string[] = [];
  if (reasons.includes("exam-changed")) parts.push("an exam date changed");
  if (reasons.includes("target-changed")) parts.push("a target grade changed");
  if (reasons.includes("availability-changed")) parts.push("your availability changed");
  if (reasons.includes("learner-evidence-changed")) parts.push("new performance evidence changed your priorities");
  if (reasons.includes("session-length-changed")) parts.push("session length changed");
  if (reasons.includes("subject-set-changed")) parts.push("your subjects changed");
  if (reasons.includes("sessions-missed")) parts.push("missed sessions were rolled forward");
  return `Plan updated because ${parts.join(", ")}.`;
}
