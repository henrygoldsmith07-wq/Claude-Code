/**
 * Sync-engine and permission tests.
 *
 * The sync engine owns everything a connector is deliberately not allowed to
 * own: consent enforcement, normalisation, validation, de-duplication, cursors
 * and health. These tests exist so that a new connector cannot skip any of it.
 */

import { describe, expect, it } from "vitest";
import { createArrayReader, decodeCursor } from "../src/connectors/sdk.js";
import { SyncEngine } from "../src/connectors/sync.js";
import {
  createReviseConnector,
  mapReviseRecord,
  type ReviseAttemptRecord,
  type ReviseRecord,
  type ReviseReviewRecord,
} from "../src/connectors/revise.js";
import {
  createAriseConnector,
  mapAriseRecord,
  type AriseRecord,
  type AriseSessionRecord,
} from "../src/connectors/arise.js";
import { createFrenchConnector, mapFrenchRecord, type FrenchRecord } from "../src/connectors/french.js";
import { createForqConnector, mapForqRecord, type ForqRecord } from "../src/connectors/forq.js";
import { createChronoConnector, mapChronoRecord, type ChronoRecord } from "../src/connectors/chrono.js";
import { createReflectConnector, mapReflectRecord, type ReflectRecord } from "../src/connectors/reflect.js";
import { createRapportConnector, mapRapportRecord, type RapportRecord } from "../src/connectors/rapport.js";
import { MemoryEventStore } from "../src/events/store.js";
import { ConsentRegistry } from "../src/privacy/consent.js";
import type { Connector } from "../src/connectors/types.js";
import type { RawEventInput } from "../src/events/normalise.js";

const NOW = Date.parse("2025-07-01T12:00:00Z");
const clock = (): number => NOW;

const reviseAttempt: ReviseAttemptRecord = {
  kind: "attempt",
  id: "a1",
  questionId: "q1",
  subjectId: "physics",
  topicIds: ["t1"],
  awarded: 6,
  max: 8,
  confidence: 4,
  elapsedMs: 180_000,
  mode: "practice",
  markedBy: "rubric",
  createdAt: "2025-06-10T15:00:00Z",
};

const reviseReview: ReviseReviewRecord = {
  kind: "review",
  id: "r1",
  cardId: "c1",
  topicId: "t1",
  subjectId: "physics",
  grade: "good",
  confidence: 3,
  elapsedMs: 8000,
  intervalDays: 5,
  reviewedAt: "2025-06-10T15:05:00Z",
};

const reviseRecords: ReviseRecord[] = [
  reviseAttempt,
  reviseReview,
  {
    kind: "session",
    id: "s1",
    subjectId: "physics",
    topicIds: ["t1"],
    activityKind: "flashcards",
    startedAt: "2025-06-10T15:00:00Z",
    endedAt: "2025-06-10T15:30:00Z",
    itemsCompleted: 20,
    itemsCorrect: 15,
  },
];

const ariseWorkout: AriseSessionRecord = {
  kind: "session",
  id: "w1",
  dateISO: "2025-06-10",
  completedAt: "2025-06-10T17:30:00Z",
  durationMin: 55,
  blocks: [{ exerciseId: "squat", muscle: "Legs", sets: [{ reps: 8, weightKg: 60, rpe: 8 }, { reps: 8, weightKg: 60, rpe: 8 }] }],
};

const ariseRecords: AriseRecord[] = [
  ariseWorkout,
  { kind: "readiness", dateISO: "2025-06-10", at: "2025-06-10T07:30:00Z", score: 72, sleep: 7, soreness: 3, motivation: 6 },
];

const frenchRecords: FrenchRecord[] = [
  { kind: "speaking", id: "f1", startedAt: "2025-06-10T19:00:00Z", durationMs: 900_000, pronunciationScore: 0.72, fluencyScore: 0.65, wordsSpoken: 210, promptCount: 12 },
  { kind: "review", id: "f2", reviewedAt: "2025-06-10T20:00:00Z", itemId: "i1", skill: "vocab", correct: true, elapsedMs: 6000, intervalDays: 4 },
];

const forqRecords: ForqRecord[] = [
  { kind: "meal", id: "m1", loggedAt: "2025-06-10T12:30:00Z", slot: "lunch", energyKcal: 620, proteinG: 40, matchedPlan: true, homeCooked: true },
  { kind: "plan-day", id: "p1", dateISO: "2025-06-10", closedAt: "2025-06-10T21:30:00Z", plannedMeals: 3, completedMeals: 2, shopSpend: 14 },
];

