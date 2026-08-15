/**
 * Data-quality scoring.
 *
 * Quality is not decoration: it feeds directly into the confidence grade, so a
 * finding built on a source that stopped syncing three weeks ago is
 * automatically downgraded rather than presented with the same authority as
 * one built on complete data.
 *
 * Five dimensions, each 0..1, each independently explainable to the user:
 *   completeness — how much of the covered period actually has data
 *   freshness    — how recently the source produced anything
 *   consistency  — how stable the record shape is (rejects, retro-edits)
 *   validity     — how many values sit inside their declared ranges
 *   timing       — how much of the data has a real clock time vs an assumed one
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { daysBetween, localDate, toInstant } from "../events/time.js";
import { clamp } from "../statistics/descriptive.js";
import { sourcesOf, type MetricDefinition } from "../metrics/registry.js";
import type { SyncReport } from "../connectors/sync.js";

export interface QualityDimension {
  id: "completeness" | "freshness" | "consistency" | "validity" | "timing";
  score: number;
  explanation: string;
}

export interface QualityIssue {
  severity: "info" | "warning" | "critical";
  message: string;
  /** What the user could do about it. Null when nothing can be done. */
  remedy: string | null;
}

export interface SourceQuality {
  source: SourceId;
  /** Weighted 0..1 overall score. */
  score: number;
  grade: "excellent" | "good" | "fair" | "poor";
  dimensions: QualityDimension[];
  issues: QualityIssue[];
  eventCount: number;
  firstEventDate: string | null;
  lastEventDate: string | null;
  /** Days in the covered window that carry at least one event. */
  daysWithData: number;
  coverageDays: number;
}

/** Ceiling applied when any critical issue is present. */
const CRITICAL_SCORE_CAP = 0.44;

const WEIGHTS: Record<QualityDimension["id"], number> = {
  completeness: 0.3,
  freshness: 0.2,
  consistency: 0.2,
  validity: 0.2,
  timing: 0.1,
};

export interface QualityContext {
  /** Reference "now" for freshness. */
  nowMs: number;
  timezone: string;
  /** Most recent sync report for the source, when available. */
  syncReport?: SyncReport;
  /** Definitions used for range validation. */
  definitions?: readonly MetricDefinition[];
  /**
   * Expected cadence in days. A daily journal missing four days matters more
   * than a gym log missing four days, so the caller supplies the expectation.
   */
  expectedEventsPerWeek?: number;
}

