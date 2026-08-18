import { describe, expect, it } from "vitest";
import { checkContract } from "../src/connectors/sdk.js";
import { createForqSameOriginConnector, mapForqRecord } from "../src/connectors/forq.js";
import { createFrenchSameOriginConnector, mapFrenchRecord } from "../src/connectors/french.js";
import { createHabitSameOriginConnector } from "../src/connectors/habit.js";
import { createRapportSameOriginConnector, mapRapportRecord } from "../src/connectors/rapport.js";
import { createReviseCloudConnector, mapReviseRecord } from "../src/connectors/revise.js";
import type { RawEventInput } from "../src/events/normalise.js";

const jsonStorage = (entries: Record<string, unknown>): { getItem(key: string): string | null } => ({
  getItem: (key) => (key in entries ? JSON.stringify(entries[key]) : null),
});

const sourceEnvelope = (source: string, records: unknown[]) => ({
  format: "le-studio.source-history",
  schemaVersion: 2,
  source,
  connectorVersion: "2.0.0",
  generatedAt: "2026-08-17T12:00:00.000Z",
  records,
  cursor: null,
});

const forqState = {
  day: "2026-08-17",
  plan: { "2026-08-16": { dinner: "pasta" } },
  cooked: [{ recipeId: "pasta", date: "2026-08-16" }],
  shops: [{ date: "2026-08-16", total: 12.5 }],
};

const frenchHistory = sourceEnvelope("le-studio-french", [
  { kind: "speaking", id: "s1", startedAt: "2026-08-16T18:00:00.000Z", durationMs: 600_000, promptCount: 8 },
  { kind: "review", id: "r1", reviewedAt: "2026-08-16T19:00:00.000Z", itemId: "bonjour", skill: "vocab", correct: true, elapsedMs: 1200 },
]);

const rapportHistory = sourceEnvelope("rapport", [
  { kind: "drill", id: "d1", startedAt: "2026-08-16T18:00:00.000Z", durationMs: 300_000, skillId: "listening", score: 0.8 },
  { kind: "challenge", id: "c1", completedAt: "2026-08-16T19:00:00.000Z", skillId: "assertiveness", completed: true, comfort: 4 },
]);

const habitMirror = {
  day: "2026-08-17",
  mirroredAt: "2026-08-17T12:00:00.000Z",
  habits: [
    { id: "h1", name: "Read", target_per_week: 3, colour: "#6366f1", sort_order: 0, archived: false, created_at: "2026-08-01T09:00:00Z" },
  ],
  checkins: [{ id: "c1", habit_id: "h1", day: "2026-08-10", completed: true, created_at: "2026-08-10T20:00:00Z" }],
};

const reviseHistory = sourceEnvelope("revise", [
  { kind: "review", id: "rr1", cardId: "card", topicId: "topic", subjectId: "physics", grade: "good", elapsedMs: 1400, reviewedAt: "2026-08-16T20:00:00.000Z" },
]);

function first(events: RawEventInput[]): RawEventInput {
  expect(events[0]).toBeDefined();
  return events[0]!;
}

describe("first-party ecosystem connectors", () => {
  it("reads every same-origin history without touching another app's key", async () => {
    const seen: string[] = [];
    const storage = {
      getItem(key: string) {
        seen.push(key);
        return key === "forq-state-v2" ? JSON.stringify(forqState) : null;
      },
    };
    const connector = createForqSameOriginConnector({ storage });
    const page = await connector.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    expect(page.records.length).toBeGreaterThan(0);
    expect(seen).toEqual(["forq-state-v2"]);
    expect(checkContract(connector, page.records)).toEqual([]);
  });

  it("maps the durable French and Rapport envelopes", async () => {
    const french = createFrenchSameOriginConnector({ storage: jsonStorage({ "fp.pulse-history.v2": frenchHistory }) });
    const rapport = createRapportSameOriginConnector({ storage: jsonStorage({ "rapport.pulse-history.v2": rapportHistory }) });
    const frenchPage = await french.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    const rapportPage = await rapport.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    expect(checkContract(french, frenchPage.records)).toEqual([]);
    expect(checkContract(rapport, rapportPage.records)).toEqual([]);
    expect(first(frenchPage.records).source).toBe("le-studio-french");
    expect(first(rapportPage.records).source).toBe("rapport");
  });

  it("reads the Habit mirror the app writes under its own key", async () => {
    const seen: string[] = [];
    const habit = createHabitSameOriginConnector({
      storage: {
        getItem(key: string) {
          seen.push(key);
          return key === "habit-tracker-state-v1" ? JSON.stringify(habitMirror) : null;
        },
      },
    });
    const page = await habit.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    expect(seen).toEqual(["habit-tracker-state-v1"]);
    expect(page.records.length).toBeGreaterThan(0);
    expect(checkContract(habit, page.records)).toEqual([]);
    expect(first(page.records).source).toBe("habit");
  });

  it("reads Revise cloud history through the same versioned payload", async () => {
    const connector = createReviseCloudConnector({
      endpoint: "https://revise.example.test/api/pulse/history",
      fetcher: async () => new Response(JSON.stringify({ ...reviseHistory, hasMore: false }), { status: 200 }),
    });
    const page = await connector.fetch({ since: null, cursor: null, timezone: "UTC", mode: "live", limit: 50 });
    expect(page.records).toHaveLength(1);
    expect(checkContract(connector, page.records)).toEqual([]);
    expect(mapReviseRecord(reviseHistory.records[0] as never)).toHaveLength(1);
    expect(mapFrenchRecord(frenchHistory.records[0] as never)).toHaveLength(1);
    expect(mapRapportRecord(rapportHistory.records[0] as never)).toHaveLength(1);
    expect(mapForqRecord({ kind: "meal", id: "m", loggedAt: "2026-08-16T12:00:00.000Z", slot: "lunch", energyKcal: 500 })).toHaveLength(1);
  });

  it("keeps the shared storage keys unique", () => {
    const keys = [
      "forq-state-v2",
      "fp.pulse-history.v2",
      "rapport.pulse-history.v2",
      "habit-tracker-state-v1",
      "reflectEntries",
      "reflectPulseOptIn",
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((key) => key.startsWith("fp.") || key.startsWith("rapport.")).every((key) => /\.v\d+$/.test(key))).toBe(true);
  });
});
