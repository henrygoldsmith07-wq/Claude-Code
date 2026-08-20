/**
 * Recommendation ranking and insight feedback.
 *
 * Two properties matter more than the exact ordering: a recommendation must
 * never point the wrong way on a metric where lower is better, and it must
 * carry the caveats of the evidence it came from. A ranked list that drops the
 * caveats is worse than no list.
 */

import { describe, expect, it } from "vitest";
import { rankRecommendations, scoreOf } from "../src/recommendations/rank.js";
import { createMemoryFeedbackAdapter, FeedbackStore } from "../src/recommendations/feedback.js";
import { createMemoryRecommendationValueAdapter, RecommendationValueTracker } from "../src/recommendations/value.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import type { Finding, NextAction } from "../src/discovery/finding.js";
import type { ExperimentResult } from "../src/experiments/analysis.js";

const registry = createDefaultRegistry();
const clock = (): number => Date.parse("2025-07-01T12:00:00Z");

function finding(overrides: Partial<Finding> = {}): Finding {
  const action: NextAction = {
    kind: "run-experiment",
    summary: "Run a crossover experiment",
    rationale: "The behaviour is under your control.",
    effortHours: 2,
  };
  return {
    id: "f1",
    createdAt: "2025-06-28T00:00:00Z",
    evidenceClass: "correlation",
    title: "Accuracy is higher after exercise",
    statement: "Across 200 observations, accuracy was 8.7% higher within 4h of exercise.",
    metricIds: ["study.accuracy", "exercise.volume"],
    sources: ["revise", "arise"],
    sampleSize: 200,
    sampleDescription: "80 vs 120 sessions",
    effect: { kind: "hedges_g", value: 0.5, magnitude: "moderate", label: "+0.50 SD" },
    confidence: { level: "moderate", score: 0.62, reasons: [], limitations: ["Found while scanning 98 comparisons"] },
    confounders: [{ id: "secular-trend", name: "Improvement over time", description: "", status: "uncontrolled", detail: "p = 0.01" }],
    causalityNote: "This is an association, not a cause.",
    nextAction: action,
    evidence: [{ kind: "events", description: "200 attempts", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 200, dateRange: { from: "2025-01-01", to: "2025-06-28" } }],
    tags: ["exposure-window"],
    ...overrides,
  };
}

const supportedExperiment: ExperimentResult = {
  experimentId: "e1",
  hypothesisId: "h1",
  targetMetricId: "study.accuracy",
  analysedAt: "2025-06-30T00:00:00Z",
  effectiveEndDate: "2025-07-28",
  stopping: null,
  verdict: "supported",
  summary: "Accuracy was 9.0% higher under the intervention.",
  reasons: [],
  comparison: null,
  secondaryComparison: null,
  differenceCi: { low: 0.02, high: 0.14, level: 0.95 },
  observedEffect: 0.6,
  predictedEffect: 0.5,
  adherence: { assignedDays: 28, daysWithSessions: 25, adherence: 0.89, conditionASessions: 30, conditionBSessions: 28, outOfWindowSessions: 0 },
  baseline: null,
  washout: null,
  family: null,
  secondaryOutcomes: [],
  confidence: { level: "high", score: 0.8, reasons: [], limitations: [] },
  causalityNote: "Measured under controlled conditions you assigned.",
  blocks: [],
  achievedPower: 0.85,
};

