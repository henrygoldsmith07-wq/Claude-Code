/**
 * Personal evidence graph: sensitivity, specificity and the honesty rules.
 *
 * A belief graph is only worth having if it refuses the same things the rest
 * of Pulse refuses: it must endorse a claim when the evidence reaches the bar,
 * stay silent or downgrade when it does not, flag a contradiction instead of
 * averaging it away, and never let causal wording slip past without an
 * experiment behind it. Those four properties are the load-bearing ones.
 */

import { describe, expect, it } from "vitest";
import { EvidenceGraph, buildEvidenceGraph, buildClaimNode } from "../src/evidence-graph/graph.js";
import {
  SETTLE_THRESHOLD,
  validateClaimNode,
  validateEvidenceEdge,
  type ClaimNode,
  type EvidenceNode,
} from "../src/evidence-graph/types.js";
import type { Hypothesis } from "../src/hypotheses/tracker.js";
import type { ExperimentResult } from "../src/experiments/analysis.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

const HIGH = { level: "high" as const, score: 0.85, reasons: [], limitations: [] };
const MODERATE = { level: "moderate" as const, score: 0.6, reasons: [], limitations: [] };
const WEAK = { level: "low" as const, score: 0.4, reasons: [], limitations: [] };

function evidence(overrides: Partial<EvidenceNode> = {}): EvidenceNode {
  return {
    id: "finding:f1",
    kind: "finding",
    refId: "f1",
    label: "An association",
    evidenceClass: "correlation",
    confidence: MODERATE,
    statement: "Accuracy is higher.",
    ...overrides,
  };
}

function claim(overrides: Partial<ClaimNode> = {}): ClaimNode {
  return {
    id: "claim:c1",
    statement: "Accuracy is higher after training.",
    createdAt: "2025-07-01T00:00:00Z",
    updatedAt: "2025-07-01T00:00:00Z",
    tags: [],
    ...overrides,
  };
}

function edge(overrides: Partial<Parameters<EvidenceGraph["addEdge"]>[0]> = {}): Parameters<EvidenceGraph["addEdge"]>[0] {
  return {
    id: "supports:c1:f1",
    from: "finding:f1",
    to: "claim:c1",
    kind: "supports",
    weight: MODERATE.score,
    confidence: MODERATE.score,
    justifiedBy: ["f1"],
    label: "correlation",
    ...overrides,
  };
}

function settledGraph(support?: EvidenceNode, refute?: EvidenceNode, unresolved?: EvidenceNode): EvidenceGraph {
  const graph = new EvidenceGraph();
  graph.addClaim(claim());
  for (const [node, kind] of [
    [support, "supports"],
    [refute, "refutes"],
    [unresolved, "inconclusive"],
  ] as const) {
    if (!node) continue;
    graph.addEvidence(node);
    graph.addEdge({
      id: `${kind}:claim:c1:${node.id}`,
      from: node.id,
      to: "claim:c1",
      kind,
      weight: node.confidence.score,
      confidence: node.confidence.score,
      justifiedBy: [node.refId],
      label: node.evidenceClass,
    });
  }
  return graph;
}

