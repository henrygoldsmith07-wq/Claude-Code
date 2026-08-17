/**
 * Personal evidence graph — types and the claim assessment.
 *
 * The knowledge graph records how metrics, findings, hypotheses and experiments
 * are wired together. The evidence graph records what the person *believes* and
 * why. Every belief is a claim; a claim is settled only by evidence that
 * carries its class (observation, correlation, hypothesis, experiment) and its
 * confidence, and a belief with no evidence is "open", not "true".
 *
 * Four rules make this something other than a notes app:
 *
 *  - provenance — every evidence edge must name the engine entity it came from;
 *  - honesty — observational evidence caps a claim below "high" confidence;
 *  - causality — a claim worded causally is never endorsed unless an experiment
 *    backs it;
 *  - contradiction — supporting and refuting evidence that are both strong is
 *    surfaced as "contested", not silently averaged into a mild "supported".
 */

import { levelFor, type ConfidenceAssessment, type EvidenceClass } from "../statistics/confidence.js";

/** What an evidence node points back to in the rest of the engine. */
export type EvidenceNodeKind = "finding" | "hypothesis" | "experiment";

export interface EvidenceNode {
  id: string;
  kind: EvidenceNodeKind;
  /** Id of the underlying entity (a Finding id, hypothesis id or experiment id). */
  refId: string;
  label: string;
  evidenceClass: EvidenceClass;
  confidence: ConfidenceAssessment;
  /** Deterministic sentence stating what this evidence established. */
  statement: string;
}

export type ClaimStatus = "open" | "supported" | "refuted" | "inconclusive" | "contested";

export interface ClaimNode {
  id: string;
  statement: string;
  createdAt: string;
  updatedAt: string;
  /** Finding or hypothesis id this claim was derived from, when it was. */
  derivedFrom?: string;
  /** Engine entity ids this claim is authored to lean on, by direction. */
  supportBy?: string[];
  refuteBy?: string[];
  uncertainBy?: string[];
  tags: string[];
}

export type EvidenceEdgeKind = "supports" | "refutes" | "inconclusive";

export interface EvidenceEdge {
  id: string;
  /** Evidence node id — an edge always runs from evidence to a claim. */
  from: string;
  /** Claim node id. */
  to: string;
  kind: EvidenceEdgeKind;
  /** 0..1. For supports/refutes this is the evidence's confidence score. */
  weight: number;
  /** Confidence in the edge itself, 0..1. */
  confidence: number;
  /** Engine entity ids that justify this edge. Never empty. */
  justifiedBy: string[];
  label: string;
}

export interface ClaimAssessment {
  claim: ClaimNode;
  status: ClaimStatus;
  confidence: ConfidenceAssessment;
  supports: EvidenceNode[];
  against: EvidenceNode[];
  unresolved: EvidenceNode[];
  /** Problems that stopped this claim being endorsed as worded. */
  problems: string[];
}

/** Observational evidence is capped below "high", mirroring the finding grader. */
export const OBSERVATIONAL_CEILING = 0.74;

/** "Moderate" confidence is the bar for a signal to count either way. */
export const SETTLE_THRESHOLD = 0.55;

const CAUSAL_LANGUAGE = /\b(causes?|caused|because of|leads to|makes you)\b/i;

export function validateClaimNode(claim: ClaimNode): string[] {
  const problems: string[] = [];
  if (!claim.statement.trim()) problems.push("Claim has no statement");
  return problems;
}

export function validateEvidenceEdge(
  edge: EvidenceEdge,
  claims: ReadonlyMap<string, ClaimNode>,
  evidence: ReadonlyMap<string, EvidenceNode>,
): string[] {
  const problems: string[] = [];
  if (!claims.has(edge.to)) problems.push(`Edge ${edge.id} points at an unknown claim`);
  if (!evidence.has(edge.from)) problems.push(`Edge ${edge.id} cites an unknown piece of evidence`);
  if (edge.justifiedBy.length === 0) problems.push(`Edge ${edge.id} names no provenance`);
  if (!Number.isFinite(edge.weight) || edge.weight < 0 || edge.weight > 1) {
    problems.push(`Edge ${edge.id} has a weight outside 0..1`);
  }
  if (!Number.isFinite(edge.confidence) || edge.confidence < 0 || edge.confidence > 1) {
    problems.push(`Edge ${edge.id} has a confidence outside 0..1`);
  }
  return problems;
}

const CLASS_RANK: Record<EvidenceClass, number> = { observation: 0, hypothesis: 1, correlation: 2, experiment: 3 };

function strongestClass(nodes: readonly EvidenceNode[]): EvidenceClass {
  let best: EvidenceClass = "observation";
  for (const node of nodes) {
    if (CLASS_RANK[node.evidenceClass] > CLASS_RANK[best]) best = node.evidenceClass;
  }
  return best;
}

function strongest(nodes: readonly EvidenceNode[]): EvidenceNode | undefined {
  return [...nodes].sort((a, b) => b.confidence.score - a.confidence.score || a.id.localeCompare(b.id))[0];
}