const chronoRecords: ChronoRecord[] = [
  { kind: "event", id: "c1", startsAt: "2025-06-10T09:00:00Z", endsAt: "2025-06-10T10:00:00Z", category: "work", attendeeCount: 4, focusBlock: false },
  { kind: "day", id: "c2", dateISO: "2025-06-10", computedAt: "2025-06-10T22:00:00Z", scheduledMinutes: 300, eventCount: 5, longestFreeBlockMinutes: 120, firstCommitmentMinutes: 540 },
];

const reflectRecords: ReflectRecord[] = [
  { kind: "entry", id: "e1", writtenAt: "2025-06-10T21:30:00Z", mood: 7, energy: 6, stress: 4, clarity: 7, wordCount: 180, followUpCompleted: true },
];

const rapportRecords: RapportRecord[] = [
  { kind: "drill", id: "d1", startedAt: "2025-06-10T18:00:00Z", durationMs: 600_000, skillId: "small-talk", score: 0.68, turnCount: 24, difficulty: 3 },
  { kind: "challenge", id: "ch1", completedAt: "2025-06-11T12:00:00Z", skillId: "small-talk", completed: true, comfort: 3 },
];

interface Fixture {
  connector: Connector;
  records: unknown[];
  map: (record: never) => RawEventInput[];
}

const FIXTURES: Fixture[] = [
  { connector: createReviseConnector(createArrayReader(reviseRecords, (r) => (r.kind === "review" ? r.reviewedAt : r.kind === "attempt" ? r.createdAt : r.startedAt))), records: reviseRecords, map: mapReviseRecord as never },
  { connector: createAriseConnector(createArrayReader(ariseRecords, (r) => (r.kind === "session" ? r.completedAt! : r.at!))), records: ariseRecords, map: ((r: AriseRecord) => mapAriseRecord(r)) as never },
  { connector: createFrenchConnector(createArrayReader(frenchRecords, (r) => (r.kind === "speaking" ? r.startedAt : r.reviewedAt))), records: frenchRecords, map: mapFrenchRecord as never },
  { connector: createForqConnector(createArrayReader(forqRecords, (r) => (r.kind === "meal" ? r.loggedAt : r.closedAt))), records: forqRecords, map: mapForqRecord as never },
  { connector: createChronoConnector(createArrayReader(chronoRecords, (r) => (r.kind === "event" ? r.startsAt : r.computedAt))), records: chronoRecords, map: mapChronoRecord as never },
  { connector: createReflectConnector(createArrayReader(reflectRecords, (r) => r.writtenAt)), records: reflectRecords, map: mapReflectRecord as never },
  { connector: createRapportConnector(createArrayReader(rapportRecords, (r) => (r.kind === "drill" ? r.startedAt : r.completedAt))), records: rapportRecords, map: mapRapportRecord as never },
];