describe("claim assessment", () => {
  it("SENSITIVITY: endorses a claim when the evidence reaches the bar", () => {
    const assessment = settledGraph(evidence()).assess("claim:c1");
    expect(assessment.status).toBe("supported");
    expect(assessment.supports).toHaveLength(1);
  });

  it("SPECIFICITY: caps observational support below high confidence", () => {
    const strongCorrelation = evidence({ confidence: { level: "moderate", score: 0.72, reasons: [], limitations: [] } });
    const assessment = settledGraph(strongCorrelation).assess("claim:c1");
    expect(assessment.status).toBe("supported");
    expect(assessment.confidence.level).not.toBe("high");
  });

  it("SPECIFICITY: leaves weak evidence inconclusive rather than supported", () => {
    const assessment = settledGraph(evidence({ confidence: WEAK })).assess("claim:c1");
    expect(assessment.status).toBe("inconclusive");
    expect(assessment.confidence.score).toBeLessThan(SETTLE_THRESHOLD);
  });

  it("refutes a claim when only strong counter-evidence exists", () => {
    const refuting = evidence({ id: "finding:r1", refId: "r1", confidence: HIGH });
    const assessment = settledGraph(undefined, refuting).assess("claim:c1");
    expect(assessment.status).toBe("refuted");
    expect(assessment.against).toHaveLength(1);
  });

  it("flags a contradiction instead of averaging it away", () => {
    const supporting = evidence({ confidence: HIGH });
    const refuting = evidence({ id: "finding:r1", refId: "r1", confidence: HIGH });
    const graph = settledGraph(supporting, refuting);
    expect(graph.assess("claim:c1").status).toBe("contested");
    expect(graph.contradictions().map((a) => a.claim.id)).toEqual(["claim:c1"]);
  });

  it("marks a belief with no evidence open, not true", () => {
    const assessment = settledGraph().assess("claim:c1");
    expect(assessment.status).toBe("open");
    expect(assessment.confidence.score).toBe(0);
    expect(assessment.confidence.reasons).toContain("No evidence yet");
  });

  it("demotes a causally-worded claim that only has observational evidence", () => {
    const causal = claim({ statement: "Training leads to more accurate study sessions." });
    const graph = new EvidenceGraph();
    graph.addClaim(causal);
    graph.addEvidence(evidence({ confidence: HIGH }));
    graph.addEdge(edge());
    const assessment = graph.assess(causal.id);
    expect(assessment.status).not.toBe("supported");
    expect(assessment.problems).toContain("Claim uses causal language without experimental evidence");
  });

  it("permits causal wording when an experiment backs the claim", () => {
    const causal = claim({ statement: "Training leads to more accurate study sessions." });
    const experimental = evidence({ id: "experiment:e1", kind: "experiment", refId: "e1", evidenceClass: "experiment", confidence: HIGH });
    const graph = new EvidenceGraph();
    graph.addClaim(causal);
    graph.addEvidence(experimental);
    graph.addEdge({ ...edge(), from: "experiment:e1", justifiedBy: ["e1"], weight: HIGH.score, confidence: HIGH.score });
    const assessment = graph.assess(causal.id);
    expect(assessment.status).toBe("supported");
    expect(assessment.problems).toEqual([]);
    expect(assessment.confidence.level).toBe("high");
  });

  it("is deterministic across repeated assessments", () => {
    const graph = settledGraph(evidence(), evidence({ id: "finding:r1", refId: "r1" }));
    const first = graph.assessAll().map((a) => [a.claim.id, a.status, a.confidence.score]);
    const second = graph.assessAll().map((a) => [a.claim.id, a.status, a.confidence.score]);
    expect(second).toEqual(first);
  });
});

describe("evidence graph boundaries", () => {
  it("rejects an edge that names no provenance", () => {
    const graph = new EvidenceGraph();
    graph.addClaim(claim());
    graph.addEvidence(evidence());
    expect(() => graph.addEdge({ ...edge(), justifiedBy: [] })).toThrow(/provenance/);
  });

  it("rejects an edge to an unknown claim or from unknown evidence", () => {
    const graph = new EvidenceGraph();
    graph.addClaim(claim());
    graph.addEvidence(evidence());
    expect(() => graph.addEdge({ ...edge(), to: "claim:nope" })).toThrow(/unknown claim/);
    expect(() => graph.addEdge({ ...edge(), from: "finding:nope" })).toThrow(/unknown piece of evidence/);
  });

  it("rejects an out-of-range confidence or weight", () => {
    expect(validateEvidenceEdge({ ...edge(), weight: 1.2 }, new Map(), new Map())).toEqual(
      expect.arrayContaining([expect.stringMatching(/weight outside 0..1/)]),
    );
    expect(validateEvidenceEdge({ ...edge(), confidence: -0.1 }, new Map(), new Map())).toEqual(
      expect.arrayContaining([expect.stringMatching(/confidence outside 0..1/)]),
    );
  });

  it("rejects a claim with no statement", () => {
    expect(validateClaimNode(claim({ statement: "  " }))).toContain("Claim has no statement");
  });

  it("merges repeated evidence for a claim without inventing duplicates", () => {
    const graph = new EvidenceGraph();
    graph.addClaim(claim());
    graph.addEvidence(evidence());
    graph.addEdge(edge());
    graph.addEdge({ ...edge(), justifiedBy: ["f1", "f2"] });
    expect(graph.listEdges()).toHaveLength(1);
    expect(graph.listEdges()[0]!.justifiedBy).toEqual(["f1", "f2"]);
  });
});

