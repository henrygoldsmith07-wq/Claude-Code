/**
 * Same-origin connector tests.
 *
 * These cover the connection Pulse actually makes to a sibling app: read that
 * app's own storage key, honour that app's own consent flag, and refuse to
 * invent a timestamp. The fixtures below are the shapes Arise really persists
 * under `arise.store.v1`, not shapes invented for the test.
 */

import { describe, expect, it, vi } from "vitest";
import {
  ARISE_STORAGE_KEY,
  ariseConsentGranted,
  createAriseSameOriginConnector,
  selectAriseRecords,
} from "../src/connectors/arise.js";
import {
  FORQ_PULSE_OPT_IN_KEY,
  FORQ_STORAGE_KEY,
  createForqSameOriginConnector,
  selectForqRecords,
} from "../src/connectors/forq.js";
import {
  REFLECT_CONSENT_KEY,
  REFLECT_STORAGE_KEY,
  createReflectSameOriginConnector,
  reflectConsentGranted,
  selectReflectRecords,
} from "../src/connectors/reflect.js";
import {
  createSameOriginReader,
  subscribeToSameOriginSource,
  type StorageLike,
} from "../src/connectors/same-origin.js";

/** A full SyncRequest; the connector contract requires cursor/timezone/mode. */
const syncRequest = (over: Record<string, unknown> = {}) => ({
  since: null,
  cursor: null,
  timezone: "Europe/London",
  mode: "live" as const,
  limit: 50,
  ...over,
});

const session = (over: Record<string, unknown> = {}) => ({
  id: "s1",
  dateISO: "2026-03-02",
  programId: "hypertrophy",
  title: "Upper A",
  savedAt: "2026-03-02T18:41:00.000Z",
  blocks: [{ exerciseId: "bench", muscle: "chest", sets: [{ reps: 8, weightKg: 60, rpe: 7 }] }],
  ...over,
});

const ariseStore = (over: Record<string, unknown> = {}) => ({
  version: 2,
  preferences: { units: "kg", pulseEnabled: true },
  history: [session()],
  readinessLog: [{ dateISO: "2026-03-02", score: 72, sleep: 7, soreness: 3, motivation: 8 }],
  ...over,
});

const storageOf = (value: unknown): StorageLike => ({
  getItem: (key) => (key === ARISE_STORAGE_KEY ? JSON.stringify(value) : null),
});

