import { describe, expect, it } from "vitest";
import { addDays } from "../src/events/time.js";
import type { DailySeries } from "../src/metrics/compute.js";
import {
  adjustForWeekdayWeekend,
  contextAwareBaseline,
  contextLabelsForDate,
  detectBaselineDrift,
  detectCarryover,
  detectChangePoints,
  distributedLagModel,
  seasonalAdjustment,
} from "../src/timeseries/context.js";

function series(values: number[], start = "2025-01-06"): DailySeries {
  return {
    metricId: "metric",
    aggregation: "mean",
    dates: values.map((_, index) => addDays(start, index)),
    values,
    counts: values.map(() => 1),
  };
}

describe("P1 temporal safeguards", () => {
  it("recognises travel, illness, school, work and holiday contexts", () => {
    const labels = contextLabelsForDate("2025-07-12", {
      travel: "London",
      illness: true,
      school: "term",
      work: true,
      holiday: true,
    });
    expect(labels).toEqual(expect.arrayContaining(["travel", "travel:london", "illness", "school", "work", "holiday", "weekend"]));
  });

  it("uses matching personal context before pooled history", () => {
    const values = Array.from({ length: 20 }, (_, index) => (index < 10 ? 100 : 101));
    const dates = values.map((_, index) => addDays("2025-06-01", index));
    const contexts = new Map(dates.map((date) => [date, "travel"]));
    const points = contextAwareBaseline({ ...series(values, "2025-06-01"), dates }, contexts, { minObservations: 3, windowDays: 30 });
    const last = points.at(-1)!;
    expect(last.baselineSource).toBe("context");
    expect(last.expected).toBeCloseTo(100.5);
    expect(last.contexts).toContain("travel");
  });

  it("detects baseline drift and robust mean change points", () => {
    const values = [...Array.from({ length: 20 }, () => 10), ...Array.from({ length: 20 }, () => 30)];
    const input = series(values);
    expect(detectBaselineDrift(input, { windowDays: 14, minObservations: 5, lookbackPoints: 4, threshold: 1.5 }).length).toBeGreaterThan(0);
    const changes = detectChangePoints(input, { minSegmentLength: 5, threshold: 1 });
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0]!.date).toBe(addDays("2025-01-06", 20));
  });

  it("removes weekday/weekend and seasonal level effects", () => {
    const values = Array.from({ length: 14 }, (_, index) => (index % 7 === 5 || index % 7 === 6 ? 20 : 10));
    const input = series(values);
    const adjusted = adjustForWeekdayWeekend(input);
    expect(adjusted.effects.weekend!).toBeGreaterThan(adjusted.effects.weekday!);
    expect(adjusted.series.values[5]!).toBeCloseTo(adjusted.series.values[6]!);

    const seasonal = seasonalAdjustment(input, { periodDays: 7 });
    expect(Object.keys(seasonal.effects)).toHaveLength(7);
  });

  it("models lag and detects multi-day carryover", () => {
    const exposureValues = Array.from({ length: 40 }, (_, index) => (index * 17) % 11);
    const outcomeValues = exposureValues.map((_, index) => {
      const lagOne = exposureValues[index - 1] ?? 0;
      const lagTwo = exposureValues[index - 2] ?? 0;
      return lagOne * 0.8 + lagTwo * 0.6;
    });
    const model = distributedLagModel(series(exposureValues), series(outcomeValues), { maxLagDays: 5, minPairs: 14 });
    expect(model.points.length).toBeGreaterThan(2);
    expect(model.best).not.toBeNull();
    const carryover = detectCarryover(model, { minimumSupportingLags: 2, minimumAbsoluteCorrelation: 0.2 });
    expect(carryover.detected).toBe(true);
    expect(carryover.supportingLags.length).toBeGreaterThanOrEqual(2);
  });
});
