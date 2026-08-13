/**
 * Metric registry.
 *
 * A metric is a *named, defined* quantity — not just any number a connector
 * happened to emit. The registry exists so that:
 *
 *  - discovery only ever scans quantities someone has decided are meaningful,
 *    which is the cheapest way to shrink the multiple-testing family;
 *  - every insight can name its inputs in the user's language;
 *  - direction ("higher is better") is declared once, so a recommendation can
 *    never suggest increasing something that should go down.
 */

import type { EventCategory, PulseEvent, SourceId } from "../events/schema.js";
import type { Connector } from "../connectors/types.js";

export type Aggregation = "mean" | "median" | "sum" | "count" | "rate" | "max" | "min";
export type Direction = "higher-better" | "lower-better" | "neutral";
/** Whether the metric is a thing you *do* or a thing that *happens to you*. */
export type MetricRole = "behaviour" | "outcome" | "context";

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  category: EventCategory;
  source: SourceId;
  /** Event types this metric can be computed from. */
  eventTypes: string[];
  /** Key within `event.metrics`. */
  metricKey: string;
  unit: string;
  aggregation: Aggregation;
  direction: Direction;
  role: MetricRole;
  /** Below this many observations Pulse will not publish a finding about it. */
  minSampleForInsight: number;
  range?: { min: number; max: number };
  /** Metrics that are near-tautologically related — never reported as a discovery. */
  trivialPartners?: string[];
  /** How to format a value for display. */
  format?: "number" | "percent" | "duration-minutes";
}

export class MetricRegistry {
  private definitions = new Map<string, MetricDefinition>();

  register(definition: MetricDefinition): this {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Metric "${definition.id}" is already registered`);
    }
    this.definitions.set(definition.id, definition);
    return this;
  }

  registerAll(definitions: readonly MetricDefinition[]): this {
    for (const definition of definitions) this.register(definition);
    return this;
  }

  get(id: string): MetricDefinition | undefined {
    return this.definitions.get(id);
  }

  require(id: string): MetricDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Unknown metric: ${id}`);
    return definition;
  }

  list(): MetricDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  bySource(source: SourceId): MetricDefinition[] {
    return this.list().filter((d) => d.source === source);
  }

  byRole(role: MetricRole): MetricDefinition[] {
    return this.list().filter((d) => d.role === role);
  }

  /** Metrics for which the given events actually contain data. */
  available(events: readonly PulseEvent[]): MetricDefinition[] {
    const present = new Set<string>();
    for (const event of events) {
      for (const key of Object.keys(event.metrics)) present.add(`${event.type}::${key}`);
    }
    return this.list().filter((d) => d.eventTypes.some((type) => present.has(`${type}::${d.metricKey}`)));
  }

  /**
   * A pair is trivial when one metric mechanically determines the other
   * (marks awarded vs accuracy). Reporting those as discoveries is the
   * fastest way to lose a user's trust.
   */
  isTrivialPair(a: string, b: string): boolean {
    const da = this.definitions.get(a);
    const db = this.definitions.get(b);
    if (!da || !db) return false;
    if (da.trivialPartners?.includes(b)) return true;
    if (db.trivialPartners?.includes(a)) return true;
    // Same source, same event type, same underlying key: same thing twice.
    return da.metricKey === db.metricKey && da.eventTypes.some((t) => db.eventTypes.includes(t));
  }

  size(): number {
    return this.definitions.size;
  }
}

/**
 * Seeds a registry from what connectors declare they emit.
 *
 * Derived definitions are conservative: role defaults to `context` and the
 * metric is not eligible for outcome analysis until someone classifies it in
 * `DEFAULT_METRICS`. That keeps a newly added third-party connector from
 * immediately generating claims about "outcomes" nobody has vetted.
 */
export function deriveDefinitions(connector: Connector): MetricDefinition[] {
  const out: MetricDefinition[] = [];
  for (const spec of connector.emits) {
    for (const metric of spec.metrics) {
      out.push({
        id: `${spec.type}.${metric.key}`,
        name: `${spec.description} — ${metric.key.replace(/_/g, " ")}`,
        description: metric.description,
        category: spec.category,
        source: connector.id,
        eventTypes: [spec.type],
        metricKey: metric.key,
        unit: metric.unit,
        aggregation: metric.unit === "count" ? "sum" : "mean",
        direction: "neutral",
        role: "context",
        minSampleForInsight: 20,
        ...(metric.range ? { range: metric.range } : {}),
      });
    }
  }
  return out;
}