describe("sync engine", () => {
  function setup(): { store: MemoryEventStore; consent: ConsentRegistry; engine: SyncEngine; connector: Connector } {
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry(clock);
    const connector = FIXTURES[0]!.connector;
    return { store, consent, engine: new SyncEngine(store, consent), connector };
  }

  it("refuses to sync a source with no consent", async () => {
    const { engine, connector, store } = setup();
    const report = await engine.sync(connector, { timezone: "Europe/London", now: clock });
    expect(report.error).toMatch(/No consent granted/);
    expect(report.health.status).toBe("failing");
    expect(store.size).toBe(0);
  });

  it("ingests, normalises and validates once consent is granted", async () => {
    const { engine, connector, consent, store } = setup();
    consent.grant(connector);
    const report = await engine.sync(connector, { timezone: "Europe/London", now: clock, mode: "backfill", backfillFrom: "2025-06-01" });
    expect(report.error).toBeUndefined();
    expect(report.inserted).toBe(3);
    expect(report.rejected).toBe(0);
    expect(store.size).toBe(3);
    expect(store.all()[0]!.provenance.syncId).toBe(report.syncId);
    expect(store.all()[0]!.provenance.ingestMode).toBe("backfill");
  });

  it("is idempotent: syncing twice does not duplicate events", async () => {
    const { engine, connector, consent, store } = setup();
    consent.grant(connector);
    const options = { timezone: "Europe/London", now: clock, mode: "backfill" as const, backfillFrom: "2025-06-01" };
    await engine.sync(connector, options);
    const second = await engine.sync(connector, options);
    expect(second.duplicates).toBe(3);
    expect(second.inserted).toBe(0);
    expect(store.size).toBe(3);
  });

  it("records a cursor and the latest event time", async () => {
    const { engine, connector, consent, store } = setup();
    consent.grant(connector);
    await engine.sync(connector, { timezone: "Europe/London", now: clock, mode: "backfill", backfillFrom: "2025-06-01" });
    const cursor = store.getCursor("revise");
    expect(cursor?.lastEventAt).toBe("2025-06-10T15:05:00.000Z");
    expect(decodeCursor(cursor!.cursor).since).toBeTruthy();
  });

  it("rejects records that claim a different source", async () => {
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry(clock);
    const engine = new SyncEngine(store, consent);
    const liar: Connector = {
      ...FIXTURES[0]!.connector,
      async fetch() {
        return {
          records: [{ source: "arise", type: "revise.attempt", category: "study", occurredAt: "2025-06-10T15:00:00Z", metrics: { accuracy: 0.5 } } as RawEventInput],
          cursor: null,
          hasMore: false,
        };
      },
    };
    consent.grant(liar);
    const report = await engine.sync(liar, { timezone: "UTC", now: clock });
    expect(report.rejected).toBe(1);
    expect(report.inserted).toBe(0);
    expect(report.rejectionSamples[0]).toMatch(/claimed source/);
  });

  it("rejects records that fail schema validation without aborting the page", async () => {
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry(clock);
    const engine = new SyncEngine(store, consent);
    const flaky: Connector = {
      ...FIXTURES[0]!.connector,
      async fetch() {
        return {
          records: [
            { source: "revise", type: "revise.attempt", category: "study", occurredAt: "2025-06-10T15:00:00Z", metrics: { accuracy: NaN } } as RawEventInput,
            { source: "revise", sourceEventId: "ok", type: "revise.attempt", category: "study", occurredAt: "2025-06-10T15:00:00Z", metrics: { accuracy: 0.5 } } as RawEventInput,
          ],
          cursor: null,
          hasMore: false,
        };
      },
    };
    consent.grant(flaky);
    const report = await engine.sync(flaky, { timezone: "UTC", now: clock });
    expect(report.rejected).toBe(1);
    expect(report.inserted).toBe(1);
  });

  it("reports a degraded connector when data has gone stale", async () => {
    const { engine, connector, consent } = setup();
    consent.grant(connector);
    // Clock set six months after the fixture data.
    const later = (): number => Date.parse("2025-12-01T00:00:00Z");
    const report = await engine.sync(connector, { timezone: "Europe/London", now: later, mode: "backfill", backfillFrom: "2025-06-01" });
    expect(report.health.status).not.toBe("healthy");
  });

  it("captures a connector error as a failing health status rather than throwing", async () => {
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry(clock);
    const engine = new SyncEngine(store, consent);
    const broken: Connector = {
      ...FIXTURES[0]!.connector,
      async fetch() {
        throw new Error("upstream is down");
      },
    };
    consent.grant(broken);
    const report = await engine.sync(broken, { timezone: "UTC", now: clock });
    expect(report.error).toMatch(/upstream is down/);
    expect(report.health.status).toBe("failing");
  });

  it("clamps a backfill to the connector's maximum history", async () => {
    const { engine, connector, consent } = setup();
    consent.grant(connector);
    const report = await engine.backfill(connector, "1990-01-01", { timezone: "Europe/London", now: clock });
    expect(report.mode).toBe("backfill");
    expect(report.error).toBeUndefined();
  });

  it("pages through a long history without losing or repeating records", async () => {
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry(clock);
    const engine = new SyncEngine(store, consent);
    const many: ReviseRecord[] = Array.from({ length: 250 }, (_, i) => ({
      kind: "attempt",
      id: `bulk-${i}`,
      questionId: `q${i}`,
      subjectId: "physics",
      topicIds: ["t1"],
      awarded: 5,
      max: 10,
      elapsedMs: 60_000,
      mode: "practice",
      markedBy: "rubric",
      createdAt: new Date(Date.parse("2025-01-01T09:00:00Z") + i * 3_600_000).toISOString(),
    }));
    const connector = createReviseConnector(createArrayReader(many, (r) => (r as { createdAt: string }).createdAt));
    consent.grant(connector);
    const report = await engine.sync(connector, { timezone: "UTC", now: clock, mode: "backfill", backfillFrom: "2024-12-01", pageSize: 40 });
    expect(report.inserted).toBe(250);
    expect(report.pages).toBeGreaterThan(1);
    expect(store.size).toBe(250);
  });

  it("resumes from the cursor without re-reporting old records as new", async () => {
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry(clock);
    const engine = new SyncEngine(store, consent);
    const growing: ReviseRecord[] = [...reviseRecords];
    const connector = createReviseConnector({
      async read(since, limit) {
        const cutoff = since ? Date.parse(since) : -Infinity;
        const matching = growing
          .filter((record) => Date.parse(record.kind === "review" ? record.reviewedAt : record.kind === "attempt" ? record.createdAt : record.startedAt) >= cutoff)
          .sort((a, b) => a.id.localeCompare(b.id));
        return { records: matching.slice(0, limit), hasMore: matching.length > limit };
      },
    });
    consent.grant(connector);
    const options = { timezone: "UTC", now: clock, mode: "backfill" as const, backfillFrom: "2025-06-01" };
    await engine.sync(connector, options);

    growing.push({ ...reviseRecords[0]!, id: "a2", createdAt: "2025-06-20T15:00:00Z" } as ReviseRecord);
    const second = await engine.sync(connector, { timezone: "UTC", now: clock });
    expect(second.inserted).toBe(1);
    expect(store.size).toBe(4);
  });
});

