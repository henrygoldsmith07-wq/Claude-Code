/**
 * Calendar connectors — Google Calendar and Outlook.
 *
 * A calendar earns its place in Pulse as a *confounder source* first and an
 * outcome source second. "My revision is worse on Wednesdays" is almost always
 * "Wednesdays are fragmented", and without the calendar there is no way to
 * tell those apart. So the useful output is the shape of the day — how much of
 * it was spoken for, how broken up it was, how long the biggest surviving free
 * block was — not a count of meetings.
 *
 * Nothing textual crosses the boundary. Titles, descriptions, locations,
 * attendee names and addresses are not in any record type here and are not
 * requested in `scopes`, so a bridge has nowhere to put them.
 *
 * Both providers emit the shared `calendar.*` types. Someone with a work
 * Outlook account and a personal Google account has one fragmented day, not
 * two half-days, and reconciliation can spot the same meeting arriving twice.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";
import { minutesBetween, stampLocalHour } from "./health-events.js";

export type CalendarProvider = "google-calendar" | "outlook-calendar";

/** How the user answered the invitation. Declines are not commitments. */
export type CalendarResponse = "accepted" | "tentative" | "declined" | "needs-action" | "organizer";

/** What the entry does to availability, in both providers' vocabulary. */
export type CalendarAvailability = "busy" | "free" | "tentative" | "out-of-office";

export interface CalendarEventRecord {
  kind: "event";
  id: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  response?: CalendarResponse;
  availability?: CalendarAvailability;
  attendeeCount?: number;
  isRecurring?: boolean;
  /** Whether the entry carries a conferencing link — a proxy for remote meetings. */
  isOnline?: boolean;
  /** Low-cardinality bucket the user assigned, e.g. which calendar it came from. */
  calendarKind?: "work" | "personal" | "shared" | "other";
  timezone?: string;
}

/**
 * A day's shape, in local minutes.
 *
 * This is a record rather than something the connector derives, because
 * deriving it means knowing what local midnight was, and connectors are not
 * allowed to compute local time. `summariseCalendarDay` below does the work
 * from local minutes the provider SDK already hands out, so the logic lives
 * here and is tested here, but the zone arithmetic stays outside.
 */
export interface CalendarDayRecord {
  kind: "day";
  id: string;
  dateISO: string;
  computedAt?: string;
  /** Minutes marked busy by non-declined, non-all-day entries. */
  committedMinutes: number;
  eventCount: number;
  longestFreeBlockMinutes: number;
  firstCommitmentMinutes?: number | null;
  lastCommitmentMinutes?: number | null;
  /** Commitments starting within five minutes of the previous one ending. */
  backToBackCount: number;
  /** Committed minutes falling outside the configured working window. */
  afterHoursMinutes: number;
  allDayCount: number;
  /** Minutes in meetings with at least two other people. */
  groupMeetingMinutes: number;
  timezone?: string;
}

export type CalendarRecord = CalendarEventRecord | CalendarDayRecord;

const SCOPES: ConnectorScope[] = [
  {
    id: "event-times",
    description: "When calendar entries start and end, how many people are involved, and whether you accepted. Titles, descriptions, locations and attendee names are never read.",
    readsContent: false,
  },
  {
    id: "day-shape",
    description: "A daily summary of how booked and how fragmented your day was",
    readsContent: false,
  },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "calendar.event",
    category: "schedule",
    description: "A calendar commitment",
    metrics: [
      { key: "duration_minutes", unit: "minutes", description: "Length of the commitment", range: { min: 0, max: 1440 } },
      { key: "attendee_count", unit: "count", description: "People involved, including you", range: { min: 0, max: 1000 } },
      { key: "is_recurring", unit: "ratio", description: "1 when the entry repeats", range: { min: 0, max: 1 } },
      { key: "is_online", unit: "ratio", description: "1 when the entry carries a conferencing link", range: { min: 0, max: 1 } },
    ],
  },
  {
    type: "calendar.day_shape",
    category: "schedule",
    description: "How booked and fragmented a day was",
    metrics: [
      { key: "committed_minutes", unit: "minutes", description: "Minutes spoken for by commitments", range: { min: 0, max: 1440 } },
      { key: "event_count", unit: "count", description: "Commitments in the day", range: { min: 0, max: 100 } },
      { key: "longest_free_block_minutes", unit: "minutes", description: "Longest uninterrupted gap inside the working window", range: { min: 0, max: 1440 } },
      { key: "fragmentation", unit: "ratio", description: "Commitments per committed hour — how chopped up the day was", range: { min: 0, max: 60 } },
      { key: "first_commitment_minutes", unit: "minutes", description: "Minutes after local midnight of the first commitment", range: { min: 0, max: 1439 } },
      { key: "back_to_back_count", unit: "count", description: "Commitments starting within five minutes of the previous one ending", range: { min: 0, max: 100 } },
      { key: "after_hours_minutes", unit: "minutes", description: "Committed minutes outside the working window", range: { min: 0, max: 1440 } },
      { key: "all_day_count", unit: "count", description: "All-day entries such as leave or travel", range: { min: 0, max: 50 } },
      { key: "group_meeting_minutes", unit: "minutes", description: "Minutes in meetings with three or more people", range: { min: 0, max: 1440 } },
    ],
  },
];