describe("ranking formula", () => {
  it("is benefit x confidence x relevance / effort", () => {
    expect(scoreOf({ expectedBenefit: 0.8, evidenceConfidence: 0.5, relevance: 1, effortHours: 2 })).toBeCloseTo(0.2, 10);
  });

  it("floors effort so a trivial action cannot dominate the list", () => {
    const tiny = scoreOf({ expectedBenefit: 0.5, evidenceConfidence: 0.5, relevance: 1, effortHours: 0 });
    expect(Number.isFinite(tiny)).toBe(true);
    expect(tiny).toBeCloseTo(1, 10);
  });

  it("ranks a bigger effect above a smaller one, all else equal", () => {
    const ranked = rankRecommendations(
      [finding({ id: "small", effect: { kind: "hedges_g", value: 0.25, magnitude: "small", label: "" } }), finding({ id: "big" })],
      [],
      { registry, now: clock, today: "2025-06-29" },
    );
    expect(ranked[0]!.sourceId).toBe("big");
  });

  it("ranks a cheaper action above an equally good expensive one", () => {
    const cheap = finding({ id: "cheap", nextAction: { kind: "run-experiment", summary: "Cheap", rationale: "", effortHours: 0.5 } });
    const dear = finding({ id: "dear", nextAction: { kind: "run-experiment", summary: "Dear", rationale: "", effortHours: 8 } });
    const ranked = rankRecommendations([cheap, dear], [], { registry, now: clock, today: "2025-06-29" });
    expect(ranked[0]!.title).toBe("Cheap");
  });

  it("ranks an experimental result above an observational one", () => {
    const ranked = rankRecommendations([finding()], [supportedExperiment], { registry, now: clock, today: "2025-06-29" });
    expect(ranked[0]!.sourceKind).toBe("experiment");
    expect(ranked[0]!.metricIds).toEqual(["study.accuracy"]);
    expect(ranked[0]!.evidence[0]!.metricIds).toEqual(["study.accuracy"]);
  });

  it("discounts stale evidence", () => {
    const fresh = finding({ id: "fresh" });
    const stale = finding({
      id: "stale",
      evidence: [{ kind: "events", description: "200 attempts", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 200, dateRange: { from: "2024-01-01", to: "2024-03-01" } }],
    });
    const ranked = rankRecommendations([stale, fresh], [], { registry, now: clock, today: "2025-06-29" });
    expect(ranked[0]!.sourceId).toBe("fresh");
    expect(ranked[0]!.factors.relevance).toBeGreaterThan(ranked[1]!.factors.relevance);
  });
});

describe("direction safety", () => {
  it("never recommends increasing something where lower is better", () => {
    // A positive effect on calibration error means the group did *worse*.
    const bad = finding({
      id: "calibration",
      metricIds: ["study.calibration_error"],
      effect: { kind: "hedges_g", value: 0.5, magnitude: "moderate", label: "+0.50 SD" },
    });
    expect(rankRecommendations([bad], [], { registry, now: clock, today: "2025-06-29" })).toEqual([]);
  });

  it("does recommend a change that lowers a lower-is-better metric", () => {
    const good = finding({
      id: "calibration-good",
      metricIds: ["study.calibration_error"],
      effect: { kind: "hedges_g", value: -0.5, magnitude: "moderate", label: "-0.50 SD" },
    });
    expect(rankRecommendations([good], [], { registry, now: clock, today: "2025-06-29" })).toHaveLength(1);
  });

  it("produces nothing from a finding whose next action is only to observe", () => {
    const observe = finding({ id: "observe", nextAction: { kind: "observe", summary: "Watch", rationale: "", effortHours: 0 } });
    expect(rankRecommendations([observe], [], { registry, now: clock, today: "2025-06-29" })).toEqual([]);
  });

  it("produces nothing from a finding with no action at all", () => {
    expect(rankRecommendations([finding({ id: "none", nextAction: null })], [], { registry, now: clock })).toEqual([]);
  });
});

describe("recommendations carry their evidence", () => {
  it("keeps the causality note, the limitations and the uncontrolled confounders", () => {
    const [recommendation] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-06-29" });
    expect(recommendation!.caveats).toContain("This is an association, not a cause.");
    expect(recommendation!.caveats.join(" ")).toMatch(/scanning 98 comparisons/);
    expect(recommendation!.caveats.join(" ")).toMatch(/Not controlled: improvement over time/i);
    expect(recommendation!.evidence[0]!.eventCount).toBe(200);
    expect(recommendation!.statement).toMatch(/8.7%/);
  });

  it("reports each ranking factor so the order can be argued with", () => {
    const [recommendation] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-06-29" });
    expect(recommendation!.factors.expectedBenefit).toBeGreaterThan(0);
    expect(recommendation!.factors.evidenceConfidence).toBeGreaterThan(0);
    expect(recommendation!.factors.relevance).toBeGreaterThan(0);
    expect(recommendation!.score).toBeCloseTo(scoreOf(recommendation!.factors), 10);
  });

  it("urges extending an underpowered experiment rather than treating it as a null", () => {
    const underpowered: ExperimentResult = { ...supportedExperiment, verdict: "inconclusive", achievedPower: 0.35 };
    const [recommendation] = rankRecommendations([], [underpowered], { registry, now: clock });
    expect(recommendation!.title).toMatch(/Extend the experiment/);
    expect(recommendation!.statement).toMatch(/not evidence of no effect/);
    expect(recommendation!.caveats.join(" ")).toMatch(/decide the new end date now/i);
  });

  it("says nothing about a well-powered null result", () => {
    const wellPowered: ExperimentResult = { ...supportedExperiment, verdict: "refuted", achievedPower: 0.9 };
    expect(rankRecommendations([], [wellPowered], { registry, now: clock })).toEqual([]);
  });
});

