/**
 * Arise connector.
 *
 * Arise stores completed sessions against a local `dateISO` with no clock
 * time. Rather than silently inventing a timestamp, sessions without a
 * `completedAt` are stamped at a configurable default hour and flagged
 * `time_estimated: true`, which the quality scorer penalises and the lag
 * analysis uses to exclude them from within-day timing questions.
 */

import { defineReaderConnector } from "./sdk.js";
import { createSameOriginReader, type StorageLike } from "./same-origin.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";
import { mean } from "../statistics/descriptive.js";

export interface AriseSet {
  reps: number;
  weightKg?: number | null;
  rpe?: number | null;
  side?: "left" | "right" | null;
  assistedKg?: number | null;
}

export interface AriseBlock {
  exerciseId: string;
  muscle?: string;
  sets: AriseSet[];
}

export interface AriseSessionRecord {
  kind: "session";
  id: string;
  dateISO: string;
  /** Present when the app captured a real completion time. */
  completedAt?: string;
  programId?: string;
  title?: string;
  location?: string;
  durationMin?: number;
  blocks: AriseBlock[];
  timezone?: string;
}

export interface AriseReadinessRecord {
  kind: "readiness";
  dateISO: string;
  at?: string;
  score: number;
  sleep?: number;
  soreness?: number;
  motivation?: number;
  timezone?: string;
}

export type AriseRecord = AriseSessionRecord | AriseReadinessRecord;

export interface AriseMapOptions {
  /** Local hour to assume when a session has no recorded time. */
  assumedSessionHour?: number;
  assumedReadinessHour?: number;
}

const SCOPES: ConnectorScope[] = [
  { id: "sessions", description: "Completed training sessions: exercises, sets, reps, load and effort", readsContent: false },
  { id: "readiness", description: "Daily readiness check-ins: sleep, soreness and motivation ratings", readsContent: false },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "arise.workout",
    category: "exercise",
    description: "A completed training session",
    metrics: [
      { key: "duration_minutes", unit: "minutes", description: "Session length", range: { min: 0, max: 600 } },
      { key: "total_volume_kg", unit: "kg", description: "Sum of reps x load across all sets", range: { min: 0, max: 200_000 } },
      { key: "total_reps", unit: "reps", description: "Reps completed", range: { min: 0, max: 5000 } },
      { key: "sets_completed", unit: "count", description: "Working sets completed", range: { min: 0, max: 200 } },
      { key: "mean_rpe", unit: "score", description: "Average rated perceived exertion", range: { min: 1, max: 10 } },
      { key: "exercise_count", unit: "count", description: "Distinct exercises", range: { min: 0, max: 60 } },
    ],
  },
  {
    type: "arise.readiness",
    category: "wellbeing",
    description: "A daily readiness check-in",
    metrics: [
      { key: "readiness_score", unit: "score", description: "Composite readiness", range: { min: 0, max: 100 } },
      { key: "sleep_score", unit: "score", description: "Self-rated sleep", range: { min: 0, max: 10 } },
      { key: "soreness", unit: "score", description: "Self-rated soreness", range: { min: 0, max: 10 } },
      { key: "motivation", unit: "score", description: "Self-rated motivation", range: { min: 0, max: 10 } },
    ],
  },
];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function stampLocalHour(dateISO: string, hour: number): string {
  // Deliberately emitted without a zone offset marker resolution here: the
  // normaliser applies the connector's configured zone, so this string is a
  // wall-clock intent, not a UTC claim.
  const h = String(Math.floor(hour)).padStart(2, "0");
  return `${dateISO}T${h}:00:00.000Z`;
}