const PROVIDER_NAMES: Record<CalendarProvider, string> = {
  "google-calendar": "Google Calendar",
  "outlook-calendar": "Outlook Calendar",
};

/**
 * Whether an entry is a real claim on the user's time.
 *
 * Declined invitations and entries marked free are the two big sources of
 * phantom load: counting them makes every "busy day" comparison meaningless,
 * because the days that look busiest are the ones with the most invitations
 * the user turned down.
 */
export function isCommitment(record: CalendarEventRecord): boolean {
  if (record.response === "declined") return false;
  if (record.availability === "free") return false;
  return true;
}

export function mapCalendarRecord(record: CalendarRecord, provider: CalendarProvider): RawEventInput[] {
  const common = {
    source: provider,
    sourceEventId: record.id,
    ...(record.timezone ? { timezone: record.timezone } : {}),
  };

  if (record.kind === "event") {
    if (!isCommitment(record)) return [];
    // All-day entries are a statement about the date, not a block of time.
    // Counting one as 1440 committed minutes would swamp every day it lands on.
    if (record.allDay) return [];

    const duration = minutesBetween(record.startsAt, record.endsAt);
    if (duration <= 0) return [];

    return [
      {
        ...common,
        type: "calendar.event",
        category: "schedule",
        occurredAt: record.startsAt,
        durationMs: duration * 60_000,
        subject: record.calendarKind ?? "other",
        metrics: {
          duration_minutes: duration,
          attendee_count: Math.max(0, record.attendeeCount ?? 1),
          is_recurring: record.isRecurring ? 1 : 0,
          is_online: record.isOnline ? 1 : 0,
        },
        attributes: {
          provider,
          calendar_kind: record.calendarKind ?? "other",
          availability: record.availability ?? "busy",
          response: record.response ?? "organizer",
          time_estimated: false,
        },
      },
    ];
  }

  const metrics: Record<string, number> = {
    committed_minutes: Math.max(0, record.committedMinutes),
    event_count: Math.max(0, record.eventCount),
    longest_free_block_minutes: Math.max(0, record.longestFreeBlockMinutes),
    back_to_back_count: Math.max(0, record.backToBackCount),
    after_hours_minutes: Math.max(0, record.afterHoursMinutes),
    all_day_count: Math.max(0, record.allDayCount),
    group_meeting_minutes: Math.max(0, record.groupMeetingMinutes),
    // Commitments per committed hour. An empty day has no fragmentation to
    // speak of rather than a divide-by-zero.
    fragmentation: record.committedMinutes > 0 ? record.eventCount / (record.committedMinutes / 60) : 0,
  };
  if (typeof record.firstCommitmentMinutes === "number") {
    metrics.first_commitment_minutes = record.firstCommitmentMinutes;
  }

  const estimated = !record.computedAt;
  return [
    {
      ...common,
      type: "calendar.day_shape",
      category: "schedule",
      occurredAt: record.computedAt ?? stampLocalHour(record.dateISO, 22),
      subject: "day-shape",
      metrics,
      attributes: { provider, time_estimated: estimated, local_date: record.dateISO },
    },
  ];
}

/** One entry as the provider SDK reports it in the user's local minutes. */
export interface CalendarDaySlot {
  startMinutes: number;
  endMinutes: number;
  allDay?: boolean;
  busy?: boolean;
  attendeeCount?: number;
}