export function scoreSource(
  source: SourceId,
  events: readonly PulseEvent[],
  context: QualityContext,
): SourceQuality {
  const sourceEvents = events.filter((event) => event.source === source);
  const issues: QualityIssue[] = [];

  if (sourceEvents.length === 0) {
    return {
      source,
      score: 0,
      grade: "poor",
      dimensions: (Object.keys(WEIGHTS) as QualityDimension["id"][]).map((id) => ({
        id,
        score: 0,
        explanation: "No data from this source yet",
      })),
      issues: [{ severity: "critical", message: "No events received", remedy: "Connect the source and run a sync" }],
      eventCount: 0,
      firstEventDate: null,
      lastEventDate: null,
      daysWithData: 0,
      coverageDays: 0,
    };
  }

  const dates = [...new Set(sourceEvents.map((event) => event.localDate))].sort();
  const firstEventDate = dates[0]!;
  const lastEventDate = dates[dates.length - 1]!;
  const coverageDays = daysBetween(firstEventDate, lastEventDate) + 1;
  const daysWithData = dates.length;

  // --- completeness -----------------------------------------------------
  const expectedPerWeek = context.expectedEventsPerWeek ?? 3;
  const expectedDays = Math.max(1, Math.min(coverageDays, (coverageDays * expectedPerWeek) / 7));
  const completeness = clamp(daysWithData / expectedDays, 0, 1);
  if (completeness < 0.6) {
    issues.push({
      severity: "warning",
      message: `Only ${daysWithData} of an expected ~${Math.round(expectedDays)} active days have data`,
      remedy: "Run a backfill, or lower the expected cadence for this source",
    });
  }

  // --- freshness --------------------------------------------------------
  const today = localDate(context.nowMs, context.timezone);
  const staleDays = Math.max(0, daysBetween(lastEventDate, today));
  // Half-life of a week: 0 days stale = 1.0, 7 = 0.5, 21 = 0.125.
  const freshness = clamp(2 ** (-staleDays / 7), 0, 1);
  if (staleDays > 14) {
    issues.push({
      severity: "critical",
      message: `No data for ${staleDays} days`,
      remedy: "Check the connector's health and re-authorise if needed",
    });
  } else if (staleDays > 5) {
    issues.push({ severity: "warning", message: `Last data was ${staleDays} days ago`, remedy: "Run a sync" });
  }

  // --- consistency ------------------------------------------------------
  let consistency = 1;
  const report = context.syncReport;
  if (report && report.fetched > 0) {
    const rejectRate = report.rejected / report.fetched;
    const updateRate = report.updated / Math.max(1, report.inserted + report.updated + report.duplicates);
    consistency = clamp(1 - rejectRate * 1.5 - updateRate * 0.5, 0, 1);
    if (rejectRate > 0.05) {
      issues.push({
        severity: "warning",
        message: `${(rejectRate * 100).toFixed(0)}% of records failed validation on the last sync`,
        remedy: "The connector may need updating for a change in the source app",
      });
    }
    if (updateRate > 0.2) {
      issues.push({
        severity: "info",
        message: "This source frequently rewrites past records, so historical numbers may shift",
        remedy: null,
      });
    }
  }
  // Multiple connector versions in the same window means mixed mappings.
  const versions = new Set(sourceEvents.map((event) => event.provenance.connectorVersion));
  if (versions.size > 1) {
    consistency = clamp(consistency - 0.15, 0, 1);
    issues.push({
      severity: "info",
      message: `Data was imported by ${versions.size} different connector versions`,
      remedy: "Re-run a backfill to normalise everything with the current mapping",
    });
  }

  // --- validity ---------------------------------------------------------
  let checked = 0;
  let outOfRange = 0;
  const rangeByKey = new Map<string, { min: number; max: number }>();
  for (const definition of context.definitions ?? []) {
    if (!sourcesOf(definition).includes(source) || !definition.range) continue;
    for (const type of definition.eventTypes) rangeByKey.set(`${type}::${definition.metricKey}`, definition.range);
  }
  for (const event of sourceEvents) {
    for (const [key, value] of Object.entries(event.metrics)) {
      const range = rangeByKey.get(`${event.type}::${key}`);
      if (!range) continue;
      checked += 1;
      if (value < range.min || value > range.max) outOfRange += 1;
    }
  }
  const validity = checked === 0 ? 0.8 : clamp(1 - outOfRange / checked, 0, 1);
  if (outOfRange > 0) {
    issues.push({
      severity: "warning",
      message: `${outOfRange} metric values fall outside their declared range`,
      remedy: "These values are excluded from analysis; check the source app for bad entries",
    });
  }

  // --- timing -----------------------------------------------------------
  const estimated = sourceEvents.filter((event) => event.attributes.time_estimated === true).length;
  const timing = clamp(1 - estimated / sourceEvents.length, 0, 1);
  if (timing < 0.8) {
    issues.push({
      severity: "info",
      message: `${Math.round((1 - timing) * 100)}% of events have an assumed rather than recorded time`,
      remedy: "Time-of-day insights will exclude these events",
    });
  }

  const dimensions: QualityDimension[] = [
    { id: "completeness", score: completeness, explanation: `${daysWithData} active days across ${coverageDays} days of history` },
    { id: "freshness", score: freshness, explanation: staleDays === 0 ? "Up to date" : `Last data ${staleDays} day(s) ago` },
    { id: "consistency", score: consistency, explanation: report ? `${report.rejected} rejected of ${report.fetched} fetched on last sync` : "No recent sync report" },
    { id: "validity", score: validity, explanation: checked ? `${checked - outOfRange}/${checked} values within range` : "No range checks defined" },
    { id: "timing", score: timing, explanation: estimated ? `${estimated} events have an assumed time` : "All events have recorded times" },
  ];

  const weighted = dimensions.reduce((acc, dimension) => acc + dimension.score * WEIGHTS[dimension.id], 0);
  // A critical issue caps the score. A source that stopped syncing three
  // months ago can still score well on completeness, validity and timing for
  // the period it does cover — but its data cannot support a claim about how
  // things are now, and the headline number has to say so.
  const score = issues.some((issue) => issue.severity === "critical") ? Math.min(weighted, CRITICAL_SCORE_CAP) : weighted;

  return {
    source,
    score,
    grade: gradeFor(score),
    dimensions,
    issues,
    eventCount: sourceEvents.length,
    firstEventDate,
    lastEventDate,
    daysWithData,
    coverageDays,
  };
}

export function gradeFor(score: number): SourceQuality["grade"] {
  if (score >= 0.85) return "excellent";
  if (score >= 0.65) return "good";
  if (score >= 0.45) return "fair";
  return "poor";
}

/** Quality across every source that contributed to a set of events. */
export function scoreAll(
  events: readonly PulseEvent[],
  context: QualityContext,
  perSource?: Map<SourceId, Partial<QualityContext>>,
): SourceQuality[] {
  const sources = [...new Set(events.map((event) => event.source))];
  return sources
    .map((source) => scoreSource(source, events, { ...context, ...(perSource?.get(source) ?? {}) }))
    .sort((a, b) => String(a.source).localeCompare(String(b.source)));
}

/**
 * The single 0..1 number the confidence grader consumes for a finding.
 * Takes the *worst* contributing source rather than the average: a claim is
 * only as trustworthy as its weakest input.
 */
export function qualityForSources(
  qualities: readonly SourceQuality[],
  sources: readonly SourceId[],
): number {
  const relevant = qualities.filter((quality) => sources.includes(quality.source));
  if (relevant.length === 0) return 0.5;
  return Math.min(...relevant.map((quality) => quality.score));
}

/** Detects duplicate-looking events the dedupe key could not catch. */
export function findNearDuplicates(events: readonly PulseEvent[], windowMs = 1000): PulseEvent[][] {
  const groups = new Map<string, PulseEvent[]>();
  for (const event of events) {
    const bucket = Math.floor(toInstant(event.occurredAt) / windowMs);
    const key = `${event.source}|${event.type}|${event.subject ?? ""}|${bucket}`;
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}
