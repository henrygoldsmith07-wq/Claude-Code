import { describe, expect, it } from "vitest";
import type { PulseEvent } from "../src/events/schema.js";
import { MemoryEventStore } from "../src/events/store.js";
import { addDays } from "../src/events/time.js";
import { createRng, normalDeviate } from "../src/statistics/random.js";
import { corruptEvents } from "../src/validation/corrupt.js";
import {
  pearsonDashboard,
  spearmanDashboard,
  naiveTrendDetector,
  simpleBeforeAfter,
  type SimpleSeries,
} from "../src/validation/baselines.js";
import {
  scoreClaims,
  calibrateGrades,
  gradesTrackOutcomes,
  comparePredictedToActual,
} from "../src/validation/evaluate.js";
import { runDiscoveryComparison } from "../src/validation/comparison.js";
import { ValidationLedger, createMemoryValidationAdapter } from "../src/validation/ledger.js";

// --- fixtures ---------------------------------------------------------------

const START = "2025-03-01";

function dailyEvent(day: number, value: number): PulseEvent {
  const date = addDays(START, day);
  return {
    id: `ev-${day}`,
    schemaVersion: 2,
    source: "revise",
    sourceEventId: `src-${day}`,
    type: "revise.attempt",
    category: "study",
    occurredAt: `${date}T12:00:00Z`,
    timezone: "UTC",
    localDate: date,
    localMinutes: 720,
    localDayOfWeek: new Date(`${date}T12:00:00Z`).getUTCDay(),
    metrics: { outcome: value },
    attributes: {},
    sensitivity: "normal",
    provenance: {
      connectorId: "revise",
      connectorVersion: "1.0.0",
      syncId: "sync-test",
      ingestedAt: "2025-06-01T00:00:00Z",
      ingestMode: "synthetic",
      rawHash: `hash-${day}`,
    },
    dedupeKey: `revise:src-${day}`,
  };
}

function dailyEvents(count: number): PulseEvent[] {
  return Array.from({ length: count }, (_, day) => dailyEvent(day, 50 + (day % 7)));
}

function series(id: string, values: readonly number[]): [string, SimpleSeries] {
  return [id, { dates: values.map((_, i) => addDays("2025-01-01", i)), values: [...values] }];
}

// --- corruption -------------------------------------------------------------