describe("assembly from engine state", () => {
  it("turns a supported experiment into an endorsed, causal claim", () => {
    const hypothesis: Hypothesis = {
      id: "hyp-1",
      createdAt: "2025-07-01T00:00:00Z",
      updatedAt: "2025-07-01T00:00:00Z",
      statement: "Training leads to more accurate study sessions.",
      originFindingId: null,
      exposureMetricId: null,
      outcomeMetricId: "study.accuracy",
      predictedDirection: "increase",
      predictedEffect: 0.4,
      status: "supported",
      history: [],
      experimentIds: ["exp-1"],
      knownConfounders: [],
    };
    const result: ExperimentResult = {
      experimentId: "exp-1",
      hypothesisId: "hyp-1",
      analysedAt: "2025-07-10T00:00:00Z",
      verdict: "supported",
      summary: "The change increased accuracy.",
      reasons: ["The interval excludes zero."],
      comparison: null,
      secondaryComparison: null,
      differenceCi: null,
      observedEffect: 0.5,
      predictedEffect: 0.4,
      adherence: { assignedDays: 20, daysWithSessions: 20, adherence: 1, conditionASessions: 30, conditionBSessions: 30, outOfWindowSessions: 0 },
      confidence: HIGH,
      causalityNote: "Measured under controlled conditions.",
      blocks: [],
      achievedPower: 0.85,
    };
    const graph = buildEvidenceGraph({ findings: [], hypotheses: [hypothesis], experiments: [result] });
    const assessment = graph.assess("claim:hypothesis:hyp-1");
    expect(assessment.status).toBe("supported");
    expect(assessment.problems).toEqual([]);
    expect(assessment.confidence.level).toBe("high");
  });

  it("maps a refuted experiment to a refutes edge", () => {
    const hypothesis: Hypothesis = {
      id: "hyp-1",
      createdAt: "2025-07-01T00:00:00Z",
      updatedAt: "2025-07-01T00:00:00Z",
      statement: "Training improves accuracy.",
      originFindingId: null,
      exposureMetricId: null,
      outcomeMetricId: "study.accuracy",
      predictedDirection: "increase",
      predictedEffect: 0.4,
      status: "refuted",
      history: [],
      experimentIds: ["exp-1"],
      knownConfounders: [],
    };
    const result: ExperimentResult = {
      experimentId: "exp-1",
      hypothesisId: "hyp-1",
      analysedAt: "2025-07-10T00:00:00Z",
      verdict: "refuted",
      summary: "The change lowered accuracy.",
      reasons: ["Runs the other way."],
      comparison: null,
      secondaryComparison: null,
      differenceCi: null,
      observedEffect: -0.5,
      predictedEffect: 0.4,
      adherence: { assignedDays: 20, daysWithSessions: 20, adherence: 1, conditionASessions: 30, conditionBSessions: 30, outOfWindowSessions: 0 },
      confidence: HIGH,
      causalityNote: "Measured under controlled conditions.",
      blocks: [],
      achievedPower: 0.85,
    };
    const graph = buildEvidenceGraph({ findings: [], hypotheses: [hypothesis], experiments: [result] });
    expect(graph.assess("claim:hypothesis:hyp-1").status).toBe("refuted");
  });

  it("contributes nothing for an invalid experiment", () => {
    const hypothesis: Hypothesis = {
      id: "hyp-1",
      createdAt: "2025-07-01T00:00:00Z",
      updatedAt: "2025-07-01T00:00:00Z",
      statement: "Training improves accuracy.",
      originFindingId: null,
      exposureMetricId: null,
      outcomeMetricId: "study.accuracy",
      predictedDirection: "increase",
      predictedEffect: 0.4,
      status: "proposed",
      history: [],
      experimentIds: [],
      knownConfounders: [],
    };
    const result: ExperimentResult = {
      experimentId: "exp-1",
      hypothesisId: "hyp-1",
      analysedAt: "2025-07-10T00:00:00Z",
      verdict: "invalid",
      summary: "This run cannot be analysed.",
      reasons: ["One condition has no sessions."],
      comparison: null,
      secondaryComparison: null,
      differenceCi: null,
      observedEffect: NaN,
      predictedEffect: 0.4,
      adherence: { assignedDays: 20, daysWithSessions: 2, adherence: 0.1, conditionASessions: 2, conditionBSessions: 0, outOfWindowSessions: 0 },
      confidence: WEAK,
      causalityNote: "No causal claim can be made.",
      blocks: [],
      achievedPower: 0,
    };
    const graph = buildEvidenceGraph({ findings: [], hypotheses: [hypothesis], experiments: [result] });
    // Only the untested-proposal edge remains; the invalid run adds none.
    expect(graph.size.edges).toBe(1);
    expect(graph.listEvidence().some((node) => node.kind === "experiment")).toBe(false);
    expect(graph.assess("claim:hypothesis:hyp-1").status).toBe("inconclusive");
  });

  it("derives deterministic ids for authored claims", () => {
    const first = buildClaimNode({ statement: "I sleep better after running." });
    const second = buildClaimNode({ statement: "I sleep better after running." });
    expect(second.id).toBe(first.id);
  });
});

