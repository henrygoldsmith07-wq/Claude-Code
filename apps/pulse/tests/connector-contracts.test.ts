/**
 * Connector contract and mapping tests.
 *
 * Every connector is checked against its own declared output contract. A
 * connector that emits an undeclared metric is a connector whose output the
 * registry cannot describe, which is precisely how an unexplainable number
 * reaches an insight.
 */

import { describe, expect, it } from "vitest";
import { checkContract, createArrayReader } from "../src/connectors/sdk.js";
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
import type { Connector } from "../src/connectors/types.js";
import type { RawEventInput } from "../src/events/normalise.js";

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

/** Narrows a mapped record to a single event with attributes always present. */
function firstEvent(events: RawEventInput[]): RawEventInput & { attributes: Record<string, string | number | boolean> } {
  const [event] = events;
  expect(event).toBeDefined();
  return { ...event!, attributes: event!.attributes ?? {} };
}

describe("connector contracts", () => {
  it.each(FIXTURES.map((fixture) => [String(fixture.connector.id), fixture] as const))(
    "%s honours its declared output contract",
    (_id, fixture) => {
      const produced = fixture.records.flatMap((record) => fixture.map(record as never));
      expect(produced.length).toBeGreaterThan(0);
      expect(checkContract(fixture.connector, produced)).toEqual([]);
    },
  );

  it.each(FIXTURES.map((fixture) => [String(fixture.connector.id), fixture.connector] as const))(
    "%s declares scopes, a version and at least one event type",
    (_id, connector) => {
      expect(connector.scopes.length).toBeGreaterThan(0);
      for (const scope of connector.scopes) expect(scope.description.length).toBeGreaterThan(20);
      expect(connector.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(connector.emits.length).toBeGreaterThan(0);
      for (const spec of connector.emits) expect(spec.metrics.length).toBeGreaterThan(0);
    },
  );

  it("detects a connector that emits an undeclared metric", () => {
    const connector = FIXTURES[0]!.connector;
    const violations = checkContract(connector, [
      {
        source: "revise",
        type: "revise.attempt",
        category: "study",
        occurredAt: "2025-06-10T15:00:00Z",
        metrics: { invented_score: 42 },
      },
    ]);
    expect(violations.some((violation) => violation.kind === "undeclared-metric")).toBe(true);
  });

  it("detects out-of-range values and mislabelled sources", () => {
    const connector = FIXTURES[0]!.connector;
    const violations = checkContract(connector, [
      { source: "revise", type: "revise.attempt", category: "study", occurredAt: "2025-06-10T15:00:00Z", metrics: { accuracy: 5 } },
      { source: "arise", type: "revise.attempt", category: "study", occurredAt: "2025-06-10T15:00:00Z", metrics: { accuracy: 0.5 } },
    ]);
    expect(violations.some((v) => v.kind === "out-of-range")).toBe(true);
    expect(violations.some((v) => v.kind === "wrong-source")).toBe(true);
  });
});

describe("connector mapping specifics", () => {
  it("maps Revise grades onto a comparable accuracy scale", () => {
    const grades = ["again", "hard", "good", "easy"] as const;
    const accuracies = grades.map((grade) => {
      const [event] = mapReviseRecord({ ...reviseReview, grade });
      return event!.metrics.accuracy!;
    });
    expect(accuracies).toEqual([...accuracies].sort((a, b) => a - b));
    expect(accuracies[0]).toBe(0);
    expect(accuracies[3]).toBe(1);
  });

  it("derives calibration error from confidence and accuracy", () => {
    const [event] = mapReviseRecord(reviseAttempt);
    // 6/8 = 0.75 accuracy against 4/5 = 0.8 confidence.
    expect(event!.metrics.calibration_error).toBeCloseTo(0.05, 10);
  });

  it("skips a Revise question worth no marks rather than dividing by zero", () => {
    expect(mapReviseRecord({ ...reviseAttempt, max: 0 })).toEqual([]);
  });

  it("computes Arise volume as reps times net load", () => {
    const event = firstEvent(mapAriseRecord(ariseWorkout));
    expect(event.metrics.total_volume_kg).toBe(2 * 8 * 60);
    expect(event.metrics.total_reps).toBe(16);
    expect(event.metrics.mean_rpe).toBe(8);
    expect(event.attributes.time_estimated).toBe(false);
  });

  it("subtracts assistance from load so assisted reps are not counted as full volume", () => {
    const [event] = mapAriseRecord({
      ...ariseWorkout,
      blocks: [{ exerciseId: "pull-up", sets: [{ reps: 10, weightKg: 80, assistedKg: 30 }] }],
    });
    expect(event!.metrics.total_volume_kg).toBe(10 * 50);
  });

  it("flags an Arise session whose time had to be assumed", () => {
    const event = firstEvent(
      mapAriseRecord({ kind: "session", id: "w2", dateISO: "2025-06-11", blocks: [{ exerciseId: "squat", sets: [{ reps: 5 }] }] }),
    );
    expect(event.attributes.time_estimated).toBe(true);
    expect(event.occurredAt).toBe("2025-06-11T18:00:00.000Z");
  });

  it("drops an Arise session with no sets rather than inventing a zero workout", () => {
    expect(mapAriseRecord({ kind: "session", id: "w3", dateISO: "2025-06-12", blocks: [] })).toEqual([]);
  });

  it("keeps French speaking and review as separate event types", () => {
    const types = frenchRecords.flatMap((record) => mapFrenchRecord(record)).map((event) => event.type);
    expect(types).toEqual(["french.speaking", "french.review"]);
  });

  it("derives Forq plan adherence as a ratio", () => {
    const events = forqRecords.flatMap((record) => mapForqRecord(record));
    const planEvent = events.find((event) => event.type === "forq.plan_day");
    expect(planEvent!.metrics.plan_adherence).toBeCloseTo(2 / 3, 10);
  });

  it("derives Chrono fragmentation from events per booked hour", () => {
    const events = chronoRecords.flatMap((record) => mapChronoRecord(record));
    const dayEvent = events.find((event) => event.type === "chrono.day_shape");
    expect(dayEvent!.metrics.fragmentation).toBe(1); // 5 events over 5 booked hours
  });

  it("never lets Reflect emit anything but numbers, and always marks it sensitive", () => {
    const event = firstEvent(mapReflectRecord(reflectRecords[0]!));
    expect(event.sensitivity).toBe("sensitive");
    expect(event.notes).toBeUndefined();
    for (const value of Object.values(event.metrics)) expect(typeof value).toBe("number");
  });

  it("distinguishes Rapport drills from real-world challenges", () => {
    const events = rapportRecords.flatMap((record) => mapRapportRecord(record));
    expect(events.map((event) => event.attributes?.setting)).toEqual(["simulator", "real-world"]);
  });
});
