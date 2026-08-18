/**
 * Intervention period derivation (P1 #2).
 *
 * Conditions exist only as a flat per-day assignment; nothing names a
 * contiguous stretch of the same condition as a period. These tests pin the
 * derivation that splits the schedule into named periods — the crossover's
 * blocks, the before-after's two halves, the A/B's condition runs — so the
 * UI can say "Intervention A · Day 4/7" without storing a label that could
 * drift from the actual schedule. The derivation, not a stored label, is the
 * source of truth.
 */

import { describe, expect, it } from "vitest";
import {
  buildAssignments,
  derivePeriods,
  periodForDate,
  type ExperimentDesign,
  type ExperimentType,
} from "../src/experiments/design.js";
import { buildCalendar } from "../src/experiments/calendar.js";
import { addDays } from "../src/events/time.js";

function design(options: {
  id: string;
  type?: ExperimentType;
  startDate: string;
  durationDays: number;
  blockDays?: number;
  targetMetricId?: string;
}): ExperimentDesign {
  const type = options.type ?? "crossover";
  const blockDays = options.blockDays ?? 7;
  const assignments = buildAssignments(type, options.startDate, options.durationDays, blockDays, options.id);
  return {
    id: options.id,
    hypothesisId: `hyp-${options.id}`,
    createdAt: "2025-07-01T00:00:00.000Z",
    type,
    title: `${type} test`,
    hypothesis: `Hypothesis for ${options.id}`,
    conditionA: { id: "A", label: "Intervention", instruction: "Do the behaviour under test" },
    conditionB: { id: "B", label: "Control", instruction: "Do not do the behaviour under test" },
    targetMetricId: options.targetMetricId ?? "study.accuracy",
    minSamplePerCondition: 10,
    durationDays: options.durationDays,
    blockDays,
    startDate: options.startDate,
    endDate: addDays(options.startDate, options.durationDays - 1),
    assignments,
    likelyConfounders: [],
    analysisMethod: "Paired comparison of per-block means",
    successCriteria: "CI excludes zero",
    seed: options.id,
    invalidations: [],
  };
}

describe("derivePeriods", () => {
  it("derives one period per crossover block, alternating conditions", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-01", durationDays: 28, blockDays: 7 });
    const periods = derivePeriods(d);
    expect(periods.map((period) => period.condition)).toEqual(["A", "B", "A", "B"]);
    expect(periods.map((period) => period.dayCount)).toEqual([7, 7, 7, 7]);
    expect(periods.map((period) => period.index)).toEqual([1, 2, 3, 4]);
  });

  it("names each period with the condition's label and letter", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-01", durationDays: 14, blockDays: 7 });
    expect(derivePeriods(d).map((period) => period.label)).toEqual(["Intervention A", "Control B"]);
  });

  it("keeps period dates contiguous and covering exactly the assignments", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-01", durationDays: 28, blockDays: 7 });
    const periods = derivePeriods(d);
    expect(periods[0]!.startDate).toBe("2025-07-01");
    expect(periods[1]!.startDate).toBe("2025-07-08");
    expect(periods[3]!.endDate).toBe("2025-07-28");
    const covered = new Set(
      periods.flatMap((period) => {
        const days: string[] = [];
        for (let day = 0; day < period.dayCount; day += 1) days.push(addDays(period.startDate, day));
        return days;
      }),
    );
    expect([...covered].sort()).toEqual(d.assignments.map((assignment) => assignment.date));
  });

  it("is deterministic for the same seed", () => {
    const a = design({ id: "ab", type: "ab", startDate: "2025-07-01", durationDays: 14 });
    const b = design({ id: "ab", type: "ab", startDate: "2025-07-01", durationDays: 14 });
    expect(derivePeriods(a)).toEqual(derivePeriods(b));
  });

  it("splits before-after into exactly two periods at the midpoint", () => {
    const d = design({ id: "ba", type: "before-after", startDate: "2025-07-01", durationDays: 14 });
    const periods = derivePeriods(d);
    expect(periods.length).toBe(2);
    expect(periods[0]!.condition).toBe("B");
    expect(periods[1]!.condition).toBe("A");
    expect(periods[0]!.dayCount).toBe(7);
    expect(periods[1]!.dayCount).toBe(7);
  });

  it("gives an odd-length before-after its shorter half first", () => {
    const d = design({ id: "ba", type: "before-after", startDate: "2025-07-01", durationDays: 15 });
    const periods = derivePeriods(d);
    expect(periods[0]!.dayCount).toBe(7);
    expect(periods[1]!.dayCount).toBe(8);
  });

  it("derives A/B condition runs, covering every date exactly once", () => {
    const d = design({ id: "ab", type: "ab", startDate: "2025-07-01", durationDays: 14 });
    const periods = derivePeriods(d);
    expect(periods.length).toBeGreaterThanOrEqual(2);
    const covered = new Set(
      periods.flatMap((period) => {
        const days: string[] = [];
        for (let day = 0; day < period.dayCount; day += 1) days.push(addDays(period.startDate, day));
        return days;
      }),
    );
    expect([...covered].sort()).toEqual(d.assignments.map((assignment) => assignment.date));
    // A run ends where the condition changes, so consecutive periods always
    // carry opposite conditions.
    for (let i = 1; i < periods.length; i += 1) {
      expect(periods[i]!.condition).not.toBe(periods[i - 1]!.condition);
    }
  });

  it("handles single-day blocks", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-01", durationDays: 4, blockDays: 1 });
    const periods = derivePeriods(d);
    expect(periods.map((period) => period.dayCount)).toEqual([1, 1, 1, 1]);
    expect(periods.map((period) => period.condition)).toEqual(["A", "B", "A", "B"]);
  });
});

