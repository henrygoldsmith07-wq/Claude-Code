/**
 * Research export tests.
 *
 * The research export is the shareable form of the data: de-identified,
 * statistics-first, and free of raw events and free text. The load-bearing
 * assertion here is the redaction guard — the export must survive
 * `assertNoRawContent`, the same whitelist used before anything leaves the
 * device — and the tests below pin down exactly what may cross that line.
 */

import { describe, expect, it } from "vitest";
import { buildResearchExport } from "../src/privacy/research-export.js";
import { assertNoRawContent } from "../src/privacy/redaction.js";
import { MemoryEventStore } from "../src/events/store.js";
import { ConsentRegistry } from "../src/privacy/consent.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import { createArrayReader } from "../src/connectors/sdk.js";
import { createReviseConnector } from "../src/connectors/revise.js";
import { createReflectConnector } from "../src/connectors/reflect.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import type { PulseEvent } from "../src/events/schema.js";
import type { Finding } from "../src/discovery/finding.js";
import type { ExperimentDesign } from "../src/experiments/design.js";
import type { ExperimentResult } from "../src/experiments/analysis.js";
import type { SourceQuality } from "../src/quality/score.js";

const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

function ctx(source: string): NormaliseContext {
  return { connectorId: source, connectorVersion: "1.0.0", syncId: "s", ingestMode: "live", timezone: "UTC", now: clock };
}

function studyEvent(id: string): PulseEvent {
  return normaliseEvent(
    {
      source: "revise",
      sourceEventId: id,
      type: "revise.attempt",
      category: "study",
      occurredAt: "2025-06-15T15:00:00Z",
      metrics: { accuracy: 0.8, marks_awarded: 8 },
      attributes: { method: "practice", subject_id: "physics" },
    },
    ctx("revise"),
  );
}

function reflectEvent(id: string): PulseEvent {
  return normaliseEvent(
    {
      source: "reflect",
      sourceEventId: id,
      type: "reflect.entry",
      category: "reflection",
      occurredAt: "2025-06-15T21:00:00Z",
      metrics: { mood: 7, stress: 4 },
      sensitivity: "sensitive",
      notes: "I felt awful about the exam",
    },
    ctx("reflect"),
  );
}

const reviseConnector = createReviseConnector(createArrayReader([], () => "2025-01-01T00:00:00Z"));
const reflectConnector = createReflectConnector(createArrayReader([], () => "2025-01-01T00:00:00Z"));

const finding: Finding = {
  id: "f-exercise",
  createdAt: "2025-06-30T00:00:00Z",
  evidenceClass: "correlation",
  title: "Question accuracy is higher within 4h of training",
  statement: "Across 300 observations, question accuracy within 4h of training was 8.7% higher.",
  metricIds: ["study.accuracy", "exercise.volume"],
  sources: ["revise", "arise"],
  sampleSize: 300,
  sampleDescription: "120 within window vs 180 outside",
  effect: { kind: "hedges_g", value: 0.45, magnitude: "small", label: "+0.45 SD", ci: { low: 0.12, high: 0.78, level: 0.95 } },
  test: { name: "welch_t", statistic: 2.4, pValue: 0.019, adjustedP: 0.041, familySize: 98, correctionMethod: "benjamini_hochberg" },
  confidence: { level: "moderate", score: 0.62, reasons: ["Based on 300 observations"], limitations: ["Found while scanning 98 comparisons"] },
  confounders: [{ id: "secular-trend", name: "Improvement over time", description: "", status: "uncontrolled", detail: "Mean day 70 vs 87, p = 0.001" }],
  causalityNote: "This is an association, not a cause.",
  nextAction: { kind: "run-experiment", summary: "Run a crossover experiment", rationale: "Under your control", effortHours: 2 },
  evidence: [{ kind: "events", description: "300 attempts", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 300, dateRange: null }],
  tags: ["exposure-window"],
};

