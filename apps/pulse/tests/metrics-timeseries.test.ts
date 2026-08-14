/**
 * Metrics and time-series analysis.
 *
 * The missing-data tests deserve special mention: the difference between "you
 * did not study" and "we have no record of you studying" is the difference
 * between a real trend and an artefact of a broken sync, and it is handled
 * explicitly rather than by zero-filling everything.
 */

import { describe, expect, it } from "vitest";
import { createDefaultRegistry, DEFAULT_METRICS } from "../src/metrics/catalogue.js";
import { deriveDefinitions, MetricRegistry } from "../src/metrics/registry.js";
import {
  aggregate,
  alignSeries,
  dailySeries,
  dropMissing,
  groupByAttribute,
  observationsFor,
  timeBucket,
  type DailySeries,
  type MetricObservation,
} from "../src/metrics/compute.js";
import { analyseTrend, mannKendall, theilSenSlope, weekOverWeek } from "../src/timeseries/trend.js";
import { detectAnomalies, rollingBaseline, summariseStreaks } from "../src/timeseries/baseline.js";
import { crossCorrelate, doseResponseWithinWindow, splitByExposureWindow } from "../src/timeseries/lag.js";
import { buildTimeline, eventsAround } from "../src/timeseries/timeline.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import { createRng, normalDeviate } from "../src/statistics/random.js";
import { addDays, eachLocalDate } from "../src/events/time.js";
import type { PulseEvent } from "../src/events/schema.js";

const registry = createDefaultRegistry();
const NOW = Date.parse("2025-07-01T12:00:00Z");
const clock = (): number => NOW;

const ctx: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "s",
  ingestMode: "live",
  timezone: "UTC",
  now: clock,
};

function attempt(date: string, accuracy: number, hour = 15, index = 0): PulseEvent {
  return normaliseEvent(
    {
      source: "revise",
      sourceEventId: `${date}-${hour}-${index}`,
      type: "revise.attempt",
      category: "study",
      occurredAt: `${date}T${String(hour).padStart(2, "0")}:0${index}:00Z`,
      metrics: { accuracy, marks_awarded: accuracy * 10, marks_available: 10, response_ms: 120_000 },
      attributes: { method: "practice", subject_id: "physics" },
    },
    ctx,
  );
}

function series(values: (number | null)[], from = "2025-01-01"): DailySeries {
  return {
    metricId: "test.metric",
    aggregation: "mean",
    dates: values.map((_, i) => addDays(from, i)),
    values: values.map((value) => (value === null ? NaN : value)),
    counts: values.map((value) => (value === null ? 0 : 1)),
  };
}

describe("metric registry", () => {
  it("registers, rejects duplicates and looks up by role", () => {
    const local = new MetricRegistry();
    local.register(DEFAULT_METRICS[0]!);
    expect(() => local.register(DEFAULT_METRICS[0]!)).toThrow(/already registered/);
    expect(registry.byRole("outcome").length).toBeGreaterThan(0);
    expect(registry.bySource("revise").length).toBeGreaterThan(3);
    expect(() => registry.require("nope")).toThrow(/Unknown metric/);
  });

  it("recognises trivially related metric pairs", () => {
    expect(registry.isTrivialPair("study.accuracy", "study.marks_awarded")).toBe(true);
    expect(registry.isTrivialPair("exercise.volume", "exercise.sets")).toBe(true);
    expect(registry.isTrivialPair("study.accuracy", "exercise.volume")).toBe(false);
  });

  it("reports only the metrics the data can actually support", () => {
    const events = [attempt("2025-01-01", 0.7)];
    const available = registry.available(events).map((definition) => definition.id);
    expect(available).toContain("study.accuracy");
    expect(available).not.toContain("wellbeing.readiness");
  });

  it("derives conservative definitions from a connector's declared output", () => {
    const derived = deriveDefinitions({
      id: "custom",
      name: "Custom",
      version: "1.0.0",
      category: "study",
      description: "",
      scopes: [],
      emits: [{ type: "custom.thing", category: "study", description: "A thing", metrics: [{ key: "score", unit: "score", description: "" }] }],
      async fetch() {
        return { records: [], cursor: null, hasMore: false };
      },
    });
    // A third-party connector's metrics start as context, never as outcomes.
    expect(derived[0]!.role).toBe("context");
    expect(derived[0]!.direction).toBe("neutral");
  });
});