describe("periodForDate", () => {
  it("reports the day's position within its period", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-01", durationDays: 28, blockDays: 7 });
    const first = periodForDate(d, "2025-07-01")!;
    expect(first!.dayInPeriod).toBe(1);
    expect(first!.period.dayCount).toBe(7);
    expect(first!.period.label).toBe("Intervention A");
    const fourth = periodForDate(d, "2025-07-04")!;
    expect(fourth!.dayInPeriod).toBe(4);
    const last = periodForDate(d, "2025-07-07")!;
    expect(last!.dayInPeriod).toBe(7);
  });

  it("moves into the next period when the condition flips", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-01", durationDays: 14, blockDays: 7 });
    expect(periodForDate(d, "2025-07-07")!.period.condition).toBe("A");
    expect(periodForDate(d, "2025-07-08")!.period.condition).toBe("B");
    expect(periodForDate(d, "2025-07-08")!.dayInPeriod).toBe(1);
  });

  it("returns null for a date with no assignment", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-01", durationDays: 14, blockDays: 7 });
    expect(periodForDate(d, "2025-06-30")).toBeNull();
    expect(periodForDate(d, "2025-07-20")).toBeNull();
  });
});

describe("calendar integration", () => {
  it("carries the formatted period on every schedule entry", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-10", durationDays: 14, blockDays: 7 });
    const cal = buildCalendar([d], [], "2025-07-15");
    expect(cal.schedule.length).toBe(9); // 07-15..07-23
    expect(cal.schedule[0]!.period).toMatch(/· Day 6\/7$/); // day 6 of block one (07-10..07-16)
    expect(cal.schedule[1]!.period).toMatch(/· Day 7\/7$/);
    expect(cal.schedule[2]!.period).toMatch(/· Day 1\/7$/); // block two starts 07-17
  });

  it("marks the active entry's today period", () => {
    const d = design({ id: "cross", type: "crossover", startDate: "2025-07-10", durationDays: 14, blockDays: 7 });
    const cal = buildCalendar([d], [], "2025-07-15");
    const active = cal.active[0]!;
    expect(active.todayPeriod?.dayInPeriod).toBe(6);
    expect(active.todayPeriod?.period.label).toMatch(/^(Intervention A|Control B)$/);
  });
});
