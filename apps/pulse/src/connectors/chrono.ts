/**
 * Chrono connector — calendar shape.
 *
 * Calendar data earns its place in Pulse as a *confounder source* more than as
 * an outcome: "I revise badly on Wednesdays" is usually "Wednesdays are
 * fragmented". So the connector emits day-shape metrics (fragmentation, longest
 * free block) that the discovery layer can control for, not just event counts.
 *
 * Titles are never read. Only durations, counts and categories cross the
 * boundary.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";

export interface ChronoEventRecord {
  kind: "event";
  id: string;
  startsAt: string;
  endsAt: string;
  category?: "work" | "study" | "personal" | "health" | "travel" | "other";
  attendeeCount?: number;
  /** Marked by the user as protected deep-work time. */
  focusBlock?: boolean;
  timezone?: string;
}

export interface ChronoDayRecord {
  kind: "day";
  id: string;
  dateISO: string;
  computedAt: string;
  scheduledMinutes: number;
  eventCount: number;
  /** Longest uninterrupted gap between commitments, in minutes. */
  longestFreeBlockMinutes: number;
  firstCommitmentMinutes?: number;
  timezone?: string;
}

export type ChronoRecord = ChronoEventRecord | ChronoDayRecord;

const SCOPES: ConnectorScope[] = [
  { id: "events", description: "Calendar entries: start, end, category and attendee count. Titles are never read.", readsContent: false },
  { id: "day-shape", description: "Daily summary: how booked the day was and how fragmented", readsContent: false },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "chrono.calendar_event",
    category: "schedule",
    description: "A calendar commitment",
    metrics: [
      { key: "duration_minutes", unit: "minutes", description: "Length of the commitment", range: { min: 0, max: 1440 } },
      { key: "attendee_count", unit: "count", description: "People involved", range: { min: 0, max: 500 } },
      { key: "is_focus_block", unit: "ratio", description: "1 when marked as protected focus time", range: { min: 0, max: 1 } },
    ],
  },
  {
    type: "chrono.day_shape",
    category: "schedule",
    description: "How the day was structured",
    metrics: [
      { key: "scheduled_minutes", unit: "minutes", description: "Minutes committed", range: { min: 0, max: 1440 } },
      { key: "event_count", unit: "count", description: "Number of commitments", range: { min: 0, max: 60 } },
      { key: "longest_free_block_minutes", unit: "minutes", description: "Longest uninterrupted gap", range: { min: 0, max: 1440 } },
      { key: "fragmentation", unit: "ratio", description: "Commitments per booked hour; higher means choppier", range: { min: 0, max: 60 } },
      { key: "first_commitment_minutes", unit: "minutes", description: "Minutes after midnight of the first commitment", range: { min: 0, max: 1439 } },
    ],
  },
];

export function mapChronoRecord(record: ChronoRecord): RawEventInput[] {
  if (record.kind === "event") {
    const start = Date.parse(record.startsAt);
    const end = Date.parse(record.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    const durationMs = end - start;
    const metrics: Record<string, number> = { duration_minutes: durationMs / 60_000 };
    if (typeof record.attendeeCount === "number") metrics.attendee_count = record.attendeeCount;
    if (record.focusBlock !== undefined) metrics.is_focus_block = record.focusBlock ? 1 : 0;

    return [
      {
        source: "chrono",
        sourceEventId: record.id,
        type: "chrono.calendar_event",
        category: "schedule",
        occurredAt: record.startsAt,
        ...(record.timezone ? { timezone: record.timezone } : {}),
        durationMs,
        subject: record.category ?? "other",
        metrics,
        attributes: { calendar_category: record.category ?? "other", solo: (record.attendeeCount ?? 1) <= 1 },
      },
    ];
  }

  const bookedHours = record.scheduledMinutes / 60;
  const metrics: Record<string, number> = {
    scheduled_minutes: record.scheduledMinutes,
    event_count: record.eventCount,
    longest_free_block_minutes: record.longestFreeBlockMinutes,
    fragmentation: bookedHours > 0 ? record.eventCount / bookedHours : 0,
  };
  if (typeof record.firstCommitmentMinutes === "number") {
    metrics.first_commitment_minutes = record.firstCommitmentMinutes;
  }

  return [
    {
      source: "chrono",
      sourceEventId: record.id,
      type: "chrono.day_shape",
      category: "schedule",
      occurredAt: record.computedAt,
      ...(record.timezone ? { timezone: record.timezone } : {}),
      subject: "day",
      metrics,
      attributes: { local_date: record.dateISO },
    },
  ];
}

export function createChronoConnector(reader: SourceReader<ChronoRecord>): Connector {
  return defineReaderConnector<ChronoRecord>({
    id: "chrono",
    name: "Chrono",
    version: "1.0.0",
    category: "schedule",
    description: "Calendar commitments and daily schedule shape. Event titles are never read.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 730,
    reader,
    map: (record) => mapChronoRecord(record),
    timestampOf: (record) => (record.kind === "event" ? record.startsAt : record.computedAt),
  });
}