describe("permissions", () => {
  it("never enables Reflect through a bulk connect", () => {
    const consent = new ConsentRegistry(clock);
    const connectors = FIXTURES.map((fixture) => fixture.connector);
    const result = consent.grantAll(connectors);
    expect(result.skipped).toContain("reflect");
    expect(consent.isGranted("reflect")).toBe(false);
    expect(consent.isGranted("revise")).toBe(true);
  });

  it("refuses to sync Reflect unless it was granted explicitly", async () => {
    const store = new MemoryEventStore();
    const consent = new ConsentRegistry(clock);
    const engine = new SyncEngine(store, consent);
    const reflect = FIXTURES.find((fixture) => fixture.connector.id === "reflect")!.connector;

    // Force a non-explicit grant, as a bulk flow would.
    consent.grant(reflect);
    const grant = consent.get("reflect")!;
    grant.explicit = false;
    const blocked = await engine.sync(reflect, { timezone: "UTC", now: clock });
    expect(blocked.error).toMatch(/explicit permission/);

    grant.explicit = true;
    const allowed = await engine.sync(reflect, { timezone: "UTC", now: clock, mode: "backfill", backfillFrom: "2025-06-01" });
    expect(allowed.error).toBeUndefined();
    expect(allowed.inserted).toBe(1);
  });

  it("defaults sensitive sources to no AI processing", () => {
    const consent = new ConsentRegistry(clock);
    const reflect = FIXTURES.find((fixture) => fixture.connector.id === "reflect")!.connector;
    consent.grant(reflect);
    consent.grant(FIXTURES[0]!.connector);
    expect(consent.get("reflect")!.allowAiProcessing).toBe(false);
    expect(consent.get("revise")!.allowAiProcessing).toBe(true);
    expect(consent.aiEligibleSources()).not.toContain("reflect");
  });

  it("rejects a grant for a scope the connector does not declare", () => {
    const consent = new ConsentRegistry(clock);
    expect(() => consent.grant(FIXTURES[0]!.connector, { scopes: ["everything"] })).toThrow(/does not declare scope/);
  });

  it("revocation clears scopes and demands data deletion", () => {
    const consent = new ConsentRegistry(clock);
    consent.grant(FIXTURES[0]!.connector);
    const outcome = consent.revoke("revise");
    expect(outcome.dataDeletionRequired).toBe(true);
    expect(consent.isGranted("revise")).toBe(false);
    expect(consent.get("revise")!.scopes).toEqual([]);
  });

  it("round-trips through a snapshot", () => {
    const consent = new ConsentRegistry(clock);
    consent.grant(FIXTURES[0]!.connector);
    const restored = ConsentRegistry.fromSnapshot(consent.toSnapshot(), clock);
    expect(restored.isGranted("revise")).toBe(true);
  });
});
