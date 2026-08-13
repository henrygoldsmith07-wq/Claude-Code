/**
 * Synthetic benchmark users.
 *
 * Pulse cannot be tested only on real data, because with real data nobody
 * knows the right answer. These generators build people whose relationships
 * are known by construction, so the test suite can assert two things that
 * matter equally:
 *
 *   sensitivity — the planted effects are found;
 *   specificity — the planted *non*-effects are not.
 *
 * The second is the harder bar and the one that separates an evidence engine
 * from a correlation slot machine. Every generated user therefore carries null
 * relationships and at least one confounded relationship designed to fool a
 * naive analysis.
 *
 * Everything is seeded: the same seed always produces the same person.
 */

import { addDays, localDayOfWeek, localDayStart } from "../events/time.js";
import { createRng, normalDeviate, type Rng } from "../statistics/random.js";
import type { ReviseRecord } from "../connectors/revise.js";
import type { AriseRecord } from "../connectors/arise.js";
import type { FrenchRecord } from "../connectors/french.js";
import type { ForqRecord } from "../connectors/forq.js";

export type GroundTruthKind = "true-effect" | "null-effect" | "confounded";

export interface GroundTruthRelationship {
  id: string;
  kind: GroundTruthKind;
  description: string;
  /** Metric the effect lands on. */
  outcomeMetricId: string;
  /** Behaviour metric, where the relationship has one. */
  exposureMetricId?: string;
  /** Absolute change planted, in the outcome's own units. Zero for nulls. */
  plantedEffect: number;
  /**
   * For `confounded`, the real cause. A correct analysis should either
   * attribute the effect here or flag that it cannot separate the two.
   */
  actualCause?: string;
}

export interface SyntheticUser {
  id: string;
  seed: string;
  timezone: string;
  startDate: string;
  days: number;
  revise: ReviseRecord[];
  arise: AriseRecord[];
  french: FrenchRecord[];
  forq: ForqRecord[];
  groundTruth: GroundTruthRelationship[];
}

export interface SyntheticOptions {
  seed?: string;
  days?: number;
  startDate?: string;
  timezone?: string;
  /** Absolute accuracy gain for study within 4h after exercise. */
  exerciseAccuracyBoost?: number;
  /** Absolute accuracy gain for afternoon study, independent of exercise. */
  afternoonAccuracyBoost?: number;
  /** Session-level noise SD on accuracy. */
  accuracyNoise?: number;
  /** Probability of a workout on a given day. */
  workoutProbability?: number;
  /** Include the confounded French/recall relationship. */
  includeConfounded?: boolean;
}

const BASE_ACCURACY = 0.62;

/**
 * The default benchmark user.
 *
 * Planted structure:
 *  - TRUE:       study within 4h after exercise is more accurate
 *  - TRUE:       afternoon study is more accurate than morning or night
 *  - CONFOUNDED: French speaking "improves" recall, but only because both
 *                happen in the evening when this person is sharper
 *  - NULL:       meal plan adherence has no relationship with anything
 *  - NULL:       training volume has no relationship with study accuracy
 */
