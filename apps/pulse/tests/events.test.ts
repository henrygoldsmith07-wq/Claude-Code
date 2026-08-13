/**
 * Schema, normalisation, migration, dedup and storage tests.
 *
 * These cover the boundary where untrusted connector output becomes trusted
 * analytic input. Anything that gets past here is treated as fact by every
 * downstream module, so the bar is "reject rather than coerce".
 */

import { describe, expect, it } from "vitest";
import {
  CURRENT_SCHEMA_VERSION,
  assertValidEvent,
  validateEvent,
  type PulseEvent,
} from "../src/events/schema.js";
import { buildDedupeKey, normaliseEvent, type NormaliseContext, type RawEventInput } from "../src/events/normalise.js";
import { migrateAll, migrateEvent, needsMigration } from "../src/events/migrate.js";
import { MemoryEventStore, createMemoryAdapter, filterEvents } from "../src/events/store.js";
import { hash128, stableHash, stableStringify } from "../src/events/hash.js";

const ctx: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "sync-1",
  ingestMode: "live",
  timezone: "Europe/London",
  now: () => Date.parse("2025-07-01T12:00:00Z"),
};

function rawEvent(overrides: Partial<RawEventInput> = {}): RawEventInput {
  return {
    source: "revise",
    sourceEventId: "attempt-1",
    type: "revise.attempt",
    category: "study",
    occurredAt: "2025-06-15T15:30:00Z",
    metrics: { accuracy: 0.8, marks_awarded: 8 },
    attributes: { method: "practice" },
    ...overrides,
  };
}

describe("event schema validation", () => {
  it("accepts a well-formed event", () => {
    const event = normaliseEvent(rawEvent(), ctx);
    expect(validateEvent(event).valid).toBe(true);
    expect(event.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("derives local calendar fields from the instant and zone", () => {
    // 15:30 UTC in June is 16:30 BST.
    const event = normaliseEvent(rawEvent(), ctx);
    expect(event.localDate).toBe("2025-06-15");
    expect(event.localMinutes).toBe(16 * 60 + 30);
    expect(event.localDayOfWeek).toBe(0); // a Sunday
  });

  it("rejects NaN and Infinity in metrics rather than letting them poison aggregates", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const result = validateEvent({ ...normaliseEvent(rawEvent(), ctx), metrics: { accuracy: bad } });
      expect(result.valid).toBe(false);
      expect(result.issues.some((issue) => issue.path === "metrics.accuracy")).toBe(true);
    }
  });

  it("rejects an event with no provenance", () => {
    const event = normaliseEvent(rawEvent(), ctx) as unknown as Record<string, unknown>;
    delete event.provenance;
    const result = validateEvent(event);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "provenance")).toBe(true);
  });

  it("rejects an unnamespaced event type", () => {
    const result = validateEvent({ ...normaliseEvent(rawEvent(), ctx), type: "attempt" });
    expect(result.valid).toBe(false);
  });

  it("rejects events from a newer schema version", () => {
    const result = validateEvent({ ...normaliseEvent(rawEvent(), ctx), schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => /newer schema/.test(issue.message))).toBe(true);
  });

  it("warns but does not fail when an event carries no metrics", () => {
    const result = validateEvent({ ...normaliseEvent(rawEvent(), ctx), metrics: {} });
    expect(result.valid).toBe(true);
    expect(result.issues.some((issue) => issue.severity === "warning")).toBe(true);
  });

  it("rejects out-of-range local minutes and day-of-week", () => {
    const event = normaliseEvent(rawEvent(), ctx);
    expect(validateEvent({ ...event, localMinutes: 1440 }).valid).toBe(false);
    expect(validateEvent({ ...event, localDayOfWeek: 7 }).valid).toBe(false);
  });

  it("throws with a useful message from assertValidEvent", () => {
    expect(() => assertValidEvent({ id: "x" })).toThrow(/Invalid Pulse event/);
  });

  it("rejects an unknown timezone at normalisation", () => {
    expect(() => normaliseEvent(rawEvent({ timezone: "Nowhere/Nothing" }), ctx)).toThrow(/Unknown IANA time zone/);
  });
});

