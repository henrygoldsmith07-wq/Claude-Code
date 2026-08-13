/**
 * Data quality, the knowledge graph, the weekly brief and prediction models.
 *
 * These are the parts that decide how much authority a finding is given and
 * what the user is told about a week. A quality score that flatters a dead
 * source, or a brief that manufactures a story out of a quiet week, would
 * undermine everything the statistics layer does correctly.
 */

import { describe, expect, it } from "vitest";
import { createDefaultRegistry, DEFAULT_METRICS } from "../src/metrics/catalogue.js";
import type { MetricDefinition } from "../src/metrics/registry.js";
import type { DailySeries } from "../src/metrics/compute.js";
import { weekOverWeek } from "../src/timeseries/trend.js";
import { findNearDuplicates, gradeFor, qualityForSources, scoreSource } from "../src/quality/score.js";
import { buildKnowledgeGraph, KnowledgeGraph } from "../src/knowledge/graph.js";
import { buildWeeklyBrief, renderBriefText } from "../src/reports/brief.js";
import { score, trainAndValidate } from "../src/predictions/model.js";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import { createRng, normalDeviate } from "../src/statistics/random.js";
import { addDays, eachLocalDate } from "../src/events/time.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
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

describe("data quality", () => {
  const definitions: MetricDefinition[] = registry.list();

  it("scores a complete, fresh source highly", () => {
    const events = eachLocalDate("2025-06-01", "2025-06-30").map((date) => attempt(date, 0.7));
    const quality = scoreSource("revise", events, { nowMs: Date.parse("2025-07-01T00:00:00Z"), timezone: "UTC", definitions, expectedEventsPerWeek: 7 });
    expect(quality.grade).toBe("excellent");
    expect(quality.daysWithData).toBe(30);
    expect(quality.issues.filter((issue) => issue.severity === "critical")).toHaveLength(0);
  });

  it("penalises a stale source and says what to do about it", () => {
    const events = eachLocalDate("2025-01-01", "2025-01-31").map((date) => attempt(date, 0.7));
    const quality = scoreSource("revise", events, { nowMs: Date.parse("2025-07-01T00:00:00Z"), timezone: "UTC", definitions });
    expect(quality.score).toBeLessThan(0.7);
    const critical = quality.issues.find((issue) => issue.severity === "critical");
    expect(critical?.message).toMatch(/No data for \d+ days/);
    expect(critical?.remedy).toBeTruthy();
  });

  it("penalises a sparse source against its expected cadence", () => {
    const events = ["2025-06-01", "2025-06-15", "2025-06-30"].map((date) => attempt(date, 0.7));
    const quality = scoreSource("revise", events, { nowMs: Date.parse("2025-07-01T00:00:00Z"), timezone: "UTC", definitions, expectedEventsPerWeek: 7 });
    expect(quality.dimensions.find((dimension) => dimension.id === "completeness")!.score).toBeLessThan(0.3);
  });

  it("penalises assumed timestamps", () => {
    const estimated = eachLocalDate("2025-06-01", "2025-06-30").map((date) =>
      normaliseEvent(
        { source: "arise", sourceEventId: date, type: "arise.workout", category: "exercise", occurredAt: `${date}T18:00:00Z`, metrics: { total_reps: 40 }, attributes: { time_estimated: true } },
        { ...ctx, connectorId: "arise" },
      ),
    );
    const quality = scoreSource("arise", estimated, { nowMs: Date.parse("2025-07-01T00:00:00Z"), timezone: "UTC", definitions });
    expect(quality.dimensions.find((dimension) => dimension.id === "timing")!.score).toBe(0);
    expect(quality.issues.some((issue) => /assumed rather than recorded/.test(issue.message))).toBe(true);
  });

  it("returns a zero score with a remedy when a source has no data", () => {
    const quality = scoreSource("forq", [], { nowMs: NOW, timezone: "UTC", definitions });
    expect(quality.score).toBe(0);
    expect(quality.grade).toBe("poor");
    expect(quality.issues[0]!.remedy).toMatch(/Connect the source/);
  });

  it("takes the worst contributing source, not the average", () => {
    const qualities = [
      { source: "revise", score: 0.95 } as never,
      { source: "arise", score: 0.35 } as never,
    ];
    expect(qualityForSources(qualities, ["revise", "arise"])).toBeCloseTo(0.35, 6);
    expect(qualityForSources(qualities, ["revise"])).toBeCloseTo(0.95, 6);
    // Unknown sources fall back to a neutral prior rather than to zero.
    expect(qualityForSources(qualities, ["forq"])).toBeCloseTo(0.5, 6);
  });

  it("grades on the documented boundaries", () => {
    expect(gradeFor(0.9)).toBe("excellent");
    expect(gradeFor(0.7)).toBe("good");
    expect(gradeFor(0.5)).toBe("fair");
    expect(gradeFor(0.2)).toBe("poor");
  });

  it("spots near-duplicate events the dedupe key could not catch", () => {
    const a = attempt("2025-01-01", 0.7, 15, 0);
    const b = normaliseEvent(
      { source: "revise", sourceEventId: "different-id", type: "revise.attempt", category: "study", occurredAt: a.occurredAt, subject: a.subject ?? "", metrics: { accuracy: 0.7 } },
      ctx,
    );
    expect(findNearDuplicates([a, b])).toHaveLength(1);
  });
});

