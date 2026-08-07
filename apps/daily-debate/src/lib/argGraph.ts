// Argument graph: claim → evidence → counterclaim → rebuttal → impact
// Each debate turn can host several nodes; the graph as a whole lets the
// judge explain *why* a side won instead of just returning a number.

export type ArgNodeKind = "claim" | "evidence" | "counterclaim" | "rebuttal" | "impact";
export type Owner = "a" | "b" | "ai"; // ai = solo opponent
export type EvidenceStrength = "anecdotal" | "general" | "cited" | "strong";
export type Fallacy =
  | "strawman"
  | "ad_hominem"
  | "false_dilemma"
  | "slippery_slope"
  | "appeal_to_emotion"
  | "hasty_generalization"
  | "appeal_to_authority"
  | "whataboutism"
  | "begging_the_question"
  | "equivocation"
  | "none";

export interface ArgNode {
  id: string;
  kind: ArgNodeKind;
  owner: Owner;
  text: string;
  round: number;
  // only for evidence nodes
  evidenceStrength?: EvidenceStrength;
  // only for rebuttal nodes
  targets?: string[]; // node ids this directly rebuts
  fallacy?: Fallacy;
}

export interface ArgEdge {
  from: string;
  to: string;
  relation: "supports" | "counters" | "rebuts" | "impacts";
}

export interface DroppedArgument {
  nodeId: string;
  text: string;
  owner: Owner; // the side whose argument was dropped by the opponent
  round: number;
}

export interface Contradiction {
  a: string; // node id
  b: string; // node id
  explanation: string;
  owner: Owner; // who contradicted themselves
}

export interface Concession {
  nodeId: string; // the conceded node
  by: Owner;
  note: string;
}

export interface EvidenceStats {
  total: number;
  byOwner: Record<Owner, number>;
  byStrength: Record<EvidenceStrength, number>;
  unsupportedClaimIds: string[]; // claim ids with no evidence edge
}

export interface FallacyTag {
  nodeId: string;
  fallacy: Fallacy;
  note: string;
}

export interface ImpactComparison {
  a: number; // 0-100, judge's weighting of which impacts matter more
  b: number;
  rationale: string;
}

export interface ArgGraph {
  nodes: ArgNode[];
  edges: ArgEdge[];
  dropped: DroppedArgument[];
  contradictions: Contradiction[];
  concessions: Concession[];
  fallacies: FallacyTag[];
  evidenceStats: EvidenceStats;
  impactComparison: ImpactComparison | null;
}

// ---- Pure helpers (no I/O) ------------------------------------------------

export function unsupportedClaims(graph: ArgGraph): ArgNode[] {
  const ids = new Set(graph.evidenceStats.unsupportedClaimIds);
  return graph.nodes.filter((n) => n.kind === "claim" && ids.has(n.id));
}

export function emptyGraph(): ArgGraph {
  return {
    nodes: [],
    edges: [],
    dropped: [],
    contradictions: [],
    concessions: [],
    fallacies: [],
    evidenceStats: { total: 0, byOwner: { a: 0, b: 0, ai: 0 }, byStrength: { anecdotal: 0, general: 0, cited: 0, strong: 0 }, unsupportedClaimIds: [] },
    impactComparison: null,
  };
}

// Validate a graph produced by the judge (defense in depth before persistence).
export function validateGraph(graph: ArgGraph): string[] {
  const errors: string[] = [];
  const ids = new Set(graph.nodes.map((n) => n.id));
  for (const e of graph.edges) {
    if (!ids.has(e.from)) errors.push(`Edge from unknown node ${e.from}`);
    if (!ids.has(e.to)) errors.push(`Edge to unknown node ${e.to}`);
  }
  for (const id of graph.evidenceStats.unsupportedClaimIds) {
    if (!ids.has(id)) errors.push(`Unsupported claim id ${id} not in nodes`);
  }
  for (const d of graph.dropped) if (!ids.has(d.nodeId)) errors.push(`Dropped ${d.nodeId} not in nodes`);
  for (const c of graph.contradictions) {
    if (!ids.has(c.a)) errors.push(`Contradiction a=${c.a} not in nodes`);
    if (!ids.has(c.b)) errors.push(`Contradiction b=${c.b} not in nodes`);
  }
  for (const f of graph.fallacies) if (!ids.has(f.nodeId)) errors.push(`Fallacy ${f.nodeId} not in nodes`);
  return errors;
}

// Build a quick lookup: which claims are supported (have an evidence edge into them).
export function claimSupportMap(graph: ArgGraph): Map<string, boolean> {
  const supported = new Set(
    graph.edges.filter((e) => e.relation === "supports").map((e) => e.from),
  );
  // convention: evidence --supports--> claim, so the claim is `to`; adjust to handle both orientations stored by the judge
  const supportedClaims = new Set<string>();
  for (const e of graph.edges) if (e.relation === "supports") supportedClaims.add(e.to), supportedClaims.add(e.from);
  const map = new Map<string, boolean>();
  for (const n of graph.nodes) if (n.kind === "claim") map.set(n.id, supportedClaims.has(n.id));
  // if the judge used unsupportedClaimIds, prefer that ground truth
  for (const id of graph.evidenceStats.unsupportedClaimIds) map.set(id, false);
  return map;
}