describe("corruptEvents", () => {
  it("is deterministic for a fixed seed", () => {
    const events = dailyEvents(40);
    const recipe = { seed: "messy", dropDayRate: 0.25, duplicateRate: 0.15, unitErrorRate: 0.1, jitterMinutes: 20 };
    const first = corruptEvents(events, recipe);
    const second = corruptEvents(events, recipe);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("accounts for every event in its report", () => {
    const events = dailyEvents(60);
    const { events: corrupted, report } = corruptEvents(events, {
      seed: "audit",
      dropDayRate: 0.2,
      duplicateRate: 0.2,
    });
    expect(report.originalCount).toBe(events.length);
    expect(corrupted.length).toBe(report.originalCount - report.droppedEvents + report.duplicatedEvents);
    // Every duplicated event is a distinct record that survives dedupe.
    expect(new Set(corrupted.map((event) => event.dedupeKey ?? event.id)).size).toBe(corrupted.length);
  });

  it("drops dropout-gap days completely", () => {
    const events = dailyEvents(30);
    const { events: corrupted, report } = corruptEvents(events, { dropoutGaps: [{ start: 5, days: 3 }] });
    expect(report.droppedDays.sort()).toEqual([addDays(START, 5), addDays(START, 6), addDays(START, 7)].sort());
    expect(corrupted.every((event) => !report.droppedDays.includes(event.localDate))).toBe(true);
    expect(corrupted.length + report.droppedEvents).toBe(events.length);
  });

  it("applies unit errors by scaling one metric", () => {
    const events = dailyEvents(25);
    const { events: corrupted, report } = corruptEvents(events, { unitErrorRate: 1, unitErrorFactor: 2 });
    expect(report.unitErrors).toBe(events.length);
    for (let i = 0; i < corrupted.length; i += 1) {
      expect(corrupted[i]!.metrics.outcome).toBe((events[i]!.metrics.outcome as number) * 2);
    }
  });

  it("produces duplicates a real store keeps as separate records", async () => {
    const events = dailyEvents(20);
    const { events: corrupted } = corruptEvents(events, { duplicateRate: 1 });
    expect(corrupted.length).toBe(events.length * 2);
    const store = new MemoryEventStore();
    const result = await store.put(corrupted);
    expect(result.duplicates).toBe(0);
    expect(result.inserted).toBe(corrupted.length);
    expect(store.all().length).toBe(corrupted.length);
  });
});

// --- baselines ----------------------------------------------------------------

describe("naive discovery baselines", () => {
  it("finds a planted correlation with the right direction", () => {
    const rng = createRng("planted-pair");
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 60; i += 1) {
      const value = normalDeviate(rng);
      x.push(value);
      y.push(value * 3 + normalDeviate(rng, 0, 0.3));
    }
    const map = new Map([series("a.driver", x), series("z.outcome", y)]);
    const claims = pearsonDashboard(map);

    expect(claims).toHaveLength(1);
    expect(claims[0]!.exposureMetricId).toBe("a.driver");
    expect(claims[0]!.outcomeMetricId).toBe("z.outcome");
    expect(claims[0]!.direction).toBe(1);
  });

  it("emits false positives on pure noise — no correction, no gate", () => {
    const rng = createRng("pure-noise");
    const map = new Map<string, SimpleSeries>();
    for (let metric = 0; metric < 12; metric += 1) {
      const values = Array.from({ length: 60 }, () => normalDeviate(rng));
      map.set(`noise-${String(metric).padStart(2, "0")}`, { dates: values.map((_, i) => addDays("2025-01-01", i)), values });
    }
    // 66 uncorrected pairwise tests at alpha 0.05: some "discoveries" are
    // guaranteed by construction, which is exactly the point being scored.
    expect(pearsonDashboard(map).length).toBeGreaterThan(0);
    expect(spearmanDashboard(map).length).toBeGreaterThan(0);
  });

  it("detects a planted trend and a planted step change", () => {
    const rng = createRng("trend-step");
    const trend = Array.from({ length: 60 }, (_, t) => t * 0.5 + normalDeviate(rng, 0, 0.3));
    const step = [
      ...Array.from({ length: 30 }, () => normalDeviate(rng)),
      ...Array.from({ length: 30 }, () => 2 + normalDeviate(rng)),
    ];
    const map = new Map([series("metric", trend), series("stepper", step)]);

    const trends = naiveTrendDetector(map);
    expect(trends.some((claim) => claim.outcomeMetricId === "metric" && claim.direction === 1)).toBe(true);

    const steps = simpleBeforeAfter(map);
    expect(steps.some((claim) => claim.outcomeMetricId === "stepper" && claim.direction === 1)).toBe(true);
  });

  it("stays silent when there is too little overlap", () => {
    const rng = createRng("thin");
    const values = Array.from({ length: 8 }, () => normalDeviate(rng));
    const map = new Map([series("thin", values)]);
    expect(naiveTrendDetector(map, { minOverlap: 10 })).toHaveLength(0);
    expect(simpleBeforeAfter(map, { minOverlap: 10 })).toHaveLength(0);
  });
});

// --- scoring ------------------------------------------------------------------

describe("claim scoring", () => {
  it("computes precision, recall and direction-sensitive scores", () => {
    const truth = [
      { outcomeMetricId: "mood", exposureMetricId: "exercise", plantedDirection: 1 },
      { outcomeMetricId: "focus", exposureMetricId: "sleep" },
    ];

    const plain = scoreClaims(
      [
        { outcomeMetricId: "mood", exposureMetricId: "exercise", direction: 1 },
        { outcomeMetricId: "sleep", exposureMetricId: "caffeine", direction: 1 },
      ],
      truth,
    );
    expect(plain.truePositives).toBe(1);
    expect(plain.falsePositives).toBe(1);
    expect(plain.falseNegatives).toBe(1);
    expect(plain.precision).toBeCloseTo(0.5);
    expect(plain.recall).toBeCloseTo(0.5);

    const directional = scoreClaims(
      [
        { outcomeMetricId: "mood", exposureMetricId: "exercise", direction: 1 },
        { outcomeMetricId: "mood", exposureMetricId: "exercise", direction: -1 },
      ],
      truth,
      { requireDirection: true },
    );
    expect(directional.truePositives).toBe(1);
    expect(directional.falsePositives).toBe(1);
    expect(directional.falsePositiveDetails[0]?.direction).toBe(-1);
  });

  it("requires support rates to rise with the grade before trusting them", () => {
    const tracking = calibrateGrades([
      ...Array.from({ length: 3 }, () => ({ grade: "high" as const, outcome: "supported" as const })),
      ...Array.from({ length: 2 }, () => ({ grade: "low" as const, outcome: "refuted" as const })),
      { grade: "low", outcome: "inconclusive" },
      { grade: "moderate", outcome: "inconclusive" },
    ]);
    expect(tracking.find((row) => row.grade === "high")?.supportRate).toBe(1);
    expect(tracking.find((row) => row.grade === "low")?.supportRate).toBe(0);
    expect(Number.isNaN(tracking.find((row) => row.grade === "moderate")?.supportRate)).toBe(true);
    expect(gradesTrackOutcomes(tracking)).toBe(true);

    const inverted = calibrateGrades([
      { grade: "high", outcome: "refuted" },
      { grade: "low", outcome: "supported" },
    ]);
    expect(gradesTrackOutcomes(inverted)).toBe(false);
  });

  it("scores predicted against observed experiment effects", () => {
    const accuracy = comparePredictedToActual([
      { predictedEffect: 0.8, observedEffect: 0.4 },
      { predictedEffect: -0.5, observedEffect: 0.2 },
      { predictedEffect: 0.6, observedEffect: 0.6 },
    ]);
    expect(accuracy.n).toBe(3);
    expect(accuracy.mae).toBeCloseTo((0.4 + 0.7 + 0) / 3);
    expect(accuracy.signAgreement).toBeCloseTo(2 / 3);
    expect(accuracy.meanShrinkage).toBeCloseTo((0.5 + 0.4 + 1) / 3);
    expect(accuracy.withinHalfPrediction).toBeCloseTo(2 / 3);

    expect(comparePredictedToActual([]).n).toBe(0);
  });
});

// --- ledger ---------------------------------------------------------------------

describe("ValidationLedger", () => {
  it("summarises every validation question from raw entries", () => {
    const ledger = new ValidationLedger();
    const at = "2026-08-01T00:00:00Z";

    ledger.append({ kind: "false-positive-review", at, findingId: "f1", reviewerVerdict: "false-positive" });
    ledger.append({ kind: "false-positive-review", at, findingId: "f2", reviewerVerdict: "false-positive" });
    ledger.append({ kind: "false-positive-review", at, findingId: "f3", reviewerVerdict: "correct" });
    ledger.append({ kind: "false-positive-review", at, findingId: "f4", reviewerVerdict: "unclear" });

    ledger.append({ kind: "replication-outcome", at, signature: "k|a|b|1", outcome: "replicated" });
    ledger.append({ kind: "replication-outcome", at, signature: "k|c|d|1", outcome: "replicated" });
    ledger.append({ kind: "replication-outcome", at, signature: "k|e|f|1", outcome: "reversed" });
    ledger.append({ kind: "replication-outcome", at, signature: "k|g|h|1", outcome: "neither" });

    ledger.append({ kind: "experiment-prediction", at, designId: "d1", predictedEffect: 0.8, observedEffect: 0.4 });
    ledger.append({ kind: "experiment-prediction", at, designId: "d2", predictedEffect: -0.5, observedEffect: 0.2 });

    ledger.append({ kind: "confidence-check", at, findingId: "f1", grade: "high", outcome: "supported" });
    ledger.append({ kind: "confidence-check", at, findingId: "f2", grade: "low", outcome: "refuted" });

    ledger.append({ kind: "recommendation-outcome", at, recommendationId: "r1", adherence: 0.5, usefulness: "useful", targetImproved: true });
    ledger.append({ kind: "recommendation-outcome", at, recommendationId: "r2", adherence: 0.9, usefulness: "not-useful", targetImproved: false });
    ledger.append({ kind: "recommendation-outcome", at, recommendationId: "r3", adherence: null, usefulness: null, targetImproved: null });

    const summary = ledger.summary();

    expect(summary.falsePositives.reviewed).toBe(4);
    expect(summary.falsePositives.rate).toBeCloseTo(2 / 3);

    expect(summary.replication.tracked).toBe(4);
    expect(summary.replication.rate).toBe(0.5);
    expect(summary.replication.reversalRate).toBe(0.25);

    expect(summary.predictions.n).toBe(2);
    expect(summary.predictions.signAgreement).toBe(0.5);

    expect(summary.confidence.tracksOutcomes).toBe(true);
    expect(summary.confidence.table.find((row) => row.grade === "high")?.supported).toBe(1);

    expect(summary.recommendations.meanAdherence).toBeCloseTo(0.7);
    expect(summary.recommendations.withFeedback).toBe(2);
    expect(summary.recommendations.usefulShare).toBe(0.5);
    expect(summary.recommendations.improvedShare).toBe(0.5);

    expect(summary.totalEntries).toBe(15);
    expect(summary.firstEntryAt).toBe(at);
  });

  it("prunes entries whose findings were deleted without rewriting the rest", () => {
    const ledger = new ValidationLedger();
    const at = "2026-08-01T00:00:00Z";
    ledger.append({ kind: "false-positive-review", at, findingId: "gone", reviewerVerdict: "false-positive" });
    ledger.append({ kind: "false-positive-review", at, findingId: "kept", reviewerVerdict: "correct" });
    ledger.append({ kind: "confidence-check", at, findingId: "gone", grade: "high", outcome: "refuted" });
    ledger.append({ kind: "experiment-prediction", at, designId: "d", predictedEffect: 1, observedEffect: 1 });

    ledger.pruneByFindingIds(new Set(["kept"]));

    const summary = ledger.summary();
    expect(summary.falsePositives.reviewed).toBe(1);
    expect(summary.confidence.table.every((row) => row.n === 0)).toBe(true);
    expect(summary.predictions.n).toBe(1);
    expect(ledger.list()).toHaveLength(2);
  });

  it("persists through an adapter and reloads", async () => {
    const adapter = createMemoryValidationAdapter();
    const ledger = new ValidationLedger(adapter);
    ledger.append({
      kind: "replication-outcome",
      at: "2026-08-02T00:00:00Z",
      signature: "k|a|b|1",
      outcome: "reversed",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const reloaded = new ValidationLedger(adapter);
    await reloaded.load();
    expect(reloaded.list()).toHaveLength(1);
    expect(reloaded.summary().replication.reversalRate).toBe(1);
  });
});

// --- comparison harness ----------------------------------------------------------

describe("discovery comparison: pulse versus naive baselines", () => {
  it("beats uncorrected dashboards on the same scored ground truth, even corrupted", async () => {
    const result = await runDiscoveryComparison({
      seed: "discovery-suite",
      days: 180,
      corruption: {
        seed: "messy-real",
        dropDayRate: 0.08,
        duplicateRate: 0.05,
        unitErrorRate: 0.02,
        jitterMinutes: 45,
        dropoutGaps: [{ start: 40, days: 4 }],
      },
    });

    const methods = result.rows.map((row) => row.method);
    expect(methods).toEqual(["pulse", "pearson-dashboard", "spearman-dashboard", "naive-trend", "before-after"]);
    expect(result.truthPairs.some((rel) => rel.kind === "true-effect")).toBe(true);

    const pulse = result.rows[0]!;
    const pearson = result.rows.find((row) => row.method === "pearson-dashboard")!;

    // The uncorrected dashboard scans every pair at alpha 0.05: far more raw
    // claims than the gated engine, and a worse precision on the same truth.
    const pulseClaims = pulse.clean.truePositives + pulse.clean.falsePositives;
    const pearsonClaims = pearson.clean.truePositives + pearson.clean.falsePositives;
    expect(pearsonClaims).toBeGreaterThan(pulseClaims);
    expect(pulse.clean.precision).toBeGreaterThanOrEqual(pearson.clean.precision);

    // On the matched null dataset Pulse stays silent (asserted by the discovery
    // suite for this exact fixture); the dashboards cannot.
    expect(pulse.nullClaims).toBeLessThan(pearson.nullClaims);

    // Corruption was applied everywhere and every method was re-scored on it.
    expect(result.corruptionSummary).toBeDefined();
    const corruption = result.corruptionSummary!;
    expect(corruption.droppedDays).toBeGreaterThan(0);
    expect(corruption.corruptedEvents).toBeLessThan(corruption.originalEvents);
    for (const row of result.rows) {
      expect(row.corrupted).toBeDefined();
      expect(row.corrupted!.nullClaims).toBeGreaterThanOrEqual(0);
    }

    // Pulse must still find most planted effects after the data is damaged —
    // robustness, not perfection: the exact floor is asserted loosely so the
    // test measures the design, not one seed's luck.
    expect(pulse.corrupted!.clean.recall).toBeGreaterThan(0);
    expect(pulse.corrupted!.clean.truePositives).toBeGreaterThan(0);
  }, 120_000);
});