describe("reading a sibling app that shares this origin", () => {
  it("reads the source app's own storage key and nothing else", async () => {
    const seen: string[] = [];
    const reader = createSameOriginReader<{ at: string }>({
      key: "arise.store.v1",
      select: () => [{ at: "2026-03-02T10:00:00.000Z" }],
      timestampOf: (r) => r.at,
      storage: {
        getItem: (key) => {
          seen.push(key);
          return "{}";
        },
      },
    });

    await reader.read(null, 10);
    expect(seen).toEqual(["arise.store.v1"]);
  });

  it("returns records oldest first so `since` paging is a simple scan", async () => {
    const reader = createSameOriginReader<{ at: string }>({
      key: "k",
      select: () => [
        { at: "2026-03-03T00:00:00.000Z" },
        { at: "2026-03-01T00:00:00.000Z" },
        { at: "2026-03-02T00:00:00.000Z" },
      ],
      timestampOf: (r) => r.at,
      storage: { getItem: () => "{}" },
    });

    const { records } = await reader.read(null, 10);
    expect(records.map((r) => r.at.slice(0, 10))).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("pages with hasMore and resumes from `since`", async () => {
    const reader = createSameOriginReader<{ at: string }>({
      key: "k",
      select: () => [
        { at: "2026-03-01T00:00:00.000Z" },
        { at: "2026-03-02T00:00:00.000Z" },
        { at: "2026-03-03T00:00:00.000Z" },
      ],
      timestampOf: (r) => r.at,
      storage: { getItem: () => "{}" },
    });

    const first = await reader.read(null, 2);
    expect(first.records).toHaveLength(2);
    expect(first.hasMore).toBe(true);

    const next = await reader.read("2026-03-03T00:00:00.000Z", 2);
    expect(next.records.map((r) => r.at.slice(0, 10))).toEqual(["2026-03-03"]);
    expect(next.hasMore).toBe(false);
  });

  it("drops records with no usable timestamp rather than inventing one", async () => {
    const reader = createSameOriginReader<{ at?: string }>({
      key: "k",
      select: () => [{ at: "2026-03-01T00:00:00.000Z" }, {}, { at: "not-a-date" }],
      timestampOf: (r) => r.at,
      storage: { getItem: () => "{}" },
    });

    const { records } = await reader.read(null, 10);
    expect(records).toHaveLength(1);
  });

  it("survives an absent key, junk JSON, a shape it cannot read, and blocked storage", async () => {
    const cases: StorageLike[] = [
      { getItem: () => null },
      { getItem: () => "{not json" },
      {
        getItem: () => {
          throw new Error("blocked");
        },
      },
    ];

    for (const storage of cases) {
      const reader = createSameOriginReader<{ at: string }>({
        key: "k",
        select: () => [{ at: "2026-03-01T00:00:00.000Z" }],
        timestampOf: (r) => r.at,
        storage,
      });
      await expect(reader.read(null, 10)).resolves.toEqual({ records: [], hasMore: false });
      expect(reader.probe).toBeTypeOf("function");
      await expect(reader.probe!()).resolves.toMatchObject({ ok: false });
    }

    const throwingSelect = createSameOriginReader<{ at: string }>({
      key: "k",
      select: () => {
        throw new Error("unknown shape");
      },
      timestampOf: (r) => r.at,
      storage: { getItem: () => "{}" },
    });
    await expect(throwingSelect.read(null, 10)).resolves.toEqual({ records: [], hasMore: false });
  });
});

describe("consent is the source app's flag, not a Pulse setting", () => {
  it("reads nothing until the source app opts in", async () => {
    const off = createAriseSameOriginConnector({
      storage: storageOf(ariseStore({ preferences: { pulseEnabled: false } })),
    });
    const page = await off.fetch(syncRequest());
    expect(page.records).toHaveLength(0);

    const on = createAriseSameOriginConnector({ storage: storageOf(ariseStore()) });
    const allowed = await on.fetch(syncRequest());
    expect(allowed.records.length).toBeGreaterThan(0);
  });

  it("treats a missing flag as withheld", () => {
    expect(ariseConsentGranted({})).toBe(false);
    expect(ariseConsentGranted({ preferences: {} })).toBe(false);
    expect(ariseConsentGranted(null)).toBe(false);
    expect(ariseConsentGranted({ preferences: { pulseEnabled: true } })).toBe(true);
  });

  it("says why it is idle when consent is withheld", async () => {
    const connector = createAriseSameOriginConnector({
      storage: storageOf(ariseStore({ preferences: { pulseEnabled: false } })),
    });
    const health = await connector.healthCheck!();
    expect(health.status).toBe("failing");
    expect(health.message).toMatch(/turn Pulse on in the source app/i);
  });
});

describe("selecting records out of Arise's real store shape", () => {
  it("maps completed sessions and readiness check-ins", () => {
    const records = selectAriseRecords(ariseStore());
    expect(records.filter((r) => r.kind === "session")).toHaveLength(1);
    expect(records.filter((r) => r.kind === "readiness")).toHaveLength(1);
  });

  it("trusts savedAt as the completion time only on the session's own date", () => {
    const sameDay = selectAriseRecords(ariseStore());
    expect(sameDay.find((r) => r.kind === "session")).toMatchObject({
      completedAt: "2026-03-02T18:41:00.000Z",
    });

    // Editing an old workout moves savedAt to today. Believing it would
    // relocate the event and poison within-day timing analysis.
    const editedLater = selectAriseRecords(
      ariseStore({ history: [session({ savedAt: "2026-04-19T09:00:00.000Z" })] }),
    );
    const edited = editedLater.find((r) => r.kind === "session");
    expect(edited).not.toHaveProperty("completedAt");
    expect(edited).toMatchObject({ dateISO: "2026-03-02" });
  });

  it("flags a session whose time it had to assume", async () => {
    const connector = createAriseSameOriginConnector({
      storage: storageOf(ariseStore({ history: [session({ savedAt: undefined })], readinessLog: [] })),
    });
    const page = await connector.fetch(syncRequest());
    expect(page.records[0]?.attributes).toMatchObject({ time_estimated: true });
  });

  it("skips malformed rows instead of failing the whole sync", () => {
    const records = selectAriseRecords(
      ariseStore({
        history: [
          session(),
          { id: "no-date", blocks: [] },
          { dateISO: "2026-03-04", blocks: [] },
          { id: "bad-date", dateISO: "04/03/2026", blocks: [] },
          session({ id: "s2", blocks: undefined }),
        ],
        readinessLog: [
          { dateISO: "2026-03-02", score: 72 },
          { dateISO: "2026-03-03" },
          { score: 50 },
        ],
      }),
    );
    expect(records.filter((r) => r.kind === "session").map((r) => (r as { id: string }).id)).toEqual(["s1"]);
    expect(records.filter((r) => r.kind === "readiness")).toHaveLength(1);
  });

  it("tolerates a store shape it has never seen", () => {
    expect(selectAriseRecords({})).toEqual([]);
    expect(selectAriseRecords({ history: "not an array" })).toEqual([]);
    expect(selectAriseRecords(null)).toEqual([]);
  });
});

describe("staying live when the other app writes", () => {
  it("resyncs on a write to the watched key, coalescing bursts", () => {
    vi.useFakeTimers();
    const listeners: ((event: Event) => void)[] = [];
    const target = {
      addEventListener: (_: string, fn: EventListener) => listeners.push(fn as (e: Event) => void),
      removeEventListener: () => {},
    } as unknown as EventTarget;

    const onChange = vi.fn();
    subscribeToSameOriginSource(ARISE_STORAGE_KEY, onChange, { target, debounceMs: 500 });
    const fire = listeners[0]!;

    // Apps persist on every keystroke; one sync should follow, not five.
    for (let i = 0; i < 5; i += 1) {
      fire({ key: ARISE_STORAGE_KEY } as unknown as Event);
    }
    vi.advanceTimersByTime(499);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Another app's key is not our business.
    fire({ key: "forq-state-v2" } as unknown as Event);
    vi.advanceTimersByTime(1000);
    expect(onChange).toHaveBeenCalledTimes(1);

    // A cleared storage (key === null) is news.
    fire({ key: null } as unknown as Event);
    vi.advanceTimersByTime(500);
    expect(onChange).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("unsubscribes cleanly and is a no-op without an event target", () => {
    const removed: string[] = [];
    const target = {
      addEventListener: () => {},
      removeEventListener: (type: string) => removed.push(type),
    } as unknown as EventTarget;

    subscribeToSameOriginSource("k", () => {}, { target })();
    expect(removed).toEqual(["storage"]);
    expect(() => subscribeToSameOriginSource("k", () => {}, { target: null })()).not.toThrow();
  });
});

describe("Reflect: the consent flag lives in a different key from the data", () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    id: "e1",
    createdAt: "2026-03-02T21:15:00.000Z",
    title: "A hard conversation",
    status: "complete",
    messages: [
      { role: "user", content: "three words here" },
      { role: "assistant", content: "two more" },
    ],
    summary: { coreEmotion: "frustration" },
    ...over,
  });

  const reflectStorage = (entries: unknown, flag: string | null): StorageLike => ({
    getItem: (key) => {
      if (key === REFLECT_STORAGE_KEY) return JSON.stringify(entries);
      if (key === REFLECT_CONSENT_KEY) return flag;
      return null;
    },
  });

  it("reads nothing until Reflect's own opt-in is set", async () => {
    const off = createReflectSameOriginConnector({ storage: reflectStorage([entry()], null) });
    expect((await off.fetch(syncRequest())).records).toHaveLength(0);

    const on = createReflectSameOriginConnector({ storage: reflectStorage([entry()], "1") });
    expect((await on.fetch(syncRequest())).records).toHaveLength(1);
  });

  it("treats any value other than the app's own \"1\" as withheld", () => {
    expect(reflectConsentGranted("1")).toBe(true);
    expect(reflectConsentGranted("0")).toBe(false);
    expect(reflectConsentGranted("true")).toBe(false);
    expect(reflectConsentGranted(null)).toBe(false);
    expect(reflectConsentGranted(undefined)).toBe(false);
  });

  it("counts words and keeps the text out of the record entirely", () => {
    const [record] = selectReflectRecords([entry()]);
    expect(record).toMatchObject({ id: "e1", wordCount: 5, tag: "frustration" });
    // The promise in the `entry-shape` scope: nothing carries the content.
    expect(JSON.stringify(record)).not.toMatch(/three words here|two more/);
  });

  it("leaves the four ratings off, because Reflect does not record them", () => {
    const [record] = selectReflectRecords([entry()]);
    for (const field of ["mood", "energy", "stress", "clarity"]) {
      expect(record).not.toHaveProperty(field);
    }
  });

  it("reports an unresolved follow-up as unknown rather than as not done", () => {
    const unresolved = selectReflectRecords([entry()])[0];
    expect(unresolved).not.toHaveProperty("followUpCompleted");

    const resolved = selectReflectRecords([
      entry({ longitudinalReview: { assumptionVerdict: "held" } }),
    ])[0];
    expect(resolved).toMatchObject({ followUpCompleted: true });
  });

  it("skips entries with no id or timestamp, and a shape it does not recognise", () => {
    expect(selectReflectRecords([entry(), { createdAt: "2026-03-02T21:15:00.000Z" }, { id: "x" }])).toHaveLength(1);
    expect(selectReflectRecords({ entries: [] })).toEqual([]);
    expect(selectReflectRecords(null)).toEqual([]);
  });

  it("marks every event sensitive and requires its own permission", async () => {
    const connector = createReflectSameOriginConnector({ storage: reflectStorage([entry()], "1") });
    expect(connector.requiresExplicitPermission).toBe(true);
    const page = await connector.fetch(syncRequest());
    expect(page.records[0]).toMatchObject({ sensitivity: "sensitive" });
  });
});

describe("Forq: recovering what its cooked log does not record", () => {
  const forqState = (over: Record<string, unknown> = {}) => ({
    day: "2026-03-05",
    plan: {
      "2026-03-02": { breakfast: "porridge", lunch: "soup", dinner: "chilli" },
      "2026-03-05": { dinner: "curry" },
    },
    cooked: [
      { recipeId: "porridge", date: "2026-03-02" },
      { recipeId: "takeaway", date: "2026-03-02" },
    ],
    shops: [{ id: "t1", date: "2026-03-02", store: "Co-op", total: 24.5 }],
    ...over,
  });

  const forqStorage = (value: unknown): StorageLike => ({
    getItem: (key) => {
      if (key === FORQ_STORAGE_KEY) return JSON.stringify(value);
      if (key === FORQ_PULSE_OPT_IN_KEY) return "1";
      return null;
    },
  });

  it("recovers the slot by looking the recipe up in that day's plan", () => {
    const meals = selectForqRecords(forqState()).filter((r) => r.kind === "meal");
    expect(meals).toHaveLength(1);
    expect(meals[0]).toMatchObject({ slot: "breakfast", matchedPlan: true, id: "2026-03-02:breakfast:porridge" });
  });

  it("omits an off-plan meal rather than inventing the slot it is about", () => {
    const meals = selectForqRecords(forqState()).filter((r) => r.kind === "meal");
    expect(meals.map((m) => (m as { id: string }).id)).not.toContain("2026-03-02::takeaway");
    // But it still counts towards the day's completions, where it belongs.
    const day = selectForqRecords(forqState()).find((r) => r.kind === "plan-day");
    expect(day).toMatchObject({ completedMeals: 2, plannedMeals: 3 });
  });

  it("flags the assumed time so the engine discounts it", async () => {
    const connector = createForqSameOriginConnector({ storage: forqStorage(forqState()) });
    const page = await connector.fetch(syncRequest());
    const meal = page.records.find((r) => r.type === "forq.meal");
    expect(meal?.attributes).toMatchObject({ time_estimated: true, slot: "breakfast" });
    expect(meal?.occurredAt).toBe("2026-03-02T08:00:00.000Z");
  });

  it("does not score today's plan, which is still being worked through", () => {
    const days = selectForqRecords(forqState()).filter((r) => r.kind === "plan-day");
    expect(days.map((d) => (d as { dateISO: string }).dateISO)).toEqual(["2026-03-02"]);
  });

  it("sums the day's shopping trips into spend", () => {
    const day = selectForqRecords(
      forqState({
        shops: [
          { id: "t1", date: "2026-03-02", total: 24.5 },
          { id: "t2", date: "2026-03-02", total: 10.25 },
          { id: "t3", date: "2026-03-01", total: 99 },
        ],
      }),
    ).find((r) => r.kind === "plan-day");
    expect(day).toMatchObject({ shopSpend: 34.75 });
  });

  it("tolerates junk rows and a shape it has never seen", () => {
    expect(selectForqRecords({})).toEqual([]);
    expect(selectForqRecords(null)).toEqual([]);
    expect(
      selectForqRecords(
        forqState({ cooked: [{ date: "nope" }, { recipeId: "x" }], shops: [{ date: "2026-03-02", total: "free" }] }),
      ).filter((r) => r.kind === "meal"),
    ).toEqual([]);
  });
});
