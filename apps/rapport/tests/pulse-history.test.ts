import { describe, expect, it } from "vitest";
import {
  buildRapportPulseHistory,
  publishRapportPulseHistory,
  RAPPORT_PULSE_HISTORY_KEY,
  RAPPORT_PULSE_OPT_IN_KEY,
  readRapportPulseOptIn,
  rapportPulseOptInGranted,
  setRapportPulseOptIn,
} from "@/data/pulse-history";

const fakeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    entries: () => [...map.entries()],
  };
};

describe("Rapport Pulse history", () => {
  it("publishes durable, transcript-free drill and challenge records", () => {
    const history = buildRapportPulseHistory(
      [
        {
          kind: "simulation-evaluated",
          at: "2026-08-16T18:00:00.000Z",
          simulationId: "sim-1",
          skillIds: ["listening"],
          performance: 0.8,
          difficulty: 3,
          reliability: 0.9,
          behaviours: [],
        },
        {
          kind: "challenge-attempted",
          at: "2026-08-16T19:00:00.000Z",
          attemptId: "attempt-1",
          skillId: "assertiveness",
          outcome: "yes",
          difficulty: 3,
          performance: 0.8,
          reliability: 0.8,
          comfort: 4,
        },
      ],
      [],
      "2026-08-17T12:00:00.000Z",
    );
    expect(history.schemaVersion).toBe(2);
    expect(history.records).toHaveLength(2);
    expect(JSON.stringify(history)).not.toMatch(/transcript|conversation/);
  });
});

describe("Rapport Pulse opt-in", () => {
  const events = [
    {
      kind: "simulation-evaluated",
      at: "2026-08-16T18:00:00.000Z",
      simulationId: "sim-1",
      skillIds: ["listening"],
      performance: 0.8,
      difficulty: 3,
      reliability: 0.9,
      behaviours: [],
    },
  ] as never;

  it("accepts only the explicit on-value", () => {
    expect(rapportPulseOptInGranted("1")).toBe(true);
    expect(rapportPulseOptInGranted(1)).toBe(true);
    expect(rapportPulseOptInGranted("0")).toBe(false);
    expect(rapportPulseOptInGranted(true)).toBe(false);
    expect(rapportPulseOptInGranted(null)).toBe(false);
  });

  it("is off by default, so the mirror is never published until opted in", () => {
    const storage = fakeStorage();
    expect(readRapportPulseOptIn(storage)).toBe(false);
    publishRapportPulseHistory(events, [], storage);
    expect(storage.entries()).toEqual([]);
  });

  it("publishes the mirror while opted in and stops when revoked, clearing it", () => {
    const storage = fakeStorage();
    setRapportPulseOptIn(true, storage);
    expect(storage.getItem(RAPPORT_PULSE_OPT_IN_KEY)).toBe("1");

    publishRapportPulseHistory(events, [], storage);
    const mirror = storage.getItem(RAPPORT_PULSE_HISTORY_KEY);
    expect(mirror).not.toBeNull();
    expect(JSON.parse(mirror ?? "{}").records).toHaveLength(1);

    setRapportPulseOptIn(false, storage);
    expect(storage.getItem(RAPPORT_PULSE_OPT_IN_KEY)).toBeNull();
    expect(storage.getItem(RAPPORT_PULSE_HISTORY_KEY)).toBeNull();
    expect(readRapportPulseOptIn(storage)).toBe(false);
  });

  it("stops publishing immediately after a revoke", () => {
    const storage = fakeStorage();
    setRapportPulseOptIn(true, storage);
    publishRapportPulseHistory(events, [], storage);
    expect(storage.getItem(RAPPORT_PULSE_HISTORY_KEY)).not.toBeNull();

    setRapportPulseOptIn(false, storage);
    publishRapportPulseHistory(events, [], storage);
    expect(storage.getItem(RAPPORT_PULSE_HISTORY_KEY)).toBeNull();
  });
});
