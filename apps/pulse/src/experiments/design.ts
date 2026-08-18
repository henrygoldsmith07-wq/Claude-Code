/**
 * Personal experiment design.
 *
 * Three designs, chosen for what a single person can actually run:
 *
 *  - `crossover` — alternate conditions in blocks. The default, because it
 *    removes the biggest confounder in personal data (you, changing over
 *    time) by measuring both conditions in every phase.
 *  - `ab` — randomise condition per eligible day. Simple, but vulnerable to
 *    drift when a period is short.
 *  - `before-after` — only when a condition genuinely cannot be alternated.
 *    Weakest by far, and the design says so.
 *
 * The sample requirement is computed from the predicted effect, not chosen for
 * convenience: an experiment that cannot detect what it is looking for wastes
 * two weeks and produces a false "no effect".
 */

import { hash128 } from "../events/hash.js";
import { addDays, daysBetween } from "../events/time.js";
import { createRng } from "../statistics/random.js";
import { minSamplePaired, minSamplePerGroup } from "../statistics/power.js";
import type { Hypothesis } from "../hypotheses/tracker.js";

export type ExperimentType = "crossover" | "ab" | "before-after";

export interface Condition {
  id: "A" | "B";
  label: string;
  /** What the user actually does. Must be unambiguous enough to follow. */
  instruction: string;
}

export interface Assignment {
  date: string;
  condition: "A" | "B";
  /** Block index for crossover designs. */
  block: number;
}

export interface ExperimentDesign {
  id: string;
  hypothesisId: string;
  createdAt: string;
  type: ExperimentType;
  title: string;
  /** Restated hypothesis, in the experiment's own terms. */
  hypothesis: string;
  conditionA: Condition;
  conditionB: Condition;
  targetMetricId: string;
  /** Sessions needed *per condition* for the predicted effect at 80% power. */
  minSamplePerCondition: number;
  durationDays: number;
  /** Days per block in a crossover. */
  blockDays: number;
  startDate: string;
  endDate: string;
  assignments: Assignment[];
  likelyConfounders: string[];
  analysisMethod: string;
  successCriteria: string;
  /** Seed for the assignment schedule — makes the design reproducible. */
  seed: string;
  /** Things that would invalidate the run, checked at analysis time. */
  invalidations: string[];
}

export interface DesignOptions {
  type?: ExperimentType;
  startDate: string;
  /** Expected eligible sessions per week; drives the duration calculation. */
  sessionsPerWeek?: number;
  blockDays?: number;
  /** Overrides the power-derived sample requirement. Use sparingly. */
  minSamplePerCondition?: number;
  seed?: string;
  now?: () => number;
  conditionA?: Partial<Condition>;
  conditionB?: Partial<Condition>;
  maxDurationDays?: number;
}

export function designExperiment(hypothesis: Hypothesis, options: DesignOptions): ExperimentDesign {
  const now = options.now ?? Date.now;
  const type = options.type ?? "crossover";
  const sessionsPerWeek = options.sessionsPerWeek ?? 4;
  const blockDays = options.blockDays ?? 7;
  const seed = options.seed ?? `${hypothesis.id}:${options.startDate}`;

  // Predicted effects below 0.2 SD would demand hundreds of sessions; clamp so
  // the design stays honest about what it can detect rather than proposing a
  // two-year experiment.
  const effect = Math.max(0.25, hypothesis.predictedEffect);
  const perCondition =
    options.minSamplePerCondition ??
    (type === "crossover" ? minSamplePaired(effect) : minSamplePerGroup(effect));

  const totalSessions = perCondition * 2;
  const rawDays = Math.ceil((totalSessions / sessionsPerWeek) * 7);
  const maxDuration = options.maxDurationDays ?? 56;
  const durationDays = Math.min(maxDuration, Math.max(14, roundToBlocks(rawDays, type === "crossover" ? blockDays : 1)));

  const conditionA: Condition = {
    id: "A",
    label: options.conditionA?.label ?? "Intervention",
    instruction: options.conditionA?.instruction ?? `Deliberately do the behaviour under test before each session.`,
  };
  const conditionB: Condition = {
    id: "B",
    label: options.conditionB?.label ?? "Control",
    instruction: options.conditionB?.instruction ?? `Keep everything else the same, but do not do the behaviour under test.`,
  };

  const assignments = buildAssignments(type, options.startDate, durationDays, blockDays, seed);
  const endDate = addDays(options.startDate, durationDays - 1);

  const analysisMethod =
    type === "crossover"
      ? "Paired comparison of per-block means (Wilcoxon signed-rank, with a paired t-test reported alongside)"
      : type === "ab"
        ? "Two-sample comparison of session values (Welch's t-test, or Mann-Whitney when samples are small or skewed)"
        : "Two-sample comparison of the before and after periods, with a trend check to separate the change from drift";

  return {
    id: `exp-${hash128(`${hypothesis.id}:${type}:${options.startDate}`).slice(0, 16)}`,
    hypothesisId: hypothesis.id,
    createdAt: new Date(now()).toISOString(),
    type,
    title: `${type === "crossover" ? "Crossover" : type === "ab" ? "A/B" : "Before/after"} test: ${hypothesis.outcomeMetricId}`,
    hypothesis: hypothesis.statement,
    conditionA,
    conditionB,
    targetMetricId: hypothesis.outcomeMetricId,
    minSamplePerCondition: perCondition,
    durationDays,
    blockDays,
    startDate: options.startDate,
    endDate,
    assignments,
    likelyConfounders: [
      ...hypothesis.knownConfounders,
      ...(type === "before-after"
        ? ["General improvement over the period", "Anything else that changed between the two halves"]
        : ["Carry-over between blocks", "Days where you could not follow the assignment"]),
    ],
    analysisMethod,
    successCriteria: buildSuccessCriteria(hypothesis, perCondition),
    seed,
    invalidations: [
      `Fewer than ${perCondition} sessions in either condition`,
      "Adherence below 70% of assigned days",
      "A change in circumstances that affects both conditions unequally (illness, exams, travel)",
    ],
  };
}

