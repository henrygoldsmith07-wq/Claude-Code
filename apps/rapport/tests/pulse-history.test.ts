import { describe, expect, it } from "vitest";
import { buildRapportPulseHistory } from "@/data/pulse-history";

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
