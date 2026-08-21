import { describe, expect, it } from "vitest";
import {
  HABIT_STORAGE_KEY,
  PULSE_OPT_IN_KEY,
  buildLocalMirror,
  clearLocalMirror,
  readPulseOptIn,
  writeLocalMirror,
  writePulseOptIn,
} from "../src/lib/mirror";
import type { DbCheckin, DbHabit } from "../src/lib/types";

/** In-memory stand-in for localStorage so the mirror is testable in node. */
function fakeStorage(): { store: Map<string, string>; getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

const habits: DbHabit[] = [
  {
    id: "h1",
    user_id: "u1",
    name: "Read 20 pages",
    target_per_week: 5,
    colour: "#6366f1",
    sort_order: 0,
    archived: false,
    created_at: "2025-06-01T09:00:00.000Z",
  },
];

const checkins: DbCheckin[] = [
  {
    id: "c1",
    habit_id: "h1",
    day: "2025-06-02",
    completed: true,
    created_at: "2025-06-02T20:00:00.000Z",
  },
];

describe("the local Pulse mirror", () => {
  it("serialises the rows Pulse's connector reads", () => {
    const mirror = buildLocalMirror(habits, checkins, "2025-06-10", "2025-06-10T21:00:00.000Z");
    expect(mirror.habits).toEqual(habits);
    expect(mirror.checkins).toEqual(checkins);
    expect(mirror.day).toBe("2025-06-10");
    expect(mirror.mirroredAt).toBe("2025-06-10T21:00:00.000Z");
  });

  it("stores under the shared key Pulse reads", () => {
    expect(HABIT_STORAGE_KEY).toBe("habit-tracker-state-v1");
  });

  it("round-trips through JSON, which is how it crosses the storage boundary", () => {
    const mirror = buildLocalMirror(habits, checkins, "2025-06-10");
    expect(JSON.parse(JSON.stringify(mirror))).toEqual(mirror);
  });

  it("carries every row it is given, completed or not", () => {
    const mirror = buildLocalMirror(habits, [], "2025-06-10");
    expect(mirror.checkins).toEqual([]);
  });
});

describe("the Pulse opt-in", () => {
  it("defaults to off when no flag has been stored", () => {
    expect(readPulseOptIn(fakeStorage())).toBe(false);
  });

  it("stores the flag under the key Pulse reads", () => {
    const storage = fakeStorage();
    writePulseOptIn(true, storage);
    expect(storage.store.get(PULSE_OPT_IN_KEY)).toBe("1");
    expect(readPulseOptIn(storage)).toBe(true);

    writePulseOptIn(false, storage);
    expect(storage.store.get(PULSE_OPT_IN_KEY)).toBe("0");
    expect(readPulseOptIn(storage)).toBe(false);
  });

  it("treats anything other than the explicit on-value as revoked", () => {
    const storage = fakeStorage();
    storage.store.set(PULSE_OPT_IN_KEY, "yes please");
    expect(readPulseOptIn(storage)).toBe(false);
  });

  it("clears the mirror when revoked, so the data flow stops at the source", () => {
    const storage = fakeStorage();
    writeLocalMirror(buildLocalMirror(habits, checkins, "2025-06-10", "2025-06-10T21:00:00.000Z"), storage);
    expect(storage.store.has(HABIT_STORAGE_KEY)).toBe(true);

    clearLocalMirror(storage);
    expect(storage.store.has(HABIT_STORAGE_KEY)).toBe(false);
  });
});
