/**
 * Wearable connectors — Garmin, Fitbit, WHOOP and Oura.
 *
 * These read the vendor's own API rather than going through a phone health
 * platform, so every reading is first-hand by construction.
 *
 * The design decision worth defending: measured physiology is shared, invented
 * scores are not.
 *
 * Resting heart rate, HRV, breathing rate, sleep duration and steps are
 * *measurements*. Different devices measure them with different accuracy, but
 * they are estimating the same physical quantity, so they share the `health.*`
 * event types and can be compared, replaced and reconciled across vendors.
 *
 * Recovery, Readiness, Body Battery and Sleep Score are *models*. Each is a
 * vendor's private function of its own inputs, on its own 0–100 scale, and two
 * of them reading 70 does not mean the same thing twice. Putting them in one
 * series would fabricate a variable no instrument measures, and Pulse would
 * then happily run a regression on it. So each vendor's composites live under
 * that vendor's own event type and never merge.
 *
 * As in `health.ts`, the record shapes are the seam: an API client turns the
 * vendor's payload into these, and everything from here on is pure.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, EmittedMetricSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";
import {
  HEALTH_ACTIVITY_SPEC,
  HEALTH_BODY_SPEC,
  HEALTH_SLEEP_SPEC,
  HEALTH_VITALS_SPEC,
  HEALTH_WORKOUT_SPEC,
  collectMetrics,
  minutesBetween,
  originAttributes,
  sleepMetrics,
  sleepMidpoint,
  stampLocalHour,
  type SleepStages,
} from "./health-events.js";

export const WEARABLE_VENDORS = ["garmin", "fitbit", "whoop", "oura"] as const;
export type WearableVendor = (typeof WEARABLE_VENDORS)[number];

interface WearableRecordBase {
  id: string;
  timezone?: string;
}

export interface WearableSleepRecord extends WearableRecordBase, SleepStages {
  kind: "sleep";
  startsAt: string;
  endsAt: string;
  asleepMinutes?: number | null;
}

/**
 * One row per day holding whatever the band measured overnight and during the
 * day. It maps to two events — vitals and activity — because those are
 * different categories with different analytic roles, and a single event
 * carrying both would force the metrics layer to guess.
 */
export interface WearableDailyRecord extends WearableRecordBase {
  kind: "daily";
  dateISO: string;
  recordedAt?: string;
  restingHeartRate?: number | null;
  hrvMs?: number | null;
  respiratoryRate?: number | null;
  bloodOxygen?: number | null;
  bodyTemperatureDeltaC?: number | null;
  steps?: number | null;
  activeEnergyKcal?: number | null;
  exerciseMinutes?: number | null;
  distanceMeters?: number | null;
}

export interface WearableWorkoutRecord extends WearableRecordBase {
  kind: "workout";
  startsAt: string;
  endsAt: string;
  activityType: string;
  activeEnergyKcal?: number | null;
  distanceMeters?: number | null;
  meanHeartRate?: number | null;
  maxHeartRate?: number | null;
}

export interface WearableBodyRecord extends WearableRecordBase {
  kind: "body";
  dateISO: string;
  recordedAt?: string;
  bodyMassKg?: number | null;
  bodyFatRatio?: number | null;
}

/**
 * The vendor's own composite scores for a day. Keys must be ones the vendor
 * declares — an unrecognised key throws, and the SDK turns that into a skipped
 * record with a warning on the connector's health card rather than letting an
 * undeclared number through.
 */
export interface WearableScoreRecord extends WearableRecordBase {
  kind: "score";
  dateISO: string;
  recordedAt?: string;
  scores: Record<string, number>;
}

export type WearableRecord =
  | WearableSleepRecord
  | WearableDailyRecord
  | WearableWorkoutRecord
  | WearableBodyRecord
  | WearableScoreRecord;

const SCORE_0_100 = { min: 0, max: 100 } as const;

interface VendorProfile {
  name: string;
  /** Consent copy for the vendor's proprietary scores. */
  scoreScopeDescription: string;
  scoreMetrics: EmittedMetricSpec[];
}