const design: ExperimentDesign = {
  id: "exp-1",
  hypothesisId: "h-1",
  createdAt: "2025-06-20T00:00:00Z",
  type: "crossover",
  title: "Training before study",
  hypothesis: "Training before study improves accuracy.",
  conditionA: { id: "A", label: "train", instruction: "Train first" },
  conditionB: { id: "B", label: "rest", instruction: "Rest first" },
  targetMetricId: "study.accuracy",
  minSamplePerCondition: 12,
  durationDays: 14,
  blockDays: 7,
  startDate: "2025-07-07",
  endDate: "2025-07-20",
  assignments: [
    { date: "2025-07-07", condition: "A", block: 1 },
    { date: "2025-07-08", condition: "B", block: 1 },
  ],
  likelyConfounders: ["Time of day"],
  analysisMethod: "mixed_effects",
  successCriteria: "A meaningful difference in the target metric",
  seed: "research-fixture",
  invalidations: [],
};

const result: ExperimentResult = {
  experimentId: "exp-1",
  hypothesisId: "h-1",
  analysedAt: "2025-07-21T00:00:00Z",
  effectiveEndDate: "2025-07-21T00:00:00Z",
  baseline: null,
  washout: null,
  stopping: null,
  family: null,
  secondaryOutcomes: [],
  verdict: "supported",
  summary: "Training first improved accuracy by 18 percentage points.",
  reasons: ["The effect survives the pre-registered threshold"],
  comparison: null,
  secondaryComparison: null,
  differenceCi: { low: 0.05, high: 0.31, level: 0.95 },
  observedEffect: 0.18,
  predictedEffect: 0.2,
  adherence: { assignedDays: 14, daysWithSessions: 12, adherence: 0.857, conditionASessions: 6, conditionBSessions: 6, outOfWindowSessions: 0 },
  confidence: { level: "moderate", score: 0.7, reasons: [], limitations: [] },
  causalityNote: "Randomised crossover.",
  blocks: [{ block: 1, condition: "A", n: 6, mean: 0.8 }],
  achievedPower: 0.81,
};

const quality: SourceQuality = {
  source: "revise",
  score: 0.9,
  grade: "excellent",
  dimensions: [],
  issues: [],
  eventCount: 2,
  firstEventDate: "2025-06-15",
  lastEventDate: "2025-06-15",
  daysWithData: 1,
  coverageDays: 30,
};

async function seeded() {
  const store = new MemoryEventStore();
  await store.put([studyEvent("a"), studyEvent("b"), reflectEvent("r1")]);
  const consent = new ConsentRegistry(clock);
  consent.grant(reviseConnector);
  consent.grant(reflectConnector);
  return { store, consent };
}