describe("metric computation and missing data", () => {
  const definition = registry.require("study.accuracy");

  it("aggregates per local day using the declared aggregation", () => {
    const events = [attempt("2025-01-01", 0.6, 9), attempt("2025-01-01", 0.8, 15, 1), attempt("2025-01-03", 0.5)];
    const computed = dailySeries(events, definition);
    expect(computed.dates).toEqual(["2025-01-01", "2025-01-03"]);
    expect(computed.values[0]).toBeCloseTo(0.7, 10);
    expect(computed.counts[0]).toBe(2);
  });

  it("marks a day with no data as missing, not as zero, for a mean metric", () => {
    const events = [attempt("2025-01-01", 0.6), attempt("2025-01-03", 0.8)];
    const computed = dailySeries(events, definition, { fillGaps: true });
    expect(computed.dates).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
    expect(Number.isNaN(computed.values[1]!)).toBe(true);
    expect(computed.counts[1]).toBe(0);
  });

  it("zero-fills a day with no data for a summed metric, because zero is the truth", () => {
    const minutes = registry.require("study.session_minutes");
    const events = [
      normaliseEvent(
        { source: "revise", sourceEventId: "s1", type: "revise.session", category: "study", occurredAt: "2025-01-01T15:00:00Z", metrics: { duration_minutes: 30, items_completed: 10, throughput_per_minute: 0.33 } },
        ctx,
      ),
      normaliseEvent(
        { source: "revise", sourceEventId: "s2", type: "revise.session", category: "study", occurredAt: "2025-01-03T15:00:00Z", metrics: { duration_minutes: 45, items_completed: 12, throughput_per_minute: 0.27 } },
        ctx,
      ),
    ];
    const computed = dailySeries(events, minutes, { fillGaps: true });
    expect(computed.values[1]).toBe(0);
  });

  it("excludes values outside a metric's declared range", () => {
    const bad = normaliseEvent(
      { source: "revise", sourceEventId: "bad", type: "revise.attempt", category: "study", occurredAt: "2025-01-02T15:00:00Z", metrics: { accuracy: 4 } },
      ctx,
    );
    expect(observationsFor([attempt("2025-01-01", 0.7), bad], definition)).toHaveLength(1);
  });

  it("aligns two series only on days where both have real data", () => {
    const a = series([1, null, 3, 4]);
    const b = series([10, 20, null, 40]);
    const aligned = alignSeries(a, b);
    expect(aligned.dates).toEqual(["2025-01-01", "2025-01-04"]);
    expect(aligned.a).toEqual([1, 4]);
    expect(aligned.b).toEqual([10, 40]);
  });

  it("shifts the second series when aligning at a lag", () => {
    const a = series([1, 2, 3, 4]);
    const b = series([10, 20, 30, 40]);
    const aligned = alignSeries(a, b, 1);
    expect(aligned.a).toEqual([1, 2, 3]);
    expect(aligned.b).toEqual([20, 30, 40]);
  });

  it("drops missing days while keeping dates aligned", () => {
    const { dates, values } = dropMissing(series([1, null, 3]));
    expect(dates).toEqual(["2025-01-01", "2025-01-03"]);
    expect(values).toEqual([1, 3]);
  });

  it("aggregates by every supported method", () => {
    const values = [1, 2, 3, 4];
    expect(aggregate(values, "mean")).toBe(2.5);
    expect(aggregate(values, "median")).toBe(2.5);
    expect(aggregate(values, "sum")).toBe(10);
    expect(aggregate(values, "count")).toBe(4);
    expect(aggregate(values, "max")).toBe(4);
    expect(aggregate(values, "min")).toBe(1);
    expect(aggregate([], "mean")).toBeNaN();
  });

  it("buckets local minutes into named parts of the day", () => {
    expect(timeBucket(30)).toBe("night");
    expect(timeBucket(8 * 60)).toBe("early-morning");
    expect(timeBucket(10 * 60)).toBe("morning");
    expect(timeBucket(14 * 60)).toBe("afternoon");
    expect(timeBucket(19 * 60)).toBe("evening");
    expect(timeBucket(23 * 60)).toBe("night");
  });

  it("groups observations by an attribute", () => {
    const events = [attempt("2025-01-01", 0.7), attempt("2025-01-02", 0.5)];
    const groups = groupByAttribute(observationsFor(events, definition), "method");
    expect(groups.get("practice")).toHaveLength(2);
    expect(groups.get("paper")).toBeUndefined();
  });
});

