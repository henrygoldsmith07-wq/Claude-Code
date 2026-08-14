/**
 * Personal knowledge graph.
 *
 * Not a general-purpose graph database — a typed record of what Pulse has
 * learned about one person and how the pieces connect. Its job is to answer
 * "why do you believe that?" by walking edges back to events, and to surface
 * clusters ("everything that touches your evening study").
 *
 * Every edge carries the finding or experiment that justifies it. An edge
 * without provenance cannot be added.
 */

import type { SourceId } from "../events/schema.js";
import type { Finding } from "../discovery/finding.js";
import type { Hypothesis } from "../hypotheses/tracker.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { MetricDefinition } from "../metrics/registry.js";

export type NodeKind = "metric" | "source" | "subject" | "finding" | "hypothesis" | "experiment";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  /** Free-form typed payload for the UI; never read by graph logic. */
  attributes: Record<string, string | number | boolean>;
}

export type EdgeKind =
  | "measured-by"
  | "associated-with"
  | "predicted-by"
  | "tested-by"
  | "derived-from"
  | "about";

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  /** Strength in 0..1. For associations, |effect| normalised. */
  weight: number;
  /** Confidence in the edge itself, 0..1. */
  confidence: number;
  /** Ids of the findings/experiments that justify this edge. Never empty. */
  justifiedBy: string[];
  label: string;
}

export interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Product of edge confidences — a path is only as strong as its weakest link. */
  strength: number;
}

export class KnowledgeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge>();
  private adjacency = new Map<string, Set<string>>();

  addNode(node: GraphNode): GraphNode {
    const existing = this.nodes.get(node.id);
    if (existing) {
      // Merge rather than replace: a metric node gains attributes as findings
      // accumulate, and losing them on re-add would make the graph unstable.
      existing.attributes = { ...existing.attributes, ...node.attributes };
      return existing;
    }
    this.nodes.set(node.id, node);
    this.adjacency.set(node.id, new Set());
    return node;
  }

  addEdge(edge: GraphEdge): GraphEdge {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`Cannot add edge ${edge.id}: both endpoints must exist`);
    }
    if (edge.justifiedBy.length === 0) {
      throw new Error(`Cannot add edge ${edge.id}: every edge must cite the evidence that justifies it`);
    }
    const existing = this.edges.get(edge.id);
    if (existing) {
      existing.justifiedBy = [...new Set([...existing.justifiedBy, ...edge.justifiedBy])];
      existing.weight = Math.max(existing.weight, edge.weight);
      existing.confidence = Math.max(existing.confidence, edge.confidence);
      return existing;
    }
    this.edges.set(edge.id, edge);
    this.adjacency.get(edge.from)!.add(edge.id);
    this.adjacency.get(edge.to)!.add(edge.id);
    return edge;
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  listNodes(kind?: NodeKind): GraphNode[] {
    const all = [...this.nodes.values()];
    return (kind ? all.filter((node) => node.kind === kind) : all).sort((a, b) => a.id.localeCompare(b.id));
  }

  listEdges(kind?: EdgeKind): GraphEdge[] {
    const all = [...this.edges.values()];
    return (kind ? all.filter((edge) => edge.kind === kind) : all).sort((a, b) => a.id.localeCompare(b.id));
  }

  neighbours(nodeId: string): { edge: GraphEdge; node: GraphNode }[] {
    const edgeIds = this.adjacency.get(nodeId);
    if (!edgeIds) return [];
    const out: { edge: GraphEdge; node: GraphNode }[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId)!;
      const otherId = edge.from === nodeId ? edge.to : edge.from;
      const node = this.nodes.get(otherId);
      if (node) out.push({ edge, node });
    }
    return out.sort((a, b) => b.edge.confidence * b.edge.weight - a.edge.confidence * a.edge.weight);
  }

  /**
   * Strongest path between two nodes, by product of edge confidences.
   * Breadth-first with a best-strength relaxation — the graph is small enough
   * that a full Dijkstra would be ceremony.
   */
  strongestPath(fromId: string, toId: string, maxDepth = 4): GraphPath | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    if (fromId === toId) return { nodes: [this.nodes.get(fromId)!], edges: [], strength: 1 };

    const best = new Map<string, { strength: number; path: GraphEdge[] }>();
    best.set(fromId, { strength: 1, path: [] });
    let frontier = [fromId];

    for (let depth = 0; depth < maxDepth; depth += 1) {
      const next: string[] = [];
      for (const nodeId of frontier) {
        const current = best.get(nodeId)!;
        for (const { edge, node } of this.neighbours(nodeId)) {
          const strength = current.strength * edge.confidence;
          const known = best.get(node.id);
          if (known && known.strength >= strength) continue;
          best.set(node.id, { strength, path: [...current.path, edge] });
          next.push(node.id);
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }

    const target = best.get(toId);
    if (!target) return null;
    const nodes = [this.nodes.get(fromId)!];
    let cursor = fromId;
    for (const edge of target.path) {
      cursor = edge.from === cursor ? edge.to : edge.from;
      nodes.push(this.nodes.get(cursor)!);
    }
    return { nodes, edges: target.path, strength: target.strength };
  }

  get size(): { nodes: number; edges: number } {
    return { nodes: this.nodes.size, edges: this.edges.size };
  }
}

