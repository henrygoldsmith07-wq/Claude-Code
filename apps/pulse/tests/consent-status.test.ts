import { describe, expect, it } from "vitest";
import { createHabitSameOriginConnector, HABIT_PULSE_OPT_IN_KEY, HABIT_STORAGE_KEY } from "../src/connectors/habit.js";
import { createRapportSameOriginConnector, RAPPORT_PULSE_OPT_IN_KEY } from "../src/connectors/rapport.js";
import { createAriseSameOriginConnector, ARISE_STORAGE_KEY } from "../src/connectors/arise.js";
import { createForqSameOriginConnector } from "../src/connectors/forq.js";
import { createReviseCloudConnector } from "../src/connectors/revise.js";

const jsonStorage = (entries: Record<string, unknown>): { getItem(key: string): string | null } => ({
  getItem: (key) => (key in entries ? JSON.stringify(entries[key]) : null),
});

const habitMirror = {
  day: "2026-08-17",
  habits: [{ id: "h1", name: "Read", target_per_week: 3, colour: "#6366f1", sort_order: 0, archived: false }],
  checkins: [],
};

describe("app-side consent status", () => {
  it("reports a granted flag for Habit when the app opted in", () => {
    const connector = createHabitSameOriginConnector({
      storage: jsonStorage({ [HABIT_STORAGE_KEY]: habitMirror, [HABIT_PULSE_OPT_IN_KEY]: "1" }),
    });
    const status = connector.consentStatus?.();
    expect(status).not.toBeNull();
    expect(status?.kind).toBe("flag");
    expect(status?.key).toBe(HABIT_PULSE_OPT_IN_KEY);
    expect(status?.granted).toBe(true);
    expect(status?.message).toMatch(/opt/i);
  });

  it("reports paused at source when Habit's flag is revoked", () => {
    const connector = createHabitSameOriginConnector({
      storage: jsonStorage({ [HABIT_STORAGE_KEY]: habitMirror, [HABIT_PULSE_OPT_IN_KEY]: "0" }),
    });
    const status = connector.consentStatus?.();
    expect(status?.granted).toBe(false);
    expect(status?.message).toMatch(/paused at source/i);
  });

  it("reports paused at source when the flag key is absent entirely", () => {
    const connector = createHabitSameOriginConnector({ storage: jsonStorage({ [HABIT_STORAGE_KEY]: habitMirror }) });
    expect(connector.consentStatus?.()?.granted).toBe(false);
  });

  it("reports Rapport's flag the same way", () => {
    const connector = createRapportSameOriginConnector({
      storage: jsonStorage({ "rapport.pulse-history.v2": { format: "le-studio.source-history", records: [] }, [RAPPORT_PULSE_OPT_IN_KEY]: "1" }),
    });
    const status = connector.consentStatus?.();
    expect(status?.kind).toBe("flag");
    expect(status?.key).toBe(RAPPORT_PULSE_OPT_IN_KEY);
    expect(status?.granted).toBe(true);
  });

  it("reports Arise's embedded flag inside its store", () => {
    const on = createAriseSameOriginConnector({
      storage: jsonStorage({ [ARISE_STORAGE_KEY]: { preferences: { pulseEnabled: true }, history: [], readinessLog: [] } }),
    });
    expect(on.consentStatus?.()).toMatchObject({ kind: "embedded", key: ARISE_STORAGE_KEY, granted: true });

    const off = createAriseSameOriginConnector({
      storage: jsonStorage({ [ARISE_STORAGE_KEY]: { preferences: { pulseEnabled: false }, history: [], readinessLog: [] } }),
    });
    expect(off.consentStatus?.()?.granted).toBe(false);
  });

  it("reports no app-side gate for sources without one (Forq)", () => {
    const connector = createForqSameOriginConnector({
      storage: jsonStorage({ "forq-state-v2": { day: "2026-08-17", plan: {}, cooked: [], shops: [] } }),
    });
    expect(connector.consentStatus).toBeUndefined();
  });

  it("reports the server-side gate for Revise cloud, with no readable flag", () => {
    const connector = createReviseCloudConnector({ fetcher: async () => new Response("{}", { status: 200 }) });
    const status = connector.consentStatus?.();
    expect(status?.kind).toBe("server");
    expect(status?.key).toBeNull();
    expect(status?.granted).toBeNull();
    expect(status?.message).toMatch(/settings/i);
  });

  it("never throws when storage is blocked", () => {
    const connector = createHabitSameOriginConnector({
      storage: {
        getItem() {
          throw new Error("blocked");
        },
      },
    });
    expect(() => connector.consentStatus?.()).not.toThrow();
    expect(connector.consentStatus?.()?.granted).toBe(false);
  });
});
