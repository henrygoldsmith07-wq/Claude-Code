import { describe, expect, it } from "vitest";
import { buildReplicationSchedule } from "../src/discovery/replication-schedule.js";
import type { Finding } from "../src/discovery/finding.js";
import { detectInvalidExperimentDays } from "../src/experiments/data-quality.js";
import type { ExperimentDesign } from "../src/experiments/design.js";
import { MetricRegistry } from "../src/metrics/registry.js";
import { buildReliabilityProfiles } from "../src/quality/profiles.js";
import type { SourceQuality } from "../src/quality/score.js";
import type { PulseEvent } from "../src/events/schema.js";

function finding(id: string, status: Finding["replicationStatus"]): Finding {
  return {
    id,
    createdAt: "2025-07-01T00:00:00Z",
    evidenceClass: "correlation",
    replicationStatus: status,
    title: `${id} relationship`,
    statement: "A measurable relationship was observed.",
    metricIds: ["study.accuracy", "exercise.volume"],
    sources: ["revise"],
    sampleSize: 40,
    sampleDescription: "40 observations",
    effect: { kind: "hedges_g", value: 0.4, magnitude: "small", label: "+0.40 SD" },
    confidence: { level: "moderate", score: 0.6, reasons: [], limitations: [] },
    confounders: [],
    causalityNote: "This is an association, not a cause.",
    nextAction: null,
    evidence: [
      {
        kind: "events",
        description: "40 observations",
        metricIds: ["study.accuracy"],
        sources: ["revise"],
        eventCount: 40,
        dateRange: { from: "2025-06-01", to: "2025-06-30" },
      },
    ],
    tags: [],
  };
}

function event(date: string, attributes: Record<string, string | number | boolean> = {}): PulseEvent {
  return {
    id: `event-${date}`,
    schemaVersion: 2,
    source: "revise",
    sourceEventId: `source-${date}`,
    type: "revise.attempt",
    category: "study",
    occurredAt: `${date}T12:00:00Z`,
    timezone: "UTC",
    localDate: date,
    localMinutes: 720,
    localDayOfWeek: 2,
    metrics: { accuracy: 0.8 },
    attributes,
    sensitivity: "normal",
    provenance: {
      connectorId: "revise",
      connectorVersion: "1.0.0",
      syncId: "sync-test",
      ingestedAt: "2025-07-03T00:00:00Z",
      ingestMode: "synthetic",
      rawHash: `hash-${date}`,
    },
    dedupeKey: `revise:${date}`,
  };
}

function experimentDesign(): ExperimentDesign {
  return {
    id: "exp-test",
    hypothesisId: "hyp-test",
    createdAt: "2025-07-01T00:00:00Z",
    type: "ab",
    title: "Test experiment",
    hypothesis: "Practice changes accuracy.",
    conditionA: { id: "A", label: "With practice", instruction: "Practise" },
    conditionB: { id: "B", label: "Without practice", instruction: "Do not practise" },
    targetMetricId: "study.accuracy",
    minSamplePerCondition: 2,
    durationDays: 2,
    blockDays: 1,
    startDate: "2025-07-01",
    endDate: "2025-07-02",
    assignments: [
      { date: "2025-07-01", condition: "A", block: 0 },
      { date: "2025-07-02", condition: "B", block: 0 },
    ],
    likelyConfounders: [],
    analysisMethod: "test",
    successCriteria: "test",
    seed: "test",
    invalidations: [],
  };
}

describe("Pulse evidence trust layer", () => {
  it("schedules contradicted claims ahead of fresh and stable claims", () => {
    const queue = buildReplicationSchedule(
      [finding("new", "new"), finding("replicated", "replicated"), finding("conflict", "contradicted")],
      [],
      { today: "2025-07-01" },
    );

    expect(queue.map((entry) => entry.findingId)).toEqual(["conflict", "new", "replicated"]);
    expect(queue[0]?.priority).toBe("urgent");
    expect(queue[0]?.intervalDays).toBe(7);
    expect(queue[2]?.intervalDays).toBe(30);
  });

  it("flags assigned experiment days with an explicit missing-data classification", () => {
    const registry = new MetricRegistry().register({
      id: "study.accuracy",
      name: "Accuracy",
      description: "Study accuracy",
      category: "study",
      source: "revise",
      eventTypes: ["revise.attempt"],
      metricKey: "accuracy",
      unit: "percent",
      aggregation: "mean",
      direction: "higher-better",
      role: "outcome",
      minSampleForInsight: 1,
    });

    const invalidDays = detectInvalidExperimentDays(experimentDesign(), [event("2025-07-01")], registry);

    expect(invalidDays).toEqual([
      { date: "2025-07-02", condition: "B", reason: "missing-measurement", defaultClassification: "connector-gap" },
    ]);
  });

  it("keeps source reliability separate from unattributed device reliability", () => {
    const quality: SourceQuality = {
      source: "revise",
      score: 0.82,
      grade: "good",
      dimensions: [
        { id: "completeness", score: 0.9, explanation: "Complete" },
        { id: "freshness", score: 0.8, explanation: "Fresh" },
      ],
      issues: [],
      eventCount: 2,
      firstEventDate: "2025-07-01",
      lastEventDate: "2025-07-02",
      daysWithData: 2,
      coverageDays: 2,
    };

    const profiles = buildReliabilityProfiles([quality], [event("2025-07-01"), event("2025-07-02", { origin_device: "band-a" })]);

    expect(profiles.sources[0]?.status).toBe("strong");
    expect(profiles.devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "source:revise", status: "unrated" }),
        expect.objectContaining({ id: "band-a", status: "strong" }),
      ]),
    );
  });
});
