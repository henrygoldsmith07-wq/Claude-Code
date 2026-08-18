import { describe, expect, it } from "vitest";
import type { PulseEvent } from "../src/events/schema.js";
import { MetricRegistry, type MetricDefinition } from "../src/metrics/registry.js";
import { buildStatisticalInspection } from "../src/statistics/inspector.js";

const outcomeDefinition: MetricDefinition = {
  id: "test.outcome",
  name: "Outcome",
  description: "Test outcome",
  category: "study",
  source: "revise",
  eventTypes: ["revise.attempt"],
  metricKey: "outcome",
  unit: "score",
  aggregation: "mean",
  direction: "higher-better",
  role: "outcome",
  minSampleForInsight: 5,
};

const exposureDefinition: MetricDefinition = {
  id: "test.exposure",
  name: "Exposure",
  description: "Test exposure",
  category: "exercise",
  source: "revise",
  eventTypes: ["revise.attempt"],
  metricKey: "exposure",
  unit: "score",
  aggregation: "mean",
  direction: "neutral",
  role: "behaviour",
  minSampleForInsight: 5,
};

const negativeControlDefinition: MetricDefinition = {
  id: "test.negative",
  name: "Negative control",
  description: "Test negative control",
  category: "schedule",
  source: "revise",
  eventTypes: ["revise.attempt"],
  metricKey: "negative",
  unit: "score",
  aggregation: "mean",
  direction: "neutral",
  role: "context",
  minSampleForInsight: 5,
};

function dateFor(index: number): string {
  const date = new Date(Date.UTC(2025, 0, 1 + index));
  return date.toISOString().slice(0, 10);
}

function event(index: number, estimated = false): PulseEvent {
  const date = dateFor(index);
  return {
    id: `event-${index}`,
    schemaVersion: 2,
    source: "revise",
    sourceEventId: `source-${index}`,
    type: "revise.attempt",
    category: "study",
    occurredAt: `${date}T12:00:00Z`,
    timezone: "UTC",
    localDate: date,
    localMinutes: 720,
    localDayOfWeek: new Date(`${date}T12:00:00Z`).getUTCDay(),
    metrics: {
      outcome: 50 + index * 0.8 + (index % 3),
      exposure: index,
      negative: index % 2,
    },
    attributes: estimated ? { time_estimated: true, timestamp_uncertainty_minutes: 120 } : {},
    sensitivity: "normal",
    provenance: {
      connectorId: "revise",
      connectorVersion: "1.0.0",
      syncId: "sync-test",
      ingestedAt: "2025-02-01T00:00:00Z",
      ingestMode: "synthetic",
      rawHash: `hash-${index}`,
    },
    dedupeKey: `revise:${index}`,
  };
}

function registry(): MetricRegistry {
  return new MetricRegistry().registerAll([outcomeDefinition, exposureDefinition, negativeControlDefinition]);
}

describe("user-controlled statistical inspector", () => {
  it("reports the selected pair, controls, holdout and robustness diagnostics", () => {
    const report = buildStatisticalInspection(
      {
        events: Array.from({ length: 30 }, (_, index) => event(index)),
        registry: registry(),
        findings: [
          {
            id: "existing-finding",
            createdAt: "2025-01-30T00:00:00Z",
            evidenceClass: "correlation",
            title: "Existing finding",
            statement: "An association was observed.",
            metricIds: [outcomeDefinition.id, exposureDefinition.id],
            sources: ["revise"],
            sampleSize: 30,
            sampleDescription: "30 days",
            effect: { kind: "pearson_r", value: 0.5, magnitude: "moderate", label: "r = 0.50" },
            test: { name: "pearson", statistic: 2, pValue: 0.02 },
            confidence: { level: "low", score: 0.4, reasons: [], limitations: [] },
            confounders: [],
            causalityNote: "This is an association, not a cause.",
            nextAction: null,
            evidence: [],
            tags: [],
          },
        ],
      },
      {
        outcomeMetricId: outcomeDefinition.id,
        exposureMetricId: exposureDefinition.id,
        negativeControlMetricId: negativeControlDefinition.id,
        correction: "holm",
        alpha: 0.05,
        autocorrelationLag: 5,
        holdoutFraction: 0.2,
        adjustForWeekday: true,
        adjustForTrend: true,
        reliabilityWeighting: true,
      },
    );

    expect(report.pairedDays).toBe(30);
    expect(report.primary.spearman?.n).toBe(30);
    expect(report.primary.autocorrelation?.maxLag).toBe(5);
    expect(report.primary.lags.map((lag) => lag.lagDays)).toEqual([0, 1, 2, 3]);
    expect(report.correction.method).toBe("holm");
    expect(report.correction.familySize).toBe(5);
    expect(report.holdout.trainDays).toBe(23);
    expect(report.holdout.holdoutDays).toBe(7);
    expect(report.robustness.negativeControl?.metric.id).toBe(negativeControlDefinition.id);
    expect(report.checks.map((check) => check.id)).toEqual([
      "minimum-sample",
      "multiple-testing",
      "autocorrelation",
      "lag-scan",
      "holdout",
      "outliers",
      "stability",
      "confounders",
      "negative-control",
      "reliability",
      "timestamps",
    ]);
  });

  it("makes timestamp exclusion visible instead of silently changing the sample", () => {
    const report = buildStatisticalInspection(
      { events: Array.from({ length: 30 }, (_, index) => event(index, index === 0)), registry: registry() },
      {
        outcomeMetricId: outcomeDefinition.id,
        exposureMetricId: exposureDefinition.id,
        excludeUncertainTimestamps: true,
      },
    );

    expect(report.pairedDays).toBe(29);
    expect(report.robustness.timestamps.uncertainDays).toBe(1);
    expect(report.robustness.timestamps.excludedDays).toBe(1);
    expect(report.checks.find((check) => check.id === "timestamps")?.summary).toMatch(/Excluded 1/);
  });

  it("returns honest not-available diagnostics for a thin series", () => {
    const report = buildStatisticalInspection(
      { events: [event(0), event(1)], registry: registry() },
      { outcomeMetricId: outcomeDefinition.id, exposureMetricId: exposureDefinition.id },
    );

    expect(report.sampleGate.sufficient).toBe(false);
    expect(report.primary.spearman?.insufficient).toMatch(/at least 3/);
    expect(report.robustness.outliers).toBeNull();
    expect(report.limitations).toEqual(expect.arrayContaining([expect.stringMatching(/minimum sample thresholds/)]));
  });
});
