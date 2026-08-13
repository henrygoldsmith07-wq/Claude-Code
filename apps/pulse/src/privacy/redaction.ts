/**
 * Redaction for telemetry and for anything leaving the device.
 *
 * The rule: telemetry may carry *shapes and counts*, never content. That means
 * no subjects, no attribute values, no notes, no ids that could be joined back
 * to a source record. Enforced by a whitelist rather than a blacklist, because
 * a blacklist silently fails the moment a connector adds a field.
 */

import type { PulseEvent } from "../events/schema.js";

export interface RedactedEvent {
  source: string;
  type: string;
  category: string;
  /** Truncated to the hour — enough for cadence, not enough to identify a session. */
  hourBucket: string;
  metricKeys: string[];
  attributeKeys: string[];
  hasNotes: boolean;
  sensitivity: string;
}

export function redactEvent(event: PulseEvent): RedactedEvent {
  return {
    source: String(event.source),
    type: event.type,
    category: event.category,
    hourBucket: `${event.localDate}T${String(Math.floor(event.localMinutes / 60)).padStart(2, "0")}`,
    metricKeys: Object.keys(event.metrics).sort(),
    attributeKeys: Object.keys(event.attributes).sort(),
    hasNotes: event.notes !== undefined && event.notes.length > 0,
    sensitivity: event.sensitivity,
  };
}

export interface TelemetrySummary {
  eventCount: number
  sources: { source: string; count: number }[];
  types: { type: string; count: number }[];
  sensitiveCount: number;
  dateRange: { from: string; to: string } | null;
}

/** Aggregate telemetry: counts only, and only when there is enough to hide in. */
export function summariseForTelemetry(events: readonly PulseEvent[], minCohort = 5): TelemetrySummary {
  const bySource = new Map<string, number>();
  const byType = new Map<string, number>();
  let sensitiveCount = 0;

  for (const event of events) {
    bySource.set(String(event.source), (bySource.get(String(event.source)) ?? 0) + 1);
    byType.set(event.type, (byType.get(event.type) ?? 0) + 1);
    if (event.sensitivity === "sensitive") sensitiveCount += 1;
  }

  const dates = events.map((event) => event.localDate).sort();

  return {
    eventCount: events.length,
    // Small buckets are dropped rather than reported: a count of one is a fact
    // about a single session.
    sources: [...bySource.entries()].filter(([, count]) => count >= minCohort).map(([source, count]) => ({ source, count })),
    types: [...byType.entries()].filter(([, count]) => count >= minCohort).map(([type, count]) => ({ type, count })),
    sensitiveCount,
    dateRange: dates.length ? { from: dates[0]!, to: dates[dates.length - 1]! } : null,
  };
}

const SENSITIVE_HINTS = [
  /\bnotes?\b/i,
  /\bcontent\b/i,
  /\btranscript\b/i,
  /\bentry\b/i,
  /\bmessage\b/i,
  /\btext\b/i,
];

/**
 * Fails loudly when a payload about to leave the device contains a field that
 * looks like free text. Used in tests and before any network call.
 */
export function assertNoRawContent(payload: unknown, path = "$"): void {
  if (payload === null || payload === undefined) return;
  if (typeof payload === "string") {
    // A long free-form string at any depth is treated as content.
    if (payload.length > 280) throw new Error(`Redaction violation: long free text at ${path}`);
    return;
  }
  if (Array.isArray(payload)) {
    payload.forEach((item, index) => assertNoRawContent(item, `${path}[${index}]`));
    return;
  }
  if (typeof payload === "object") {
    for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
      if (typeof value === "string" && SENSITIVE_HINTS.some((pattern) => pattern.test(key))) {
        throw new Error(`Redaction violation: field "${key}" at ${path} may contain personal content`);
      }
      assertNoRawContent(value, `${path}.${key}`);
    }
  }
}

/**
 * Prepares events for an AI prompt: sensitive sources removed unless allowed,
 * notes stripped in all cases.
 *
 * Notes are stripped even for permitted sources because the AI layer's job is
 * to describe numbers, and free text in the prompt is both a privacy risk and
 * an invitation to invent.
 */
export function prepareForAi(
  events: readonly PulseEvent[],
  allowedSources: readonly string[],
): PulseEvent[] {
  const allowed = new Set(allowedSources.map(String));
  return events
    .filter((event) => allowed.has(String(event.source)))
    .map((event) => {
      const { notes: _notes, ...rest } = event;
      return rest as PulseEvent;
    });
}
