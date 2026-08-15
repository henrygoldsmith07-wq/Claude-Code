/**
 * The differentiation layer: replication status, experiment calendar,
 * recommendation value, automatic wearable collection, the longitudinal
 * benchmark, and uncertainty made legible.
 *
 * These are the six things that separate Pulse from a correlation slot
 * machine. Each is tested in isolation, and the benchmark is tested against
 * known ground truth the way the discovery suite is.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { ReplicationLedger } from "../src/discovery/replication.js";
import { buildCalendar } from "../src/experiments/calendar.js";
import { designExperiment } from "../src/experiments/design.js";
import { HypothesisTracker } from "../src/hypotheses/tracker.js";
import type { ExperimentResult } from "../src/experiments/analysis.js";
import { RecommendationValueTracker } from "../src/recommendations/value.js";
import { createWearableConnector, mapWearableRecord, type WearableDailyRecord } from "../src/connectors/wearable.js";
import { checkContract, createArrayReader } from "../src/connectors/sdk.js";
import { uncertaintySummary } from "../src/statistics/confidence.js";
import { runLongitudinalBenchmark, type LongitudinalBenchmarkResult } from "../src/synthetic/benchmark.js";
import type { Finding } from "../src/discovery/finding.js";

const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f1",
    createdAt: "2025-06-30T00:00:00Z",
    evidenceClass: "correlation",
    title: "Question accuracy is higher within 4h of training",
    statement: "Across 300 observations, question accuracy within 4h of training was 8.7% higher.",
    metricIds: ["study.accuracy", "exercise.volume"],
    sources: ["revise", "arise"],
    sampleSize: 300,
    sampleDescription: "120 within window vs 180 outside",
    effect: { kind: "hedges_g", value: 0.45, magnitude: "small", label: "+0.45 SD" },
    confidence: { level: "moderate", score: 0.6, reasons: [], limitations: [] },
    confounders: [],
    causalityNote: "This is an association, not a cause.",
    nextAction: { kind: "run-experiment", summary: "Run an experiment", rationale: "Under your control.", effortHours: 2 },
    evidence: [
      { kind: "events", description: "300 attempts", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 300, dateRange: null },
    ],
    tags: ["exposure-window"],
    ...overrides,
  };
}

describe("replication ledger", () => {
  it("defaults a first sighting to 'new'", () => {
    const ledger = new ReplicationLedger(clock);
    const [annotated] = ledger.annotate([finding({ id: "a" })]);
    expect(annotated!.replicationStatus).toBe("new");
  });

  it("marks a later discovery with the same signature as replicated, in both directions", () => {
    const ledger = new ReplicationLedger(clock);
    ledger.annotate([finding({ id: "a" })]);
    const [later] = ledger.annotate([finding({ id: "b" })]);
    expect(later!.replicationStatus).toBe("replicated");
    expect(ledger.statusOf("a")).toBe("replicated");
    expect(ledger.statusOf("b")).toBe("replicated");
  });

  it("does not replicate a claim that runs the opposite direction", () => {
    const ledger = new ReplicationLedger(clock);
    ledger.annotate([finding({ id: "a" })]);
    const [later] = ledger.annotate([
      finding({ id: "b", effect: { kind: "hedges_g", value: -0.45, magnitude: "small", label: "-0.45 SD" } }),
    ]);
    expect(later!.replicationStatus).toBe("new");
  });

  it("records experiment verdicts as terminal replication states", () => {
    const ledger = new ReplicationLedger(clock);
    expect(ledger.recordExperimentResult("a", "supported")).toBe("experimentally-supported");
    expect(ledger.recordExperimentResult("b", "refuted")).toBe("failed-to-replicate");
    expect(ledger.recordExperimentResult("c", "inconclusive")).toBe("new");
  });

  it("prunes records whose findings were deleted", () => {
    const ledger = new ReplicationLedger(clock);
    ledger.annotate([finding({ id: "a" }), finding({ id: "b", metricIds: ["study.recall_grade"] })]);
    ledger.prune(new Set(["a"]));
    expect(ledger.statusOf("b")).toBe("new");
    expect(ledger.size()).toBe(1);
    expect(ledger.statusOf("a")).toBe("new");
  });
});

describe("experiment calendar", () => {
  const hypothesis = new HypothesisTracker(clock).proposeFromFinding(finding())!;
  const design = designExperiment(hypothesis, { startDate: "2025-07-01", now: clock });

  const result: ExperimentResult = {
    experimentId: design.id,
    hypothesisId: hypothesis.id,
    analysedAt: "2025-07-20T00:00:00Z",
    verdict: "supported",
    summary: "Accuracy was higher under the intervention.",
    reasons: [],
    comparison: null,
    secondaryComparison: null,
    differenceCi: null,
    observedEffect: 0.5,
    predictedEffect: 0.45,
    adherence: { assignedDays: 28, daysWithSessions: 25, adherence: 0.89, conditionASessions: 30, conditionBSessions: 28, outOfWindowSessions: 0 },
    confidence: { level: "high", score: 0.8, reasons: [], limitations: [] },
    causalityNote: "Measured under controlled conditions you assigned.",
    blocks: [],
    achievedPower: 0.85,
  };

  it("buckets a design by date and by whether it has a result", () => {
    expect(buildCalendar([design], [], "2025-07-01").summary.active).toBe(1);
    expect(buildCalendar([design], [], "2025-06-01").summary.upcoming).toBe(1);
    expect(buildCalendar([design], [], "2025-10-01").summary.completed).toBe(1);
    expect(buildCalendar([design], [result], "2025-07-10").summary.analysed).toBe(1);
  });

  it("tells you what to do today when a run is live", () => {
    const calendar = buildCalendar([design], [], "2025-07-01");
    const entry = calendar.active[0]!;
    expect(entry.todayCondition).not.toBeNull();
    expect(entry.todayInstruction).toBeTruthy();
    expect(entry.daysRemaining).toBeGreaterThanOrEqual(0);
  });

  it("produces a dated schedule and the next analysis date", () => {
    const calendar = buildCalendar([design], [], "2025-07-01");
    expect(calendar.schedule.length).toBeGreaterThan(0);
    expect(calendar.schedule[0]!.date).toBe("2025-07-01");
    expect(calendar.nextAnalysisDate).toBe(design.endDate);
  });

  it("returns an empty calendar for an empty design list", () => {
    const calendar = buildCalendar([], [], "2025-07-01");
    expect(calendar.entries).toEqual([]);
    expect(calendar.nextAnalysisDate).toBeNull();
  });
});

describe("recommendation value", () => {
  it("tracks the recommended -> helped funnel", () => {
    const tracker = new RecommendationValueTracker(clock);
    tracker.recommended("r1");
    tracker.recommended("r2");
    tracker.accepted("r1");
    tracker.followed("r1");
    tracker.recordOutcome("r1", true);

    const funnel = tracker.funnel();
    expect(funnel.recommended).toBe(2);
    expect(funnel.accepted).toBe(1);
    expect(funnel.followed).toBe(1);
    expect(funnel.measured).toBe(1);
    expect(funnel.helped).toBe(1);
    expect(funnel.didNotHelp).toBe(0);
    expect(funnel.acceptanceRate).toBeCloseTo(0.5, 10);
    expect(funnel.helpRate).toBe(1);
    expect(funnel.valueScore).toBe(1);
  });

  it("is monotonic: a later stage is never regressed", () => {
    const tracker = new RecommendationValueTracker(clock);
    tracker.followed("r1"); // auto-seeds "recommended" first
    tracker.recommended("r1");
    expect(tracker.valueOf("r1")!.stage).toBe("followed");
  });

  it("scores a recommendation that did not help negatively", () => {
    const tracker = new RecommendationValueTracker(clock);
    tracker.recordOutcome("r1", false);
    tracker.recordOutcome("r2", true);
    expect(tracker.funnel().valueScore).toBe(0);
  });

  it("reports zero rates on an empty funnel", () => {
    const funnel = new RecommendationValueTracker(clock).funnel();
    expect(funnel.recommended).toBe(0);
    expect(funnel.valueScore).toBe(0);
  });
});

describe("wearable connector", () => {
  const records: WearableDailyRecord[] = [
    { kind: "daily", id: "w1", dateISO: "2025-06-10", steps: 8000, restingHeartRateBpm: 55, sleepDurationMinutes: 420, hrvMs: 60, activeMinutes: 40 },
    { kind: "daily", id: "w2", dateISO: "2025-06-11", at: "2025-06-11T06:00:00Z", steps: 3000 },
  ];

  it("maps daily aggregates and flags an estimated timestamp", () => {
    const [event] = mapWearableRecord(records[0]!);
    expect(event!.source).toBe("wearable");
    expect(event!.metrics.steps).toBe(8000);
    expect(event!.metrics.sleep_minutes).toBe(420);
    expect(event!.attributes!.time_estimated).toBe(true);
  });

  it("skips a record with no metrics at all", () => {
    expect(mapWearableRecord({ kind: "daily", id: "w3", dateISO: "2025-06-12" })).toEqual([]);
  });

  it("honours its declared output contract", () => {
    const connector = createWearableConnector(createArrayReader(records, (record) => record.at ?? `${record.dateISO}T12:00:00.000Z`));
    const produced = records.flatMap((record) => mapWearableRecord(record));
    expect(checkContract(connector, produced)).toEqual([]);
  });
});

describe("uncertainty made legible", () => {
  it("turns every confidence grade into an honest sentence", () => {
    expect(uncertaintySummary({ level: "high", score: 0.9, reasons: [], limitations: [] }).tone).toBe("confident");
    expect(uncertaintySummary({ level: "moderate", score: 0.6, reasons: [], limitations: [] }).tone).toBe("provisional");
    expect(uncertaintySummary({ level: "low", score: 0.4, reasons: [], limitations: [] }).tone).toBe("unsure");
    expect(uncertaintySummary({ level: "very-low", score: 0.1, reasons: [], limitations: [] }).label).toBe("We do not know yet");
  });

  it("never phrases low confidence as a failure", () => {
    const summary = uncertaintySummary({ level: "very-low", score: 0.05, reasons: [], limitations: [] });
    expect(summary.sentence).toMatch(/not a failure/);
  });
});

describe("longitudinal benchmark", () => {
  let result: LongitudinalBenchmarkResult;

  beforeAll(async () => {
    // The default seed is fixed so the benchmark is deterministic and CI-gatable.
    result = await runLongitudinalBenchmark({ days: 180 });
  }, 60_000);

  it("finds the planted exercise effect over a long horizon", () => {
    expect(result.foundTrueEffects).toContain("exercise-then-study");
    expect(result.sensitivity).toBeGreaterThanOrEqual(0.5);
  });

  it("finds the wearable sleep signal through the automatic-collection path", () => {
    expect(result.wearableSignalFound).toBe(true);
  });

  it("stays silent on the null user", () => {
    expect(result.nullUserFindings).toBeLessThanOrEqual(2);
    expect(result.specificity).toBeGreaterThanOrEqual(1 / 3);
  });

  it("flags the confounded relationship rather than endorsing it", () => {
    expect(result.confoundedFlagged).toBe(true);
  });

  it("points recommendations at true effects", () => {
    expect(result.recommendationsFromFindings).toBeGreaterThan(0);
    expect(result.recommendationAccuracy).toBeGreaterThanOrEqual(0.5);
  });

  it("never grades an observational finding as high confidence", () => {
    expect(result.calibration.highConfidenceCount).toBe(0);
    expect(result.calibration.meanConfidence).toBeGreaterThan(0);
  });
});