describe("deterministic hashing", () => {
  it("produces the same digest regardless of key order", () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
    expect(stableStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("distinguishes different content", () => {
    expect(hash128("a")).not.toBe(hash128("b"));
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });

  it("treats undefined as absent and non-finite numbers as null", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(stableStringify({ a: NaN })).toBe('{"a":null}');
  });
});

describe("dedupe keys", () => {
  it("uses the source id when the source has one", () => {
    expect(buildDedupeKey(rawEvent())).toBe("revise:attempt-1");
  });

  it("falls back to a content hash when there is no source id", () => {
    const input = rawEvent({ sourceEventId: undefined });
    const key = buildDedupeKey(input);
    expect(key).toMatch(/^revise:revise\.attempt:/);
    // Stable across calls, and stable across irrelevant reordering.
    expect(buildDedupeKey(input)).toBe(key);
    expect(buildDedupeKey({ ...input, metrics: { marks_awarded: 8, accuracy: 0.8 } })).toBe(key);
  });

  it("changes when the natural key changes", () => {
    const a = buildDedupeKey(rawEvent({ sourceEventId: undefined }));
    const b = buildDedupeKey(rawEvent({ sourceEventId: undefined, occurredAt: "2025-06-16T15:30:00Z" }));
    expect(a).not.toBe(b);
  });

  it("gives the same event id on re-sync", () => {
    const first = normaliseEvent(rawEvent(), ctx);
    const second = normaliseEvent(rawEvent(), { ...ctx, syncId: "sync-2", now: () => Date.parse("2025-08-01T00:00:00Z") });
    expect(second.id).toBe(first.id);
    expect(second.dedupeKey).toBe(first.dedupeKey);
  });
});

describe("schema migration", () => {
  const v1Event = {
    id: "legacy-1",
    schemaVersion: 1,
    source: "revise",
    sourceEventId: "old-1",
    type: "revise.attempt",
    category: "study",
    timestamp: "2025-01-15T09:00:00Z",
    timezone: "Europe/London",
    values: { accuracy: 0.7 },
    tags: ["morning", "physics"],
    dedupeKey: "revise:old-1",
  };

  it("detects that an old event needs migrating", () => {
    expect(needsMigration(v1Event)).toBe(true);
    expect(needsMigration({ ...v1Event, schemaVersion: CURRENT_SCHEMA_VERSION })).toBe(false);
  });

  it("migrates v1 to the current schema without losing data", () => {
    const migrated = migrateEvent(v1Event);
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.occurredAt).toBe("2025-01-15T09:00:00.000Z");
    expect(migrated.metrics).toEqual({ accuracy: 0.7 });
    expect(migrated.attributes["tag:morning"]).toBe(true);
    expect(migrated.attributes["tag:physics"]).toBe(true);
    expect(validateEvent(migrated).valid).toBe(true);
  });

  it("derives local calendar fields the old schema did not carry", () => {
    const migrated = migrateEvent(v1Event);
    expect(migrated.localDate).toBe("2025-01-15");
    expect(migrated.localMinutes).toBe(9 * 60); // January: GMT, no offset
  });

  it("marks reflect data sensitive when migrating, even if v1 did not", () => {
    const migrated = migrateEvent({ ...v1Event, source: "reflect", type: "reflect.entry", category: "reflection" });
    expect(migrated.sensitivity).toBe("sensitive");
  });

  it("synthesises provenance for events that predate it", () => {
    const migrated = migrateEvent(v1Event);
    expect(migrated.provenance.connectorId).toBe("revise");
    expect(migrated.provenance.ingestMode).toBe("backfill");
    expect(migrated.provenance.rawHash).toBeTruthy();
  });

  it("refuses to migrate from a version it does not understand", () => {
    expect(() => migrateEvent({ ...v1Event, schemaVersion: 99 })).toThrow(/only understands up to/);
  });

  it("migrates a batch and is idempotent on already-current events", () => {
    const [migrated] = migrateAll([v1Event]);
    const twice = migrateEvent(migrated as unknown as Record<string, unknown>);
    expect(twice).toEqual(migrated);
  });
});

