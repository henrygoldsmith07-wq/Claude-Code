/**
 * Full export and per-source deletion.
 *
 * Two guarantees this module exists to make true:
 *   - you can get everything out, in a documented format, without Pulse;
 *   - you can remove one source completely without touching the others.
 *
 * Sensitive sources are excluded from an export by default and must be asked
 * for by name, so an export shared with someone else does not quietly carry a
 * year of reflections in it.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { CURRENT_SCHEMA_VERSION } from "../events/schema.js";
import type { MemoryEventStore } from "../events/store.js";
import type { ConsentRegistry, ConsentGrant } from "./consent.js";
import type { Finding } from "../discovery/finding.js";
import type { Hypothesis } from "../hypotheses/tracker.js";
import type { ExperimentDesign } from "../experiments/design.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { FeedbackEntry } from "../recommendations/feedback.js";
import type { ReplicationRecord } from "../discovery/replication.js";
import type { ContradictionRecord } from "../discovery/contradictions.js";
import type { InsightHistorySnapshot } from "../history/insight-history.js";
import type { InsightCollection } from "../history/insight-collections.js";
import type { RecommendationValue } from "../recommendations/value.js";

export const EXPORT_FORMAT_VERSION = 1;

export interface PulseExport {
  format: "pulse-export";
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  /** Sources deliberately left out, and why. */
  excludedSources: { source: SourceId; reason: string }[];
  counts: { events: number; findings: number; hypotheses: number; experiments: number };
  events: PulseEvent[];
  consents: ConsentGrant[];
  findings: Finding[];
  hypotheses: Hypothesis[];
  experimentDesigns: ExperimentDesign[];
  experimentResults: ExperimentResult[];
  feedback: FeedbackEntry[];
  replication: ReplicationRecord[];
  contradictions: ContradictionRecord[];
  insightHistory: InsightHistorySnapshot;
  insightCollections: InsightCollection[];
  recommendationValue: RecommendationValue[];
}

export interface ExportOptions {
  /** Include sources marked sensitive. Off by default, on purpose. */
  includeSensitive?: boolean;
  /** Restrict to these sources. */
  sources?: readonly SourceId[];
  now?: () => number;
  findings?: readonly Finding[];
  hypotheses?: readonly Hypothesis[];
  experimentDesigns?: readonly ExperimentDesign[];
  experimentResults?: readonly ExperimentResult[];
  feedback?: readonly FeedbackEntry[];
  replication?: readonly ReplicationRecord[];
  contradictions?: readonly ContradictionRecord[];
  insightHistory?: InsightHistorySnapshot;
  insightCollections?: readonly InsightCollection[];
  recommendationValue?: readonly RecommendationValue[];
}

export function buildExport(
  store: MemoryEventStore,
  consent: ConsentRegistry,
  options: ExportOptions = {},
): PulseExport {
  const now = options.now ?? Date.now;
  const all = store.all();
  const excludedSources: PulseExport["excludedSources"] = [];

  const allowedByConsent = new Set(consent.exportableSources());
  const requested = options.sources ? new Set(options.sources) : null;

  const events = all.filter((event) => {
    if (requested && !requested.has(event.source)) return false;
    if (!options.includeSensitive && event.sensitivity === "sensitive") {
      addOnce(excludedSources, event.source, "Marked sensitive; re-run the export with sensitive data included to receive it");
      return false;
    }
    if (!allowedByConsent.has(event.source) && consent.get(event.source) !== null) {
      addOnce(excludedSources, event.source, "Excluded from exports in this source's privacy settings");
      return false;
    }
    return true;
  });

  const findings = options.findings ?? [];
  const hypotheses = options.hypotheses ?? [];
  const experimentDesigns = options.experimentDesigns ?? [];

  return {
    format: "pulse-export",
    formatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date(now()).toISOString(),
    excludedSources,
    counts: {
      events: events.length,
      findings: findings.length,
      hypotheses: hypotheses.length,
      experiments: experimentDesigns.length,
    },
    events,
    consents: consent.list(),
    findings: [...findings],
    hypotheses: [...hypotheses],
    experimentDesigns: [...experimentDesigns],
    experimentResults: [...(options.experimentResults ?? [])],
    feedback: [...(options.feedback ?? [])],
    replication: [...(options.replication ?? [])],
    contradictions: [...(options.contradictions ?? [])],
    insightHistory: options.insightHistory ?? { version: 1 as const, scans: [] },
    insightCollections: [...(options.insightCollections ?? [])],
    recommendationValue: [...(options.recommendationValue ?? [])],
  };
}