export function generateSyntheticUser(options: SyntheticOptions = {}): SyntheticUser {
  const seed = options.seed ?? "pulse-benchmark-1";
  const days = options.days ?? 180;
  const startDate = options.startDate ?? "2025-01-06";
  const timezone = options.timezone ?? "Europe/London";
  const exerciseBoost = options.exerciseAccuracyBoost ?? 0.055;
  const afternoonBoost = options.afternoonAccuracyBoost ?? 0.04;
  const noise = options.accuracyNoise ?? 0.12;
  const workoutProbability = options.workoutProbability ?? 0.5;
  const includeConfounded = options.includeConfounded ?? true;

  const rng = createRng(seed);

  const revise: ReviseRecord[] = [];
  const arise: AriseRecord[] = [];
  const french: FrenchRecord[] = [];
  const forq: ForqRecord[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const date = addDays(startDate, dayIndex);
    const dayStartMs = localDayStart(date, timezone);
    const dow = localDayOfWeek(dayStartMs, timezone);
    const isWeekend = dow === 0 || dow === 6;

    // --- exercise -------------------------------------------------------
    let workoutMinutes: number | null = null;
    if (rng.next() < workoutProbability) {
      // Training times are spread across the day on purpose. If workouts
      // always happened at 17:30, "studied within 4h of exercise" would be
      // perfectly collinear with "studied in the evening" and the planted
      // effect would not be identifiable even in principle — which would make
      // this a benchmark for a question nobody can answer.
      workoutMinutes = drawWorkoutMinutes(rng, isWeekend);
      arise.push(buildWorkout(rng, date, dayStartMs, workoutMinutes, timezone));
    }

    // Readiness check-in most mornings.
    if (rng.next() < 0.8) {
      arise.push({
        kind: "readiness",
        dateISO: date,
        at: instantAt(dayStartMs, clampMinutes(normalDeviate(rng, 460, 45))),
        score: Math.round(clampRange(normalDeviate(rng, 68, 12), 0, 100)),
        sleep: Math.round(clampRange(normalDeviate(rng, 6.6, 1.4), 0, 10)),
        soreness: Math.round(clampRange(normalDeviate(rng, 3.2, 1.6), 0, 10)),
        motivation: Math.round(clampRange(normalDeviate(rng, 6.4, 1.7), 0, 10)),
        timezone,
      });
    }

    // --- French speaking, in the evening ---------------------------------
    let frenchSpokenMinutes: number | null = null;
    if (includeConfounded && rng.next() < 0.45) {
      frenchSpokenMinutes = clampMinutes(normalDeviate(rng, 1170, 45)); // ~19:30
      const durationMs = Math.round(clampRange(normalDeviate(rng, 14, 5), 4, 40)) * 60_000;
      french.push({
        kind: "speaking",
        id: `fr-sp-${dayIndex}`,
        startedAt: instantAt(dayStartMs, frenchSpokenMinutes),
        durationMs,
        pronunciationScore: clampRange(normalDeviate(rng, 0.71, 0.09), 0, 1),
        fluencyScore: clampRange(normalDeviate(rng, 0.66, 0.1), 0, 1),
        wordsSpoken: Math.round(clampRange(normalDeviate(rng, 220, 70), 10, 2000)),
        promptCount: Math.round(clampRange(normalDeviate(rng, 12, 4), 1, 60)),
        topic: rng.pick(["travel", "work", "family", "food"]),
        timezone,
      });
    }

    // --- study sessions --------------------------------------------------
    const sessionCount = isWeekend ? (rng.next() < 0.55 ? 1 : 2) : rng.next() < 0.35 ? 1 : rng.next() < 0.8 ? 2 : 3;
    for (let s = 0; s < sessionCount; s += 1) {
      const minutes = drawStudyMinutes(rng, isWeekend);
      const at = instantAt(dayStartMs, minutes);

      // The planted effects, applied additively on the accuracy scale.
      let accuracy = BASE_ACCURACY;
      const withinExerciseWindow =
        workoutMinutes !== null && minutes > workoutMinutes && minutes - workoutMinutes <= 240;
      if (withinExerciseWindow) accuracy += exerciseBoost;
      if (minutes >= 720 && minutes < 1080) accuracy += afternoonBoost;
      // Evening sharpness — the *real* cause behind the French/recall pattern.
      const eveningSharpness = includeConfounded && minutes >= 1080 && minutes < 1320 ? 0.05 : 0;
      accuracy += eveningSharpness;
      accuracy += normalDeviate(rng, 0, noise);
      accuracy = clampRange(accuracy, 0, 1);

      const marksAvailable = rng.pick([4, 6, 8, 10]);
      revise.push({
        kind: "attempt",
        id: `rv-at-${dayIndex}-${s}`,
        questionId: `q-${rng.int(400)}`,
        subjectId: rng.pick(["physics", "maths", "chemistry"]),
        topicIds: [`topic-${rng.int(30)}`],
        awarded: Math.round(accuracy * marksAvailable),
        max: marksAvailable,
        confidence: (Math.round(clampRange(normalDeviate(rng, 3.2, 0.9), 1, 5)) as 1 | 2 | 3 | 4 | 5),
        elapsedMs: Math.round(clampRange(normalDeviate(rng, 210_000, 80_000), 20_000, 1_200_000)),
        mode: rng.next() < 0.75 ? "practice" : "paper",
        markedBy: "rubric",
        createdAt: at,
        timezone,
      });

      // Flashcard reviews attached to the same sitting.
      const reviewCount = 4 + rng.int(9);
      for (let r = 0; r < reviewCount; r += 1) {
        // Reviews inherit the sitting's quality with a little extra noise.
        // Too much here and the planted effects stop being identifiable at
        // all, which would make the benchmark a test of luck rather than of
        // the engine.
        const reviewAccuracy = clampRange(accuracy + normalDeviate(rng, 0, 0.1), 0, 1);
        revise.push({
          kind: "review",
          id: `rv-rv-${dayIndex}-${s}-${r}`,
          cardId: `card-${rng.int(600)}`,
          topicId: `topic-${rng.int(30)}`,
          subjectId: rng.pick(["physics", "maths", "chemistry"]),
          grade: reviewAccuracy > 0.82 ? "easy" : reviewAccuracy > 0.58 ? "good" : reviewAccuracy > 0.3 ? "hard" : "again",
          confidence: (Math.round(clampRange(normalDeviate(rng, 3.1, 1), 1, 5)) as 1 | 2 | 3 | 4 | 5),
          elapsedMs: Math.round(clampRange(normalDeviate(rng, 9000, 4000), 800, 120_000)),
          intervalDays: Math.round(clampRange(normalDeviate(rng, 9, 6), 0, 90)),
          reviewedAt: instantAt(dayStartMs, minutes + r),
          timezone,
        });
      }
    }

    // --- French review, deliberately *not* linked to study accuracy -------
    if (rng.next() < 0.5) {
      const reviewMinutes = clampMinutes(normalDeviate(rng, 1200, 60));
      const count = 6 + rng.int(14);
      for (let i = 0; i < count; i += 1) {
        // Evening sharpness lifts these too, which is what creates the
        // confounded (but non-causal) speaking → recall association.
        const correct = rng.next() < (frenchSpokenMinutes !== null ? 0.74 : 0.68);
        french.push({
          kind: "review",
          id: `fr-rv-${dayIndex}-${i}`,
          reviewedAt: instantAt(dayStartMs, reviewMinutes + i),
          itemId: `fr-item-${rng.int(300)}`,
          skill: rng.pick(["vocab", "grammar", "listening", "reading"]),
          correct,
          elapsedMs: Math.round(clampRange(normalDeviate(rng, 6500, 2500), 500, 60_000)),
          intervalDays: Math.round(clampRange(normalDeviate(rng, 7, 5), 0, 60)),
          timezone,
        });
      }
    }

    // --- meals: pure noise, planted as a null relationship ----------------
    const plannedMeals = 3;
    forq.push({
      kind: "plan-day",
      id: `fq-day-${dayIndex}`,
      dateISO: date,
      closedAt: instantAt(dayStartMs, 1290),
      plannedMeals,
      completedMeals: Math.min(plannedMeals, Math.round(clampRange(normalDeviate(rng, 2.4, 0.8), 0, plannedMeals))),
      shopSpend: Math.round(clampRange(normalDeviate(rng, 12, 9), 0, 120)),
      timezone,
    });
  }

  return {
    id: `synthetic-${seed}`,
    seed,
    timezone,
    startDate,
    days,
    revise,
    arise,
    french,
    forq,
    groundTruth: [
      {
        id: "exercise-then-study",
        kind: "true-effect",
        description: "Study within 4 hours after exercise is more accurate.",
        outcomeMetricId: "study.accuracy",
        exposureMetricId: "exercise.volume",
        plantedEffect: exerciseBoost,
      },
      {
        id: "afternoon-study",
        kind: "true-effect",
        description: "Afternoon study (12:00-18:00) is more accurate.",
        outcomeMetricId: "study.accuracy",
        plantedEffect: afternoonBoost,
      },
      ...(includeConfounded
        ? [
            {
              id: "french-speaking-recall",
              kind: "confounded" as const,
              description: "French speaking appears to improve French recall, but both merely happen in the evening.",
              outcomeMetricId: "language.recall_accuracy",
              exposureMetricId: "language.speaking_minutes",
              plantedEffect: 0,
              actualCause: "Evening time-of-day sharpness",
            },
          ]
        : []),
      {
        id: "meal-adherence-accuracy",
        kind: "null-effect",
        description: "Meal plan adherence has no relationship with study accuracy.",
        outcomeMetricId: "study.accuracy",
        exposureMetricId: "wellbeing.plan_adherence",
        plantedEffect: 0,
      },
      {
        id: "volume-accuracy",
        kind: "null-effect",
        description: "How much you lift has no relationship with study accuracy.",
        outcomeMetricId: "study.accuracy",
        exposureMetricId: "exercise.volume",
        plantedEffect: 0,
      },
    ],
  };
}

