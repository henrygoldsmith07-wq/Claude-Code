/**
 * What happens once more than one source is connected.
 *
 * The specificity tests here are the load-bearing ones, in the same way they
 * are for discovery. Reconciliation that is too eager deletes a real nap;
 * reconciliation that is too shy lets one pair of legs be counted twice and
 * then reports the agreement between the two copies as corroboration.
 */

import { describe, expect, it } from "vitest";
import { normaliseEvent, type RawEventInput } from "../src/events/normalise.js";
import type { PulseEvent } from "../src/events/schema.js";
import { mapHealthRecord } from "../src/connectors/health.js";
import { mapWearableRecord } from "../src/connectors/wearables.js";
import { createWearableConnector } from "../src/connectors/wearables.js";
import { createAppleHealthConnector } from "../src/connectors/health.js";
import { createArrayReader } from "../src/connectors/sdk.js";
import { reconcileEvents } from "../src/connectors/reconcile.js";
import { buildConnectorDashboard, freshnessSummary } from "../src/connectors/dashboard.js";
import type { SyncReport } from "../src/connectors/sync.js";

const TZ = "Europe/London";

function toEvent(raw: RawEventInput): PulseEvent {
  return normaliseEvent(raw, {
    connectorId: String(raw.source),
    connectorVersion: "1.0.0",
    syncId: "test",
    ingestMode: "live",
    timezone: TZ,
    now: () => Date.parse("2025-06-11T09:00:00Z"),
  });
}

/** The same day's steps, once via Apple Health and once straight from Garmin. */
const appleStepsFromGarmin = toEvent(
  mapHealthRecord(
    { kind: "activity", id: "ah-1", dateISO: "2025-06-10", steps: 11_204, sourceApp: "Garmin Connect" },
    "apple-health",
  )[0]!,
);
const garminSteps = toEvent(
  mapWearableRecord({ kind: "daily", id: "gr-1", dateISO: "2025-06-10", steps: 11_204 }, "garmin")[0]!,
);

