/**
 * Personal evidence graph — the graph itself and its assembly.
 *
 * The class enforces the evidence rules at the boundary: an edge that names no
 * provenance, points at a missing node, or carries an out-of-range confidence
 * is rejected when it is added, so a malformed graph can never be queried.
 *
 * Assembly has two sources:
 *
 *  - derived — every finding becomes a claim supported by that finding, every
 *    hypothesis becomes an inconclusive claim, and every analysed experiment
 *    adds a supports/refutes edge to its hypothesis's claim;
 *  - authored — beliefs the person recorded, optionally linked to engine
 *    evidence by id.
 */

import { hash128 } from "../events/hash.js";
import type { Finding } from "../discovery/finding.js";
import type { Hypothesis } from "../hypotheses/tracker.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import {
  assessClaim,
  compareAssessments,
  untestedProposalConfidence,
  validateClaimNode,
  validateEvidenceEdge,
  type ClaimAssessment,
  type ClaimNode,
  type EvidenceEdgeKind,
  type EvidenceEdge,
  type EvidenceNode,
} from "./types.js";

export class EvidenceGraph {
  private readonly claims = new Map<string, ClaimNode>();
  private readonly evidence = new Map<string, EvidenceNode>();
  private readonly edges = new Map<string, EvidenceEdge>();
  private readonly adjacency = new Map<string, Set<string>>();

  addClaim(claim: ClaimNode): ClaimNode {
    const problems = validateClaimNode(claim);
    if (problems.length > 0) throw new Error(problems.join("; "));
    const existing = this.claims.get(claim.id);
    if (existing) {
      existing.tags = [...new Set([...existing.tags, ...claim.tags])];
      existing.supportBy = mergeRefs(existing.supportBy, claim.supportBy);
      existing.refuteBy = mergeRefs(existing.refuteBy, claim.refuteBy);
      existing.uncertainBy = mergeRefs(existing.uncertainBy, claim.uncertainBy);
      existing.updatedAt = claim.updatedAt;
      return existing;
    }
    this.claims.set(claim.id, claim);
    this.adjacency.set(claim.id, new Set());
    return claim;
  }

  addEvidence(node: EvidenceNode): EvidenceNode {
    const existing = this.evidence.get(node.id);
    if (existing) return existing;
    this.evidence.set(node.id, node);
    this.adjacency.set(node.id, new Set());
    return node;
  }

  addEdge(edge: EvidenceEdge): EvidenceEdge {
    const problems = validateEvidenceEdge(edge, this.claims, this.evidence);
    if (problems.length > 0) throw new Error(problems.join("; "));
    const existing = this.edges.get(edge.id);
    if (existing) {
      existing.justifiedBy = [...new Set([...existing.justifiedBy, ...edge.justifiedBy])];
      existing.weight = Math.max(existing.weight, edge.weight);
      existing.confidence = Math.max(existing.confidence, edge.confidence);
      return existing;
    }
    this.edges.set(edge.id, edge);
    this.adjacency.get(edge.from)?.add(edge.id);
    this.adjacency.get(edge.to)?.add(edge.id);
    return edge;
  }

  getClaim(id: string): ClaimNode | undefined {
    return this.claims.get(id);
  }

  getEvidence(id: string): EvidenceNode | undefined {
    return this.evidence.get(id);
  }

