/**
 * Habit connector tests.
 *
 * The habit-tracker keeps its rows in Supabase (habits + checkins), so the
 * connector reads those tables and synthesises one record per habit per day —
 * including the days the habit was *not* done. That last part is the whole
 * point of the connector: a source that only reported completions would make
 * "didn't do the habit" invisible, and then Pulse could never ask whether
 * mood or study accuracy differs on done vs not-done days.
 */

import { describe, expect, it } from "vitest";
import { checkContract } from "../src/connectors/sdk.js";
import {
  createHabitConnector,
  createHabitSameOriginConnector,
  createHabitSupabaseConnector,
  mapHabitRecord,
  selectHabitRecords,
  type HabitDayRecord,
  type HabitSupabaseState,
} from "../src/connectors/habit.js";
import type { RawEventInput } from "../src/events/normalise.js";

const doneDay: HabitDayRecord = {
  kind: "day",
  id: "h1:2025-06-10",
  habitId: "h1",
  habitName: "Read 20 pages",
  targetPerWeek: 5,
  colour: "#6366f1",
  archived: false,
  day: "2025-06-10",
  completed: true,
  completedAt: "2025-06-10T20:15:00.000Z",
  timezone: "Europe/London",
};

const missedDay: HabitDayRecord = {
  kind: "day",
  id: "h1:2025-06-11",
  habitId: "h1",
  habitName: "Read 20 pages",
  targetPerWeek: 5,
  colour: "#6366f1",
  archived: false,
  day: "2025-06-11",
  completed: false,
  timezone: "Europe/London",
};

const records: HabitDayRecord[] = [doneDay, missedDay];

function firstEvent(events: RawEventInput[]): RawEventInput & { attributes: Record<string, string | number | boolean> } {
  const [event] = events;
  expect(event).toBeDefined();
  return { ...event!, attributes: event!.attributes ?? {} };
}

describe("habit connector mapping", () => {
  it("emits a completion event for a done day", () => {
    const event = firstEvent(mapHabitRecord(doneDay));
    expect(event.source).toBe("habit");
    expect(event.type).toBe("habit.checkin");
    expect(event.category).toBe("wellbeing");
    expect(event.occurredAt).toBe("2025-06-10T20:15:00.000Z");
    expect(event.metrics.completed).toBe(1);
    expect(event.attributes.habit_id).toBe("h1");
    expect(event.attributes.habit_name).toBe("Read 20 pages");
    expect(event.attributes.target_per_week).toBe(5);
    expect(event.attributes.archived).toBe(false);
    expect(event.attributes.time_estimated).toBe(false);
  });

  it("emits a zero for a day the habit was not done, stamped at day end", () => {
    const event = firstEvent(mapHabitRecord(missedDay));
    expect(event.metrics.completed).toBe(0);
    // A missed day is a day-level fact: the honest timestamp is the day's end.
    expect(event.occurredAt).toBe("2025-06-11T23:59:59.999Z");
    expect(event.attributes.time_estimated).toBe(true);
  });

  it("marks archived habits without hiding their history", () => {
    const event = firstEvent(
      mapHabitRecord({ ...missedDay, id: "h2:2025-06-11", habitId: "h2", habitName: "Journal", archived: true }),
    );
    expect(event.attributes.archived).toBe(true);
  });

  it("keeps a stable sourceEventId so re-syncs dedupe per habit-day", () => {
    const event = firstEvent(mapHabitRecord(doneDay));
    expect(event.sourceEventId).toBe("h1:2025-06-10");
  });

  it("honours its declared contract", () => {
    const connector = createHabitConnector({
      async read() {
        return { records, hasMore: false };
      },
    });
    const produced = records.flatMap((record) => mapHabitRecord(record));
    expect(produced.length).toBeGreaterThan(0);
    expect(checkContract(connector, produced)).toEqual([]);
  });
});