const VENDORS: Record<WearableVendor, VendorProfile> = {
  garmin: {
    name: "Garmin",
    scoreScopeDescription: "Garmin's own daily scores: Body Battery and training readiness",
    scoreMetrics: [
      { key: "body_battery", unit: "score", description: "Garmin Body Battery, 0–100", range: SCORE_0_100 },
      { key: "training_readiness", unit: "score", description: "Garmin training readiness, 0–100", range: SCORE_0_100 },
      { key: "stress_average", unit: "score", description: "Garmin average stress, 0–100", range: SCORE_0_100 },
    ],
  },
  fitbit: {
    name: "Fitbit",
    scoreScopeDescription: "Fitbit's own daily scores: Daily Readiness and Sleep Score",
    scoreMetrics: [
      { key: "daily_readiness", unit: "score", description: "Fitbit Daily Readiness, 0–100", range: SCORE_0_100 },
      { key: "sleep_score", unit: "score", description: "Fitbit Sleep Score, 0–100", range: SCORE_0_100 },
    ],
  },
  whoop: {
    name: "WHOOP",
    scoreScopeDescription: "WHOOP's own daily scores: Recovery, Day Strain and Sleep Performance",
    scoreMetrics: [
      { key: "recovery_score", unit: "score", description: "WHOOP Recovery, 0–100", range: SCORE_0_100 },
      { key: "day_strain", unit: "score", description: "WHOOP Day Strain, 0–21", range: { min: 0, max: 21 } },
      { key: "sleep_performance", unit: "score", description: "WHOOP Sleep Performance, 0–100", range: SCORE_0_100 },
    ],
  },
  oura: {
    name: "Oura",
    scoreScopeDescription: "Oura's own daily scores: Readiness, Sleep Score and Activity Score",
    scoreMetrics: [
      { key: "readiness_score", unit: "score", description: "Oura Readiness, 0–100", range: SCORE_0_100 },
      { key: "sleep_score", unit: "score", description: "Oura Sleep Score, 0–100", range: SCORE_0_100 },
      { key: "activity_score", unit: "score", description: "Oura Activity Score, 0–100", range: SCORE_0_100 },
    ],
  },
};

function scoreSpecFor(vendor: WearableVendor): EmittedEventSpec {
  return {
    type: `${vendor}.score`,
    category: "wellbeing",
    description: `${VENDORS[vendor].name}'s own daily scores`,
    metrics: VENDORS[vendor].scoreMetrics,
  };
}

function scopesFor(vendor: WearableVendor): ConnectorScope[] {
  return [
    { id: "sleep", description: `Sleep recorded by your ${VENDORS[vendor].name} device: timing, duration and stages`, readsContent: false },
    { id: "vitals", description: "Daily physiology: resting heart rate, heart rate variability, breathing rate, blood oxygen and skin temperature", readsContent: false },
    { id: "activity", description: "Daily movement: steps, distance, active energy and exercise minutes", readsContent: false },
    { id: "workouts", description: "Recorded workouts: activity type, duration, distance, energy and heart rate", readsContent: false },
    { id: "scores", description: VENDORS[vendor].scoreScopeDescription, readsContent: false },
  ];
}

export interface WearableMapOptions {
  assumedDailyHour?: number;
  assumedScoreHour?: number;
  assumedBodyHour?: number;
}