  listClaims(): ClaimNode[] {
    return [...this.claims.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listEvidence(): EvidenceNode[] {
    return [...this.evidence.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listEdges(): EvidenceEdge[] {
    return [...this.edges.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  edgesForClaim(claimId: string): EvidenceEdge[] {
    const ids = this.adjacency.get(claimId);
    if (!ids) return [];
    return [...ids]
      .map((id) => this.edges.get(id))
      .filter((edge): edge is EvidenceEdge => edge !== undefined && edge.to === claimId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /** "Why do you believe that?" — the evidence behind one claim, strongest first. */
  evidenceFor(claimId: string): EvidenceNode[] {
    return this.edgesForClaim(claimId)
      .map((edge) => this.evidence.get(edge.from))
      .filter((node): node is EvidenceNode => node !== undefined)
      .sort((a, b) => b.confidence.score - a.confidence.score || a.id.localeCompare(b.id));
  }

  assess(claimId: string): ClaimAssessment {
    const claim = this.claims.get(claimId);
    if (!claim) throw new Error(`Unknown claim: ${claimId}`);
    return assessClaim(claim, this.edgesForClaim(claimId), this.evidence);
  }

  /** "What do I believe?" — every claim, settled, most decision-relevant first. */
  assessAll(): ClaimAssessment[] {
    return [...this.claims.values()].map((claim) => this.assess(claim.id)).sort(compareAssessments);
  }

  /** Claims where strong evidence points both ways. */
  contradictions(): ClaimAssessment[] {
    return this.assessAll().filter((assessment) => assessment.status === "contested");
  }

  get size(): { claims: number; evidence: number; edges: number } {
    return { claims: this.claims.size, evidence: this.evidence.size, edges: this.edges.size };
  }
}

function mergeRefs(existing: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  if (!incoming) return existing;
  const merged = [...new Set([...(existing ?? []), ...incoming])];
  return merged.length > 0 ? merged : undefined;
}

export interface AuthoredClaimInput {
  statement: string;
  id?: string;
  tags?: readonly string[];
  supportBy?: readonly string[];
  refuteBy?: readonly string[];
  uncertainBy?: readonly string[];
}

/** Builds a claim node from what the person stated, with a deterministic id. */
export function buildClaimNode(input: AuthoredClaimInput, now: () => number = Date.now): ClaimNode {
  const at = new Date(now()).toISOString();
  return {
    id: input.id ?? `claim:authored:${hash128(input.statement).slice(0, 16)}`,
    statement: input.statement,
    createdAt: at,
    updatedAt: at,
    tags: [...(input.tags ?? [])],
    ...(input.supportBy ? { supportBy: [...input.supportBy] } : {}),
    ...(input.refuteBy ? { refuteBy: [...input.refuteBy] } : {}),
    ...(input.uncertainBy ? { uncertainBy: [...input.uncertainBy] } : {}),
  };
}

export interface BuildEvidenceGraphInput {
  findings: readonly Finding[];
  hypotheses?: readonly Hypothesis[];
  experiments?: readonly ExperimentResult[];
  authored?: readonly ClaimNode[];
  now?: () => number;
}

export function buildEvidenceGraph(input: BuildEvidenceGraphInput): EvidenceGraph {
  const graph = new EvidenceGraph();
  const refIndex = new Map<string, EvidenceNode>();

  for (const finding of input.findings) {
    const node: EvidenceNode = {
      id: `finding:${finding.id}`,
      kind: "finding",
      refId: finding.id,
      label: finding.title,
      evidenceClass: finding.evidenceClass,
      confidence: finding.confidence,
      statement: finding.statement,
    };
    graph.addEvidence(node);
    refIndex.set(finding.id, node);

    graph.addClaim({
      id: `claim:finding:${finding.id}`,
      statement: finding.title,
      createdAt: finding.createdAt,
      updatedAt: finding.createdAt,
      derivedFrom: finding.id,
      tags: [...finding.tags],
    });
    graph.addEdge({
      id: `supports:claim:finding:${finding.id}:${finding.id}`,
      from: node.id,
      to: `claim:finding:${finding.id}`,
      kind: "supports",
      weight: finding.confidence.score,
      confidence: finding.confidence.score,
      justifiedBy: [finding.id],
      label: finding.evidenceClass,
    });
  }

  for (const hypothesis of input.hypotheses ?? []) {
    const node: EvidenceNode = {
      id: `hypothesis:${hypothesis.id}`,
      kind: "hypothesis",
      refId: hypothesis.id,
      label: hypothesis.statement,
      evidenceClass: "hypothesis",
      confidence: untestedProposalConfidence(),
      statement: hypothesis.statement,
    };
    graph.addEvidence(node);
    refIndex.set(hypothesis.id, node);

    const claimId = `claim:hypothesis:${hypothesis.id}`;
    graph.addClaim({
      id: claimId,
      statement: hypothesis.statement,
      createdAt: hypothesis.createdAt,
      updatedAt: hypothesis.updatedAt,
      derivedFrom: hypothesis.originFindingId ?? undefined,
      tags: [],
    });
    graph.addEdge({
      id: `inconclusive:${claimId}:${hypothesis.id}`,
      from: node.id,
      to: claimId,
      kind: "inconclusive",
      weight: 0.3,
      confidence: 0.3,
      justifiedBy: [hypothesis.id],
      label: "untested proposal",
    });
  }

  for (const experiment of input.experiments ?? []) {
    // An invalid run is not evidence of anything; it must not move a claim.
    if (experiment.verdict === "invalid") continue;
    const claimId = `claim:hypothesis:${experiment.hypothesisId}`;
    if (!graph.getClaim(claimId)) continue;

    const node: EvidenceNode = {
      id: `experiment:${experiment.experimentId}`,
      kind: "experiment",
      refId: experiment.experimentId,
      label: experiment.summary,
      evidenceClass: "experiment",
      confidence: experiment.confidence,
      statement: experiment.summary,
    };
    graph.addEvidence(node);
    refIndex.set(experiment.experimentId, node);

    const kind: EvidenceEdgeKind =
      experiment.verdict === "supported" ? "supports" : experiment.verdict === "refuted" ? "refutes" : "inconclusive";
    graph.addEdge({
      id: `${kind}:${claimId}:${experiment.experimentId}`,
      from: node.id,
      to: claimId,
      kind,
      weight: experiment.confidence.score,
      confidence: experiment.confidence.score,
      justifiedBy: [experiment.experimentId],
      label: `verdict: ${experiment.verdict}`,
    });
  }

  for (const authored of input.authored ?? []) {
    graph.addClaim(authored);
    addAuthoredEdges(graph, authored, refIndex, "supportBy", "supports");
    addAuthoredEdges(graph, authored, refIndex, "refuteBy", "refutes");
    addAuthoredEdges(graph, authored, refIndex, "uncertainBy", "inconclusive");
  }

  return graph;
}

function addAuthoredEdges(
  graph: EvidenceGraph,
  claim: ClaimNode,
  refIndex: ReadonlyMap<string, EvidenceNode>,
  field: "supportBy" | "refuteBy" | "uncertainBy",
  kind: EvidenceEdgeKind,
): void {
  for (const refId of claim[field] ?? []) {
    const node = refIndex.get(refId);
    // A reference to an entity absent from this build is dropped, not invented.
    if (!node) continue;
    graph.addEdge({
      id: `${kind}:${claim.id}:${refId}`,
      from: node.id,
      to: claim.id,
      kind,
      weight: node.confidence.score,
      confidence: node.confidence.score,
      justifiedBy: [refId],
      label: node.evidenceClass,
    });
  }
}