/** A hypothesis is an untested proposal, not a result — always graded as such. */
export function untestedProposalConfidence(): ConfidenceAssessment {
  return {
    level: "very-low",
    score: 0.3,
    reasons: ["This is an untested proposal"],
    limitations: ["No experiment has tested it yet"],
  };
}

function describeClass(evidenceClass: EvidenceClass): string {
  switch (evidenceClass) {
    case "experiment":
      return "an experiment";
    case "correlation":
      return "a correlation";
    case "hypothesis":
      return "a hypothesis";
    default:
      return "an observation";
  }
}

/**
 * Settles a claim from its evidence, deterministically.
 *
 * The status machine mirrors the experiment verdicts: a claim is
 * "supported"/"refuted" only when the strongest evidence on one side reaches
 * "moderate" confidence and the other side does not. "contested" means both
 * sides are strong — a contradiction to resolve, not a result. "inconclusive"
 * is the honest default for evidence that is real but too weak to settle
 * anything, and "open" means there is no evidence at all.
 */
export function assessClaim(
  claim: ClaimNode,
  edges: readonly EvidenceEdge[],
  evidenceById: ReadonlyMap<string, EvidenceNode>,
): ClaimAssessment {
  const supports: EvidenceNode[] = [];
  const against: EvidenceNode[] = [];
  const unresolved: EvidenceNode[] = [];

  for (const edge of edges) {
    if (edge.to !== claim.id) continue;
    const node = evidenceById.get(edge.from);
    if (!node) continue;
    if (edge.kind === "supports") supports.push(node);
    else if (edge.kind === "refutes") against.push(node);
    else unresolved.push(node);
  }

  const supportScore = strongest(supports)?.confidence.score ?? 0;
  const refuteScore = strongest(against)?.confidence.score ?? 0;
  const supportClass = supports.length > 0 ? strongestClass(supports) : ("hypothesis" as EvidenceClass);

  const problems: string[] = [];
  const reasons: string[] = [];
  const limitations: string[] = [];

  let status: ClaimStatus;
  if (supports.length === 0 && against.length === 0 && unresolved.length === 0) {
    status = "open";
  } else if (supportScore >= SETTLE_THRESHOLD && refuteScore >= SETTLE_THRESHOLD) {
    status = "contested";
  } else if (supportScore >= SETTLE_THRESHOLD) {
    status = "supported";
  } else if (refuteScore >= SETTLE_THRESHOLD) {
    status = "refuted";
  } else {
    status = "inconclusive";
  }

  // Causal language needs an experiment. Nothing else can back it, so a
  // causally-worded claim without one is demoted, never endorsed.
  if (CAUSAL_LANGUAGE.test(claim.statement) && supportClass !== "experiment") {
    problems.push("Claim uses causal language without experimental evidence");
    if (status === "supported") status = "inconclusive";
  }

  // Observational evidence cannot reach "high", however much of it there is.
  let score = Math.max(supportScore, refuteScore);
  if (supportClass !== "experiment") score = Math.min(score, OBSERVATIONAL_CEILING);

  if (supports.length > 0) {
    reasons.push(
      supports.length === 1
        ? "Backed by 1 piece of supporting evidence"
        : `Backed by ${supports.length} pieces of supporting evidence`,
    );
    const best = strongest(supports)!;
    reasons.push(`Strongest support is ${describeClass(best.evidenceClass)} at ${best.confidence.level} confidence`);
  }
  if (against.length > 0) {
    reasons.push(against.length === 1 ? "1 piece of evidence argues against it" : `${against.length} pieces of evidence argue against it`);
  }
  if (unresolved.length > 0) {
    reasons.push(
      unresolved.length === 1 ? "1 piece of evidence is unresolved" : `${unresolved.length} pieces of evidence are unresolved`,
    );
  }
  if (reasons.length === 0) reasons.push("No evidence yet");

  if (status === "contested") {
    limitations.push("Strong evidence both supports and contradicts this — resolve the contradiction before acting on it");
  } else if (status === "open") {
    limitations.push("An untested belief, not a finding");
  } else if (status === "inconclusive") {
    limitations.push("The evidence is too weak to settle this yet");
  }
  if (supports.length > 0 && supportClass !== "experiment") {
    limitations.push("Observational evidence cannot reach high confidence");
  }

  return {
    claim,
    status,
    confidence: { level: levelFor(score), score, reasons, limitations },
    supports,
    against,
    unresolved,
    problems,
  };
}

/** Deterministic ordering: the claims that most need a decision come first. */
export function compareAssessments(a: ClaimAssessment, b: ClaimAssessment): number {
  const rank: Record<ClaimStatus, number> = { contested: 0, refuted: 1, supported: 2, inconclusive: 3, open: 4 };
  const byStatus = rank[a.status] - rank[b.status];
  if (byStatus !== 0) return byStatus;
  const byConfidence = b.confidence.score - a.confidence.score;
  if (Math.abs(byConfidence) > 1e-9) return byConfidence;
  return a.claim.statement.localeCompare(b.claim.statement) || a.claim.id.localeCompare(b.claim.id);
}
