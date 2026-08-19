import { describe, expect, it } from "vitest";
import { EvidenceGraph } from "../src/evidence-graph/graph.js";
import { createPersonalEvidenceApi, PersonalEvidenceError } from "../src/evidence-api/index.js";
import { Pulse } from "../src/pulse.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

const clock = () => Date.parse("2025-07-01T12:00:00.000Z");
const confidence = {
  level: "moderate" as const,
  score: 0.68,
  reasons: ["Backed by a measured relationship"],
  limitations: ["This is observational evidence"],
};

function graphFixture(): EvidenceGraph {
  const graph = new EvidenceGraph();
  graph.addClaim({
    id: "claim:study",
    statement: "Study sessions improve recall",
    createdAt: "2025-06-01T00:00:00.000Z",
    updatedAt: "2025-06-30T00:00:00.000Z",
    tags: ["study", "recall"],
  });
  graph.addClaim({
    id: "claim:open",
    statement: "A future question",
    createdAt: "2025-06-02T00:00:00.000Z",
    updatedAt: "2025-06-02T00:00:00.000Z",
    tags: ["open"],
  });
  graph.addEvidence({
    id: "finding:study",
    kind: "finding",
    refId: "finding:study",
    label: "Recall is higher after study",
    evidenceClass: "correlation",
    confidence,
    statement: "An association was observed between study and recall.",
  });
  graph.addEvidence({
    id: "hypothesis:study",
    kind: "hypothesis",
    refId: "hypothesis:study",
    label: "Test study before recall",
    evidenceClass: "hypothesis",
    confidence: { ...confidence, level: "very-low", score: 0.3 },
    statement: "Test this relationship in a crossover experiment.",
  });
  graph.addEdge({
    id: "supports:study",
    from: "finding:study",
    to: "claim:study",
    kind: "supports",
    weight: confidence.score,
    confidence: confidence.score,
    justifiedBy: ["finding:study"],
    label: "correlation",
  });
  graph.addEdge({
    id: "inconclusive:study",
    from: "hypothesis:study",
    to: "claim:study",
    kind: "inconclusive",
    weight: 0.3,
    confidence: 0.3,
    justifiedBy: ["hypothesis:study"],
    label: "hypothesis",
  });
  return graph;
}

describe("Personal Evidence API", () => {
  it("returns a versioned graph snapshot without raw event payloads", () => {
    const api = createPersonalEvidenceApi(graphFixture, clock);
    const description = api.describe();
    const snapshot = api.snapshot();

    expect(description).toMatchObject({
      format: "pulse-personal-evidence-api",
      apiVersion: 1,
      readOnly: true,
      transport: "in-process",
    });
    expect(description.privacy).toMatchObject({
      rawEvents: false,
      rawAttributes: false,
      rawNotes: false,
    });
    expect(snapshot).toMatchObject({
      format: "pulse-personal-evidence-api",
      apiVersion: 1,
      schemaVersion: 1,
      generatedAt: "2025-07-01T12:00:00.000Z",
      counts: { claims: 2, evidence: 2, edges: 2 },
    });
    expect(snapshot.claims.find((claim) => claim.id === "claim:study")).toMatchObject({
      status: "supported",
      supportingEvidenceIds: ["finding:study"],
      unresolvedEvidenceIds: ["hypothesis:study"],
    });
    expect(snapshot.evidence[0]).not.toHaveProperty("occurredAt");
    expect(snapshot.evidence[0]).not.toHaveProperty("attributes");
    expect(snapshot.evidence[0]).not.toHaveProperty("notes");
  });

  it("supports deterministic claim queries and claim details", () => {
    const api = createPersonalEvidenceApi(graphFixture, clock);

    expect(api.listClaims({ status: "supported" }).map((claim) => claim.id)).toEqual(["claim:study"]);
    expect(api.listClaims({ search: "recall" }).map((claim) => claim.id)).toEqual(["claim:study"]);
    expect(api.listClaims({ search: "RECALL" }).map((claim) => claim.id)).toEqual(["claim:study"]);
    expect(api.listClaims({ tag: "open", limit: 1 }).map((claim) => claim.id)).toEqual(["claim:open"]);
    expect(api.listClaims({ limit: 0 })).toEqual([]);
    expect(api.getClaim("missing")).toBeNull();

    const detail = api.getClaim("claim:study");
    expect(detail?.supportingEvidence.map((node) => node.id)).toEqual(["finding:study"]);
    expect(detail?.unresolvedEvidence.map((node) => node.id)).toEqual(["hypothesis:study"]);
    expect(detail?.edges.map((edge) => edge.id)).toEqual(["inconclusive:study", "supports:study"]);
    expect(api.explainClaim("claim:study")).toEqual(detail);
  });

  it("filters evidence and edges without exposing mutable graph internals", () => {
    const api = createPersonalEvidenceApi(graphFixture, clock);

    expect(api.listEvidence({ claimId: "claim:study", kind: "finding" }).map((node) => node.id)).toEqual(["finding:study"]);
    expect(api.listEdges({ claimId: "claim:study", kind: "supports" }).map((edge) => edge.id)).toEqual(["supports:study"]);
    expect(api.listEdges({ evidenceId: "hypothesis:study" }).map((edge) => edge.id)).toEqual(["inconclusive:study"]);

    const first = api.listClaims()[0]!;
    (first.tags as string[]).push("caller-mutation");
    expect(api.listClaims()[0]!.tags).not.toContain("caller-mutation");
  });

  it("is exposed by Pulse and reflects the current graph on each call", () => {
    const pulse = new Pulse({ now: clock });
    const claim = pulse.recordClaim({ statement: "My authored belief", tags: ["personal"] });

    const api = pulse.personalEvidence();
    expect(api.getClaim(claim.id)).toMatchObject({
      id: claim.id,
      status: "open",
      statement: "My authored belief",
    });
    expect(api.snapshot().counts).toEqual({ claims: 1, evidence: 0, edges: 0 });
    expect(api.fullExport()).toMatchObject({ format: "pulse-export" });
    expect(api.researchExport()).toMatchObject({ format: "pulse-research-export" });
    expect(pulse.personalEvidenceApi().getClaim(claim.id)?.id).toBe(claim.id);
  });

  it("does not make export hand-offs available for a graph-only facade", () => {
    const api = createPersonalEvidenceApi(graphFixture, clock);

    expect(() => api.researchExport()).toThrowError(PersonalEvidenceError);
    expect(() => api.fullExport()).toThrowError(/Pulse-owned/);
  });

  it("reflects source deletion in subsequent graph reads", async () => {
    const { pulse } = await createSyntheticPulse({ days: 180, seed: "personal-evidence-deletion" });
    pulse.discover();
    pulse.proposeHypotheses();

    const targetFinding = pulse.findings()[0];
    const targetSource = targetFinding?.sources[0];
    expect(targetFinding).toBeDefined();
    expect(targetSource).toBeDefined();
    const api = pulse.personalEvidence();
    const sourceEvidence = api.listEvidence().find((node) => node.refId === targetFinding!.id);
    expect(sourceEvidence).toBeDefined();
    const before = api.snapshot().counts;

    await pulse.forgetSource(targetSource!);

    expect(api.getEvidence(sourceEvidence!.id)).toBeNull();
    expect(api.listEdges({ evidenceId: sourceEvidence!.id })).toEqual([]);
    expect(api.snapshot().counts.evidence).toBeLessThan(before.evidence);
  });
});
