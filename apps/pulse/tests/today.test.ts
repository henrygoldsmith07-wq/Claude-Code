import { describe, expect, it } from "vitest";
import { normaliseEvent, type NormaliseContext } from "../src/events/normalise.js";
import { addDays, eachLocalDate } from "../src/events/time.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { buildTodayBrief } from "../src/reports/today.js";
import type { PulseEvent } from "../src/events/schema.js";

const registry = createDefaultRegistry();
const context: NormaliseContext = {
  connectorId: "revise",
  connectorVersion: "1.0.0",
  syncId: "today-test",
  ingestMode: "live",
  timezone: "UTC",
  now: () => Date.parse("2025-03-12T12:00:00Z"),
};

function attempt(date: string, accuracy: number): PulseEvent {
  return normaliseEvent(
    {
      source: "revise",
      sourceEventId: `today-${date}`,
      type: "revise.attempt",
      category: "study",
      occurredAt: `${date}T12:00:00Z`,
      metrics: { accuracy, marks_awarded: accuracy * 10, marks_available: 10, response_ms: 120_000 },
      attributes: { method: "practice", subject_id: "physics" },
    },
    context,
  );
}

describe("Today decision brief", () => {
  it("separates a recent change from the normal baseline and states coverage", () => {
    const start = "2025-01-01";
    const dates = eachLocalDate(start, "2025-03-11");
    const events = dates.map((date) => attempt(date, date >= "2025-03-05" ? 0.95 : 0.7));
    const brief = buildTodayBrief({
      registry,
      today: "2025-03-11",
      events,
      timezone: "UTC",
      now: () => Date.parse("2025-03-11T12:00:00Z"),
    });

    expect(brief.dataState.status).toBe("ready");
    expect(brief.dataState.recentDays).toBe(7);
    expect(brief.whatChanged.some((change) => change.definition.id === "study.accuracy")).toBe(true);
    expect(brief.headline).toMatch(/clearest recent change/i);
    expect(brief.evidence.level).toBe("none");
  });

  it("does not call a missing period quiet", () => {
    const events = eachLocalDate("2025-01-01", "2025-01-10").map((date) => attempt(date, 0.7));
    const brief = buildTodayBrief({
      registry,
      today: "2025-02-01",
      events,
      timezone: "UTC",
      now: () => Date.parse("2025-02-01T12:00:00Z"),
    });

    expect(brief.dataState.status).toBe("missing");
    expect(brief.headline).toMatch(/No recent evidence/);
    expect(brief.normal).toHaveLength(0);
  });

  it("marks degraded sources as a partial-evidence state", () => {
    const events = [attempt(addDays("2025-03-08", 0), 0.7), attempt("2025-03-11", 0.7)];
    const brief = buildTodayBrief({
      registry,
      today: "2025-03-11",
      events,
      qualities: [{ source: "revise", grade: "poor", score: 0.2, issues: [{ severity: "critical", message: "Sync is stale", remedy: "Run a sync" }] } as never],
      timezone: "UTC",
      now: () => Date.parse("2025-03-11T12:00:00Z"),
    });

    expect(brief.dataState.status).toBe("partial");
    expect(brief.dataState.affectedSources).toEqual(["revise"]);
    expect(brief.evidence.caveats.join(" ")).toMatch(/degraded|reduced/i);
  });
});