export function mapWearableRecord(
  record: WearableRecord,
  vendor: WearableVendor,
  options: WearableMapOptions = {},
): RawEventInput[] {
  // A wearable reads its own sensors, so attribution is never in doubt.
  const origin = originAttributes({ platform: vendor, app: vendor });
  const common = {
    source: vendor,
    sourceEventId: record.id,
    ...(record.timezone ? { timezone: record.timezone } : {}),
  };

  if (record.kind === "sleep") {
    const inBed = minutesBetween(record.startsAt, record.endsAt);
    if (inBed <= 0) return [];
    const asleep =
      typeof record.asleepMinutes === "number" && Number.isFinite(record.asleepMinutes) ? record.asleepMinutes : inBed;
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

  if (record.kind === "body") {
    const metrics = collectMetrics({ body_mass_kg: record.bodyMassKg, body_fat_ratio: record.bodyFatRatio });
    if (Object.keys(metrics).length === 0) return [];
    const estimated = !record.recordedAt;
    return [
      {
        ...common,
        type: "health.body",
        category: "wellbeing",
        occurredAt: record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedBodyHour ?? 7),
        subject: "body",
        metrics,
        attributes: { ...origin, time_estimated: estimated, local_date: record.dateISO },
      },
    ];
  }

  if (record.kind === "score") {
    const declared = new Set(VENDORS[vendor].scoreMetrics.map((metric) => metric.key));
    const unknown = Object.keys(record.scores).filter((key) => !declared.has(key));
    if (unknown.length > 0) {
      // Thrown rather than dropped: the SDK records it as a skipped record with
      // a warning, so a vendor adding a new score shows up on the health card
      // instead of vanishing.
      throw new Error(`${VENDORS[vendor].name} record ${record.id} carries undeclared scores: ${unknown.join(", ")}`);
    }
    const metrics = collectMetrics(record.scores);
    if (Object.keys(metrics).length === 0) return [];
    const estimated = !record.recordedAt;
    return [
      {
        ...common,
        type: `${vendor}.score`,
        category: "wellbeing",
        occurredAt: record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedScoreHour ?? 8),
        subject: "score",
        metrics,
        attributes: { ...origin, time_estimated: estimated, local_date: record.dateISO },
      },
    ];
  }

  const occurredAt = record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedDailyHour ?? 21);
  const estimated = !record.recordedAt;
  const attributes = { ...origin, time_estimated: estimated, local_date: record.dateISO };

  const vitals = collectMetrics({
    resting_heart_rate: record.restingHeartRate,
    hrv_ms: record.hrvMs,
    respiratory_rate: record.respiratoryRate,
    blood_oxygen: record.bloodOxygen,
    body_temperature_delta: record.bodyTemperatureDeltaC,
  });
  const activity = collectMetrics({
    steps: record.steps,
    active_energy_kcal: record.activeEnergyKcal,
    exercise_minutes: record.exerciseMinutes,
    distance_m: record.distanceMeters,
  });

  const events: RawEventInput[] = [];
  if (Object.keys(vitals).length > 0) {
    events.push({
      ...common,
      // The two events share a source record, so the id has to be split or the
      // dedupe key collides and one silently overwrites the other.
      sourceEventId: `${record.id}:vitals`,
      type: "health.vitals",
      category: "wellbeing",
      occurredAt,
      subject: "vitals",
      metrics: vitals,
      attributes,
    });
  }
  if (Object.keys(activity).length > 0) {
    events.push({
      ...common,
      sourceEventId: `${record.id}:activity`,
      type: "health.activity",
      category: "exercise",
      occurredAt,
      subject: "activity",
      metrics: activity,
      attributes,
    });
  }
  return events;
}

export function wearableRecordTimestamp(record: WearableRecord, options: WearableMapOptions = {}): string {
  switch (record.kind) {
    case "sleep":
    case "workout":
      return record.startsAt;
    case "daily":
      return record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedDailyHour ?? 21);
    case "body":
      return record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedBodyHour ?? 7);
    case "score":
      return record.recordedAt ?? stampLocalHour(record.dateISO, options.assumedScoreHour ?? 8);
  }
}

export function createWearableConnector(
  vendor: WearableVendor,
  reader: SourceReader<WearableRecord>,
  options: WearableMapOptions = {},
): Connector {
  return defineReaderConnector<WearableRecord>({
    id: vendor,
    name: VENDORS[vendor].name,
    version: "1.0.0",
    category: "wellbeing",
    description: `Sleep, physiology, movement and ${VENDORS[vendor].name}'s own daily scores.`,
    scopes: scopesFor(vendor),
    emits: [
      HEALTH_SLEEP_SPEC,
      HEALTH_VITALS_SPEC,
      HEALTH_ACTIVITY_SPEC,
      HEALTH_BODY_SPEC,
      HEALTH_WORKOUT_SPEC,
      scoreSpecFor(vendor),
    ],
    // Vendor APIs generally serve a couple of years; asking for ten and
    // getting silence is worse than asking for what exists.
    maxBackfillDays: 730,
    cadence: "daily",
    reader,
    map: (record) => mapWearableRecord(record, vendor, options),
    timestampOf: (record) => wearableRecordTimestamp(record, options),
  });
}

export const createGarminConnector = (reader: SourceReader<WearableRecord>, options?: WearableMapOptions): Connector =>
  createWearableConnector("garmin", reader, options);
export const createFitbitConnector = (reader: SourceReader<WearableRecord>, options?: WearableMapOptions): Connector =>
  createWearableConnector("fitbit", reader, options);
export const createWhoopConnector = (reader: SourceReader<WearableRecord>, options?: WearableMapOptions): Connector =>
  createWearableConnector("whoop", reader, options);
export const createOuraConnector = (reader: SourceReader<WearableRecord>, options?: WearableMapOptions): Connector =>
  createWearableConnector("oura", reader, options);
