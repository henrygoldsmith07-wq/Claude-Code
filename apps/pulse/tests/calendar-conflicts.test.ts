/**
 * Experiment calendar conflict warnings.
 *
 * Two live experiments can silently overlap: the calendar lists both, and the
 * user is expected to notice they are being asked to do two things at once.
 * These tests pin down the warning half of that problem — per-date detection
 * that an experiment "also assigns today" — before it becomes a hard block
 * (P1 #9). The same-metric flag is the signal for the stricter rule later.
 */

import { describe, expect, it } from "vitest";
import { buildCalendar, type ExperimentCalendar } from "../src/experiments/calendar.js";
import { buildAssignments, type ExperimentDesign } from "../src/experiments/design.js";
import { addDays } from "../src/events/time.js";

const TODAY = "2025-07-15";

interface DesignSeed {
  id: string;
  title?: string;
  startDate: string;
  durationDays: number;
  targetMetricId?: string;
  type?: "crossover" | "ab" | "before-after";
}

/** Deterministic design with hand-chosen dates, so overlaps are exact. */
function design(seed: DesignSeed): ExperimentDesign {
  const type = seed.type ?? "crossover";
  const durationDays = seed.durationDays;
  const assignments = buildAssignments(type, seed.startDate, durationDays, 7, seed.id);
  return {
    id: seed.id,
    hypothesisId: `hyp-${seed.id}`,
    createdAt: "2025-07-01T00:00:00.000Z",
    type,
    title: seed.title ?? seed.id,
    hypothesis: `Hypothesis for ${seed.id}`,
    conditionA: { id: "A", label: "Intervention", instruction: "Do the behaviour under test" },
    conditionB: { id: "B", label: "Control", instruction: "Do not do the behaviour under test" },
    targetMetricId: seed.targetMetricId ?? "study.accuracy",
    minSamplePerCondition: 10,
    durationDays,
    blockDays: 7,
    startDate: seed.startDate,
    endDate: addDays(seed.startDate, durationDays - 1),
    assignments,
    likelyConfounders: [],
    analysisMethod: "Paired comparison of per-block means",
    successCriteria: "CI excludes zero",
    seed: seed.id,
    invalidations: [],
  };
}

function calendar(designs: readonly ExperimentDesign[]): ExperimentCalendar {
  return buildCalendar(designs, [], TODAY);
}

describe("calendar conflict warnings", () => {
  it("reports no conflicts when live experiments do not overlap", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-01", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-08-01", durationDays: 14 }),
    ]);
    expect(cal.conflicts).toEqual([]);
    expect(cal.summary.conflicts).toBe(0);
  });

  it("flags every shared date when two experiments run at the same time", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14 }),
    ]);
    // Overlap runs 2025-07-14..2025-07-23, but 07-14 is already past — the
    // warning is about upcoming clashes, so only 07-15..07-23 are reported.
    expect(cal.conflicts.length).toBe(9);
    expect(cal.conflicts[0]!.date).toBe("2025-07-15");
    expect(cal.conflicts[0]!.experimentIds).toEqual(["exp-a", "exp-b"]);
    expect(cal.conflicts[0]!.titles).toEqual(["exp-a", "exp-b"]);
    expect(cal.summary.conflicts).toBe(9);
  });

  it("marks the overlap as same-metric when both target the same metric", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14, targetMetricId: "study.accuracy" }),
    ]);
    expect(cal.conflicts[0]!.sameMetric).toBe(true);
    expect(cal.conflicts[0]!.metricIds).toEqual(["study.accuracy"]);
  });

  it("does not mark the overlap as same-metric when the metrics differ", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14, targetMetricId: "study.accuracy" }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14, targetMetricId: "exercise.volume" }),
    ]);
    expect(cal.conflicts[0]!.sameMetric).toBe(false);
    expect(cal.conflicts[0]!.metricIds).toEqual(["exercise.volume", "study.accuracy"]);
  });

  it("reports an overlap once per date, not once per pair", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-12", durationDays: 14 }),
      design({ id: "exp-c", startDate: "2025-07-14", durationDays: 14 }),
    ]);
    // All three overlap 07-15..07-23; exp-b and exp-c overlap on 07-24..07-25.
    expect(cal.conflicts[0]!.experimentIds).toEqual(["exp-a", "exp-b", "exp-c"]);
    expect(cal.conflicts.length).toBe(11);
    expect(cal.conflicts[10]!.date).toBe("2025-07-25");
    expect(cal.conflicts[10]!.experimentIds).toEqual(["exp-b", "exp-c"]);
    expect(cal.summary.conflicts).toBe(11);
  });

  it("warns about upcoming overlaps in the future, not only today", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-20", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-25", durationDays: 14 }),
    ]);
    expect(cal.conflicts.length).toBe(9);
    expect(cal.conflicts[0]!.date).toBe("2025-07-25");
  });

  it("ignores experiments that have already finished", () => {
    const cal = calendar([
      design({ id: "exp-past", startDate: "2025-06-01", durationDays: 14 }),
      design({ id: "exp-now", startDate: "2025-07-10", durationDays: 14 }),
    ]);
    // exp-past's assignments are all before today, so nothing overlaps.
    expect(cal.conflicts).toEqual([]);
  });

  it("exposes the conflict dates so the schedule can mark them", () => {
    const cal = calendar([
      design({ id: "exp-a", startDate: "2025-07-10", durationDays: 14 }),
      design({ id: "exp-b", startDate: "2025-07-14", durationDays: 14 }),
    ]);
    const dates = new Set(cal.conflicts.map((conflict) => conflict.date));
    // Every assignment on a conflicting date appears in the schedule.
    const scheduleDates = new Set(cal.schedule.map((entry) => entry.date));
    expect(cal.schedule.length).toBeGreaterThan(0);
    for (const date of dates) {
      expect(scheduleDates.has(date)).toBe(true);
    }
  });
});
