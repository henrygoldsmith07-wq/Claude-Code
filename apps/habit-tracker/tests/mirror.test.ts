import { describe, expect, it } from "vitest";
import { HABIT_STORAGE_KEY, buildLocalMirror } from "../src/lib/mirror";
import type { DbCheckin, DbHabit } from "../src/lib/types";

const habits: DbHabit[] = [
  {
    id: "h1",
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