describe("research export", () => {
  it("is de-identified: numbers and identities, never narratives or raw events", async () => {
    const { store, consent } = await seeded();
    const exported = buildResearchExport(store, consent, {
      now: clock,
      timezone: "UTC",
      findings: [finding],
      qualities: [quality],
      experimentDesigns: [design],
      experimentResults: [result],
    });

    expect(exported.format).toBe("pulse-research-export");
    // No raw events cross the line — the export carries statistics only.
    expect(exported).not.toHaveProperty("events");
    // No free text: the load-bearing guarantee.
    expect(() => assertNoRawContent(exported)).not.toThrow();

    const row = exported.findings[0]!;
    expect(row.outcomeMetricId).toBe("study.accuracy");
    expect(row.exposureMetricId).toBe("exercise.volume");
    expect(row.effect.value).toBe(0.45);
    expect(row.effect.ci).toEqual({ low: 0.12, high: 0.78, level: 0.95 });
    expect(row.test?.adjustedP).toBe(0.041);
    expect(row.test?.familySize).toBe(98);
    expect(row.sampleSize).toBe(300);
    expect(row.direction).toBe("increase");
    expect(row.replicationStatus).toBe("new");
    // The narrative fields are deliberately absent.
    expect(JSON.stringify(exported)).not.toMatch(/Question accuracy is higher within 4h of training/);
    expect(JSON.stringify(exported)).not.toMatch(/8\.7% higher/);
  });

  it("excludes sensitive sources by default and says so", async () => {
    const { store, consent } = await seeded();
    const standard = buildResearchExport(store, consent, { now: clock, timezone: "UTC" });
    expect(standard.excludedSources.map((entry) => entry.source)).toContain("reflect");
    expect(standard.excludedSources[0]!.reason).toMatch(/sensitive/i);
    expect(standard.coverage.eventCount).toBe(2);

    const full = buildResearchExport(store, consent, { now: clock, timezone: "UTC", includeSensitive: true });
    expect(full.excludedSources.map((entry) => entry.source)).not.toContain("reflect");
    expect(full.coverage.eventCount).toBe(3);
    // Even with sensitive data included, the notes never cross the line.
    expect(JSON.stringify(full)).not.toMatch(/felt awful/);
    expect(() => assertNoRawContent(full)).not.toThrow();
  });

  it("honours a per-source opt-out from exports", async () => {
    const { store, consent } = await seeded();
    consent.get("revise")!.includeInExport = false;
    const exported = buildResearchExport(store, consent, { now: clock, timezone: "UTC" });
    expect(exported.excludedSources.some((entry) => entry.source === "revise")).toBe(true);
    expect(exported.coverage.eventCount).toBe(0);
  });

  it("carries experiment verdicts with their numbers, not their summaries", async () => {
    const { store, consent } = await seeded();
    const exported = buildResearchExport(store, consent, {
      now: clock,
      timezone: "UTC",
      experimentDesigns: [design],
      experimentResults: [result],
    });
    const experiment = exported.experiments[0]!;
    expect(experiment.designId).toBe("exp-1");
    expect(experiment.type).toBe("crossover");
    expect(experiment.targetMetricId).toBe("study.accuracy");
    expect(experiment.result?.verdict).toBe("supported");
    expect(experiment.result?.observedEffect).toBe(0.18);
    expect(experiment.result?.differenceCi).toEqual({ low: 0.05, high: 0.31, level: 0.95 });
    expect(experiment.result?.achievedPower).toBe(0.81);
    expect(JSON.stringify(exported)).not.toMatch(/Training first improved accuracy/);
    expect(() => assertNoRawContent(exported)).not.toThrow();
  });

  it("orders everything deterministically, whatever the input order", async () => {
    const { store, consent } = await seeded();
    const reversed = [
      finding,
      {
        ...finding,
        id: "f-other",
        metricIds: ["study.recall_grade", "exercise.volume"],
        effect: { ...finding.effect, value: -0.3 },
      },
    ].reverse();
    const first = buildResearchExport(store, consent, { now: clock, timezone: "UTC", findings: reversed });
    const second = buildResearchExport(store, consent, {
      now: clock,
      timezone: "UTC",
      findings: [...reversed].reverse(),
    });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("research export inside Pulse", () => {
  it("publishes the current findings, coverage and insight journeys", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "research-export" });
    const through = (dayIndex: number): string =>
      new Date(Date.parse("2025-01-01T00:00:00Z") + dayIndex * 86_400_000).toISOString();
    pulse.discover({ through: through(60) });
    pulse.discover({ through: through(120) });
    pulse.discover();
    expect(pulse.findings().length).toBeGreaterThan(0);

    const exported = pulse.researchExport();
    expect(() => assertNoRawContent(exported)).not.toThrow();
    expect(exported.findings.length).toBe(pulse.findings().length);
    expect(exported.coverage.sources.length).toBeGreaterThan(0);
    expect(exported.coverage.eventCount).toBeGreaterThan(0);
    expect(exported.insightJourneys.length).toBeGreaterThan(0);
    for (const journey of exported.insightJourneys) {
      expect(journey.changes.length).toBeGreaterThan(0);
      expect(journey.signature).toContain("|");
    }
  });

  it("never leaks free text even when the sensitive source is included", async () => {
    const { pulse } = await createSyntheticPulse({ days: 30, seed: "research-sensitive", includeReflect: true });
    pulse.discover();
    const exported = pulse.researchExport({ includeSensitive: true });
    expect(() => assertNoRawContent(exported)).not.toThrow();
    expect(JSON.stringify(exported)).not.toMatch(/mood/i);
  });
});