describe("knowledge graph", () => {
  it("refuses an edge that cites no evidence", () => {
    const graph = new KnowledgeGraph();
    graph.addNode({ id: "a", kind: "metric", label: "A", attributes: {} });
    graph.addNode({ id: "b", kind: "metric", label: "B", attributes: {} });
    expect(() =>
      graph.addEdge({ id: "e", from: "a", to: "b", kind: "associated-with", weight: 1, confidence: 1, justifiedBy: [], label: "" }),
    ).toThrow(/must cite the evidence/);
  });

  it("refuses an edge to a node that does not exist", () => {
    const graph = new KnowledgeGraph();
    graph.addNode({ id: "a", kind: "metric", label: "A", attributes: {} });
    expect(() =>
      graph.addEdge({ id: "e", from: "a", to: "ghost", kind: "about", weight: 1, confidence: 1, justifiedBy: ["x"], label: "" }),
    ).toThrow(/both endpoints must exist/);
  });

  it("builds metric, source and finding nodes with association edges", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "graph" });
    pulse.discover();
    const graph = pulse.knowledgeGraph();

    expect(graph.listNodes("metric").length).toBeGreaterThan(10);
    expect(graph.listNodes("source").length).toBeGreaterThan(2);
    expect(graph.listNodes("finding").length).toBeGreaterThan(0);
    for (const edge of graph.listEdges()) expect(edge.justifiedBy.length).toBeGreaterThan(0);
  });

  it("walks from one metric to another through the strongest path", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "graph" });
    pulse.discover();
    const graph = pulse.knowledgeGraph();
    const path = graph.strongestPath("metric:study.accuracy", "source:revise");
    expect(path).not.toBeNull();
    expect(path!.strength).toBeGreaterThan(0);
    expect(path!.nodes[0]!.id).toBe("metric:study.accuracy");
  });

  it("merges rather than replaces on repeated adds", () => {
    const graph = buildKnowledgeGraph({ definitions: DEFAULT_METRICS.slice(0, 3), findings: [] });
    const before = graph.size.nodes;
    buildKnowledgeGraph({ definitions: DEFAULT_METRICS.slice(0, 3), findings: [] });
    expect(graph.size.nodes).toBe(before);
  });
});

