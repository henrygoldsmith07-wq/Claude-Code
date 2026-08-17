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
import type { ExperimentDesign } from "./design.js";

export type CalendarBucket = "active" | "upcoming" | "completed" | "analysed";

export interface CalendarEntry {
  design: ExperimentDesign;
  bucket: CalendarBucket;
  /** Condition assigned to `today`, when the experiment is active. */
  todayCondition: "A" | "B" | null;
  todayInstruction: string | null;
  result: ExperimentResult | null;
  /** Days until the run ends; negative once it has overrun. */
  daysRemaining: number;
}

export interface CalendarAssignment {
  date: string;
  experimentId: string;
  title: string;
  condition: "A" | "B";
  instruction: string;
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
    return {
      design,
      bucket,
      todayCondition: assignment?.condition ?? null,
      todayInstruction: assignment
        ? assignment.condition === "A"
          ? design.conditionA.instruction
          : design.conditionB.instruction
        : null,
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
    for (const assignment of design.assignments) {
      if (assignment.date < today) continue;
      const list = byDate.get(assignment.date) ?? [];
      list.push({
        date: assignment.date,
        experimentId: design.id,
        title: design.title,
        condition: assignment.condition,
        instruction: assignment.condition === "A" ? design.conditionA.instruction : design.conditionB.instruction,
      });
      byDate.set(assignment.date, list);
    }
  }

  const horizon = addDays(today, MAX_SCHEDULE_DAYS);
  return [...byDate.keys()]
    .sort()
    .filter((date) => date <= horizon)
    .flatMap((date) => byDate.get(date) ?? []);
}
