/**
 * Longitudinal data robustness diagnostics.
 *
 * A year of real data is not a clean array — it has holes, duplicates,
 * device swaps, timezone jumps, delayed syncs and unit surprises.
 * This module surfaces each explicitly rather than silently treating
 * missing as normal.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { addDays, daysBetween, localDate, localDayLengthHours, toInstant } from "../events/time.js";
import { findNearDuplicates } from "./score.js";
import type { SyncReport } from "../connectors/sync.js";
import type { Connector } from "../connectors/types.js";

export interface DeviceChange {
  date: string;
  from: string | null;
  to: string;
  source: SourceId;
  note: string;
}

export interface TimezoneShift {
  date: string;
  timezone: string;
  previous: string | null;
  isDstTransition: boolean;
  dayLengthHours: number;
  note: string;
}

export interface SamplingRateShift {
  source: SourceId;
  earlyRatePerWeek: number;
  lateRatePerWeek: number;
  ratio: number;
  note: string;
}

export interface UnitAnomaly {
  metricKey: string;
  source: SourceId;
  mean: number;
  globalMean: number;
  ratio: number;
  note: string;
}

export interface LongitudinalDiagnostics {
  window: { from: string; to: string; days: number };
  missingDays: { from: string; to: string; days: number }[];
  totalMissingDays: number;
  deviceChanges: DeviceChange[];
  duplicateGroups: number;
  reExportedCount: number;
  delayedSyncCount: number;
  partialImportNotes: string[];
  samplingRateShifts: SamplingRateShift[];
  timezoneShifts: TimezoneShift[];
  dstTransitionDays: string[];
  travelDays: string[];
  unitAnomalies: UnitAnomaly[];
  corruptedRecords: number;
  connectorOutageNotes: string[];
  diagnostics: string[];
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function diagnoseLongitudinal(
  events: readonly PulseEvent[],
  options: {
    syncReports?: readonly SyncReport[];
    connectors?: readonly Connector[];
    connectedSources?: readonly SourceId[];
    timezone?: string;
    now?: () => number;
  } = {},
): LongitudinalDiagnostics {
  const timezone = options.timezone ?? "UTC";
  const nowMs = (options.now ?? Date.now)();
  const today = localDate(nowMs, timezone);

  if (events.length === 0) {
    return {
      window: { from: today, to: today, days: 1 },
      missingDays: [],
      totalMissingDays: 0,
      deviceChanges: [],
      duplicateGroups: 0,
      reExportedCount: 0,
      delayedSyncCount: 0,
      partialImportNotes: [],
      samplingRateShifts: [],
      timezoneShifts: [],
      dstTransitionDays: [],
      travelDays: [],
      unitAnomalies: [],
      corruptedRecords: 0,
      connectorOutageNotes: [],
      diagnostics: ["No events to diagnose — connect a source to begin longitudinal tracking."],
    };
  }

  const dates = [...new Set(events.map((e) => e.localDate))].sort();
  const from = dates[0]!;
  const to = dates[dates.length - 1]!;
  const allDays = eachDate(from, to);
  const covered = new Set(dates);

  // Missing days — gaps not shared as blackouts (simple version: any gap >=2 days)
  const missingDays: { from: string; to: string; days: number }[] = [];
  let gapStart: string | null = null;
  let gapEnd: string | null = null;
  for (const day of allDays) {
    if (!covered.has(day)) {
      gapStart ??= day;
      gapEnd = day;
    } else if (gapStart && gapEnd) {
      const days = daysBetween(gapStart, gapEnd) + 1;
      if (days >= 2) missingDays.push({ from: gapStart, to: gapEnd, days });
      gapStart = null;
      gapEnd = null;
    }
  }
  if (gapStart && gapEnd) {
    const days = daysBetween(gapStart, gapEnd) + 1;
    if (days >= 2) missingDays.push({ from: gapStart, to: gapEnd, days });
  }
  const totalMissingDays = missingDays.reduce((s, g) => s + g.days, 0);

  // Device changes — distinct origin_device per source over time
  const deviceChanges: DeviceChange[] = [];
  const bySource = new Map<SourceId, PulseEvent[]>();
  for (const e of events) {
    const list = bySource.get(e.source);
    if (list) list.push(e);
    else bySource.set(e.source, [e]);
  }
  for (const [source, list] of bySource) {
    const sorted = [...list].sort((a, b) => toInstant(a.occurredAt) - toInstant(b.occurredAt));
    let lastDevice: string | null = null;
    for (const ev of sorted) {
      const device = typeof ev.attributes.origin_device === "string" ? ev.attributes.origin_device : null;
      if (device && device !== lastDevice && lastDevice !== null) {
        deviceChanges.push({
          date: ev.localDate,
          from: lastDevice,
          to: device,
          source,
          note: `${source} switched device from ${lastDevice} to ${device} on ${ev.localDate}`,
        });
      }
      if (device) lastDevice = device;
    }
  }
  // Source-level switch for same metric (e.g., garmin -> oura for steps)
  const metricSources = new Map<string, Set<string>>();
  for (const ev of events) {
    for (const key of Object.keys(ev.metrics)) {
      const set = metricSources.get(key) ?? new Set<string>();
      set.add(String(ev.source));
      metricSources.set(key, set);
    }
  }

  // Duplicates — near-duplicate groups the store dedupe may have collapsed
  const duplicateGroups = findNearDuplicates(events).length;

  // Re-exported measurements — second-hand platform import when original source also connected
  const reExportedCount = events.filter((e) => e.attributes.first_hand === false).length;

  // Delayed sync — ingested >7 days after occurrence
  const delayedSyncCount = events.filter((e) => {
    const ingested = Date.parse(e.provenance.ingestedAt);
    const occurred = Date.parse(e.occurredAt);
    return Number.isFinite(ingested) && Number.isFinite(occurred) && ingested - occurred > 7 * 86_400_000;
  }).length;

  // Partial imports — pages capped or rejected samples present
  const partialImportNotes: string[] = [];
  for (const report of options.syncReports ?? []) {
    if (report.warnings.some((w) => w.includes("pages"))) {
      partialImportNotes.push(`${report.source}: ${report.warnings.find((w) => w.includes("pages"))}`);
    }
    if (report.rejected > 0 && report.fetched > 0 && report.rejected / report.fetched > 0.1) {
      partialImportNotes.push(`${report.source}: ${report.rejected}/${report.fetched} records rejected on last sync`);
    }
  }

  // Sampling rate changes — early vs late halves
  const samplingRateShifts: SamplingRateShift[] = [];
  const midDate = allDays[Math.floor(allDays.length / 2)]!;
  for (const [source, list] of bySource) {
    const early = list.filter((e) => e.localDate < midDate).length;
    const late = list.filter((e) => e.localDate >= midDate).length;
    const earlyDays = Math.max(1, daysBetween(from, midDate) + 1);
    const lateDays = Math.max(1, daysBetween(midDate, to) + 1);
    const earlyRate = (early / earlyDays) * 7;
    const lateRate = (late / lateDays) * 7;
    const ratio = earlyRate > 0 ? lateRate / earlyRate : lateRate > 0 ? Infinity : 1;
    if ((ratio >= 2 || ratio <= 0.5) && early + late >= 14) {
      samplingRateShifts.push({
        source,
        earlyRatePerWeek: Math.round(earlyRate * 10) / 10,
        lateRatePerWeek: Math.round(lateRate * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        note: `${source} changed sampling from ${earlyRate.toFixed(1)}/week to ${lateRate.toFixed(1)}/week (ratio ${ratio.toFixed(2)})`,
      });
    }
  }

  // Timezone shifts + DST
  const sortedByTime = [...events].sort((a, b) => toInstant(a.occurredAt) - toInstant(b.occurredAt));
  const timezoneShifts: TimezoneShift[] = [];
  const dstTransitionDays: string[] = [];
  let prevTz: string | null = null;
  const seenDaysForDst = new Set<string>();
  for (const ev of sortedByTime) {
    if (prevTz !== null && ev.timezone !== prevTz) {
      const hours = localDayLengthHours(ev.localDate, ev.timezone);
      const isDst = hours !== 24;
      timezoneShifts.push({
        date: ev.localDate,
        timezone: ev.timezone,
        previous: prevTz,
        isDstTransition: isDst,
        dayLengthHours: hours,
        note: `Timezone changed from ${prevTz} to ${ev.timezone} on ${ev.localDate}${isDst ? ` — DST day is ${hours}h` : ""}`,
      });
    }
    prevTz = ev.timezone;
    if (!seenDaysForDst.has(ev.localDate)) {
      seenDaysForDst.add(ev.localDate);
      const len = localDayLengthHours(ev.localDate, ev.timezone);
      if (len !== 24) dstTransitionDays.push(ev.localDate);
    }
  }

  // Travel days — attributes marking travel
  const travelDays = [
    ...new Set(
      events
        .filter((e) => {
          const a = e.attributes;
          return a.travel === true || a.travelling === true || a.is_travelling === true || typeof a.travel_context === "string" || typeof a.trip === "string";
        })
        .map((e) => e.localDate),
    ),
  ].sort();

  // Different units — same metric with divergent per-source means (ratio >2)
  const unitAnomalies: UnitAnomaly[] = [];
  const globalMeans = new Map<string, number>();
  for (const [metricKey, sources] of metricSources) {
    if (sources.size < 2) continue;
    const allVals = events.flatMap((e) => (typeof e.metrics[metricKey] === "number" ? [e.metrics[metricKey]!] : []));
    if (allVals.length < 10) continue;
    const globalMean = allVals.reduce((s, v) => s + v, 0) / allVals.length;
    if (!Number.isFinite(globalMean) || Math.abs(globalMean) < 1e-9) continue;
    globalMeans.set(metricKey, globalMean);
  }
  for (const [metricKey, globalMean] of globalMeans) {
    for (const source of metricSources.get(metricKey) ?? []) {
      const vals = events.filter((e) => String(e.source) === source && typeof e.metrics[metricKey] === "number").map((e) => e.metrics[metricKey]!);
      if (vals.length < 5) continue;
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const ratio = globalMean !== 0 ? mean / globalMean : 1;
      if (ratio >= 2 || ratio <= 0.5) {
        unitAnomalies.push({
          metricKey,
          source: source as SourceId,
          mean: Math.round(mean * 100) / 100,
          globalMean: Math.round(globalMean * 100) / 100,
          ratio: Math.round(ratio * 100) / 100,
          note: `${metricKey} from ${source} averages ${mean.toFixed(2)} vs global ${globalMean.toFixed(2)} — possible unit mismatch`,
        });
      }
    }
  }

  // Corrupted records
  const corruptedRecords = (options.syncReports ?? []).reduce((s, r) => s + r.rejected, 0);

  // Connector outages — failing health or long silent gap
  const connectorOutageNotes: string[] = [];
  for (const report of options.syncReports ?? []) {
    if (report.health.status === "failing") {
      connectorOutageNotes.push(`${report.source} failing: ${report.health.message}`);
    } else if (report.error) {
      connectorOutageNotes.push(`${report.source} sync error: ${report.error}`);
    }
  }
  for (const conn of options.connectors ?? []) {
    const srcEvents = bySource.get(conn.id) ?? [];
    if (options.connectedSources?.includes(conn.id) && srcEvents.length === 0) {
      connectorOutageNotes.push(`${conn.name} is connected but has never delivered data`);
    }
  }

  const diagnostics: string[] = [];
  if (totalMissingDays > 0) diagnostics.push(`${totalMissingDays} missing days across ${missingDays.length} gaps — treated as not measured, not zero.`);
  else diagnostics.push("No multi-day gaps detected in this window.");
  if (deviceChanges.length) diagnostics.push(`${deviceChanges.length} device change(s) detected — continuity is tracked by metric, not by device.`);
  if (timezoneShifts.length) diagnostics.push(`${timezoneShifts.length} timezone shift(s); wall-clock analysis stays correct.`);
  if (dstTransitionDays.length) diagnostics.push(`DST transition on ${dstTransitionDays[0]} — that day is ${localDayLengthHours(dstTransitionDays[0]!, timezone)}h long.`);
  if (travelDays.length) diagnostics.push(`${travelDays.length} travel day(s) flagged — baselines exclude travel context.`);
  if (reExportedCount > 0) diagnostics.push(`${reExportedCount} re-exported measurement(s) will be deduplicated before analysis.`);
  if (delayedSyncCount > 0) diagnostics.push(`${delayedSyncCount} event(s) arrived >7 days late — late data still counts once received.`);
  if (unitAnomalies.length) diagnostics.push(`${unitAnomalies.length} possible unit mismatch(es) detected across sources.`);
  if (corruptedRecords > 0) diagnostics.push(`${corruptedRecords} record(s) rejected as corrupted — samples remain on the health card.`);
  if (connectorOutageNotes.length) diagnostics.push(`${connectorOutageNotes.length} connector outage signal(s) present.`);

  return {
    window: { from, to, days: allDays.length },
    missingDays,
    totalMissingDays,
    deviceChanges,
    duplicateGroups,
    reExportedCount,
    delayedSyncCount,
    partialImportNotes,
    samplingRateShifts,
    timezoneShifts,
    dstTransitionDays,
    travelDays,
    unitAnomalies,
    corruptedRecords,
    connectorOutageNotes,
    diagnostics,
  };
}