describe("insight feedback", () => {
  it("removes a dismissed finding from the list entirely", () => {
    const feedback = new FeedbackStore(clock);
    const target = finding();
    expect(rankRecommendations([target], [], { registry, now: clock, feedback, today: "2025-06-29" })).toHaveLength(1);

    feedback.record(target.id, "not-useful", target.metricIds);
    expect(rankRecommendations([target], [], { registry, now: clock, feedback, today: "2025-06-29" })).toEqual([]);
  });

  it("removes everything about a muted topic", () => {
    const feedback = new FeedbackStore(clock);
    feedback.muteTopic("study.accuracy");
    expect(rankRecommendations([finding()], [], { registry, now: clock, feedback, today: "2025-06-29" })).toEqual([]);
    feedback.unmuteTopic("study.accuracy");
    expect(rankRecommendations([finding()], [], { registry, now: clock, feedback, today: "2025-06-29" })).toHaveLength(1);
  });

  it("promotes topics the user acts on and demotes ones they reject", () => {
    const positive = new FeedbackStore(clock);
    positive.record("other-1", "acted-on", ["study.accuracy"]);
    positive.record("other-2", "useful", ["study.accuracy"]);

    const negative = new FeedbackStore(clock);
    negative.record("other-3", "already-knew", ["study.accuracy"]);
    negative.record("other-4", "already-knew", ["study.accuracy"]);

    const up = rankRecommendations([finding()], [], { registry, now: clock, feedback: positive, today: "2025-06-29" })[0]!;
    const down = rankRecommendations([finding()], [], { registry, now: clock, feedback: negative, today: "2025-06-29" })[0]!;
    expect(up.factors.relevance).toBeGreaterThan(down.factors.relevance);
  });

  it("bounds the multiplier so clicking cannot bury or inflate anything indefinitely", () => {
    const feedback = new FeedbackStore(clock);
    for (let i = 0; i < 200; i += 1) feedback.record(`x${i}`, "wrong", ["study.accuracy"]);
    expect(feedback.relevanceMultiplier(["study.accuracy"])).toBeGreaterThanOrEqual(0.2);

    const positive = new FeedbackStore(clock);
    for (let i = 0; i < 200; i += 1) positive.record(`y${i}`, "acted-on", ["study.accuracy"]);
    expect(positive.relevanceMultiplier(["study.accuracy"])).toBeLessThanOrEqual(1.5);
  });

  it("never changes a statistic — only the ordering", () => {
    const feedback = new FeedbackStore(clock);
    feedback.record("other", "already-knew", ["study.accuracy"]);
    const [recommendation] = rankRecommendations([finding()], [], { registry, now: clock, feedback, today: "2025-06-29" });
    expect(recommendation!.statement).toMatch(/8.7%/);
    expect(recommendation!.caveats).toContain("This is an association, not a cause.");
  });

  it("surfaces topics that keep producing rejected insights", () => {
    const feedback = new FeedbackStore(clock);
    for (let i = 0; i < 4; i += 1) feedback.record(`f${i}`, "already-knew", ["study.response_time"]);
    feedback.record("f5", "useful", ["study.response_time"]);
    expect(feedback.problemTopics()[0]!.metricId).toBe("study.response_time");
  });

  it("round-trips through a snapshot", () => {
    const feedback = new FeedbackStore(clock);
    feedback.record("f1", "useful", ["study.accuracy"]);
    feedback.muteTopic("study.response_time");
    const restored = FeedbackStore.fromSnapshot(feedback.toSnapshot(), clock);
    expect(restored.isTopicMuted("study.response_time")).toBe(true);
    expect(restored.list()).toHaveLength(1);
  });

  it("persists corrections so a reload does not resurrect a retired insight", async () => {
    const adapter = createMemoryFeedbackAdapter();
    const first = new FeedbackStore(clock, adapter);
    await first.load();
    first.record("f1", "not-useful", ["study.accuracy"]);
    first.muteTopic("study.response_time");
    await first.persist();

    const second = new FeedbackStore(clock, adapter);
    await second.load();
    expect(second.isDismissed("f1")).toBe(true);
    expect(second.isTopicMuted("study.response_time")).toBe(true);
  });

  it("removes feedback tied to a source during privacy deletion", () => {
    const feedback = new FeedbackStore(clock);
    feedback.record("f1", "not-useful", ["study.accuracy"]);
    feedback.muteTopic("study.accuracy");
    feedback.pruneByMetrics(["study.accuracy"], ["f1"]);
    expect(feedback.list()).toHaveLength(0);
    expect(feedback.isDismissed("f1")).toBe(false);
    expect(feedback.isTopicMuted("study.accuracy")).toBe(false);
  });
});