export interface DayShapeOptions {
  /** Local minutes bounding the window free blocks are measured inside. */
  workingWindow?: { startMinutes: number; endMinutes: number };
  /** Gap at or below which two commitments count as back-to-back. */
  backToBackGapMinutes?: number;
}

const DEFAULT_WINDOW = { startMinutes: 8 * 60, endMinutes: 20 * 60 };

/**
 * Builds a day record from a day's entries.
 *
 * Overlapping commitments are merged before minutes are counted. Double-booked
 * calendars are extremely common, and summing raw durations produces days with
 * more than 24 hours of meetings in them — a number that then quietly poisons
 * every comparison the day takes part in.
 */
export function summariseCalendarDay(
  dateISO: string,
  slots: readonly CalendarDaySlot[],
  options: DayShapeOptions = {},
): CalendarDayRecord {
  const window = options.workingWindow ?? DEFAULT_WINDOW;
  const gapLimit = options.backToBackGapMinutes ?? 5;

  const allDayCount = slots.filter((slot) => slot.allDay).length;
  const timed = slots
    .filter((slot) => !slot.allDay && (slot.busy ?? true) && slot.endMinutes > slot.startMinutes)
    .map((slot) => ({
      start: Math.max(0, slot.startMinutes),
      end: Math.min(1440, slot.endMinutes),
      attendees: slot.attendeeCount ?? 1,
    }))
    .filter((slot) => slot.end > slot.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: { start: number; end: number }[] = [];
  for (const slot of timed) {
    const last = merged[merged.length - 1];
    if (last && slot.start <= last.end) last.end = Math.max(last.end, slot.end);
    else merged.push({ start: slot.start, end: slot.end });
  }

  const committedMinutes = merged.reduce((total, block) => total + (block.end - block.start), 0);
  const afterHoursMinutes = merged.reduce(
    (total, block) =>
      total +
      Math.max(0, Math.min(block.end, window.startMinutes) - block.start) +
      Math.max(0, block.end - Math.max(block.start, window.endMinutes)),
    0,
  );

  let longestFreeBlockMinutes = 0;
  let cursor = window.startMinutes;
  for (const block of merged) {
    if (block.end <= window.startMinutes || block.start >= window.endMinutes) continue;
    longestFreeBlockMinutes = Math.max(longestFreeBlockMinutes, Math.min(block.start, window.endMinutes) - cursor);
    cursor = Math.max(cursor, Math.min(block.end, window.endMinutes));
  }
  longestFreeBlockMinutes = Math.max(longestFreeBlockMinutes, window.endMinutes - cursor);

  let backToBackCount = 0;
  for (let index = 1; index < timed.length; index += 1) {
    if (timed[index]!.start - timed[index - 1]!.end <= gapLimit) backToBackCount += 1;
  }

  const groupMeetingMinutes = timed
    .filter((slot) => slot.attendees >= 3)
    .reduce((total, slot) => total + (slot.end - slot.start), 0);

  return {
    kind: "day",
    id: `day:${dateISO}`,
    dateISO,
    committedMinutes,
    eventCount: timed.length,
    longestFreeBlockMinutes: Math.max(0, longestFreeBlockMinutes),
    firstCommitmentMinutes: timed[0]?.start ?? null,
    lastCommitmentMinutes: timed[timed.length - 1]?.end ?? null,
    backToBackCount,
    afterHoursMinutes,
    allDayCount,
    groupMeetingMinutes,
  };
}

export function calendarRecordTimestamp(record: CalendarRecord): string {
  return record.kind === "event" ? record.startsAt : (record.computedAt ?? stampLocalHour(record.dateISO, 22));
}

export function createCalendarConnector(provider: CalendarProvider, reader: SourceReader<CalendarRecord>): Connector {
  return defineReaderConnector<CalendarRecord>({
    id: provider,
    name: PROVIDER_NAMES[provider],
    version: "1.0.0",
    category: "schedule",
    description: `Commitment times and day shape from ${PROVIDER_NAMES[provider]}. No titles, no attendees, no locations.`,
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1095,
    cadence: "daily",
    reader,
    map: (record) => mapCalendarRecord(record, provider),
    timestampOf: calendarRecordTimestamp,
  });
}

export const createGoogleCalendarConnector = (reader: SourceReader<CalendarRecord>): Connector =>
  createCalendarConnector("google-calendar", reader);
export const createOutlookCalendarConnector = (reader: SourceReader<CalendarRecord>): Connector =>
  createCalendarConnector("outlook-calendar", reader);