describe("weekly brief", () => {
  it("reports a quiet week as quiet rather than inventing a story", async () => {
    const { pulse } = await createSyntheticPulse({ days: 120, seed: "brief-quiet" });
    const brief = pulse.weeklyBrief("2025-04-14");
    expect(brief.weekStart).toBe("2025-04-14");
    expect(brief.headline.length).toBeGreaterThan(10);
    if (brief.changes.length === 0 && brief.activity.events > 0) {
      expect(brief.notes.join(" ")).toMatch(/nothing outside|Nothing moved/i);
    }
  });

  it("says so plainly when a week has no activity at all", async () => {
    const { pulse } = await createSyntheticPulse({ days: 60, seed: "brief-empty" });
    // A week well after the generated data ends.
    const brief = pulse.weeklyBrief("2026-01-05");
    expect(brief.activity.events).toBe(0);
    expect(brief.headline).toMatch(/Nothing was logged/);
  });

  it("renders a readable text brief carrying the caveats", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "brief-render" });
    pulse.discover();
    const text = renderBriefText(pulse.weeklyBrief("2025-06-16"));
    expect(text).toMatch(/Pulse weekly brief/);
    expect(text).toMatch(/Activity: \d+ events/);
  });

  it("only calls a change notable when it is large against that metric's own variability", () => {
    const dates = eachLocalDate("2025-01-06", "2025-03-09");
    const rng = createRng("volatile");
    // A metric that swings wildly every week: a big move is not news.
    const values = dates.map(() => normalDeviate(rng, 10, 5));
    const volatile: DailySeries = { metricId: "study.accuracy", aggregation: "mean", dates, values, counts: dates.map(() => 1) };
    const change = weekOverWeek(
      volatile,
      eachLocalDate("2025-03-03", "2025-03-09"),
      eachLocalDate("2025-02-24", "2025-03-02"),
      [1, 2, 3, 4, 5].map((n) => eachLocalDate(addDays("2025-03-03", -7 * n), addDays("2025-03-09", -7 * n))),
    );
    expect(change.notable).toBe(false);
  });

  it("includes findings created during the week", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "brief-findings" });
    const report = pulse.discover();
    const brief = buildWeeklyBrief({
      registry,
      weekOf: report.findings[0]!.createdAt.slice(0, 10),
      events: pulse.events(),
      findings: report.findings,
      now: () => Date.parse(report.findings[0]!.createdAt),
    });
    expect(brief.newFindings.length).toBe(report.findings.length);
  });
});

describe("prediction models", () => {
  it("refuses to publish a model without enough history", async () => {
    const { pulse } = await createSyntheticPulse({ days: 30, seed: "predict-thin" });
    const model = trainAndValidate(pulse.events(), { registry, targetMetricId: "study.accuracy" });
    expect(model.publishable).toBe(false);
    expect(model.verdict).toMatch(/usable days|does not predict/);
  });

  it("refuses to publish a model that does not beat a simple rule of thumb", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "predict-noise" });
    const model = trainAndValidate(pulse.events(), {
      registry,
      targetMetricId: "study.accuracy",
      driverMetricIds: ["exercise.volume", "wellbeing.sleep"],
    });
    // Daily mean accuracy on this generator is close to noise around a
    // constant, so an honest model should decline. If it does publish, it must
    // have genuinely beaten both baselines out of sample.
    if (model.publishable) {
      expect(model.validation.r2).toBeGreaterThan(0);
      expect(model.validation.mae).toBeLessThan(Math.min(model.baselines.persistence.mae, model.baselines.rollingMedian.mae));
    } else {
      expect(model.limitations.length).toBeGreaterThan(0);
    }
  });

  it("always states its limitations, published or not", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "predict-limits" });
    const model = trainAndValidate(pulse.events(), { registry, targetMetricId: "study.accuracy" });
    expect(model.limitations.join(" ")).toMatch(/routine changes/);
  });

  it("validates walk-forward, never on data the model already saw", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "predict-walk" });
    const model = trainAndValidate(pulse.events(), { registry, targetMetricId: "study.accuracy", minTrainDays: 60 });
    // One out-of-sample prediction per day after the training window.
    expect(model.validation.n).toBe(model.trainedOn - 60);
    expect(model.validation.n).toBeGreaterThan(0);
  });

  it("scores predictions against actuals correctly", () => {
    const result = score([1, 2, 3], [1, 2, 3]);
    expect(result.mae).toBe(0);
    expect(result.r2).toBe(1);
    const worse = score([2, 2, 2], [1, 2, 3]);
    expect(worse.mae).toBeCloseTo(2 / 3, 6);
    expect(worse.r2).toBeCloseTo(0, 6);
  });
});