describe("recommendation outcome learning", () => {
  it("files the shown recommendation, response, follow-through and later evidence", () => {
    const [recommendation] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01" });
    const tracker = new RecommendationValueTracker(clock);
    tracker.recommended(recommendation!.id, recommendation);
    tracker.respond(recommendation!.id, "try-this");
    tracker.followed(recommendation!.id);
    tracker.recordOutcome(recommendation!.id, true, "Felt easier to focus");
    tracker.recordEvidence(recommendation!.id, {
      description: "Three later sessions stayed above the personal baseline",
      metricIds: ["study.accuracy"],
      sources: ["revise"],
      eventCount: 3,
      dateRange: { from: "2025-07-02", to: "2025-07-04" },
    });

    const value = tracker.valueOf(recommendation!.id)!;
    expect(value.recommendation?.statement).toContain("8.7%");
    expect(value.recommendation?.confidence.level).toBe("moderate");
    expect(value.recommendation?.causalStatus).toBe("association");
    expect(value.response).toBe("try-this");
    expect(value.stage).toBe("measured");
    expect(value.followedAt).toBeTruthy();
    expect(value.outcomeHistory).toHaveLength(1);
    expect(value.laterEvidence[0]?.eventCount).toBe(3);
  });

  it("uses a neutral prior so one outcome only moves ranking modestly", () => {
    const [base] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01" });
    const tracker = new RecommendationValueTracker(clock);
    tracker.recommended(base!.id, base);
    tracker.recordOutcome(base!.id, false);

    const [adapted] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01", value: tracker });
    expect(adapted!.score).toBeLessThan(base!.score);
    expect(adapted!.score).toBeGreaterThan(base!.score * 0.5);
  });

  it("reduces confidence for contradictory outcomes and suppresses explicit opt-outs", () => {
    const [base] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01" });
    const tracker = new RecommendationValueTracker(clock);
    tracker.recommended(base!.id, base);
    tracker.recordOutcome(base!.id, true);
    tracker.recordOutcome(base!.id, false);
    const mixed = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01", value: tracker })[0]!;
    expect(mixed.confidence.level).toBe("moderate");
    expect(mixed.factors.evidenceConfidence).toBeLessThan(base!.factors.evidenceConfidence);
    expect(mixed.caveats.join(" ")).toMatch(/mixed/i);

    tracker.respond(base!.id, "dont-suggest-again");
    expect(rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01", value: tracker })).toEqual([]);
  });

  it("defers a not-today response only for the current local date", () => {
    const [base] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01" });
    const tracker = new RecommendationValueTracker(clock);
    tracker.recommended(base!.id, base);
    tracker.respond(base!.id, "not-today");
    expect(tracker.isDeferred(base!.id, "2025-07-01")).toBe(true);
    expect(tracker.isDeferred(base!.id, "2025-07-02")).toBe(false);
  });

  it("round-trips the closed loop through its adapter", async () => {
    const adapter = createMemoryRecommendationValueAdapter();
    const [recommendation] = rankRecommendations([finding()], [], { registry, now: clock, today: "2025-07-01" });
    const first = new RecommendationValueTracker(clock, adapter);
    await first.load();
    first.recommended(recommendation!.id, recommendation);
    first.respond(recommendation!.id, "not-useful");
    await first.persist();

    const second = new RecommendationValueTracker(clock, adapter);
    await second.load();
    expect(second.valueOf(recommendation!.id)?.recommendation?.sourceId).toBe("f1");
    expect(second.valueOf(recommendation!.id)?.responseHistory[0]?.response).toBe("not-useful");
  });
});