describe("event store", () => {
  const build = (overrides: Partial<RawEventInput> = {}): PulseEvent => normaliseEvent(rawEvent(overrides), ctx);

  it("deduplicates identical re-ingests", async () => {
    const store = new MemoryEventStore();
    const event = build();
    const first = await store.put([event]);
    const second = await store.put([event]);
    expect(first.inserted).toBe(1);
    expect(second.inserted).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(store.size).toBe(1);
  });

  it("replaces an event whose upstream content changed, and reports it", async () => {
    const store = new MemoryEventStore();
    await store.put([build()]);
    const result = await store.put([build({ metrics: { accuracy: 0.9, marks_awarded: 9 } })]);
    expect(result.updated).toBe(1);
    expect(result.duplicates).toBe(0);
    expect(store.size).toBe(1);
    expect(store.all()[0]!.metrics.accuracy).toBe(0.9);
  });

  it("returns events in a total, reproducible order", async () => {
    const store = new MemoryEventStore();
    await store.put([
      build({ sourceEventId: "b", occurredAt: "2025-06-15T10:00:00Z" }),
      build({ sourceEventId: "a", occurredAt: "2025-06-15T10:00:00Z" }),
      build({ sourceEventId: "c", occurredAt: "2025-06-14T10:00:00Z" }),
    ]);
    const first = store.all().map((event) => event.sourceEventId);
    const second = store.all().map((event) => event.sourceEventId);
    expect(first).toEqual(second);
    expect(first[0]).toBe("c");
  });

  it("deletes everything from one source and leaves the others intact", async () => {
    const store = new MemoryEventStore();
    await store.put([
      build(),
      normaliseEvent(
        { source: "arise", sourceEventId: "w-1", type: "arise.workout", category: "exercise", occurredAt: "2025-06-15T17:00:00Z", metrics: { total_reps: 40 } },
        { ...ctx, connectorId: "arise" },
      ),
    ]);
    const removed = await store.deleteBySource("revise");
    expect(removed).toBe(1);
    expect(store.size).toBe(1);
    expect(store.all()[0]!.source).toBe("arise");
    expect(store.getCursor("revise")).toBeNull();
  });

  it("deletes a date range from one source only", async () => {
    const store = new MemoryEventStore();
    await store.put([
      build({ sourceEventId: "in", occurredAt: "2025-06-15T10:00:00Z" }),
      build({ sourceEventId: "out", occurredAt: "2025-07-15T10:00:00Z" }),
    ]);
    const removed = await store.deleteRange("revise", "2025-06-01T00:00:00Z", "2025-07-01T00:00:00Z");
    expect(removed).toBe(1);
    expect(store.all()[0]!.sourceEventId).toBe("out");
  });

  it("hides sensitive events unless they are explicitly requested", async () => {
    const store = new MemoryEventStore();
    await store.put([
      build(),
      normaliseEvent(
        { source: "reflect", sourceEventId: "r-1", type: "reflect.entry", category: "reflection", occurredAt: "2025-06-15T21:00:00Z", metrics: { mood: 7 } },
        { ...ctx, connectorId: "reflect" },
      ),
    ]);
    expect(store.query().length).toBe(1);
    expect(store.query({ includeSensitive: true }).length).toBe(2);
  });

  it("persists and rehydrates through an adapter, migrating on the way in", async () => {
    const adapter = createMemoryAdapter();
    const first = new MemoryEventStore(adapter);
    await first.load();
    await first.put([build()]);
    await first.setCursor({ source: "revise", cursor: "abc", lastSyncedAt: "2025-07-01T12:00:00Z", lastEventAt: "2025-06-15T15:30:00Z" });

    const second = new MemoryEventStore(adapter);
    await second.load();
    expect(second.size).toBe(1);
    expect(second.getCursor("revise")?.cursor).toBe("abc");
  });

  it("filters by source, type, category, subject and time window", async () => {
    const store = new MemoryEventStore();
    await store.put([
      build({ sourceEventId: "june", occurredAt: "2025-06-15T10:00:00Z", subject: "topic-1" }),
      build({ sourceEventId: "july", occurredAt: "2025-07-15T10:00:00Z", subject: "topic-2" }),
    ]);
    const all = store.all();
    expect(filterEvents(all, { sources: ["revise"] })).toHaveLength(2);
    expect(filterEvents(all, { sources: ["arise"] })).toHaveLength(0);
    expect(filterEvents(all, { subjects: ["topic-1"] })).toHaveLength(1);
    expect(filterEvents(all, { categories: ["study"] })).toHaveLength(2);
    // `to` is exclusive, `from` inclusive.
    expect(filterEvents(all, { from: "2025-06-15T10:00:00Z", to: "2025-07-15T10:00:00Z" })).toHaveLength(1);
  });
});
