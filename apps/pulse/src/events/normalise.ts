/**
 * Raw connector record → validated `PulseEvent`.
 *
 * Connectors are only allowed to describe *what happened*; every derived field
 * (local calendar position, dedupe key, id, provenance) is computed here so
 * that no connector can invent its own convention.
 */

import {
  CURRENT_SCHEMA_VERSION,
  assertValidEvent,
  type AttributeValue,
  type EventCategory,
  type PulseEvent,
  type Sensitivity,
  type SourceId,
} from "./schema.js";
import { assertValidTimeZone, localDate, localDayOfWeek, localMinutes, toInstant } from "./time.js";
import { hash128, stableHash } from "./hash.js";

export interface RawEventInput {
  source: SourceId;
  /** Stable id in the source system. Omit only when the source has none. */
  sourceEventId?: string;
  type: string;
  category: EventCategory;
  occurredAt: string | number | Date;
  /** Falls back to the connector's configured zone. */
  timezone?: string;
  durationMs?: number;
  subject?: string;
  metrics: Record<string, number>;
  attributes?: Record<string, AttributeValue>;
  notes?: string;
  sensitivity?: Sensitivity;
  /**
   * Fields that make the event unique when `sourceEventId` is absent.
   * Chosen by the connector; hashed into the dedupe key.
   */
  naturalKey?: unknown;
}

export interface NormaliseContext {
  connectorId: string;
  connectorVersion: string;
  syncId: string;
  ingestMode: "live" | "backfill" | "synthetic";
  /** Zone to assume when the raw record carries none. */
  timezone: string;
  /** Injectable for deterministic tests. */
  now?: () => number;
  /** Sources whose events are always marked sensitive (e.g. reflect). */
  sensitiveSources?: readonly string[];
}

const DEFAULT_SENSITIVE_SOURCES = ["reflect"] as const;

/**
 * Dedupe identity. Stable across re-syncs and backfills of the same record,
 * which is what makes "sync twice, get one event" hold.
 */
export function buildDedupeKey(input: RawEventInput): string {
  if (input.sourceEventId) return `${input.source}:${input.sourceEventId}`;
  const natural =
    input.naturalKey ?? {
      type: input.type,
      occurredAt: new Date(toInstant(input.occurredAt)).toISOString(),
      subject: input.subject ?? null,
      metrics: input.metrics,
    };
  return `${input.source}:${input.type}:${stableHash(natural)}`;
}

export function normaliseEvent(input: RawEventInput, ctx: NormaliseContext): PulseEvent {
  const timezone = input.timezone ?? ctx.timezone;
  assertValidTimeZone(timezone);

  const instant = toInstant(input.occurredAt);
  if (!Number.isFinite(instant)) {
    throw new Error(`Connector ${ctx.connectorId} produced an unparseable occurredAt`);
  }

  const dedupeKey = buildDedupeKey(input);
  const sensitiveSources = ctx.sensitiveSources ?? DEFAULT_SENSITIVE_SOURCES;
  const sensitivity: Sensitivity =
    input.sensitivity ?? (sensitiveSources.includes(String(input.source)) ? "sensitive" : "normal");

  const nowMs = (ctx.now ?? Date.now)();

  const event: PulseEvent = {
    id: hash128(dedupeKey),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    source: input.source,
    sourceEventId: input.sourceEventId ?? hash128(dedupeKey).slice(0, 16),
    type: input.type,
    category: input.category,
    occurredAt: new Date(instant).toISOString(),
    timezone,
    localDate: localDate(instant, timezone),
    localMinutes: localMinutes(instant, timezone),
    localDayOfWeek: localDayOfWeek(instant, timezone),
    metrics: { ...input.metrics },
    attributes: { ...(input.attributes ?? {}) },
    sensitivity,
    provenance: {
      connectorId: ctx.connectorId,
      connectorVersion: ctx.connectorVersion,
      syncId: ctx.syncId,
      ingestedAt: new Date(nowMs).toISOString(),
      ingestMode: ctx.ingestMode,
      rawHash: stableHash(input),
    },
    dedupeKey,
  };

  if (input.durationMs !== undefined) event.durationMs = input.durationMs;
  if (input.subject !== undefined) event.subject = input.subject;
  if (input.notes !== undefined) event.notes = input.notes;

  return assertValidEvent(event);
}
