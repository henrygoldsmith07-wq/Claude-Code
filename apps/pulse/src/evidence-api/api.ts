import type { EvidenceGraph } from "../evidence-graph/graph.js";
import type { ClaimAssessment, EvidenceNode, EvidenceEdge } from "../evidence-graph/types.js";
import type { PulseExport } from "../privacy/export.js";
import type { ResearchExport } from "../privacy/research-export.js";
import { PersonalEvidenceError } from "./errors.js";
import {
  PERSONAL_EVIDENCE_API_FORMAT,
  PERSONAL_EVIDENCE_API_SCHEMA_VERSION,
  PERSONAL_EVIDENCE_API_VERSION,
  type PersonalEvidenceApi,
  type PersonalEvidenceApiDescription,
  type PersonalEvidenceApiSnapshot,
  type PersonalEvidenceClaim,
  type PersonalEvidenceClaimDetail,
  type PersonalEvidenceClaimQuery,
  type PersonalEvidenceConfidence,
  type PersonalEvidenceEdge,
  type PersonalEvidenceEdgeQuery,
  type PersonalEvidenceNode,
  type PersonalEvidenceNodeQuery,
  type PersonalEvidenceExportOptions,
} from "./types.js";

const DESCRIPTION = "A read-only view of the claims and graph evidence currently held by Pulse. Query methods contain no raw events, metric attributes or notes; export methods are explicit privacy-aware hand-offs.";
const MAX_QUERY_RESULTS = 100;

export interface PersonalEvidenceApiExports {
  fullExport?: (options?: PersonalEvidenceExportOptions) => PulseExport;
  researchExport?: (options?: PersonalEvidenceExportOptions) => ResearchExport;
}

const PRIVACY: PersonalEvidenceApiDescription["privacy"] = {
  rawEvents: false,
  rawAttributes: false,
  rawNotes: false,
  sensitiveSourceRecords: false,
  statementHandling: "claim-and-evidence-statements-may-be-personal-text",
};

// Keep the public description literal aligned with the type without exposing
// mutable internal arrays or objects to callers.
const DESCRIPTION_TEMPLATE: PersonalEvidenceApiDescription = {
  format: PERSONAL_EVIDENCE_API_FORMAT,
  apiVersion: PERSONAL_EVIDENCE_API_VERSION,
  readOnly: true,
  transport: "in-process",
  capabilities: ["claims.read", "evidence.read", "edges.read", "snapshot.read", "search"],
  privacy: {
    ...PRIVACY,
    statementHandling: "claim-and-evidence-statements-may-be-personal-text",
  },
};

/** Creates a query facade over a caller-owned, live evidence graph. */
export function createPersonalEvidenceApi(
  getGraph: () => EvidenceGraph,
  now: () => number = Date.now,
  exports: PersonalEvidenceApiExports = {},
): PersonalEvidenceApi {
  const readClaim = (id: string): PersonalEvidenceClaimDetail | null => {
    const graph = getGraph();
    if (!graph.getClaim(id)) return null;
    const assessment = graph.assess(id);
    return {
      ...toClaim(assessment),
      supportingEvidence: assessment.supports.map(toEvidence),
      refutingEvidence: assessment.against.map(toEvidence),
      unresolvedEvidence: assessment.unresolved.map(toEvidence),
      edges: graph.edgesForClaim(id).map(toEdge),
    };
  };

  return {
    describe(): PersonalEvidenceApiDescription {
      return {
        ...DESCRIPTION_TEMPLATE,
        capabilities: [...DESCRIPTION_TEMPLATE.capabilities],
        privacy: { ...DESCRIPTION_TEMPLATE.privacy },
      };
    },

    snapshot(): PersonalEvidenceApiSnapshot {
      const graph = getGraph();
      const claims = graph.assessAll().map(toClaim);
      const evidence = graph.listEvidence().map(toEvidence);
      const edges = graph.listEdges().map(toEdge);
      return {
        format: PERSONAL_EVIDENCE_API_FORMAT,
        apiVersion: PERSONAL_EVIDENCE_API_VERSION,
        schemaVersion: PERSONAL_EVIDENCE_API_SCHEMA_VERSION,
        generatedAt: new Date(now()).toISOString(),
        description: DESCRIPTION,
        privacy: { ...DESCRIPTION_TEMPLATE.privacy },
        counts: { claims: claims.length, evidence: evidence.length, edges: edges.length },
        claims,
        evidence,
        edges,
      };
    },

    listClaims(query: PersonalEvidenceClaimQuery = {}): PersonalEvidenceClaim[] {
      const graph = getGraph();
      const statuses = query.status === undefined
        ? null
        : new Set(Array.isArray(query.status) ? query.status : [query.status]);
      const search = query.search?.trim().toLowerCase();
      const tag = query.tag?.trim() || undefined;
      const claims = graph.assessAll()
        .filter((assessment) => statuses === null || statuses.has(assessment.status))
        .filter((assessment) => tag === undefined || assessment.claim.tags.includes(tag))
        .filter((assessment) => search === undefined || search.length === 0 || claimMatches(assessment, search))
        .map(toClaim);
      return applyLimit(claims, query.limit);
    },

    getClaim(id: string): PersonalEvidenceClaimDetail | null {
      return readClaim(id);
    },

    explainClaim(id: string): PersonalEvidenceClaimDetail | null {
      return readClaim(id);
    },

    listEvidence(query: PersonalEvidenceNodeQuery = {}): PersonalEvidenceNode[] {
      const graph = getGraph();
      const claimEvidenceIds = query.claimId === undefined
        ? null
        : new Set(graph.edgesForClaim(query.claimId).map((edge) => edge.from));
      const evidence = graph.listEvidence()
        .filter((node) => query.kind === undefined || node.kind === query.kind)
        .filter((node) => claimEvidenceIds === null || claimEvidenceIds.has(node.id))
        .map(toEvidence);
      return applyLimit(evidence, query.limit);
    },

    getEvidence(id: string): PersonalEvidenceNode | null {
      const evidence = getGraph().getEvidence(id);
      return evidence ? toEvidence(evidence) : null;
    },

    listEdges(query: PersonalEvidenceEdgeQuery = {}): PersonalEvidenceEdge[] {
      const edges = getGraph().listEdges()
        .filter((edge) => query.claimId === undefined || edge.to === query.claimId)
        .filter((edge) => query.evidenceId === undefined || edge.from === query.evidenceId)
        .filter((edge) => query.kind === undefined || edge.kind === query.kind)
        .map(toEdge);
      return applyLimit(edges, query.limit);
    },

    fullExport(options: PersonalEvidenceExportOptions = {}): PulseExport {
      return runExport("full", exports.fullExport, options);
    },

    researchExport(options: PersonalEvidenceExportOptions = {}): ResearchExport {
      return runExport("research", exports.researchExport, options);
    },
  };
}