describe("selectHabitRecords - Supabase rows to day records", () => {
  const state: HabitSupabaseState = {
    habits: [
      {
        id: "h1",
        name: "Read 20 pages",
        target_per_week: 5,
        colour: "#6366f1",
        sort_order: 0,
        archived: false,
        created_at: "2025-06-08T09:00:00Z",
      },
      {
        id: "h2",
        name: "Journal",
        target_per_week: 7,
        colour: "#10b981",
        sort_order: 1,
        archived: true,
        created_at: "2025-06-01T09:00:00Z",
      },
    ],
    checkins: [
      { id: "c1", habit_id: "h1", day: "2025-06-08", completed: true, created_at: "2025-06-08T20:00:00Z" },
      { id: "c2", habit_id: "h1", day: "2025-06-10", completed: true, created_at: "2025-06-10T20:15:00Z" },
      { id: "c3", habit_id: "h2", day: "2025-06-09", completed: true, created_at: "2025-06-09T21:00:00Z" },
    ],
  };

  it("synthesises one record per habit per day, marking only real check-ins done", () => {
    const selected = selectHabitRecords(state, "2025-06-11");
    const h1 = selected.filter((record) => record.habitId === "h1");
    // Created 06-08, so 06-08..06-10 exist; today (06-11) is skipped.
    expect(h1.map((record) => record.day)).toEqual(["2025-06-08", "2025-06-09", "2025-06-10"]);
    expect(h1.map((record) => record.completed)).toEqual([true, false, true]);
    expect(h1[1]!.completedAt).toBeUndefined();
    expect(h1[0]!.completedAt).toBe("2025-06-08T20:00:00Z");
  });

  it("never emits today, because the day is still in progress", () => {
    const selected = selectHabitRecords(state, "2025-06-10");
    expect(selected.every((record) => record.day < "2025-06-10")).toBe(true);
  });

  it("keeps archived habits' history", () => {
    const selected = selectHabitRecords(state, "2025-06-11");
    const h2 = selected.filter((record) => record.habitId === "h2");
    expect(h2.length).toBeGreaterThan(0);
    expect(h2.every((record) => record.archived)).toBe(true);
  });

  it("returns nothing for an unrecognised shape rather than throwing", () => {
    expect(selectHabitRecords({ wrong: true }, "2025-06-11")).toEqual([]);
    expect(selectHabitRecords(null, "2025-06-11")).toEqual([]);
  });
});

describe("habit same-origin connector", () => {
  // The app mirrors its Supabase rows into localStorage under this shape, so
  // Pulse can connect without needing the project's credentials.
  const mirrorState = {
    day: "2025-06-10",
    mirroredAt: "2025-06-10T21:00:00.000Z",
    habits: [
      {
        id: "h1",
        name: "Read 20 pages",
        target_per_week: 3,
        colour: "#6366f1",
        sort_order: 0,
        archived: false,
        created_at: "2025-06-01T09:00:00Z",
      },
    ],
    checkins: [
      { id: "c1", habit_id: "h1", day: "2025-06-02", completed: true, created_at: "2025-06-02T20:00:00Z" },
      { id: "c2", habit_id: "h1", day: "2025-06-05", completed: true, created_at: "2025-06-05T20:10:00Z" },
    ],
  };

  it("reads the app's mirror and synthesises completed + missed days", async () => {
    const seen: string[] = [];
    const storage = {
      getItem(key: string) {
        seen.push(key);
        return key === "habit-tracker-state-v1" ? JSON.stringify(mirrorState) : null;
      },
    };
    const connector = createHabitSameOriginConnector({ storage });
    const page = await connector.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    // Only its own key, never another app's.
    expect(seen).toEqual(["habit-tracker-state-v1"]);
    expect(page.records.length).toBeGreaterThan(0);
    expect(page.records.every((event) => event.source === "habit")).toBe(true);
    expect(checkContract(connector, page.records)).toEqual([]);
    // Missed days are synthesised, not just completions.
    expect(page.records.filter((event) => event.metrics.completed === 0).length).toBeGreaterThan(0);
  });

  it("never emits today, using the mirror's own day", async () => {
    const connector = createHabitSameOriginConnector({
      storage: { getItem: () => JSON.stringify(mirrorState) },
    });
    const page = await connector.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    expect(page.records.every((event) => event.occurredAt < "2025-06-10T00:00:00.000Z")).toBe(true);
  });

  it("reports no data when the mirror is absent", async () => {
    const connector = createHabitSameOriginConnector({ storage: { getItem: () => null } });
    const page = await connector.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    expect(page.records).toEqual([]);
    const health = await connector.healthCheck!();
    expect(health.status).toBe("failing");
  });
});

