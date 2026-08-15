/**
 * Health platform connectors — Apple Health and Health Connect.
 *
 * Both platforms are *aggregators*: they hold readings written by other apps
 * and devices, and they say who wrote each one. Pulse keeps that attribution
 * (`origin_app`, `first_hand`) because it is the difference between two
 * sources agreeing and one source being read twice — see `reconcile.ts`.
 *
 * The record shapes below are the seam. A platform bridge (HealthKit on iOS,
 * the Health Connect client on Android) is responsible for turning that
 * platform's own query results into these; everything from here on is pure and
 * runs in plain Node, so the mapping is testable with no device attached.
 *
 * What deliberately does not cross the boundary: clinical records, menstrual
 * and sexual health data, ECG waveforms, medication and anything the platform
 * classifies as a clinical document. Those are neither requested in `scopes`
 * nor representable in these record types, so a bridge cannot pass them
 * through by accident.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";
import {
  HEALTH_EVENT_SPECS,
  collectMetrics,
  minutesBetween,
  originAttributes,
  sleepMetrics,
  sleepMidpoint,
  stampLocalHour,
  type SleepStages,
} from "./health-events.js";

export type HealthPlatform = "apple-health" | "health-connect";

/** Fields every platform record carries, whatever it is about. */
interface HealthRecordBase {
  id: string;
  /** App that wrote the reading, as the platform reports it. */
  sourceApp?: string;
  device?: string;
  timezone?: string;
}

export interface HealthSleepRecord extends HealthRecordBase, SleepStages {
  kind: "sleep";
  startsAt: string;
  endsAt: string;
  /** Minutes actually asleep. Falls back to the in-bed span when not measured. */
  asleepMinutes?: number | null;
}

export interface HealthVitalsRecord extends HealthRecordBase {
  kind: "vitals";
  dateISO: string;
  /** Present when the platform recorded a real time for the reading. */
  recordedAt?: string;
  restingHeartRate?: number | null;
  hrvMs?: number | null;
  respiratoryRate?: number | null;
  /** Fraction, not a percentage: 0.97, never 97. */
  bloodOxygen?: number | null;
  bodyTemperatureDeltaC?: number | null;
}

export interface HealthActivityRecord extends HealthRecordBase {
  kind: "activity";
  dateISO: string;
  recordedAt?: string;
  steps?: number | null;
  activeEnergyKcal?: number | null;
  exerciseMinutes?: number | null;
  distanceMeters?: number | null;
}

export interface HealthBodyRecord extends HealthRecordBase {
  kind: "body";
  dateISO: string;
  recordedAt?: string;
  bodyMassKg?: number | null;
  /** Fraction, not a percentage. */
  bodyFatRatio?: number | null;
}

export interface HealthWorkoutRecord extends HealthRecordBase {
  kind: "workout";
  startsAt: string;
  endsAt: string;
  /** Low-cardinality activity name, e.g. "running". Never a user-typed title. */
  activityType: string;
  activeEnergyKcal?: number | null;
  distanceMeters?: number | null;
  meanHeartRate?: number | null;
  maxHeartRate?: number | null;
}

export type HealthRecord =
  | HealthSleepRecord
  | HealthVitalsRecord
  | HealthActivityRecord
  | HealthBodyRecord
  | HealthWorkoutRecord;

export interface HealthMapOptions {
  /** Local hour to assume for a daily summary that carries no clock time. */
  assumedVitalsHour?: number;
  assumedActivityHour?: number;
  assumedBodyHour?: number;
}

const SCOPES: ConnectorScope[] = [
  {
    id: "sleep",
    description: "Sleep: when you slept, for how long, and the stages your device detected",
    readsContent: false,
  },
  {
    id: "vitals",
    description: "Daily readings: resting heart rate, heart rate variability, breathing rate, blood oxygen and skin temperature",
    readsContent: false,
  },
  {
    id: "activity",
    description: "Daily movement: steps, distance on foot, active energy and exercise minutes",
    readsContent: false,
  },
  {
    id: "body",
    description: "Body measurements you have recorded: mass and body fat share",
    readsContent: false,
  },
  {
    id: "workouts",
    description: "Recorded workouts: activity type, duration, distance, energy and heart rate",
    readsContent: false,
  },
];

const EMITS: EmittedEventSpec[] = HEALTH_EVENT_SPECS;

const PLATFORM_NAMES: Record<HealthPlatform, string> = {
  "apple-health": "Apple Health",
  "health-connect": "Health Connect",
};

/**
 * Maps one platform record to zero or more events.
 *
 * Returning `[]` for a record whose every measurement is missing is the point
 * of several of the branches below: a vitals row where the watch was not worn
 * carries no numbers, and an event with no metrics is an event that can only
 * mislead the completeness score.
 */
