/**
 * Cross-app timeline.
 *
 * One chronological view over every source, grouped by local day. This is the
 * substrate for "what happened around my strongest days" questions and the
 * only place the UI is allowed to show raw events, so it carries provenance
 * on every entry.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { eachLocalDate, isoWeekKey, toInstant } from "../events/time.js";
import { timeBucket, type TimeBucket } from "../metrics/compute.js";

export interface TimelineEntry {
  eventId: string;
  source: SourceId;
  type: string;
  category: string;
  occurredAt: string;
  localMinutes: number;
  timeBucket: TimeBucket;
  durationMinutes: number | null;
  subject: string | null;
  metrics: Record<string, number>;
  sensitivity: "normal" | "sensitive";
  /** Where this entry came from, shown on hover in the UI. */
  provenance: { connectorId: string; connectorVersion: string; syncId: string; ingestMode: string };
}

export interface TimelineDay {
  date: string;
  weekKey: string;
  dayOfWeek: number;
  entries: TimelineEntry[];
  sources: SourceId[];
  totalEvents: number;
  /** Minutes of recorded activity, where duration is known. */
  activeMinutes: number;
}

export interface Timeline {
  days: TimelineDay[];
  from: string | null;
  to: string | null;
  sources: SourceId[];
  totalEvents: number;
}

export interface TimelineOptions {
  from?: string;
  to?: string;
  /** Emit empty days too — needed to see gaps rather than infer them. */
  includeEmptyDays?: boolean;
  sources?: readonly SourceId[];
  includeSensitive?: boolean;
}

export function buildTimeline(events: readonly PulseEvent[], options: TimelineOptions = {}): Timeline {
  const sourceFilter = options.sources ? new Set(options.sources) : null;
  const filtered = events
    .filter((event) => (options.includeSensitive ? true : event.sensitivity !== "sensitive"))
    .filter((event) => (sourceFilter ? sourceFilter.has(event.source) : true))
    .filter((event) => (options.from ? event.localDate >= options.from : true))
    .filter((event) => (options.to ? event.localDate <= options.to : true))
    .sort((a, b) => toInstant(a.occurredAt) - toInstant(b.occurredAt));

  const byDate = new Map<string, TimelineEntry[]>();
  for (const event of filtered) {
    const entry: TimelineEntry = {
      eventId: event.id,
      source: event.source,
      type: event.type,
      category: event.category,
      occurredAt: event.occurredAt,
      localMinutes: event.localMinutes,
      timeBucket: timeBucket(event.localMinutes),
      durationMinutes: event.durationMs !== undefined ? event.durationMs / 60_000 : null,
      subject: event.subject ?? null,
      metrics: event.metrics,
      sensitivity: event.sensitivity,
      provenance: {
        connectorId: event.provenance.connectorId,
        connectorVersion: event.provenance.connectorVersion,
        syncId: event.provenance.syncId,
        ingestMode: event.provenance.ingestMode,
      },
    };
    const bucket = byDate.get(event.localDate);
    if (bucket) bucket.push(entry);
    else byDate.set(event.localDate, [entry]);
  }

  const observedDates = [...byDate.keys()].sort();
  const from = options.from ?? observedDates[0] ?? null;
  const to = options.to ?? observedDates[observedDates.length - 1] ?? null;
  const dates = options.includeEmptyDays && from && to ? eachLocalDate(from, to) : observedDates;

  const days: TimelineDay[] = dates.map((date) => {
    const entries = byDate.get(date) ?? [];
    return {
      date,
      weekKey: isoWeekKey(date),
      dayOfWeek: new Date(`${date}T00:00:00Z`).getUTCDay(),
      entries,
      sources: [...new Set(entries.map((entry) => entry.source))],
      totalEvents: entries.length,
      activeMinutes: entries.reduce((acc, entry) => acc + (entry.durationMinutes ?? 0), 0),
    };
  });

  return {
    days,
    from,
    to,
    sources: [...new Set(filtered.map((event) => event.source))],
    totalEvents: filtered.length,
  };
}

/**
 * Events that occurred within `windowHours` around an anchor instant.
 * Used to answer "what was happening around my best day?" without the caller
 * re-implementing window arithmetic.
 */
export function eventsAround(
  events: readonly PulseEvent[],
  anchorInstant: string | number,
  windowHours: number,
  options: { includeSensitive?: boolean } = {},
): PulseEvent[] {
  const anchor = toInstant(anchorInstant);
  const windowMs = windowHours * 3_600_000;
  return events
    .filter((event) => (options.includeSensitive ? true : event.sensitivity !== "sensitive"))
    .filter((event) => Math.abs(toInstant(event.occurredAt) - anchor) <= windowMs)
    .sort((a, b) => toInstant(a.occurredAt) - toInstant(b.occurredAt));
}
