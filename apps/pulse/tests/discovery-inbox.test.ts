import { describe, expect, it } from "vitest";
import { buildDiscoveryInbox } from "../src/discovery/inbox.js";
import type { Finding } from "../src/discovery/finding.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { rankRecommendations } from "../src/recommendations/rank.js";
import { FeedbackStore } from "../src/recommendations/feedback.js";
import { RecommendationValueTracker } from "../src/recommendations/value.js";
import { InsightHistory } from "../src/history/insight-history.js";

const registry = createDefaultRegistry();
const now = () => Date.parse("2025-07-01T12:00:00Z");

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f-inbox",
    createdAt: "2025-06-30T00:00:00Z",
    evidenceClass: "correlation",
    title: "Accuracy is higher after exercise",
    statement: "Accuracy is higher in sessions after exercise.",
    metricIds: ["study.accuracy", "exercise.volume"],
    sources: ["revise", "arise"],
    sampleSize: 60,
    sampleDescription: "30 vs 30 sessions",
    effect: { kind: "hedges_g", value: 0.45, magnitude: "moderate", label: "+0.45 SD" },
    confidence: { level: "moderate", score: 0.62, reasons: [], limitations: [] },
    confounders: [],
    causalityNote: "This is an association, not a cause.",
    nextAction: { kind: "run-experiment", summary: "Run a crossover experiment", rationale: "The behaviour is under your control.", effortHours: 2 },
    evidence: [{ kind: "events", description: "60 sessions", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 60, dateRange: { from: "2025-01-01", to: "2025-06-30" } }],
    tags: ["exposure-window"],
    ...overrides,
  };
}

describe("discovery inbox lifecycle", () => {
  it("keeps a finding in an experiment-candidate state until the user acts", () => {
    const candidate = finding();
    const [recommendation] = rankRecommendations([candidate], [], { registry, now, today: "2025-07-01" });
    if (!recommendation) throw new Error("Expected the candidate to produce a recommendation");
    const tracker = new RecommendationValueTracker(now);
    tracker.recommended(recommendation!.id, recommendation);
    expect(buildDiscoveryInbox({ findings: [candidate], recommendations: [recommendation], value: tracker })[0]!.state).toBe("experiment-candidate");

    tracker.respond(recommendation!.id, "try-this");
    expect(buildDiscoveryInbox({ findings: [candidate], recommendations: [recommendation], value: tracker })[0]!.state).toBe("acted-upon");
  });

  it("prioritises safety and user corrections over a generic active state", () => {
    const feedback = new FeedbackStore(now);
    const contradicted = finding({ id: "conflict", replicationStatus: "contradicted" });
    expect(buildDiscoveryInbox({ findings: [contradicted], feedback })[0]!.state).toBe("contradicted");

    const retired = finding({ id: "retired" });
    feedback.dismiss(retired.id);
    expect(buildDiscoveryInbox({ findings: [retired], feedback })[0]!.state).toBe("retired");

    const thin = finding({ id: "thin", confidence: { level: "low", score: 0.25, reasons: [], limitations: [] }, nextAction: { kind: "collect-more-data", summary: "Collect more data", rationale: "The sample is still small.", effortHours: 1 } });
    expect(buildDiscoveryInbox({ findings: [thin] })[0]!.state).toBe("needs-more-data");

    const replicated = finding({ id: "replicated", replicationStatus: "replicated" });
    expect(buildDiscoveryInbox({ findings: [replicated] })[0]!.state).toBe("replicated");
  });

  it("keeps a disappeared insight visible as needing more data", () => {
    const history = new InsightHistory();
    const old = finding({ id: "old" });
    history.recordScan({ at: "2025-06-30T00:00:00Z", eventCount: 60, findings: [old], rejected: [], totals: { findings: 1, rejected: 0, familySize: 1, familyCount: 1, expectedFalseDiscoveries: 0 } });
    history.recordScan({ at: "2025-07-01T00:00:00Z", eventCount: 61, findings: [], rejected: [{ outcomeMetricId: "study.accuracy", exposureMetricId: "exercise.volume", reason: "The sample is now too thin" }], totals: { findings: 0, rejected: 1, familySize: 1, familyCount: 1, expectedFalseDiscoveries: 0 } });

    const [item] = buildDiscoveryInbox({ findings: [], history: history.history() });
    expect(item?.state).toBe("needs-more-data");
    expect(item?.stateReason).toMatch(/thin|evidence bar/i);
  });
});