export function mapHealthRecord(
  record: HealthRecord,
  platform: HealthPlatform,
  options: HealthMapOptions = {},
): RawEventInput[] {
  const origin = originAttributes({ platform, app: record.sourceApp, device: record.device });
  const common = {
    source: platform,
    sourceEventId: record.id,
    ...(record.timezone ? { timezone: record.timezone } : {}),
  };

  if (record.kind === "sleep") {
    const inBed = minutesBetween(record.startsAt, record.endsAt);
    if (inBed <= 0) return [];
    const asleep =
      typeof record.asleepMinutes === "number" && Number.isFinite(record.asleepMinutes)
        ? record.asleepMinutes
        : inBed;
    return [
      {
        ...common,
        type: "health.sleep",
        category: "wellbeing",
        occurredAt: sleepMidpoint(record.startsAt, record.endsAt),
        durationMs: inBed * 60_000,
        subject: "sleep",
        metrics: sleepMetrics(asleep, inBed, record),
        attributes: {
          ...origin,
          time_estimated: false,
          stages_measured: record.deepMinutes != null || record.remMinutes != null,
        },
      },
    ];
  }

  if (record.kind === "workout") {
    const duration = minutesBetween(record.startsAt, record.endsAt);
    if (duration <= 0) return [];
    return [
      {
        ...common,
        type: "health.workout",
        category: "exercise",
        occurredAt: record.startsAt,
        durationMs: duration * 60_000,
        subject: record.activityType,
        metrics: {
          duration_minutes: duration,
          ...collectMetrics({
            active_energy_kcal: record.activeEnergyKcal,
            distance_m: record.distanceMeters,
            mean_heart_rate: record.meanHeartRate,
            max_heart_rate: record.maxHeartRate,
          }),
        },
        attributes: { ...origin, activity_type: record.activityType, time_estimated: false },
      },
    ];
  }

  const metrics =
    record.kind === "vitals"
      ? collectMetrics({
          resting_heart_rate: record.restingHeartRate,
          hrv_ms: record.hrvMs,
          respiratory_rate: record.respiratoryRate,
          blood_oxygen: record.bloodOxygen,
          body_temperature_delta: record.bodyTemperatureDeltaC,
        })
      : record.kind === "activity"
        ? collectMetrics({
            steps: record.steps,
            active_energy_kcal: record.activeEnergyKcal,
            exercise_minutes: record.exerciseMinutes,
            distance_m: record.distanceMeters,
          })
        : collectMetrics({ body_mass_kg: record.bodyMassKg, body_fat_ratio: record.bodyFatRatio });

  if (Object.keys(metrics).length === 0) return [];

  const defaultHour =
    record.kind === "vitals"
      ? (options.assumedVitalsHour ?? 7)
      : record.kind === "activity"
        ? (options.assumedActivityHour ?? 21)
        : (options.assumedBodyHour ?? 7);

  const estimated = !record.recordedAt;
  return [
    {
      ...common,
      type: record.kind === "vitals" ? "health.vitals" : record.kind === "activity" ? "health.activity" : "health.body",
      category: record.kind === "activity" ? "exercise" : "wellbeing",
      occurredAt: record.recordedAt ?? stampLocalHour(record.dateISO, defaultHour),
      subject: record.kind,
      metrics,
      attributes: { ...origin, time_estimated: estimated, local_date: record.dateISO },
    },
  ];
}

/** Timestamp a record sorts and paginates by. */
export function healthRecordTimestamp(record: HealthRecord, options: HealthMapOptions = {}): string {
  switch (record.kind) {
    case "sleep":
      return record.startsAt;
    case "workout":
      return record.startsAt;
    case "vitals":
      return record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedVitalsHour ?? 7);
    case "activity":
      return record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedActivityHour ?? 21);
    case "body":
      return record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedBodyHour ?? 7);
  }
}

/**
 * Builds the connector for one health platform.
 *
 * Both platforms produce the same events from the same record shapes; only the
 * id, the display name and the consent copy differ. Sharing one implementation
 * means a fix to the sleep-efficiency derivation cannot land on iOS and be
 * forgotten on Android.
 */
export function createHealthPlatformConnector(
  platform: HealthPlatform,
  reader: SourceReader<HealthRecord>,
  options: HealthMapOptions = {},
): Connector {
  return defineReaderConnector<HealthRecord>({
    id: platform,
    name: PLATFORM_NAMES[platform],
    version: "1.0.0",
    category: "wellbeing",
    description: `Sleep, daily vitals, movement and workouts from ${PLATFORM_NAMES[platform]}.`,
    scopes: SCOPES,
    emits: EMITS,
    // Platforms hold years of history and it is worth having: a personal
    // seasonal baseline needs more than one winter in it.
    maxBackfillDays: 3650,
    cadence: "daily",
    reader,
    map: (record) => mapHealthRecord(record, platform, options),
    timestampOf: (record) => healthRecordTimestamp(record, options),
  });
}

export function createAppleHealthConnector(
  reader: SourceReader<HealthRecord>,
  options: HealthMapOptions = {},
): Connector {
  return createHealthPlatformConnector("apple-health", reader, options);
}

export function createHealthConnectConnector(
  reader: SourceReader<HealthRecord>,
  options: HealthMapOptions = {},
): Connector {
  return createHealthPlatformConnector("health-connect", reader, options);
}
