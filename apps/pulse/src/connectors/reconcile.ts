/**
 * Cross-source duplicate reconciliation.
 *
 * The store's dedupe key catches the same record arriving twice from the same
 * source. It cannot catch the harder case, which appears the moment a user
 * connects more than one health source:
 *
 *   Apple Health hands over yesterday's 11,204 steps. So does Garmin. It is
 *   one pair of legs, counted once by one watch, and Apple Health is simply
 *   re-exporting what Garmin Connect wrote into it.
 *
 * Left alone this does three kinds of damage, in increasing order of severity:
 * daily totals roughly double; the sample size looks twice as large as it is,
 * so confidence is overstated; and the two "sources" agree perfectly, which
 * reads as independent corroboration when it is one measurement wearing two
 * hats. The third is the dangerous one, because it is invisible.
 *
 * Nothing is deleted here. Reconciliation returns a *view* — the events to
 * analyse — plus a report of exactly what it set aside and why, so the user
 * can look at the decision and override the precedence if it got it wrong.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { toInstant } from "../events/time.js";
import { attributedVendor } from "./health-events.js";

export interface ReconcileOptions {
  /**
   * Sources in the order the user trusts them, most trusted first. Anything
   * not listed is ranked by the automatic rules below.
   */
  sourcePrecedence?: readonly SourceId[];
  /**
   * Sources currently connected. Used to recognise a re-export: an Apple
   * Health reading written by Garmin Connect is only a duplicate if Garmin
   * itself is also connected — otherwise it is the only copy there is, and
   * dropping it would lose the data entirely.
   */
  connectedSources?: readonly SourceId[];
  /** Share of the shorter event that must overlap for two to count as the same. */
  overlapThreshold?: number;
}

export interface SupersededEvent {
  event: PulseEvent;
  /** Plain-language explanation, shown on the reconciliation card. */
  reason: string;
}

export interface DuplicateGroup {
  eventType: string;
  /** The local date or time window the group covers. */
  window: string;
  kept: PulseEvent[];
  superseded: SupersededEvent[];
}

export interface SourceReconciliation {
  source: SourceId;
  kept: number;
  superseded: number;
}

export interface ReconciliationReport {
  groups: DuplicateGroup[];
  keptCount: number;
  supersededCount: number;
  bySource: SourceReconciliation[];
}

export interface ReconciliationResult {
  /** The events analysis should use. */
  events: PulseEvent[];
  report: ReconciliationReport;
}

const DEFAULT_OVERLAP = 0.5;

/**
 * A sleep event is stamped at its midpoint (see `health-events.ts`), so its
 * interval runs half its duration either side. Everything else starts when it
 * says it starts.
 */
function intervalOf(event: PulseEvent): { start: number; end: number } {
  const at = toInstant(event.occurredAt);
  const duration = event.durationMs ?? 0;
  if (event.type === "health.sleep") return { start: at - duration / 2, end: at + duration / 2 };
  return { start: at, end: at + duration };
}

function overlapShare(a: PulseEvent, b: PulseEvent): number {
  const first = intervalOf(a);
  const second = intervalOf(b);
  const shorter = Math.min(first.end - first.start, second.end - second.start);
  if (shorter <= 0) return 0;
  const intersection = Math.min(first.end, second.end) - Math.max(first.start, second.start);
  return Math.max(0, intersection) / shorter;
}

/**
 * The source an event was re-exported from, when that source is connected in
 * its own right.
 *
 * The second condition matters: Apple Health holding a reading Garmin Connect
 * wrote is only a duplicate if Garmin is *also* connected directly. If it is
 * not, that re-export is the only copy in existence and dropping it would lose
 * the data outright.
 */
function isReExportOf(event: PulseEvent, connected: readonly SourceId[]): SourceId | null {
  if (event.attributes.first_hand !== false) return null;
  const originApp = event.attributes.origin_app;
  if (typeof originApp !== "string") return null;
  const vendor = attributedVendor(originApp);
  if (vendor === null) return null;
  return connected.find((source) => source !== event.source && String(source) === vendor) ?? null;
}

/**
 * Ranks one event's claim to be the copy worth keeping. Lower wins.
 *
 * The ordering is deliberate. A user's explicit precedence is obeyed first,
 * because they know which watch they actually wore. Then a recognised
 * re-export is pushed to the back — it is definitionally a second-hand copy of
 * something else in the same group. Then first-hand readings beat unattributed
 * ones, and richer events beat thinner ones, because keeping the copy with
 * five metrics over the copy with two loses nothing.
 */
function rankOf(event: PulseEvent, options: Required<Pick<ReconcileOptions, "sourcePrecedence" | "connectedSources">>) {
  const explicit = options.sourcePrecedence.indexOf(event.source);
  return {
    explicit: explicit >= 0 ? explicit : options.sourcePrecedence.length,
    reExport: isReExportOf(event, options.connectedSources) ? 1 : 0,
    secondHand: event.attributes.first_hand === false ? 1 : 0,
    metricDeficit: -Object.keys(event.metrics).length,
    source: String(event.source),
    id: event.id,
  };
}

