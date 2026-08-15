/**
 * The shared health event vocabulary.
 *
 * Every health source — the two platforms and the four wearables — emits the
 * same `health.*` event types with the same metric keys. That is deliberate
 * and it is the load-bearing decision in this layer:
 *
 *  - a metric definition ("resting heart rate") is written once and covers
 *    whichever source the user actually connected;
 *  - a person who switches from Fitbit to Oura keeps one continuous series
 *    rather than two half-length ones that can never be compared;
 *  - reconciliation can recognise that Apple Health's step count and Garmin's
 *    step count are *the same measurement*, which is impossible if each vendor
 *    invents its own key.
 *
 * The exception is a vendor's proprietary composite score. WHOOP recovery,
 * Oura readiness, Garmin Body Battery and Fitbit readiness are all "0–100 and
 * higher is better" and are all computed differently from different inputs.
 * Pooling them under one key would manufacture a series that no instrument
 * ever measured, so those stay vendor-namespaced — see `wearables.ts`.
 */

import type { AttributeValue } from "../events/schema.js";
import { toInstant } from "../events/time.js";
import type { EmittedEventSpec } from "./types.js";

/** Sources that can write into a health platform, normalised for grouping. */
export function normaliseAppName(app: string | undefined): string {
  if (!app) return "unknown";
  return app
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

/**
 * Writing apps and devices, resolved to the source they belong to.
 *
 * The names platforms report are product names, not source ids: "Garmin
 * Connect" is the Garmin connector's data, and "Apple Watch" is Apple Health's
 * own. Comparing the raw strings gets both of those wrong, and getting the
 * second one wrong is how a perfectly good first-hand reading loses a tiebreak
 * to another device for no reason.
 */
const VENDOR_ALIASES: Record<string, string> = {
  garmin: "garmin",
  "garmin-connect": "garmin",
  fitbit: "fitbit",
  whoop: "whoop",
  oura: "oura",
  "apple-health": "apple-health",
  "apple-watch": "apple-health",
  health: "apple-health",
  iphone: "apple-health",
  "health-connect": "health-connect",
  "samsung-health": "health-connect",
  "google-fit": "health-connect",
};

/** The source an `origin_app` attribution belongs to, or null if unrecognised. */
export function attributedVendor(app: string): string | null {
  return VENDOR_ALIASES[normaliseAppName(app)] ?? null;
}

export interface OriginContext {
  /** The connector doing the reading. */
  platform: string;
  /** The app that actually wrote the record, when the platform reports one. */
  app?: string | undefined;
  device?: string | undefined;
}

/**
 * Provenance attributes every health event carries.
 *
 * `first_hand` is the one reconciliation depends on. A platform is an
 * aggregator: the step count Apple Health hands over may have been written by
 * Garmin Connect, in which case it is the *same physical measurement* the
 * Garmin connector also reports. Counting it twice would inflate every daily
 * total and, worse, would make a spurious correlation between two "different"
 * sources look like independent confirmation.
 */
export function originAttributes(origin: OriginContext): Record<string, AttributeValue> {
  const app = normaliseAppName(origin.app);
  const platform = normaliseAppName(origin.platform);
  const vendor = attributedVendor(app);
  return {
    platform,
    origin_app: app,
    // A reading is second-hand only when its writer belongs to a *different*
    // source. An unrecognised writer counts as first-hand: suppressing data we
    // cannot attribute would lose real measurements, and the reconciler
    // already prefers a known-first-hand reading over an unattributed one.
    first_hand: vendor === null || vendor === platform,
    ...(origin.device ? { origin_device: normaliseAppName(origin.device) } : {}),
  };
}

/**
 * A sleep event is stamped at the midpoint of the sleep, not at its start.
 *
 * Two reasons. The local date then lands on the morning someone woke up, which
 * is how people talk about "last night's sleep"; and the connector gets the
 * midpoint into the analytic path without computing a local time itself, since
 * the normaliser derives `localMinutes` from the instant. A sleep centred at
 * 03:20 reads as a late night without the connector knowing what a timezone is.
 */
export function sleepMidpoint(startsAt: string, endsAt: string): string {
  // `toInstant` throws on an unreadable timestamp, which the SDK turns into a
  // skipped record and a warning on the connector's health card.
  const start = toInstant(startsAt);
  const end = toInstant(endsAt);
  if (end <= start) throw new Error("Sleep record ends at or before it starts");
  return new Date(start + (end - start) / 2).toISOString();
}

/** Minutes between two instants, rounded to the nearest minute. */
export function minutesBetween(startsAt: string, endsAt: string): number {
  return Math.round((toInstant(endsAt) - toInstant(startsAt)) / 60_000);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Wall-clock intent for a daily summary that carries no clock time.
 *
 * The trailing `Z` is not a UTC claim — the normaliser stamps the connector's
 * configured zone over it. Every event built this way is also marked
 * `time_estimated`, which the quality scorer penalises and the within-day
 * timing analyses use to exclude it.
 */
export function stampLocalHour(dateISO: string, hour: number): string {
  if (!DATE_ONLY.test(dateISO)) throw new Error(`Expected a YYYY-MM-DD date, received "${dateISO}"`);
  return `${dateISO}T${String(Math.floor(hour)).padStart(2, "0")}:00:00.000Z`;
}

export const HEALTH_SLEEP_SPEC: EmittedEventSpec = {
  type: "health.sleep",
  category: "wellbeing",
  description: "A night of sleep",
  metrics: [
    { key: "sleep_minutes", unit: "minutes", description: "Time actually asleep", range: { min: 0, max: 1200 } },
    { key: "time_in_bed_minutes", unit: "minutes", description: "Time between getting in and out of bed", range: { min: 0, max: 1440 } },
    { key: "sleep_efficiency", unit: "ratio", description: "Share of time in bed spent asleep", range: { min: 0, max: 1 } },
    { key: "deep_minutes", unit: "minutes", description: "Time in deep sleep", range: { min: 0, max: 600 } },
    { key: "rem_minutes", unit: "minutes", description: "Time in REM sleep", range: { min: 0, max: 600 } },
    { key: "light_minutes", unit: "minutes", description: "Time in light sleep", range: { min: 0, max: 1200 } },
    { key: "awake_minutes", unit: "minutes", description: "Time awake after first falling asleep", range: { min: 0, max: 600 } },
  ],
};

export const HEALTH_VITALS_SPEC: EmittedEventSpec = {
  type: "health.vitals",
  category: "wellbeing",
  description: "Daily physiological readings",
  metrics: [
    { key: "resting_heart_rate", unit: "bpm", description: "Resting heart rate", range: { min: 20, max: 200 } },
    { key: "hrv_ms", unit: "ms", description: "Heart rate variability, as the source computed it", range: { min: 0, max: 500 } },
    { key: "respiratory_rate", unit: "per-minute", description: "Breaths per minute during sleep", range: { min: 4, max: 40 } },
    { key: "blood_oxygen", unit: "ratio", description: "Blood oxygen saturation", range: { min: 0.5, max: 1 } },
    { key: "body_temperature_delta", unit: "celsius", description: "Deviation from the personal temperature baseline", range: { min: -5, max: 5 } },
  ],
};

export const HEALTH_ACTIVITY_SPEC: EmittedEventSpec = {
  type: "health.activity",
  category: "exercise",
  description: "A day of movement",
  metrics: [
    { key: "steps", unit: "count", description: "Steps taken", range: { min: 0, max: 200_000 } },
    { key: "active_energy_kcal", unit: "kcal", description: "Energy burned above resting", range: { min: 0, max: 20_000 } },
    { key: "exercise_minutes", unit: "minutes", description: "Minutes at or above a brisk effort", range: { min: 0, max: 1440 } },
    { key: "distance_m", unit: "m", description: "Distance travelled on foot", range: { min: 0, max: 500_000 } },
  ],
};

export const HEALTH_BODY_SPEC: EmittedEventSpec = {
  type: "health.body",
  category: "wellbeing",
  description: "A body composition reading",
  metrics: [
    { key: "body_mass_kg", unit: "kg", description: "Body mass", range: { min: 20, max: 400 } },
    { key: "body_fat_ratio", unit: "ratio", description: "Body fat as a share of mass", range: { min: 0, max: 0.75 } },
  ],
};

export const HEALTH_WORKOUT_SPEC: EmittedEventSpec = {
  type: "health.workout",
  category: "exercise",
  description: "A recorded workout",
  metrics: [
    { key: "duration_minutes", unit: "minutes", description: "Workout length", range: { min: 0, max: 1440 } },
    { key: "active_energy_kcal", unit: "kcal", description: "Energy burned during the workout", range: { min: 0, max: 15_000 } },
    { key: "distance_m", unit: "m", description: "Distance covered", range: { min: 0, max: 500_000 } },
    { key: "mean_heart_rate", unit: "bpm", description: "Average heart rate", range: { min: 20, max: 250 } },
    { key: "max_heart_rate", unit: "bpm", description: "Peak heart rate", range: { min: 20, max: 250 } },
  ],
};

/** Every shared health event type, in the order a reader is likely to meet them. */
export const HEALTH_EVENT_SPECS: EmittedEventSpec[] = [
  HEALTH_SLEEP_SPEC,
  HEALTH_VITALS_SPEC,
  HEALTH_ACTIVITY_SPEC,
  HEALTH_BODY_SPEC,
  HEALTH_WORKOUT_SPEC,
];

/**
 * Sleep stage minutes, as reported. Stages are optional everywhere: a phone
 * measuring sleep by movement has no idea what REM is, and inventing a zero
 * for it would let the analytics layer treat "not measured" as "none".
 */
export interface SleepStages {
  deepMinutes?: number | null;
  remMinutes?: number | null;
  lightMinutes?: number | null;
  awakeMinutes?: number | null;
}

/**
 * Builds the sleep metric bag.
 *
 * Efficiency is derived rather than taken from the source because vendors
 * disagree about whether it means asleep/in-bed or asleep/(asleep+awake).
 * Deriving it once from two directly measured quantities is the only way the
 * number means the same thing across sources.
 */
export function sleepMetrics(
  asleepMinutes: number,
  inBedMinutes: number,
  stages: SleepStages = {},
): Record<string, number> {
  const asleep = Math.max(0, Math.round(asleepMinutes));
  const inBed = Math.max(asleep, Math.round(inBedMinutes));
  const metrics: Record<string, number> = {
    sleep_minutes: asleep,
    time_in_bed_minutes: inBed,
  };
  if (inBed > 0) metrics.sleep_efficiency = asleep / inBed;

  const stageKeys: [keyof SleepStages, string][] = [
    ["deepMinutes", "deep_minutes"],
    ["remMinutes", "rem_minutes"],
    ["lightMinutes", "light_minutes"],
    ["awakeMinutes", "awake_minutes"],
  ];
  for (const [field, key] of stageKeys) {
    const value = stages[field];
    if (typeof value === "number" && Number.isFinite(value)) metrics[key] = Math.max(0, value);
  }
  return metrics;
}

/** Copies through only the numbers that are actually present and finite. */
export function collectMetrics(candidates: Record<string, number | null | undefined>): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const [key, value] of Object.entries(candidates)) {
    if (typeof value === "number" && Number.isFinite(value)) metrics[key] = value;
  }
  return metrics;
}