function addOnce(list: { source: SourceId; reason: string }[], source: SourceId, reason: string): void {
  if (!list.some((entry) => entry.source === source)) list.push({ source, reason });
}

/** Newline-delimited JSON of raw events — the format that survives without Pulse. */
export function toNdjson(events: readonly PulseEvent[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n");
}

/** Flat CSV of the analytic payload. Free text is never included. */
export function toCsv(events: readonly PulseEvent[]): string {
  const metricKeys = [...new Set(events.flatMap((event) => Object.keys(event.metrics)))].sort();
  const header = [
    "id",
    "source",
    "type",
    "category",
    "occurred_at",
    "timezone",
    "local_date",
    "local_minutes",
    "duration_ms",
    "subject",
    "sensitivity",
    ...metricKeys.map((key) => `metric_${key}`),
  ];

  const rows = events.map((event) => [
    event.id,
    String(event.source),
    event.type,
    event.category,
    event.occurredAt,
    event.timezone,
    event.localDate,
    String(event.localMinutes),
    event.durationMs === undefined ? "" : String(event.durationMs),
    event.subject ?? "",
    event.sensitivity,
    ...metricKeys.map((key) => (event.metrics[key] === undefined ? "" : String(event.metrics[key]))),
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export interface DeletionReport {
  source: SourceId;
  eventsDeleted: number;
  consentRevoked: boolean;
  deletedAt: string;
  /** Derived artefacts that referenced the source and are no longer valid. */
  invalidatedFindings: string[];
  invalidatedHypotheses: string[];
}

/**
 * Deletes everything from one source and revokes its consent.
 *
 * Crucially it also reports the *derived* artefacts that referenced it. A
 * finding built on deleted data is not merely stale, it is unverifiable, and
 * the caller is expected to drop the ids returned here.
 */
export async function deleteSource(
  store: MemoryEventStore,
  consent: ConsentRegistry,
  source: SourceId,
  derived: { findings?: readonly Finding[]; hypotheses?: readonly Hypothesis[] } = {},
  now: () => number = Date.now,
): Promise<DeletionReport> {
  const eventsDeleted = await store.deleteBySource(source);
  consent.revoke(source);

  const invalidatedFindings = (derived.findings ?? [])
    .filter((finding) => finding.sources.includes(source))
    .map((finding) => finding.id);

  const findingIds = new Set(invalidatedFindings);
  const invalidatedHypotheses = (derived.hypotheses ?? [])
    .filter((hypothesis) => hypothesis.originFindingId && findingIds.has(hypothesis.originFindingId))
    .map((hypothesis) => hypothesis.id);

  return {
    source,
    eventsDeleted,
    consentRevoked: true,
    deletedAt: new Date(now()).toISOString(),
    invalidatedFindings,
    invalidatedHypotheses,
  };
}

/** Deletes a date range from one source, e.g. "forget last week". */
export async function deleteRange(
  store: MemoryEventStore,
  source: SourceId,
  fromISO: string,
  toISO: string,
  now: () => number = Date.now,
): Promise<DeletionReport> {
  const eventsDeleted = await store.deleteRange(source, fromISO, toISO);
  return {
    source,
    eventsDeleted,
    consentRevoked: false,
    deletedAt: new Date(now()).toISOString(),
    invalidatedFindings: [],
    invalidatedHypotheses: [],
  };
}

/** Erases everything Pulse holds. Consents are revoked, not merely cleared. */
export async function deleteEverything(
  store: MemoryEventStore,
  consent: ConsentRegistry,
): Promise<{ eventsDeleted: number; sourcesRevoked: SourceId[] }> {
  const eventsDeleted = store.size;
  const sources = consent.list().map((grant) => grant.source);
  for (const source of sources) consent.revoke(source);
  await store.clear();
  return { eventsDeleted, sourcesRevoked: sources };
}