export interface BuildGraphInput {
  definitions: readonly MetricDefinition[];
  findings: readonly Finding[];
  hypotheses?: readonly Hypothesis[];
  experiments?: readonly ExperimentResult[];
}

/** Assembles the graph from what the engine has produced. */
export function buildKnowledgeGraph(input: BuildGraphInput): KnowledgeGraph {
  const graph = new KnowledgeGraph();

  const sources = new Set<SourceId>();
  for (const definition of input.definitions) {
    graph.addNode({
      id: `metric:${definition.id}`,
      kind: "metric",
      label: definition.name,
      attributes: {
        role: definition.role,
        direction: definition.direction,
        category: definition.category,
        unit: definition.unit,
      },
    });
    sources.add(definition.source);
  }
  for (const source of sources) {
    graph.addNode({ id: `source:${source}`, kind: "source", label: String(source), attributes: {} });
  }
  for (const definition of input.definitions) {
    graph.addEdge({
      id: `measured:${definition.id}`,
      from: `metric:${definition.id}`,
      to: `source:${definition.source}`,
      kind: "measured-by",
      weight: 1,
      confidence: 1,
      justifiedBy: [`catalogue:${definition.id}`],
      label: `${definition.name} comes from ${definition.source}`,
    });
  }

  for (const finding of input.findings) {
    graph.addNode({
      id: `finding:${finding.id}`,
      kind: "finding",
      label: finding.title,
      attributes: {
        evidenceClass: finding.evidenceClass,
        confidence: finding.confidence.level,
        sampleSize: finding.sampleSize,
        effect: finding.effect.value,
      },
    });

    for (const metricId of finding.metricIds) {
      const nodeId = `metric:${metricId}`;
      if (!graph.getNode(nodeId)) continue;
      graph.addEdge({
        id: `about:${finding.id}:${metricId}`,
        from: `finding:${finding.id}`,
        to: nodeId,
        kind: "about",
        weight: 1,
        confidence: finding.confidence.score,
        justifiedBy: [finding.id],
        label: "concerns",
      });
    }

    // The association edge itself, between the two metrics involved.
    const [outcome, driver] = finding.metricIds;
    if (outcome && driver && graph.getNode(`metric:${outcome}`) && graph.getNode(`metric:${driver}`)) {
      graph.addEdge({
        id: `assoc:${driver}->${outcome}`,
        from: `metric:${driver}`,
        to: `metric:${outcome}`,
        kind: finding.evidenceClass === "experiment" ? "tested-by" : "associated-with",
        weight: Math.min(1, Math.abs(finding.effect.value)),
        confidence: finding.confidence.score,
        justifiedBy: [finding.id],
        label: finding.title,
      });
    }
  }

  for (const hypothesis of input.hypotheses ?? []) {
    graph.addNode({
      id: `hypothesis:${hypothesis.id}`,
      kind: "hypothesis",
      label: hypothesis.statement,
      attributes: { status: hypothesis.status, predictedEffect: hypothesis.predictedEffect },
    });
    if (hypothesis.originFindingId && graph.getNode(`finding:${hypothesis.originFindingId}`)) {
      graph.addEdge({
        id: `derived:${hypothesis.id}`,
        from: `hypothesis:${hypothesis.id}`,
        to: `finding:${hypothesis.originFindingId}`,
        kind: "derived-from",
        weight: 1,
        confidence: 0.9,
        justifiedBy: [hypothesis.originFindingId],
        label: "proposed from",
      });
    }
  }

  for (const experiment of input.experiments ?? []) {
    graph.addNode({
      id: `experiment:${experiment.experimentId}`,
      kind: "experiment",
      label: experiment.summary,
      attributes: { verdict: experiment.verdict, effect: experiment.observedEffect },
    });
    if (graph.getNode(`hypothesis:${experiment.hypothesisId}`)) {
      graph.addEdge({
        id: `tested:${experiment.experimentId}`,
        from: `experiment:${experiment.experimentId}`,
        to: `hypothesis:${experiment.hypothesisId}`,
        kind: "tested-by",
        weight: 1,
        confidence: experiment.confidence.score,
        justifiedBy: [experiment.experimentId],
        label: `verdict: ${experiment.verdict}`,
      });
    }
  }

  return graph;
}