describe("cross-source reconciliation", () => {
  it("drops a platform re-export when the source it came from is connected directly", () => {
    const { events, report } = reconcileEvents([appleStepsFromGarmin, garminSteps], {
      connectedSources: ["apple-health", "garmin"],
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe("garmin");
    expect(report.supersededCount).toBe(1);
    expect(report.groups[0]!.superseded[0]!.reason).toMatch(/re-exporting a reading written by garmin/);
  });

  it("keeps a re-export when it is the only copy in existence", () => {
    // Garmin is not connected, so Apple Health's copy is the data, not a duplicate.
    const { events, report } = reconcileEvents([appleStepsFromGarmin], { connectedSources: ["apple-health"] });
    expect(events).toHaveLength(1);
    expect(report.supersededCount).toBe(0);
  });

  it("never touches two events from the same source, however alike", () => {
    const morningNap = toEvent(
      mapWearableRecord(
        { kind: "sleep", id: "n1", startsAt: "2025-06-10T13:00:00Z", endsAt: "2025-06-10T13:45:00Z" },
        "oura",
      )[0]!,
    );
    const secondNap = toEvent(
      mapWearableRecord(
        { kind: "sleep", id: "n2", startsAt: "2025-06-10T13:10:00Z", endsAt: "2025-06-10T13:50:00Z" },
        "oura",
      )[0]!,
    );
    const { events, report } = reconcileEvents([morningNap, secondNap]);
    expect(events).toHaveLength(2);
    expect(report.supersededCount).toBe(0);
  });

  it("treats two devices tracking one night as one night", () => {
    const oura = toEvent(
      mapWearableRecord(
        { kind: "sleep", id: "o1", startsAt: "2025-06-09T23:00:00Z", endsAt: "2025-06-10T07:00:00Z", asleepMinutes: 440 },
        "oura",
      )[0]!,
    );
    const whoop = toEvent(
      mapWearableRecord(
        { kind: "sleep", id: "wp1", startsAt: "2025-06-09T23:10:00Z", endsAt: "2025-06-10T07:05:00Z", asleepMinutes: 436 },
        "whoop",
      )[0]!,
    );

    const { events, report } = reconcileEvents([oura, whoop], { sourcePrecedence: ["whoop", "oura"] });
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe("whoop");
    expect(report.groups[0]!.eventType).toBe("health.sleep");
  });

  it("leaves a genuine afternoon nap alone while reconciling the night", () => {
    const nightOura = toEvent(
      mapWearableRecord(
        { kind: "sleep", id: "o2", startsAt: "2025-06-09T23:00:00Z", endsAt: "2025-06-10T07:00:00Z" },
        "oura",
      )[0]!,
    );
    const nightWhoop = toEvent(
      mapWearableRecord(
        { kind: "sleep", id: "wp2", startsAt: "2025-06-09T23:05:00Z", endsAt: "2025-06-10T07:00:00Z" },
        "whoop",
      )[0]!,
    );
    const nap = toEvent(
      mapWearableRecord(
        { kind: "sleep", id: "o3", startsAt: "2025-06-10T14:00:00Z", endsAt: "2025-06-10T14:40:00Z" },
        "oura",
      )[0]!,
    );

    const { events } = reconcileEvents([nightOura, nightWhoop, nap]);
    expect(events).toHaveLength(2);
    expect(events.some((event) => event.id === nap.id)).toBe(true);
  });

  it("obeys the user's stated precedence over its own heuristics", () => {
    const { events } = reconcileEvents([appleStepsFromGarmin, garminSteps], {
      connectedSources: ["apple-health", "garmin"],
      sourcePrecedence: ["apple-health"],
    });
    expect(events[0]!.source).toBe("apple-health");
  });

  it("keeps the richer copy when neither source is second-hand", () => {
    const thin = toEvent(
      mapWearableRecord({ kind: "daily", id: "f1", dateISO: "2025-06-10", restingHeartRate: 52 }, "fitbit")[0]!,
    );
    const rich = toEvent(
      mapWearableRecord(
        { kind: "daily", id: "o4", dateISO: "2025-06-10", restingHeartRate: 51, hrvMs: 70, respiratoryRate: 14 },
        "oura",
      )[0]!,
    );
    const { events, report } = reconcileEvents([thin, rich]);
    expect(events[0]!.source).toBe("oura");
    expect(report.groups[0]!.superseded[0]!.reason).toMatch(/3 measurements for this against 1/);
  });

  it("produces the same survivor whichever order the events arrive in", () => {
    const forwards = reconcileEvents([appleStepsFromGarmin, garminSteps], { connectedSources: ["apple-health", "garmin"] });
    const backwards = reconcileEvents([garminSteps, appleStepsFromGarmin], { connectedSources: ["apple-health", "garmin"] });
    expect(forwards.events.map((event) => event.id)).toEqual(backwards.events.map((event) => event.id));
  });

  it("sets nothing aside without saying so", () => {
    const { report } = reconcileEvents([appleStepsFromGarmin, garminSteps], {
      connectedSources: ["apple-health", "garmin"],
    });
    expect(report.bySource).toEqual([
      { source: "apple-health", kept: 0, superseded: 1 },
      { source: "garmin", kept: 1, superseded: 0 },
    ]);
  });
});

describe("the connector dashboard", () => {
  const NOW = Date.parse("2025-06-11T09:00:00Z");
  const now = () => NOW;

  const garmin = createWearableConnector("garmin", createArrayReader([], () => "2025-06-10T00:00:00Z"));
  const apple = createAppleHealthConnector(createArrayReader([], () => "2025-06-10T00:00:00Z"));

  /** A run of daily step events ending `endingDaysAgo` days before now. */
  function dailySteps(source: "garmin" | "apple-health", days: number, endingDaysAgo: number): PulseEvent[] {
    return Array.from({ length: days }, (_unused, index) => {
      const at = new Date(NOW - (endingDaysAgo + index) * 86_400_000).toISOString().slice(0, 10);
      const raw =
        source === "garmin"
          ? mapWearableRecord({ kind: "daily", id: `g-${at}`, dateISO: at, steps: 9000 }, "garmin")[0]!
          : mapHealthRecord({ kind: "activity", id: `a-${at}`, dateISO: at, steps: 9000 }, "apple-health")[0]!;
      return toEvent(raw);
    });
  }

  const healthyReport = (source: string): SyncReport => ({
    source,
    syncId: `${source}-1`,
    mode: "live",
    startedAt: "2025-06-11T08:00:00Z",
    finishedAt: "2025-06-11T08:00:05Z",
    fetched: 10,
    inserted: 10,
    duplicates: 0,
    updated: 0,
    rejected: 0,
    rejectionSamples: [],
    warnings: [],
    pages: 1,
    cursor: null,
    health: { status: "healthy", message: "Syncing normally", checkedAt: "2025-06-11T08:00:05Z" },
  });

  it("calls a daily source fresh when yesterday is in and stale when a week is missing", () => {
    const dashboard = buildConnectorDashboard(
      [garmin, apple],
      [...dailySteps("garmin", 14, 0), ...dailySteps("apple-health", 14, 7)],
      { timezone: TZ, now, syncReports: [healthyReport("garmin"), healthyReport("apple-health")] },
    );

    const cards = new Map(dashboard.cards.map((card) => [String(card.source), card]));
    expect(cards.get("garmin")!.freshness).toBe("fresh");
    expect(cards.get("apple-health")!.freshness).toBe("stale");
  });

  it("puts the connector needing attention at the top", () => {
    const dashboard = buildConnectorDashboard(
      [garmin, apple],
      [...dailySteps("garmin", 14, 0), ...dailySteps("apple-health", 14, 7)],
      { timezone: TZ, now, syncReports: [healthyReport("garmin"), healthyReport("apple-health")] },
    );
    expect(String(dashboard.cards[0]!.source)).toBe("apple-health");
    expect(dashboard.summary.needingAttention).toBe(1);
  });

  it("says a connected source has never sent anything", () => {
    const dashboard = buildConnectorDashboard([garmin], [], { timezone: TZ, now });
    expect(dashboard.cards[0]!.freshness).toBe("silent");
    expect(dashboard.cards[0]!.attention[0]!.message).toMatch(/never sent any data/);
    expect(dashboard.cards[0]!.attention[0]!.severity).toBe("critical");
  });

  it("blames a shared quiet spell on the week off, not on five broken connectors", () => {
    // Both sources stop for the same four days and both resume. That is a
    // holiday. Reporting it as two connector faults teaches people to ignore
    // the dashboard, which costs more than the gap does.
    const events = [
      ...dailySteps("garmin", 5, 0),
      ...dailySteps("garmin", 5, 9),
      ...dailySteps("apple-health", 5, 0),
      ...dailySteps("apple-health", 5, 9),
    ];
    const dashboard = buildConnectorDashboard([garmin, apple], events, {
      timezone: TZ,
      now,
      windowDays: 14,
      syncReports: [healthyReport("garmin"), healthyReport("apple-health")],
    });

    expect(dashboard.blackoutDays.length).toBe(4);
    for (const card of dashboard.cards) expect(card.missingDays).toBe(0);
  });

  it("counts a gap that is one connector's own", () => {
    const events = [
      // Garmin covers the fortnight; Apple Health missed the middle four days.
      ...dailySteps("garmin", 14, 0),
      ...dailySteps("apple-health", 5, 0),
      ...dailySteps("apple-health", 5, 9),
    ];
    const dashboard = buildConnectorDashboard([garmin, apple], events, {
      timezone: TZ,
      now,
      windowDays: 14,
      syncReports: [healthyReport("garmin"), healthyReport("apple-health")],
    });
    const apples = dashboard.cards.find((card) => card.source === "apple-health")!;
    expect(dashboard.blackoutDays).toEqual([]);
    expect(apples.missingDays).toBe(4);
    expect(apples.longestGapDays).toBe(4);
    expect(apples.attention.some((item) => item.message.includes("missing 4 of"))).toBe(true);
  });

  it("does not accuse a newly added connector of missing the weeks before it existed", () => {
    const dashboard = buildConnectorDashboard([garmin], dailySteps("garmin", 3, 0), { timezone: TZ, now });
    expect(dashboard.cards[0]!.missingDays).toBe(0);
    expect(dashboard.cards[0]!.coverageDays).toBe(3);
  });

  it("raises a warning when a source keeps sending records that cannot be read", () => {
    const broken: SyncReport = { ...healthyReport("garmin"), fetched: 20, rejected: 8, inserted: 12 };
    const dashboard = buildConnectorDashboard([garmin], dailySteps("garmin", 5, 0), {
      timezone: TZ,
      now,
      syncReports: [broken],
    });
    expect(dashboard.cards[0]!.rejectionRate).toBeCloseTo(0.4, 10);
    expect(dashboard.cards[0]!.attention.some((item) => item.message.includes("40% of the records"))).toBe(true);
  });

  it("never calls an imported file stale", () => {
    const dashboard = buildConnectorDashboard([garmin], dailySteps("garmin", 2, 40), { timezone: TZ, now });
    expect(dashboard.cards[0]!.freshness).toBe("silent");

    const irregular = { ...garmin, cadence: "irregular" as const };
    const importDashboard = buildConnectorDashboard([irregular], dailySteps("garmin", 2, 40), { timezone: TZ, now });
    expect(importDashboard.cards[0]!.freshness).toBe("unknown");
    expect(importDashboard.cards[0]!.attention).toEqual([]);
  });

  it("offers a one-line freshness label for the strip above the findings", () => {
    const dashboard = buildConnectorDashboard([garmin], dailySteps("garmin", 5, 0), { timezone: TZ, now });
    const [summary] = freshnessSummary(dashboard);
    expect(summary!.label).toMatch(/^Garmin — /);
  });

  it("marks a connector the user has not connected as such, without alarming them", () => {
    const dashboard = buildConnectorDashboard([garmin, apple], dailySteps("garmin", 5, 0), {
      timezone: TZ,
      now,
      connectedSources: ["garmin"],
    });
    const appleCard = dashboard.cards.find((card) => card.source === "apple-health")!;
    expect(appleCard.connected).toBe(false);
    expect(appleCard.attention.every((item) => item.severity === "info")).toBe(true);
    expect(dashboard.summary.connected).toBe(1);
  });
});
