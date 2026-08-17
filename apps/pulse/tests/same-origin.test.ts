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