function compareRank(a: ReturnType<typeof rankOf>, b: ReturnType<typeof rankOf>): number {
  return (
    a.explicit - b.explicit ||
    a.reExport - b.reExport ||
    a.secondHand - b.secondHand ||
    a.metricDeficit - b.metricDeficit ||
    // Ties are broken on ids so the same inputs always produce the same
    // survivor — a reconciliation that reshuffles between runs would make
    // every downstream number irreproducible.
    a.source.localeCompare(b.source) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Clusters events of one type that describe the same occasion.
 *
 * Events carrying a duration are clustered by overlap; daily summaries, which
 * have none, are clustered by local date.
 */
function clusterEvents(events: readonly PulseEvent[], overlapThreshold: number): { window: string; events: PulseEvent[] }[] {
  const timed = events.filter((event) => (event.durationMs ?? 0) > 0);
  const daily = events.filter((event) => (event.durationMs ?? 0) <= 0);

  const clusters: { window: string; events: PulseEvent[] }[] = [];

  const byDate = new Map<string, PulseEvent[]>();
  for (const event of daily) {
    const list = byDate.get(event.localDate);
    if (list) list.push(event);
    else byDate.set(event.localDate, [event]);
  }
  for (const [date, group] of byDate) clusters.push({ window: date, events: group });

  const sorted = [...timed].sort((a, b) => intervalOf(a).start - intervalOf(b).start || a.id.localeCompare(b.id));
  for (const event of sorted) {
    const target = clusters.find(
      (cluster) =>
        cluster.events.some((member) => (member.durationMs ?? 0) > 0 && overlapShare(member, event) >= overlapThreshold),
    );
    if (target) target.events.push(event);
    else clusters.push({ window: describeWindow(event), events: [event] });
  }

  return clusters;
}

function describeWindow(event: PulseEvent): string {
  const { start, end } = intervalOf(event);
  return `${new Date(start).toISOString()}/${new Date(end).toISOString()}`;
}

function reasonFor(loser: PulseEvent, winner: PulseEvent, connected: readonly SourceId[]): string {
  const reExportOf = isReExportOf(loser, connected);
  if (reExportOf) {
    return `${loser.source} is re-exporting a reading written by ${reExportOf}, which is connected directly.`;
  }
  if (loser.attributes.first_hand === false && winner.attributes.first_hand !== false) {
    return `${winner.source} measured this first-hand; ${loser.source} received it from another app.`;
  }
  const winnerMetrics = Object.keys(winner.metrics).length;
  const loserMetrics = Object.keys(loser.metrics).length;
  if (winnerMetrics > loserMetrics) {
    return `${winner.source} reported ${winnerMetrics} measurements for this against ${loserMetrics} from ${loser.source}.`;
  }
  return `${winner.source} takes precedence over ${loser.source} for this kind of data.`;
}

/**
 * Reconciles a set of events, returning the ones to analyse and a full account
 * of what was set aside.
 *
 * Events from a single source are never touched: that is the store's dedupe
 * job, and a person who legitimately naps twice in a day should not lose a nap
 * to a heuristic written for duplicate watches.
 */
export function reconcileEvents(
  events: readonly PulseEvent[],
  options: ReconcileOptions = {},
): ReconciliationResult {
  const resolved = {
    sourcePrecedence: options.sourcePrecedence ?? [],
    connectedSources: options.connectedSources ?? [...new Set(events.map((event) => event.source))],
  };
  const overlapThreshold = options.overlapThreshold ?? DEFAULT_OVERLAP;

  const byType = new Map<string, PulseEvent[]>();
  for (const event of events) {
    const list = byType.get(event.type);
    if (list) list.push(event);
    else byType.set(event.type, [event]);
  }

  const groups: DuplicateGroup[] = [];
  const supersededIds = new Set<string>();

  for (const [eventType, typeEvents] of byType) {
    for (const cluster of clusterEvents(typeEvents, overlapThreshold)) {
      const sources = new Set(cluster.events.map((event) => event.source));
      if (sources.size < 2) continue;

      const winner = [...cluster.events].sort((a, b) => compareRank(rankOf(a, resolved), rankOf(b, resolved)))[0]!;
      const kept = cluster.events.filter((event) => event.source === winner.source);
      const superseded = cluster.events
        .filter((event) => event.source !== winner.source)
        .map((event) => ({ event, reason: reasonFor(event, winner, resolved.connectedSources) }));

      for (const entry of superseded) supersededIds.add(entry.event.id);
      groups.push({ eventType, window: cluster.window, kept, superseded });
    }
  }

  const bySourceCounts = new Map<SourceId, SourceReconciliation>();
  for (const event of events) {
    const row = bySourceCounts.get(event.source) ?? { source: event.source, kept: 0, superseded: 0 };
    if (supersededIds.has(event.id)) row.superseded += 1;
    else row.kept += 1;
    bySourceCounts.set(event.source, row);
  }

  return {
    events: events.filter((event) => !supersededIds.has(event.id)),
    report: {
      groups: groups.sort((a, b) => a.eventType.localeCompare(b.eventType) || a.window.localeCompare(b.window)),
      keptCount: events.length - supersededIds.size,
      supersededCount: supersededIds.size,
      bySource: [...bySourceCounts.values()].sort((a, b) => String(a.source).localeCompare(String(b.source))),
    },
  };
}