function roundToBlocks(days: number, blockDays: number): number {
  if (blockDays <= 1) return days;
  // Always an even number of blocks, so both conditions get equal exposure.
  const blocks = Math.max(2, Math.ceil(days / blockDays));
  return (blocks % 2 === 0 ? blocks : blocks + 1) * blockDays;
}

/**
 * Assignment schedule.
 *
 * Crossover randomises only *which condition starts*; the alternation is then
 * fixed, which is what makes the design balanced against time trends. A/B
 * randomises per day with a balance constraint so a short run cannot end up
 * 11-3.
 */
export function buildAssignments(
  type: ExperimentType,
  startDate: string,
  durationDays: number,
  blockDays: number,
  seed: string,
): Assignment[] {
  const rng = createRng(seed);
  const assignments: Assignment[] = [];

  if (type === "crossover") {
    const startWithA = rng.next() < 0.5;
    for (let day = 0; day < durationDays; day += 1) {
      const block = Math.floor(day / blockDays);
      const isFirstOfPair = block % 2 === 0;
      const condition: "A" | "B" = isFirstOfPair === startWithA ? "A" : "B";
      assignments.push({ date: addDays(startDate, day), condition, block });
    }
    return assignments;
  }

  if (type === "before-after") {
    const half = Math.floor(durationDays / 2);
    for (let day = 0; day < durationDays; day += 1) {
      assignments.push({ date: addDays(startDate, day), condition: day < half ? "B" : "A", block: day < half ? 0 : 1 });
    }
    return assignments;
  }

  // A/B: shuffle a balanced pool so the split is exact.
  const pool: ("A" | "B")[] = [];
  for (let i = 0; i < durationDays; i += 1) pool.push(i % 2 === 0 ? "A" : "B");
  const shuffled = rng.shuffle(pool);
  for (let day = 0; day < durationDays; day += 1) {
    assignments.push({ date: addDays(startDate, day), condition: shuffled[day]!, block: 0 });
  }
  return assignments;
}

function buildSuccessCriteria(hypothesis: Hypothesis, perCondition: number): string {
  const direction = hypothesis.predictedDirection === "increase" ? "higher" : "lower";
  return [
    `At least ${perCondition} qualifying sessions in each condition.`,
    `Condition A is ${direction} than condition B, with a 95% confidence interval that excludes zero.`,
    `The observed effect is at least half the predicted ${hypothesis.predictedEffect.toFixed(2)} SD — a detectable but trivial difference counts as inconclusive, not as support.`,
  ].join(" ");
}

export function conditionForDate(design: ExperimentDesign, date: string): "A" | "B" | null {
  return design.assignments.find((assignment) => assignment.date === date)?.condition ?? null;
}

/**
 * A contiguous stretch of the same condition in a design's schedule. Derived
 * from the assignments, never stored — the derivation is the source of truth,
 * so a period cannot drift from the schedule it names. For a crossover the
 * periods are the blocks; for before-after they are the two halves; for A/B
 * they are the condition runs.
 */
export interface ExperimentPeriod {
  /** 1-based position within the design. */
  index: number;
  condition: "A" | "B";
  /** Condition label plus letter, e.g. "Intervention A". */
  label: string;
  startDate: string;
  endDate: string;
  dayCount: number;
}

/** A day's position within the period that contains it. */
export interface PeriodPosition {
  period: ExperimentPeriod;
  /** 1-based day within the period. */
  dayInPeriod: number;
}

/**
 * Splits the design's schedule into named periods. A period ends wherever the
 * condition changes, so every assigned date belongs to exactly one period and
 * the periods cover the assignments completely.
 */
export function derivePeriods(design: ExperimentDesign): ExperimentPeriod[] {
  const labelOf = (condition: "A" | "B"): string => {
    const source = condition === "A" ? design.conditionA : design.conditionB;
    return `${source.label} ${source.id}`;
  };

  const byDate = [...design.assignments].sort((a, b) => a.date.localeCompare(b.date));
  const periods: ExperimentPeriod[] = [];
  for (const assignment of byDate) {
    const current = periods[periods.length - 1];
    if (current && current.condition === assignment.condition) {
      current.endDate = assignment.date;
      current.dayCount += 1;
    } else {
      periods.push({
        index: periods.length + 1,
        condition: assignment.condition,
        label: labelOf(assignment.condition),
        startDate: assignment.date,
        endDate: assignment.date,
        dayCount: 1,
      });
    }
  }
  return periods;
}

/** The period containing `date`, with the day's 1-based position within it. */
export function periodForDate(design: ExperimentDesign, date: string): PeriodPosition | null {
  for (const period of derivePeriods(design)) {
    if (date >= period.startDate && date <= period.endDate) {
      return { period, dayInPeriod: daysBetween(period.startDate, date) + 1 };
    }
  }
  return null;
}