describe("the Pulse facade", () => {
  it("records authored beliefs and wires them into the graph", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "evidence-graph" });
    pulse.discover();
    pulse.proposeHypotheses();

    const training = pulse
      .findings()
      .find((finding) => finding.tags.includes("exposure-window") && finding.sources.includes("arise"));
    expect(training).toBeDefined();

    const recorded = pulse.recordClaim({
      statement: "Training sharpens my study accuracy.",
      supportBy: [training!.id],
      tags: ["authored"],
    });
    expect(recorded.id).toMatch(/^claim:authored:/);

    const graph = pulse.evidenceGraph();
    expect(graph.size.claims).toBeGreaterThan(0);
    expect(graph.listClaims().some((node) => node.id.startsWith("claim:finding:"))).toBe(true);
    expect(graph.listClaims().some((node) => node.id.startsWith("claim:hypothesis:"))).toBe(true);

    // Every edge carries provenance — the rule the whole graph rests on.
    for (const graphEdge of graph.listEdges()) {
      expect(graphEdge.justifiedBy.length).toBeGreaterThan(0);
    }

    const authored = graph.assessAll().find((assessment) => assessment.claim.tags.includes("authored"));
    expect(authored).toBeDefined();
    expect(authored!.supports).toHaveLength(1);
  });

  it("SPECIFICITY: never grades a derived observational claim high", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "evidence-graph-specificity" });
    pulse.discover();
    pulse.proposeHypotheses();
    const derived = pulse.evidenceGraph().assessAll().filter((assessment) => assessment.claim.id.startsWith("claim:finding:"));
    for (const assessment of derived) {
      expect(assessment.confidence.level).not.toBe("high");
    }
  });
});
