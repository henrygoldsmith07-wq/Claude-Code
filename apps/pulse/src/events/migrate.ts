/**
 * Schema migrations.
 *
 * Stored events are never rewritten in place by a connector; they are migrated
 * forward through this chain on read. Each step is pure and independently
 * testable, and the chain must be able to take any historical version to
 * CURRENT_SCHEMA_VERSION without loss.
 *
 * v1 → v2 changes:
 *   - `timestamp`  → `occurredAt` (+ derived localDate / localMinutes / localDayOfWeek)
 *   - `values`     → `metrics`
 *   - `tags: string[]` → `attributes` flags
 *   - added `sensitivity`, `provenance.ingestMode`, `provenance.rawHash`
 */

import { CURRENT_SCHEMA_VERSION, type PulseEvent } from "./schema.js";
import { localDate, localDayOfWeek, localMinutes, toInstant } from "./time.js";
import { stableHash } from "./hash.js";

export type AnyStoredEvent = Record<string, unknown>;
type MigrationStep = (event: AnyStoredEvent) => AnyStoredEvent;

const SENSITIVE_SOURCES = new Set(["reflect"]);

const migrations: Record<number, MigrationStep> = {
  1: (event) => {
    const timezone = (event.timezone as string) || "UTC";
    const occurredAt = new Date(toInstant((event.timestamp ?? event.occurredAt) as string)).toISOString();
    const instant = toInstant(occurredAt);
    const source = String(event.source ?? "unknown");
    const tags = Array.isArray(event.tags) ? (event.tags as unknown[]).map(String) : [];
    const attributes: Record<string, string | number | boolean> = {
      ...((event.attributes as Record<string, string | number | boolean>) ?? {}),
    };
    for (const tag of tags) attributes[`tag:${tag}`] = true;

    const priorProvenance = (event.provenance as Record<string, unknown>) ?? {};

    const migrated: AnyStoredEvent = {
      ...event,
      schemaVersion: 2,
      occurredAt,
      timezone,
      localDate: localDate(instant, timezone),
      localMinutes: localMinutes(instant, timezone),
      localDayOfWeek: localDayOfWeek(instant, timezone),
      metrics: (event.metrics ?? event.values ?? {}) as Record<string, number>,
      attributes,
      sensitivity: event.sensitivity ?? (SENSITIVE_SOURCES.has(source) ? "sensitive" : "normal"),
      provenance: {
        connectorId: String(priorProvenance.connectorId ?? source),
        connectorVersion: String(priorProvenance.connectorVersion ?? "0.0.0"),
        syncId: String(priorProvenance.syncId ?? "migrated"),
        ingestedAt: String(priorProvenance.ingestedAt ?? occurredAt),
        ingestMode: (priorProvenance.ingestMode as string) ?? "backfill",
        rawHash: String(priorProvenance.rawHash ?? stableHash(event)),
      },
    };
    delete migrated.timestamp;
    delete migrated.values;
    delete migrated.tags;
    return migrated;
  },
};

export function migrateEvent(stored: AnyStoredEvent): PulseEvent {
  let current = stored;
  let version = typeof current.schemaVersion === "number" ? current.schemaVersion : 1;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Cannot migrate event from schema v${version}: this build only understands up to v${CURRENT_SCHEMA_VERSION}`,
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new Error(`No migration registered from schema v${version}`);
    current = step(current);
    const next = typeof current.schemaVersion === "number" ? current.schemaVersion : version + 1;
    if (next <= version) throw new Error(`Migration from v${version} did not advance the version`);
    version = next;
  }

  return current as unknown as PulseEvent;
}

export function migrateAll(stored: AnyStoredEvent[]): PulseEvent[] {
  return stored.map(migrateEvent);
}

export function needsMigration(stored: AnyStoredEvent): boolean {
  const version = typeof stored.schemaVersion === "number" ? stored.schemaVersion : 1;
  return version < CURRENT_SCHEMA_VERSION;
}
