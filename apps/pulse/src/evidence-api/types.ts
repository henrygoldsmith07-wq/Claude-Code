import type { ClaimStatus, EvidenceEdgeKind, EvidenceNodeKind } from "../evidence-graph/types.js";
import type { PulseExport } from "../privacy/export.js";
import type { ResearchExport } from "../privacy/research-export.js";
import type { ConfidenceLevel, EvidenceClass } from "../statistics/confidence.js";

/** Stable wire identifier for the in-process Personal Evidence API contract. */
export const PERSONAL_EVIDENCE_API_FORMAT = "pulse-personal-evidence-api" as const;
export const PERSONAL_EVIDENCE_API_VERSION = 1 as const;
export const PERSONAL_EVIDENCE_API_SCHEMA_VERSION = 1 as const;

export type PersonalEvidenceCapability =
  | "claims.read"
  | "evidence.read"
  | "edges.read"
  | "snapshot.read"
  | "search";

export interface PersonalEvidenceApiDescription {
  format: typeof PERSONAL_EVIDENCE_API_FORMAT;
  apiVersion: typeof PERSONAL_EVIDENCE_API_VERSION;
  readOnly: true;
  transport: "in-process";
  capabilities: readonly PersonalEvidenceCapability[];
  privacy: {
    rawEvents: false;
    rawAttributes: false;
    rawNotes: false;
    sensitiveSourceRecords: false;
    statementHandling: "claim-and-evidence-statements-may-be-personal-text";
  };
}

export interface PersonalEvidenceConfidence {
  level: ConfidenceLevel;
  score: number;
  reasons: readonly string[];
  limitations: readonly string[];
}

export interface PersonalEvidenceClaim {
  id: string;
  statement: string;
  createdAt: string;
  updatedAt: string;
  derivedFrom: string | null;
  tags: readonly string[];
  status: ClaimStatus;
  confidence: PersonalEvidenceConfidence;
  problems: readonly string[];
  supportingEvidenceIds: readonly string[];
  refutingEvidenceIds: readonly string[];
  unresolvedEvidenceIds: readonly string[];
}

export interface PersonalEvidenceNode {
  id: string;
  kind: EvidenceNodeKind;
  refId: string;
  label: string;
  evidenceClass: EvidenceClass;
  confidence: PersonalEvidenceConfidence;
  statement: string;
}

export interface PersonalEvidenceEdge {
  id: string;
  from: string;
  to: string;
  kind: EvidenceEdgeKind;
  weight: number;
  confidence: number;
  justifiedBy: readonly string[];
  label: string;
}

export interface PersonalEvidenceClaimDetail extends PersonalEvidenceClaim {
  supportingEvidence: readonly PersonalEvidenceNode[];
  refutingEvidence: readonly PersonalEvidenceNode[];
  unresolvedEvidence: readonly PersonalEvidenceNode[];
  edges: readonly PersonalEvidenceEdge[];
}

export interface PersonalEvidenceClaimQuery {
  status?: ClaimStatus | readonly ClaimStatus[];
  search?: string;
  tag?: string;
  limit?: number;
}

export interface PersonalEvidenceNodeQuery {
  claimId?: string;
  kind?: EvidenceNodeKind;
  limit?: number;
}

export interface PersonalEvidenceEdgeQuery {
  claimId?: string;
  evidenceId?: string;
  kind?: EvidenceEdgeKind;
  limit?: number;
}

export interface PersonalEvidenceExportOptions {
  includeSensitive?: boolean;
}

export interface PersonalEvidenceApiSnapshot {
  format: typeof PERSONAL_EVIDENCE_API_FORMAT;
  apiVersion: typeof PERSONAL_EVIDENCE_API_VERSION;
  schemaVersion: typeof PERSONAL_EVIDENCE_API_SCHEMA_VERSION;
  generatedAt: string;
  description: string;
  privacy: PersonalEvidenceApiDescription["privacy"];
  counts: { claims: number; evidence: number; edges: number };
  claims: readonly PersonalEvidenceClaim[];
  evidence: readonly PersonalEvidenceNode[];
  edges: readonly PersonalEvidenceEdge[];
}

export interface PersonalEvidenceApi {
  describe(): PersonalEvidenceApiDescription;
  snapshot(): PersonalEvidenceApiSnapshot;
  listClaims(query?: PersonalEvidenceClaimQuery): PersonalEvidenceClaim[];
  getClaim(id: string): PersonalEvidenceClaimDetail | null;
  explainClaim(id: string): PersonalEvidenceClaimDetail | null;
  listEvidence(query?: PersonalEvidenceNodeQuery): PersonalEvidenceNode[];
  getEvidence(id: string): PersonalEvidenceNode | null;
  listEdges(query?: PersonalEvidenceEdgeQuery): PersonalEvidenceEdge[];
  fullExport(options?: PersonalEvidenceExportOptions): PulseExport;
  researchExport(options?: PersonalEvidenceExportOptions): ResearchExport;
}