describe("trend analysis", () => {
  it("computes a Theil-Sen slope robust to a single wild point", () => {
    const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const clean = x.map((value) => 2 * value + 1);
    const withOutlier = [...clean];
    withOutlier[5] = 500;
    expect(theilSenSlope(x, clean)).toBeCloseTo(2, 10);
    expect(theilSenSlope(x, withOutlier)).toBeCloseTo(2, 1);
  });

  it("detects a monotone trend with Mann-Kendall and reports none in noise", () => {
    expect(mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).pValue).toBeLessThan(0.01);
    expect(mannKendall([5, 5, 5, 5, 5, 5]).pValue).toBe(1);
    const rng = createRng("flat");
    const noise = Array.from({ length: 40 }, () => normalDeviate(rng, 0, 1));
    expect(mannKendall(noise).pValue).toBeGreaterThan(0.05);
  });

  it("calls a rising series rising and a noisy one flat", () => {
    const rising = analyseTrend(series(Array.from({ length: 30 }, (_, i) => 0.5 + i * 0.01)));
    expect(rising.direction).toBe("rising");
    expect(rising.slopePerDay).toBeCloseTo(0.01, 6);
    expect(rising.slopePerWeek).toBeCloseTo(0.07, 6);
    expect(rising.slopeCi.low).toBeLessThanOrEqual(rising.slopePerDay);

    const rng = createRng("noisy-trend");
    const flat = analyseTrend(series(Array.from({ length: 40 }, () => normalDeviate(rng, 0.6, 0.1))));
    expect(flat.direction).toBe("flat");
  });

  it("declines to report a trend on too few points", () => {
    const result = analyseTrend(series([1, 2, 3]));
    expect(result.insufficient).toMatch(/at least/);
    expect(result.direction).toBe("unclear");
  });

  it("measures elapsed days, so gaps do not compress a trend", () => {
    const sparse: DailySeries = {
      metricId: "m",
      aggregation: "mean",
      dates: ["2025-01-01", "2025-01-02", "2025-02-01", "2025-02-02", "2025-03-01", "2025-03-02", "2025-04-01", "2025-04-02"],
      values: [1, 1, 2, 2, 3, 3, 4, 4],
      counts: [1, 1, 1, 1, 1, 1, 1, 1],
    };
    const result = analyseTrend(sparse);
    // Roughly one unit per month, not one unit per two observations.
    expect(result.slopePerDay).toBeLessThan(0.1);
    expect(result.direction).toBe("rising");
  });

  it("judges a weekly change against typical variability, not against last week", () => {
    const dates = eachLocalDate("2025-01-06", "2025-03-02");
    const values = dates.map((_, i) => (i >= 49 ? 0.9 : 0.6));
    const weekly: DailySeries = { metricId: "m", aggregation: "mean", dates, values, counts: dates.map(() => 1) };
    const current = eachLocalDate("2025-02-24", "2025-03-02");
    const previous = eachLocalDate("2025-02-17", "2025-02-23");
    const prior = [1, 2, 3, 4, 5].map((n) => eachLocalDate(addDays("2025-02-24", -7 * n), addDays("2025-03-02", -7 * n)));

    const change = weekOverWeek(weekly, current, previous, prior);
    expect(change.currentMean).toBeCloseTo(0.9, 6);
    expect(change.typicalMean).toBeCloseTo(0.6, 6);
    expect(change.notable).toBe(true);
  });
});

