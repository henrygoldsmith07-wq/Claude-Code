/**
 * Experiment calendar.
 *
 * Designing an experiment is cheap; remembering to run it on the right day is
 * the part people actually fail at. The calendar turns a set of designs into a
 * managed schedule: which experiments are live today, what condition each day
 * is assigned to, what is coming up, and what has finished but not yet been
 * analysed. Pulse proposes experiments; the calendar runs them.
 */

import { addDays, daysBetween } from "../events/time.js";
import type { ExperimentResult } from "./analysis.js";
import {
  derivePeriods,
  periodForDate,
  BASELINE_INSTRUCTION,
  WASHOUT_INSTRUCTION,
  type ExperimentDesign,
  type PeriodPosition,
} from "./design.js";

export type CalendarBucket = "active" | "upcoming" | "completed" | "analysed";

export interface CalendarEntry {
  design: ExperimentDesign;
  bucket: CalendarBucket;
  /** Condition assigned to `today`, when the experiment is active. */
  todayCondition: "A" | "B" | null;
  todayInstruction: string | null;
  /** The period containing today, when the experiment assigns a condition today. */
  todayPeriod: PeriodPosition | null;
  result: ExperimentResult | null;
  /** Days until the run ends; negative once it has overrun. */
  daysRemaining: number;
}

export interface CalendarAssignment {
  date: string;
  experimentId: string;
  title: string;
  /** Null during a washout, when no condition applies. */
  condition: "A" | "B" | null;
  instruction: string | null;
  /** Derived period, e.g. "Intervention A · Day 4/7"; "Washout · Day 1/2" for gaps. */
  period: string;
}

/**
 * A date on which two or more live experiments both assign a condition. The
 * warning tier of conflict handling: it tells the user the clash exists. The
 * stricter tier (blocking same-metric overlaps before they start) is a
 * separate rule that reads `sameMetric` rather than re-deriving it.
 */
export interface CalendarConflict {
  /** The shared date, as an ISO local date. */
  date: string;
  /** Every live experiment assigned on this date. */
  experimentIds: string[];
  titles: string[];
  /** True when two or more of the overlapping experiments target the same metric. */
  sameMetric: boolean;
  /** The target metrics involved, deduped and sorted — the flag above in detail. */
  metricIds: string[];
}

/**
 * An existing experiment whose run range intersects a proposed one on the
 * same metric. The hard-block tier (P1 #9) reads this at proposal time; the
 * warning tier only needs the per-date `sameMetric` flag above.
 */
export interface SameMetricOverlap {
  designId: string;
  title: string;
  startDate: string;
  endDate: string;
}

/**
 * Finds existing experiments that would share days with the candidate while
 * targeting the same metric. Two experiments may share days freely when they
 * measure different things; the same metric cannot be measured under two
 * conditions at once without the runs contaminating each other.
 */
export function findSameMetricOverlaps(
  existing: readonly ExperimentDesign[],
  candidate: ExperimentDesign,
): SameMetricOverlap[] {
  return existing
    .filter(
      (design) =>
        design.id !== candidate.id &&
        design.targetMetricId === candidate.targetMetricId &&
        design.startDate <= candidate.endDate &&
        candidate.startDate <= design.endDate,
    )
    .map((design) => ({
      designId: design.id,
      title: design.title,
      startDate: design.startDate,
      endDate: design.endDate,
    }));
}

/**
 * Thrown when a proposed experiment overlaps a live same-metric run. Carries
 * the structured details so the UI can render them; the message is the
 * human-readable form.
 */
export class ExperimentConflictError extends Error {
  readonly candidateId: string;
  readonly targetMetricId: string;
  readonly conflicts: SameMetricOverlap[];

  constructor(candidate: ExperimentDesign, conflicts: SameMetricOverlap[]) {
    const names = conflicts
      .map((overlap) => `"${overlap.title}" (${overlap.designId}, ${overlap.startDate}..${overlap.endDate})`)
      .join(", ");
    super(
      `Cannot start "${candidate.title}": its run overlaps ${names}, ` +
        `${conflicts.length === 1 ? "an experiment" : "experiments"} targeting the same metric ` +
        `(${candidate.targetMetricId}). Resolve the overlap before proposing again.`,
    );
    this.name = "ExperimentConflictError";
    this.candidateId = candidate.id;
    this.targetMetricId = candidate.targetMetricId;
    this.conflicts = conflicts;
  }
}

export interface ExperimentCalendar {
  today: string;
  entries: CalendarEntry[];
  active: CalendarEntry[];
  upcoming: CalendarEntry[];
  completed: CalendarEntry[];
  analysed: CalendarEntry[];
  /** Dated schedule from today through the end of the longest live run (capped). */
  schedule: CalendarAssignment[];
  /** Dates with more than one live experiment assigned, within the schedule horizon. */
  conflicts: CalendarConflict[];
  /** Next date a live run reaches its end — the next analysis checkpoint. */
  nextAnalysisDate: string | null;
  summary: { active: number; upcoming: number; completed: number; analysed: number; conflicts: number };
}

/** Bound the rendered schedule so a year of experiments cannot flood the UI. */
const MAX_SCHEDULE_DAYS = 60;