export function mapAriseRecord(record: AriseRecord, options: AriseMapOptions = {}): RawEventInput[] {
  if (record.kind === "session") {
    const sets = record.blocks.flatMap((block) => block.sets ?? []);
    if (sets.length === 0) return []; // A planned-but-empty session is not a workout.

    let totalReps = 0;
    let totalVolume = 0;
    const rpes: number[] = [];
    for (const set of sets) {
      const reps = Number.isFinite(set.reps) ? Math.max(0, set.reps) : 0;
      totalReps += reps;
      const load = typeof set.weightKg === "number" && Number.isFinite(set.weightKg) ? set.weightKg : 0;
      const assist = typeof set.assistedKg === "number" && Number.isFinite(set.assistedKg) ? set.assistedKg : 0;
      totalVolume += reps * Math.max(0, load - assist);
      if (typeof set.rpe === "number" && Number.isFinite(set.rpe)) rpes.push(set.rpe);
    }

    const estimated = !record.completedAt;
    const occurredAt = record.completedAt ?? stampLocalHour(record.dateISO, options.assumedSessionHour ?? 18);
    if (estimated && !DATE_ONLY.test(record.dateISO)) {
      throw new Error(`Arise session ${record.id} has neither completedAt nor a valid dateISO`);
    }

    const metrics: Record<string, number> = {
      total_volume_kg: totalVolume,
      total_reps: totalReps,
      sets_completed: sets.length,
      exercise_count: new Set(record.blocks.map((b) => b.exerciseId)).size,
    };
    if (typeof record.durationMin === "number" && Number.isFinite(record.durationMin)) {
      metrics.duration_minutes = Math.max(0, record.durationMin);
    }
    if (rpes.length) metrics.mean_rpe = mean(rpes);

    return [
      {
        source: "arise",
        sourceEventId: record.id,
        type: "arise.workout",
        category: "exercise",
        occurredAt,
        ...(record.timezone ? { timezone: record.timezone } : {}),
        ...(metrics.duration_minutes !== undefined ? { durationMs: metrics.duration_minutes * 60_000 } : {}),
        subject: record.programId ?? "training",
        metrics,
        attributes: {
          time_estimated: estimated,
          local_date: record.dateISO,
          ...(record.location ? { location: record.location } : {}),
          ...(record.programId ? { program_id: record.programId } : {}),
          muscles: [...new Set(record.blocks.map((b) => b.muscle).filter(Boolean))].join(","),
        },
      },
    ];
  }

  const estimated = !record.at;
  const metrics: Record<string, number> = { readiness_score: record.score };
  if (typeof record.sleep === "number") metrics.sleep_score = record.sleep;
  if (typeof record.soreness === "number") metrics.soreness = record.soreness;
  if (typeof record.motivation === "number") metrics.motivation = record.motivation;

  return [
    {
      source: "arise",
      // Readiness has no id in Arise; the date is the natural key.
      naturalKey: { kind: "readiness", dateISO: record.dateISO },
      type: "arise.readiness",
      category: "wellbeing",
      occurredAt: record.at ?? stampLocalHour(record.dateISO, options.assumedReadinessHour ?? 8),
      ...(record.timezone ? { timezone: record.timezone } : {}),
      subject: "readiness",
      metrics,
      attributes: { time_estimated: estimated, local_date: record.dateISO },
    },
  ];
}

/** Where Arise keeps its state when both apps are served from one origin. */
export const ARISE_STORAGE_KEY = "arise.store.v1";

/** Arise's own opt-in. Absent or false means Pulse reads nothing. */
export function ariseConsentGranted(state: unknown): boolean {
  const preferences = (state as { preferences?: { pulseEnabled?: unknown } } | null)?.preferences;
  return preferences?.pulseEnabled === true;
}

/**
 * Pull Pulse records out of Arise's persisted store.
 *
 * Arise keeps completed work in `history` and check-ins in `readinessLog`, and
 * stamps each saved session with `savedAt`. It is tempting to treat `savedAt` as
 * the completion time, which would spare every session the `time_estimated`
 * quality penalty — but `savedAt` is a *write* time. Edit a workout from last
 * week and it moves to today, which would silently relocate an event and poison
 * exactly the within-day timing questions the lag analysis exists to answer.
 *
 * So `savedAt` is trusted only when it lands on the session's own local date.
 * Otherwise the time is left unknown and the engine flags and discounts it,
 * which is the honest outcome rather than the flattering one.
 */