describe("habit Supabase connector", () => {
  function jsonStorage(state: HabitSupabaseState): { fetcher: typeof fetch } {
    const responses: Record<string, unknown> = {
      "/rest/v1/habits?select=*": state.habits,
      "/rest/v1/checkins?select=*&order=day.asc": state.checkins,
    };
    return {
      fetcher: (async (input: RequestInfo | URL) => {
        const url = String(input);
        // Match on the path: the connector prefixes the project URL.
        const body = Object.entries(responses).find(([key]) => url.includes(key))?.[1] ?? [];
        return {
          ok: true,
          status: 200,
          json: async () => body,
        } as Response;
      }) as typeof fetch,
    };
  }

  it("reads both tables and emits completed + missed days", async () => {
    const { fetcher } = jsonStorage({
      habits: [
        {
          id: "h1",
          name: "Read",
          target_per_week: 3,
          colour: "#6366f1",
          sort_order: 0,
          archived: false,
          created_at: "2025-06-08T09:00:00Z",
        },
      ],
      checkins: [{ id: "c1", habit_id: "h1", day: "2025-06-08", completed: true, created_at: "2025-06-08T20:00:00Z" }],
    });
    const connector = createHabitSupabaseConnector({ url: "https://example.supabase.co", anonKey: "anon", fetcher });

    const page = await connector.fetch({
      since: null,
      cursor: null,
      timezone: "Europe/London",
      mode: "backfill",
      limit: 50,
    });
    expect(page.records.length).toBeGreaterThan(0);
    expect(page.records.every((event) => event.source === "habit")).toBe(true);
    expect(checkContract(connector, page.records)).toEqual([]);
    // The missed days are there too, not just the completion.
    expect(page.records.filter((event) => event.metrics.completed === 0).length).toBeGreaterThan(0);
  });

  it("reports an unreadable state as a probe failure, not a crash", async () => {
    const fetcher = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    const connector = createHabitSupabaseConnector({ url: "https://example.supabase.co", anonKey: "anon", fetcher });
    const health = await connector.healthCheck!();
    expect(health.status).toBe("failing");
  });
});

describe("habit correlation end to end", () => {
  it("lets Pulse discover a relationship between habit completion and study accuracy", async () => {
    const { createSyntheticPulse } = await import("../src/synthetic/harness.js");
    const { pulse } = await createSyntheticPulse({
      days: 180,
      includeHabit: true,
      // The daily-series test is noisier than the within-day exposure tests,
      // so the planted effect needs to be strong enough to survive the family
      // correction across ~119 comparisons.
      habitAccuracyBoost: 0.16,
    });
    expect(pulse.store.query({ sources: ["habit"] }).length).toBeGreaterThan(0);

    const report = pulse.discover();
    const habitFinding = report.findings.find((finding) => finding.sources.includes("habit"));
    expect(habitFinding).toBeDefined();
    expect(habitFinding!.tags.some((tag) => tag === "lagged-correlation")).toBe(true);
  });

  it("adds no habit events unless the connector is opted in", async () => {
    const { createSyntheticPulse } = await import("../src/synthetic/harness.js");
    const { pulse } = await createSyntheticPulse({ days: 30, seed: "habit-opt-out" });
    expect(pulse.store.query({ sources: ["habit"] })).toHaveLength(0);
  });
});