export function buildCalendar(
  designs: readonly ExperimentDesign[],
  results: readonly ExperimentResult[],
  today: string,
): ExperimentCalendar {
  const resultById = new Map(results.map((result) => [result.experimentId, result]));

  const entries: CalendarEntry[] = designs.map((design) => {
    const result = resultById.get(design.id) ?? null;
    let bucket: CalendarBucket;
    if (result) bucket = "analysed";
    else if (design.endDate < today) bucket = "completed";
    else if (design.startDate > today) bucket = "upcoming";
    else bucket = "active";

    const assignment = design.assignments.find((entry) => entry.date === today) ?? null;
    const todayPeriod = assignment ? periodForDate(design, today) : null;
    return {
      design,
      bucket,
      todayCondition: assignment?.condition ?? null,
      todayInstruction: todayPeriod
        ? todayPeriod.period.kind === "baseline"
          ? BASELINE_INSTRUCTION
          : todayPeriod.period.kind === "washout"
            ? WASHOUT_INSTRUCTION
            : todayPeriod.period.condition === "A"
              ? design.conditionA.instruction
              : design.conditionB.instruction
        : null,
      todayPeriod,
      result,
      daysRemaining: daysBetween(today, design.endDate),
    };
  });

  const live = entries.filter((entry) => entry.bucket === "active" || entry.bucket === "upcoming");
  const nextAnalysisDate =
    live
      .map((entry) => entry.design.endDate)
      .filter((date) => date >= today)
      .sort()[0] ?? null;
  const conflicts = buildConflicts(live.map((entry) => entry.design), today);

  return {
    today,
    entries,
    active: entries.filter((entry) => entry.bucket === "active"),
    upcoming: entries.filter((entry) => entry.bucket === "upcoming"),
    completed: entries.filter((entry) => entry.bucket === "completed"),
    analysed: entries.filter((entry) => entry.bucket === "analysed"),
    schedule: buildSchedule(live.map((entry) => entry.design), today),
    conflicts,
    nextAnalysisDate,
    summary: {
      active: entries.filter((entry) => entry.bucket === "active").length,
      upcoming: entries.filter((entry) => entry.bucket === "upcoming").length,
      completed: entries.filter((entry) => entry.bucket === "completed").length,
      analysed: entries.filter((entry) => entry.bucket === "analysed").length,
      conflicts: conflicts.length,
    },
  };
}

/**
 * Per-date conflict scan across live designs, matching the schedule's horizon
 * so the warnings and the rendered schedule always agree. A date with two or
 * more assigned experiments is one conflict; the same-metric flag is computed
 * here so the blocking rule (P1 #9) reads it instead of re-deriving it.
 */
function buildConflicts(designs: readonly ExperimentDesign[], today: string): CalendarConflict[] {
  if (designs.length < 2) return [];

  const byDate = new Map<string, { experimentIds: string[]; titles: string[]; metricIds: string[] }>();
  for (const design of designs) {
    for (const assignment of design.assignments) {
      if (assignment.date < today) continue;
      const entry = byDate.get(assignment.date) ?? { experimentIds: [], titles: [], metricIds: [] };
      entry.experimentIds.push(design.id);
      entry.titles.push(design.title);
      entry.metricIds.push(design.targetMetricId);
      byDate.set(assignment.date, entry);
    }
  }

  const horizon = addDays(today, MAX_SCHEDULE_DAYS);
  const conflicts: CalendarConflict[] = [];
  for (const [date, entry] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (date > horizon) continue;
    if (entry.experimentIds.length < 2) continue;
    const metricIds = [...new Set(entry.metricIds)].sort();
    conflicts.push({
      date,
      experimentIds: entry.experimentIds,
      titles: entry.titles,
      sameMetric: metricIds.length < entry.experimentIds.length,
      metricIds,
    });
  }
  return conflicts;
}

function buildSchedule(designs: readonly ExperimentDesign[], today: string): CalendarAssignment[] {
  if (designs.length === 0) return [];

  const byDate = new Map<string, CalendarAssignment[]>();
  for (const design of designs) {
    // Iterate the derived periods rather than the raw assignments: every
    // assigned date falls in exactly one period, so the rows are identical
    // and each carries its period label and day position.
    for (const period of derivePeriods(design)) {
      for (let day = 0; day < period.dayCount; day += 1) {
        const date = addDays(period.startDate, day);
        if (date < today) continue;
        const list = byDate.get(date) ?? [];
        list.push({
          date,
          experimentId: design.id,
          title: design.title,
          condition: period.condition,
          instruction:
            period.kind === "baseline"
              ? BASELINE_INSTRUCTION
              : period.kind === "washout"
                ? WASHOUT_INSTRUCTION
                : period.condition === "A"
                  ? design.conditionA.instruction
                  : design.conditionB.instruction,
          period: `${period.label} · Day ${day + 1}/${period.dayCount}`,
        });
        byDate.set(date, list);
      }
    }
  }

  const horizon = addDays(today, MAX_SCHEDULE_DAYS);
  return [...byDate.keys()]
    .sort()
    .filter((date) => date <= horizon)
    .flatMap((date) => byDate.get(date) ?? []);
}