function runExport<T>(
  kind: "full" | "research",
  exportData: ((options?: PersonalEvidenceExportOptions) => T) | undefined,
  options: PersonalEvidenceExportOptions,
): T {
  if (!exportData) {
    throw new PersonalEvidenceError(
      "EXPORT_FAILED",
      `The ${kind} export is only available from a Pulse-owned Personal Evidence API.`,
    );
  }
  try {
    return exportData(options);
  } catch (error) {
    throw new PersonalEvidenceError("EXPORT_FAILED", `The ${kind} export failed.`, error);
  }
}

function toClaim(assessment: ClaimAssessment): PersonalEvidenceClaim {
  return {
    id: assessment.claim.id,
    statement: assessment.claim.statement,
    createdAt: assessment.claim.createdAt,
    updatedAt: assessment.claim.updatedAt,
    derivedFrom: assessment.claim.derivedFrom ?? null,
    tags: [...assessment.claim.tags],
    status: assessment.status,
    confidence: toConfidence(assessment.confidence),
    problems: [...assessment.problems],
    supportingEvidenceIds: assessment.supports.map((node) => node.id),
    refutingEvidenceIds: assessment.against.map((node) => node.id),
    unresolvedEvidenceIds: assessment.unresolved.map((node) => node.id),
  };
}

function toEvidence(node: EvidenceNode): PersonalEvidenceNode {
  return {
    id: node.id,
    kind: node.kind,
    refId: node.refId,
    label: node.label,
    evidenceClass: node.evidenceClass,
    confidence: toConfidence(node.confidence),
    statement: node.statement,
  };
}

function toEdge(edge: EvidenceEdge): PersonalEvidenceEdge {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    kind: edge.kind,
    weight: edge.weight,
    confidence: edge.confidence,
    justifiedBy: [...edge.justifiedBy],
    label: edge.label,
  };
}

function toConfidence(confidence: {
  level: PersonalEvidenceConfidence["level"];
  score: number;
  reasons: readonly string[];
  limitations: readonly string[];
}): PersonalEvidenceConfidence {
  return {
    level: confidence.level,
    score: confidence.score,
    reasons: [...confidence.reasons],
    limitations: [...confidence.limitations],
  };
}

function claimMatches(assessment: ClaimAssessment, search: string): boolean {
  const haystack = [
    assessment.claim.id,
    assessment.claim.statement,
    ...assessment.claim.tags,
    ...assessment.supports.flatMap((node) => [node.id, node.label, node.statement]),
    ...assessment.against.flatMap((node) => [node.id, node.label, node.statement]),
    ...assessment.unresolved.flatMap((node) => [node.id, node.label, node.statement]),
  ].join("\n").toLowerCase();
  return haystack.includes(search);
}

function applyLimit<T>(items: T[], requested: number | undefined): T[] {
  if (requested === undefined) return items;
  const limit = Number.isFinite(requested)
    ? Math.max(0, Math.min(MAX_QUERY_RESULTS, Math.floor(requested)))
    : MAX_QUERY_RESULTS;
  return items.slice(0, limit);
}