describe("baselines and anomalies", () => {
  it("compares each day only against days before it", () => {
    const values = Array.from({ length: 40 }, (_, i) => (i === 39 ? 10 : 1));
    const points = rollingBaseline(series(values), { minObservations: 5 });
    // The spike itself must not be inside the window it is judged against.
    expect(points[points.length - 1]!.expected).toBeCloseTo(1, 6);
    expect(points[points.length - 1]!.robustZ).toBeGreaterThan(3);
  });

  it("emits no baseline until the window is deep enough", () => {
    const points = rollingBaseline(series([1, 2, 3, 4]), { minObservations: 5 });
    expect(points.every((point) => Number.isNaN(point.expected))).toBe(true);
  });

  it("detects a genuine spike and ignores ordinary variation", () => {
    const rng = createRng("anomaly");
    const values = Array.from({ length: 60 }, () => normalDeviate(rng, 10, 1));
    values[55] = 40;
    const anomalies = detectAnomalies(series(values), { minObservations: 10, threshold: 3 });
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]!.direction).toBe("above");
    expect(anomalies[0]!.severity).toBe("extreme");
  });

  it("does not flag a weekly rhythm as anomalous when day-of-week adjusted", () => {
    // Weekends are systematically lower; that is a rhythm, not an anomaly.
    const dates = eachLocalDate("2025-01-06", "2025-03-31");
    const values = dates.map((date) => {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      return dow === 0 || dow === 6 ? 2 : 10;
    });
    const rhythm: DailySeries = { metricId: "m", aggregation: "mean", dates, values, counts: dates.map(() => 1) };

    const naive = detectAnomalies(rhythm, { minObservations: 5, threshold: 3 });
    const adjusted = detectAnomalies(rhythm, { minObservations: 5, threshold: 3, dayOfWeekAdjusted: true });
    expect(adjusted.length).toBeLessThan(naive.length);

    // The adjustment needs five of the same weekday before it can engage, so
    // the first five weeks legitimately fall back to the pooled baseline.
    // After that the rhythm must be recognised as a rhythm.
    const warmUpEnds = addDays(dates[0]!, 5 * 7);
    expect(adjusted.filter((anomaly) => anomaly.date > warmUpEnds)).toHaveLength(0);
    expect(naive.filter((anomaly) => anomaly.date > warmUpEnds).length).toBeGreaterThan(0);
  });

  it("summarises streaks, gaps and consistency", () => {
    const summary = summariseStreaks(series([1, 1, 1, null, null, 1, 1]));
    expect(summary.longestStreak).toBe(3);
    expect(summary.longestGap).toBe(2);
    expect(summary.activeDays).toBe(5);
    expect(summary.consistency).toBeCloseTo(5 / 7, 6);
  });

  it("returns an empty summary rather than throwing on no data", () => {
    expect(summariseStreaks(series([])).activeDays).toBe(0);
  });
});

