/**
 * Evidence search.
 *
 * Pulse's evidence is more than its findings: every question the engine
 * asked and declined to publish is evidence too, and so is every
 * experiment. The search surface must cover all of it — the negative
 * results are how a user audits why something they care about is *not*
 * being reported.
 */

import { describe, expect, it } from "vitest";
import { searchEvidence } from "../src/search/evidence-search.js";
import type { EvidenceIndex, RejectedClaim } from "../src/search/evidence-search.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import type { Finding } from "../src/discovery/finding.js";
import type { Hypothesis } from "../src/hypotheses/tracker.js";
import type { ExperimentDesign } from "../src/experiments/design.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

const registry = createDefaultRegistry();

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f-evening",
    createdAt: "2025-06-30T00:00:00Z",
    evidenceClass: "correlation",
    title: "Question accuracy is higher evening sessions",
    statement: "Across 324 sittings, question accuracy evening sessions was 10.2% higher.",
    metricIds: ["study.accuracy"],
    sources: ["revise"],
    sampleSize: 324,
    sampleDescription: "137 evening sittings vs 187 at other times",
    effect: { kind: "hedges_g", value: 0.43, magnitude: "small", label: "+0.43 SD" },
    test: { name: "welch_t", statistic: 3.9, pValue: 0.0001, adjustedP: 0.001, familySize: 13, correctionMethod: "benjamini_hochberg" },
    confidence: {
      level: "moderate",
      score: 0.7,
      reasons: ["Survives correction"],
      limitations: [],
    },
    confounders: [],
    causalityNote: "This is an association, not a cause.",
    nextAction: null,
    evidence: [],
    tags: ["time-of-day", "study"],
    ...overrides,
  };
}

function rejection(overrides: Partial<RejectedClaim> = {}): RejectedClaim {
  return {
    kind: "exposure-window",
    question: "Is question accuracy different within 4 hours of training volume?",
    outcomeMetricId: "study.accuracy",
    exposureMetricId: "exercise.volume",
    reason: "Did not survive correction across the 12 comparisons made about study.accuracy (p = 0.082, adjusted 0.34)",
    ...overrides,
  };
}

function hypothesis(overrides: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: "h1",
    createdAt: "2025-06-30T00:00:00Z",
    updatedAt: "2025-06-30T00:00:00Z",
    statement: "Evening revision sessions improve question accuracy.",
    originFindingId: "f-evening",
    exposureMetricId: null,
    outcomeMetricId: "study.accuracy",
    predictedDirection: "increase",
    predictedEffect: 0.4,
    status: "proposed",
    history: [],
    experimentIds: [],
    knownConfounders: [],
    ...overrides,
  };
}

function design(overrides: Partial<ExperimentDesign> = {}): ExperimentDesign {
  return {
    id: "exp-1",
    hypothesisId: "h1",
    createdAt: "2025-06-30T00:00:00Z",
    type: "crossover",
    title: "Crossover test: evening vs daytime revision sessions",
    hypothesis: "Evening revision sessions improve question accuracy.",
    conditionA: { id: "A", label: "Evening sessions", instruction: "Revise between 18:00 and 22:00" },
    conditionB: { id: "B", label: "Daytime sessions", instruction: "Revise between 08:00 and 12:00" },
    targetMetricId: "study.accuracy",
    minSamplePerCondition: 12,
    durationDays: 28,
    blockDays: 7,
    startDate: "2025-07-01",
    endDate: "2025-07-28",
    assignments: [],
    likelyConfounders: [],
    analysisMethod: "paired_t",
    successCriteria: "p < 0.05 in the predicted direction",
    seed: "seed",
    invalidations: [],
    ...overrides,
  };
}

const baseIndex: EvidenceIndex = {
  findings: [finding()],
  rejected: [rejection()],
  hypotheses: [hypothesis()],
  experiments: [design()],
  experimentResults: [],
  registry,
};

