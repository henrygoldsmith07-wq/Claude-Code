/**
 * Wearable connector — daily activity and physiology aggregates.
 *
 * Collection has to be almost automatic for the analytics to be worth
 * anything, so the connector accepts the shape every consumer wearable (and
 * Apple Health / Google Fit export) reduces to: one record per day of steps,
 * active minutes, resting heart rate, HRV and sleep. No raw waveforms, no
 * free text — just the daily numbers that can act as confounders and drivers
 * for everything else Pulse measures.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";

export interface WearableDailyRecord {
  kind: "daily";
  id: string;
  dateISO: string;
  /** Precise time when known; otherwise stamped at noon and flagged estimated. */
  at?: string;
  steps?: number;
  activeMinutes?: number;
  restingHeartRateBpm?: number;
  /** Heart-rate variability, rMSSD in milliseconds. */
  hrvMs?: number;
  sleepDurationMinutes?: number;
  timezone?: string;
}

const SCOPES: ConnectorScope[] = [
  { id: "activity", description: "Daily activity aggregates: steps and active minutes", readsContent: false },
  { id: "physiology", description: "Daily physiology: resting heart rate, heart-rate variability and sleep duration", readsContent: false },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "wearable.daily",
    category: "wellbeing",
    description: "A day of wearable activity and physiology aggregates",
    metrics: [
      { key: "steps", unit: "count", description: "Steps taken", range: { min: 0, max: 200_000 } },
      { key: "active_minutes", unit: "minutes", description: "Active minutes", range: { min: 0, max: 1440 } },
      { key: "resting_hr_bpm", unit: "score", description: "Resting heart rate in beats per minute", range: { min: 30, max: 120 } },
      { key: "hrv_ms", unit: "ms", description: "Heart-rate variability (rMSSD)", range: { min: 0, max: 300 } },
      { key: "sleep_minutes", unit: "minutes", description: "Total sleep duration", range: { min: 0, max: 1440 } },
    ],
  },
];

export function mapWearableRecord(record: WearableDailyRecord): RawEventInput[] {
  const metrics: Record<string, number> = {};
  if (typeof record.steps === "number" && Number.isFinite(record.steps)) metrics.steps = Math.max(0, record.steps);
  if (typeof record.activeMinutes === "number" && Number.isFinite(record.activeMinutes)) {
    metrics.active_minutes = Math.max(0, record.activeMinutes);
  }
  if (typeof record.restingHeartRateBpm === "number" && Number.isFinite(record.restingHeartRateBpm)) {
    metrics.resting_hr_bpm = record.restingHeartRateBpm;
  }
  if (typeof record.hrvMs === "number" && Number.isFinite(record.hrvMs)) metrics.hrv_ms = record.hrvMs;
  if (typeof record.sleepDurationMinutes === "number" && Number.isFinite(record.sleepDurationMinutes)) {
    metrics.sleep_minutes = Math.max(0, record.sleepDurationMinutes);
  }
  if (Object.keys(metrics).length === 0) return [];

  const at = record.at ?? `${record.dateISO}T12:00:00.000Z`;
  return [
    {
      source: "wearable",
      sourceEventId: record.id,
      type: "wearable.daily",
      category: "wellbeing",
      occurredAt: at,
      ...(record.timezone ? { timezone: record.timezone } : {}),
      subject: "daily",
      metrics,
      attributes: { local_date: record.dateISO, time_estimated: !record.at },
    },
  ];
}

export function createWearableConnector(reader: SourceReader<WearableDailyRecord>): Connector {
  return defineReaderConnector<WearableDailyRecord>({
    id: "wearable",
    name: "Wearable",
    version: "1.0.0",
    category: "wellbeing",
    description: "Daily activity and physiology aggregates from Apple Health, Google Fit, Fitbit, Oura, Whoop or a health export.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1825,
    reader,
    map: (record) => mapWearableRecord(record),
    timestampOf: (record) => record.at ?? `${record.dateISO}T12:00:00.000Z`,
  });
}