export function selectAriseRecords(state: unknown): AriseRecord[] {
  const store = (state ?? {}) as {
    history?: unknown;
    readinessLog?: unknown;
  };
  const records: AriseRecord[] = [];

  if (Array.isArray(store.history)) {
    for (const raw of store.history) {
      const session = raw as Partial<AriseSessionRecord> & { savedAt?: unknown };
      if (typeof session.id !== "string") continue;
      if (typeof session.dateISO !== "string" || !DATE_ONLY.test(session.dateISO)) continue;
      if (!Array.isArray(session.blocks)) continue;

      const savedAt = typeof session.savedAt === "string" ? session.savedAt : null;
      const trustworthy = savedAt !== null && savedAt.slice(0, 10) === session.dateISO;

      records.push({
        kind: "session",
        id: session.id,
        dateISO: session.dateISO,
        ...(trustworthy ? { completedAt: savedAt } : {}),
        ...(typeof session.programId === "string" ? { programId: session.programId } : {}),
        ...(typeof session.title === "string" ? { title: session.title } : {}),
        ...(typeof session.location === "string" ? { location: session.location } : {}),
        ...(typeof session.durationMin === "number" ? { durationMin: session.durationMin } : {}),
        blocks: session.blocks as AriseBlock[],
      });
    }
  }

  if (Array.isArray(store.readinessLog)) {
    for (const raw of store.readinessLog) {
      const entry = raw as Partial<AriseReadinessRecord>;
      if (typeof entry.dateISO !== "string" || !DATE_ONLY.test(entry.dateISO)) continue;
      if (typeof entry.score !== "number" || !Number.isFinite(entry.score)) continue;
      records.push({
        kind: "readiness",
        dateISO: entry.dateISO,
        score: entry.score,
        ...(typeof entry.at === "string" ? { at: entry.at } : {}),
        ...(typeof entry.sleep === "number" ? { sleep: entry.sleep } : {}),
        ...(typeof entry.soreness === "number" ? { soreness: entry.soreness } : {}),
        ...(typeof entry.motivation === "number" ? { motivation: entry.motivation } : {}),
      });
    }
  }

  return records;
}

/**
 * An Arise connector that reads the real app's storage, for when Pulse and
 * Arise are served from the same origin. The mapping, dedup and quality rules
 * are the ones the synthetic build already exercises — only the reader differs.
 */
export function createAriseSameOriginConnector(options: AriseMapOptions & { storage?: StorageLike | null } = {}): Connector {
  const { storage, ...mapOptions } = options;
  return createAriseConnector(
    createSameOriginReader<AriseRecord>({
      key: ARISE_STORAGE_KEY,
      label: "Arise",
      select: selectAriseRecords,
      consent: ariseConsentGranted,
      ...(storage !== undefined ? { storage } : {}),
      timestampOf: (record) =>
        record.kind === "session"
          ? (record.completedAt ?? stampLocalHour(record.dateISO, mapOptions.assumedSessionHour ?? 18))
          : (record.at ?? stampLocalHour(record.dateISO, mapOptions.assumedReadinessHour ?? 8)),
    }),
    mapOptions,
  );
}

export function createAriseConnector(
  reader: SourceReader<AriseRecord>,
  options: AriseMapOptions = {},
): Connector {
  return defineReaderConnector<AriseRecord>({
    id: "arise",
    name: "Arise",
    version: "1.0.0",
    category: "exercise",
    description: "Training sessions and daily readiness check-ins.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1825,
    reader,
    map: (record) => mapAriseRecord(record, options),
    timestampOf: (record) =>
      record.kind === "session"
        ? (record.completedAt ?? stampLocalHour(record.dateISO, options.assumedSessionHour ?? 18))
        : (record.at ?? stampLocalHour(record.dateISO, options.assumedReadinessHour ?? 8)),
  });
}