describe("evidence search", () => {
  it("finds a finding by its metric name", () => {
    const hits = searchEvidence("accuracy", baseIndex);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.kind).toBe("finding");
    expect(hits[0]!.finding?.id).toBe("f-evening");
    expect(hits[0]!.matchedTerms).toContain("accuracy");
  });

  it("finds a rejected question by the metric and the reason", () => {
    const hits = searchEvidence("training", baseIndex);
    const rejectionHit = hits.find((hit) => hit.kind === "rejection");
    expect(rejectionHit).toBeDefined();
    expect(rejectionHit!.rejection?.reason).toMatch(/correction/);
    expect(rejectionHit!.summary).toMatch(/not published/);
  });

  it("finds an experiment and its verdict", () => {
    const hits = searchEvidence("crossover", baseIndex);
    expect(hits.some((hit) => hit.kind === "experiment")).toBe(true);
    expect(hits.find((hit) => hit.kind === "experiment")!.experiment?.title).toBe(
      "Crossover test: evening vs daytime revision sessions",
    );
  });

  it("finds a hypothesis", () => {
    const hits = searchEvidence("revision", baseIndex);
    expect(hits.some((hit) => hit.kind === "hypothesis")).toBe(true);
    expect(hits.find((hit) => hit.kind === "hypothesis")!.hypothesis?.id).toBe("h1");
  });

  it("ranks more matches above fewer", () => {
    const richer = finding({ title: "Question accuracy is higher evening sessions and evening accuracy", statement: "Question accuracy evening sessions accuracy..." });
    const index = { ...baseIndex, findings: [finding(), richer] };
    const hits = searchEvidence("accuracy evening", index);
    expect(hits[0]!.finding?.id).toBe(richer.id);
  });

  it("is case-insensitive and tolerant of punctuation", () => {
    const byUpper = searchEvidence("EVENING", baseIndex);
    const byPunctuated = searchEvidence("evening, sessions", baseIndex);
    expect(byUpper.length).toBeGreaterThan(0);
    expect(byPunctuated.length).toBeGreaterThan(0);
  });

  it("returns nothing for an empty query or a miss", () => {
    expect(searchEvidence("", baseIndex)).toEqual([]);
    expect(searchEvidence("   ", baseIndex)).toEqual([]);
    expect(searchEvidence("zzzz-nothing-matches", baseIndex)).toEqual([]);
  });

  it("is deterministic", () => {
    const first = searchEvidence("accuracy", baseIndex).map((hit) => `${hit.kind}:${hit.title}`);
    const second = searchEvidence("accuracy", baseIndex).map((hit) => `${hit.kind}:${hit.title}`);
    expect(second).toEqual(first);
  });
});

describe("evidence search end to end", () => {
  it("searches the synthetic user's findings, rejections, hypotheses and experiments", async () => {
    const { pulse } = await createSyntheticPulse({});
    pulse.discover();
    pulse.proposeHypotheses();

    const evening = pulse.search("evening");
    expect(evening.length).toBeGreaterThan(0);
    expect(evening.filter((hit) => hit.kind === "finding").length).toBeGreaterThanOrEqual(3);
    for (const hit of evening) {
      expect(hit.score).toBeGreaterThanOrEqual(1);
      expect(hit.matchedTerms.length).toBeGreaterThan(0);
      expect(hit.title.length).toBeGreaterThan(0);
      expect(["finding", "rejection", "experiment", "hypothesis"]).toContain(hit.kind);
    }

    // The rejection trail is searchable: the scan asked about things it
    // declined to publish, and those questions mention their metrics.
    const practice = pulse.search("practice");
    expect(practice.some((hit) => hit.kind === "finding")).toBe(true);
    const rejectedPractice = pulse.search("method");
    expect(rejectedPractice.some((hit) => hit.kind === "rejection")).toBe(true);

    expect(pulse.search("zzzz-no-such-thing")).toEqual([]);
  });

  it("carries the rejection trail into the export", async () => {
    const { pulse } = await createSyntheticPulse({});
    pulse.discover();
    const exported = pulse.export();
    expect(exported.rejected.length).toBeGreaterThan(0);
    expect(exported.rejected[0]!.question).toBeTruthy();
  });
});