/**
 * A user with no planted relationships at all.
 *
 * The strictest test in the suite: a correct engine reports *nothing* about
 * this person. Any finding is a false positive by construction.
 */
export function generateNullUser(options: SyntheticOptions = {}): SyntheticUser {
  const user = generateSyntheticUser({
    ...options,
    seed: options.seed ?? "pulse-null-user",
    exerciseAccuracyBoost: 0,
    afternoonAccuracyBoost: 0,
    includeConfounded: false,
  });
  return {
    ...user,
    groundTruth: user.groundTruth.map((relationship) => ({
      ...relationship,
      kind: "null-effect" as const,
      plantedEffect: 0,
      description: `${relationship.description} (removed in the null user)`,
    })),
  };
}

function buildWorkout(rng: Rng, date: string, dayStartMs: number, minutes: number, timezone: string): AriseRecord {
  const exercises = ["squat", "bench-press-barbell", "deadlift", "pull-up", "dumbbell-row", "overhead-press"];
  const chosen = rng.shuffle(exercises).slice(0, 3 + rng.int(2));
  return {
    kind: "session",
    id: `ar-${date}`,
    dateISO: date,
    completedAt: instantAt(dayStartMs, minutes),
    programId: "strength-block-1",
    title: "Strength",
    durationMin: Math.round(clampRange(normalDeviate(rng, 52, 12), 20, 150)),
    blocks: chosen.map((exerciseId) => ({
      exerciseId,
      muscle: "Full body",
      sets: Array.from({ length: 3 + rng.int(2) }, () => ({
        reps: Math.round(clampRange(normalDeviate(rng, 8, 2), 1, 20)),
        weightKg: Math.round(clampRange(normalDeviate(rng, 55, 18), 0, 200)),
        rpe: Math.round(clampRange(normalDeviate(rng, 7.4, 1.1), 1, 10)),
      })),
    })),
    timezone,
  };
}