describe("lag analysis", () => {
  function observation(at: string, value: number, estimated = false): MetricObservation {
    return {
      metricId: "study.accuracy",
      value,
      at,
      localDate: at.slice(0, 10),
      localMinutes: Number(at.slice(11, 13)) * 60,
      localDayOfWeek: 1,
      eventId: at + value,
      source: "revise",
      eventType: "revise.attempt",
      attributes: estimated ? { time_estimated: true } : {},
    };
  }

  it("splits outcomes by whether an exposure preceded them inside the window", () => {
    const exposures = [observation("2025-01-01T08:00:00Z", 1)];
    const outcomes = [
      observation("2025-01-01T10:00:00Z", 0.8), // 2h after
      observation("2025-01-01T14:00:00Z", 0.7), // 6h after
      observation("2025-01-02T09:00:00Z", 0.6), // next day
    ];
    const split = splitByExposureWindow(outcomes, exposures, { windowHours: 4 });
    expect(split.exposed).toHaveLength(1);
    expect(split.unexposed).toHaveLength(2);
    expect(split.hoursSinceExposure[0]).toBeCloseTo(2, 6);
  });

  it("never counts an outcome that came before its exposure", () => {
    const exposures = [observation("2025-01-01T12:00:00Z", 1)];
    const outcomes = [observation("2025-01-01T10:00:00Z", 0.8)];
    // Dropped entirely: it predates the first exposure.
    const split = splitByExposureWindow(outcomes, exposures, { windowHours: 4 });
    expect(split.exposed).toHaveLength(0);
    expect(split.unexposed).toHaveLength(0);
  });

  it("excludes outcomes whose timestamp was assumed rather than recorded", () => {
    const exposures = [observation("2025-01-01T08:00:00Z", 1)];
    const outcomes = [observation("2025-01-01T10:00:00Z", 0.8, true)];
    const split = splitByExposureWindow(outcomes, exposures, { windowHours: 4 });
    expect(split.excludedEstimatedTime).toBe(1);
    expect(split.exposed).toHaveLength(0);
  });

  it("finds the lag at which two series line up", () => {
    const driver = series(Array.from({ length: 60 }, (_, i) => Math.sin(i / 3)));
    const follower = series(Array.from({ length: 60 }, (_, i) => Math.sin((i - 2) / 3)));
    const result = crossCorrelate(driver, follower, { maxLagDays: 4, minPairs: 10 });
    expect(result.best?.lagDays).toBe(2);
    expect(Math.abs(result.best!.correlation.r)).toBeGreaterThan(0.9);
    expect(result.lagsTested).toBeGreaterThan(1);
  });

  it("returns nothing when the two series barely overlap", () => {
    const a = series([1, 2, 3]);
    const b = series([1, 2, 3], "2026-01-01");
    expect(crossCorrelate(a, b, { minPairs: 10 }).best).toBeNull();
  });

  it("checks whether an effect fades as the gap grows", () => {
    const exposures = [observation("2025-01-01T06:00:00Z", 1)];
    const outcomes = Array.from({ length: 12 }, (_, i) =>
      observation(`2025-01-01T${String(7 + i).padStart(2, "0")}:00:00Z`, 1 - i * 0.05),
    );
    const split = splitByExposureWindow(outcomes, exposures, { windowHours: 24 });
    const dose = doseResponseWithinWindow(split);
    expect(dose!.r).toBeLessThan(-0.9);
  });
});

describe("timeline", () => {
  it("groups events by local day with provenance intact", () => {
    const timeline = buildTimeline([attempt("2025-01-01", 0.7), attempt("2025-01-01", 0.8, 16, 1), attempt("2025-01-03", 0.6)]);
    expect(timeline.days).toHaveLength(2);
    expect(timeline.days[0]!.totalEvents).toBe(2);
    expect(timeline.days[0]!.entries[0]!.provenance.connectorId).toBe("revise");
    expect(timeline.totalEvents).toBe(3);
  });

  it("can show empty days, so gaps are visible rather than inferred", () => {
    const timeline = buildTimeline([attempt("2025-01-01", 0.7), attempt("2025-01-04", 0.6)], { includeEmptyDays: true });
    expect(timeline.days).toHaveLength(4);
    expect(timeline.days[1]!.totalEvents).toBe(0);
  });

  it("withholds sensitive events by default", () => {
    const sensitive = normaliseEvent(
      { source: "reflect", sourceEventId: "r", type: "reflect.entry", category: "reflection", occurredAt: "2025-01-01T21:00:00Z", metrics: { mood: 6 }, sensitivity: "sensitive" },
      { ...ctx, connectorId: "reflect" },
    );
    expect(buildTimeline([attempt("2025-01-01", 0.7), sensitive]).totalEvents).toBe(1);
    expect(buildTimeline([attempt("2025-01-01", 0.7), sensitive], { includeSensitive: true }).totalEvents).toBe(2);
  });

  it("finds what was happening around a moment", () => {
    const events = [attempt("2025-01-01", 0.7, 9), attempt("2025-01-01", 0.8, 15, 1), attempt("2025-01-02", 0.6, 15)];
    expect(eventsAround(events, "2025-01-01T15:00:00Z", 3)).toHaveLength(1);
    expect(eventsAround(events, "2025-01-01T15:00:00Z", 12)).toHaveLength(2);
  });
});