/** Three training slots — early, midday and evening — so exposure is not a proxy for clock time. */
function drawWorkoutMinutes(rng: Rng, isWeekend: boolean): number {
  const roll = rng.next();
  if (roll < 0.35) return clampMinutes(normalDeviate(rng, 450, 45)); // ~07:30
  if (roll < 0.65) return clampMinutes(normalDeviate(rng, isWeekend ? 720 : 750, 55)); // ~12:00-12:30
  return clampMinutes(normalDeviate(rng, 1050, 55)); // ~17:30
}

function drawStudyMinutes(rng: Rng, isWeekend: boolean): number {
  // Three-component mixture: morning, afternoon, evening.
  const roll = rng.next();
  if (roll < (isWeekend ? 0.3 : 0.22)) return clampMinutes(normalDeviate(rng, 570, 70));
  if (roll < (isWeekend ? 0.72 : 0.6)) return clampMinutes(normalDeviate(rng, 930, 90));
  return clampMinutes(normalDeviate(rng, 1180, 80));
}

function clampMinutes(value: number): number {
  return Math.round(clampRange(value, 5, 1435));
}

function clampRange(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Builds a UTC instant for a wall-clock minute offset within a local day. */
function instantAt(dayStartMs: number, minutes: number): string {
  return new Date(dayStartMs + minutes * 60_000).toISOString();
}
