/**
 * Health, wearable and calendar mapping behaviour.
 *
 * The contract tests next door prove these connectors emit what they declare.
 * These prove the mappings mean what they say — which is where the damage
 * actually happens, because a plausible-looking wrong number is invisible.
 */

import { describe, expect, it } from "vitest";
import { mapHealthRecord, type HealthRecord } from "../src/connectors/health.js";
import { mapWearableRecord, type WearableRecord } from "../src/connectors/wearables.js";
import {
  mapCalendarRecord,
  summariseCalendarDay,
  type CalendarEventRecord,
} from "../src/connectors/calendar.js";
import { attributedVendor, sleepMidpoint } from "../src/connectors/health-events.js";

const night: HealthRecord = {
  kind: "sleep",
  id: "s1",
  startsAt: "2025-06-09T22:40:00Z",
  endsAt: "2025-06-10T06:50:00Z",
  asleepMinutes: 442,
  deepMinutes: 72,
  remMinutes: 96,
  sourceApp: "Apple Watch",
};

describe("health platform mapping", () => {
  it("stamps a night of sleep at its midpoint, so it lands on the morning you woke up", () => {
    const [event] = mapHealthRecord(night, "apple-health");
    // 22:40 to 06:50 is 490 minutes; half of that past the start is 02:45.
    expect(event!.occurredAt).toBe("2025-06-10T02:45:00.000Z");
    expect(sleepMidpoint(night.startsAt as string, "2025-06-10T06:50:00Z")).toBe(event!.occurredAt);
  });

  it("derives sleep efficiency from measured quantities rather than trusting the source's own", () => {
    const [event] = mapHealthRecord(night, "apple-health");
    expect(event!.metrics.time_in_bed_minutes).toBe(490);
    expect(event!.metrics.sleep_minutes).toBe(442);
    expect(event!.metrics.sleep_efficiency).toBeCloseTo(442 / 490, 10);
  });

  it("omits sleep stages it was never given instead of recording them as zero", () => {
    const [event] = mapHealthRecord({ ...night, deepMinutes: null, remMinutes: null }, "apple-health");
    expect(event!.metrics.deep_minutes).toBeUndefined();
    expect(event!.metrics.rem_minutes).toBeUndefined();
    expect(event!.attributes!.stages_measured).toBe(false);
  });

  it("drops a day the watch was not worn rather than emitting an event with no measurements", () => {
    const unworn: HealthRecord = {
      kind: "vitals",
      id: "v1",
      dateISO: "2025-06-10",
      restingHeartRate: null,
      hrvMs: null,
      bloodOxygen: null,
    };
    expect(mapHealthRecord(unworn, "apple-health")).toEqual([]);
  });

  it("flags a daily summary whose time had to be assumed", () => {
    const [event] = mapHealthRecord(
      { kind: "activity", id: "a1", dateISO: "2025-06-10", steps: 9000 },
      "health-connect",
    );
    expect(event!.attributes!.time_estimated).toBe(true);
    expect(event!.occurredAt).toBe("2025-06-10T21:00:00.000Z");
  });

  it("marks a reading another vendor wrote into the platform as second-hand", () => {
    const [event] = mapHealthRecord(
      { kind: "activity", id: "a2", dateISO: "2025-06-10", steps: 11_204, sourceApp: "Garmin Connect" },
      "apple-health",
    );
    expect(event!.attributes!.origin_app).toBe("garmin-connect");
    expect(event!.attributes!.first_hand).toBe(false);
  });

  it("treats the platform's own hardware as first-hand", () => {
    const [event] = mapHealthRecord(night, "apple-health");
    expect(event!.attributes!.first_hand).toBe(true);
    expect(attributedVendor("Apple Watch")).toBe("apple-health");
    expect(attributedVendor("Some Indie Tracker")).toBeNull();
  });

  it("treats an unattributed reading as first-hand rather than discarding it", () => {
    const [event] = mapHealthRecord({ kind: "activity", id: "a3", dateISO: "2025-06-10", steps: 8000 }, "apple-health");
    expect(event!.attributes!.origin_app).toBe("unknown");
    expect(event!.attributes!.first_hand).toBe(true);
  });
});

describe("wearable mapping", () => {
  const daily: WearableRecord = {
    kind: "daily",
    id: "d1",
    dateISO: "2025-06-10",
    restingHeartRate: 51,
    hrvMs: 71,
    steps: 11_040,
  };

  it("splits a daily row into vitals and activity with distinct identities", () => {
    const events = mapWearableRecord(daily, "oura");
    expect(events.map((event) => event.type)).toEqual(["health.vitals", "health.activity"]);
    // Sharing one id would make the two events collide on the dedupe key and
    // silently overwrite each other.
    expect(new Set(events.map((event) => event.sourceEventId)).size).toBe(2);
  });

  it("emits only the half of a daily row that carries data", () => {
    const events = mapWearableRecord({ kind: "daily", id: "d2", dateISO: "2025-06-10", steps: 7000 }, "fitbit");
    expect(events.map((event) => event.type)).toEqual(["health.activity"]);
  });

  it("shares measured physiology across vendors so switching device keeps one series", () => {
    const oura = mapWearableRecord(daily, "oura")[0]!;
    const whoop = mapWearableRecord(daily, "whoop")[0]!;
    expect(oura.type).toBe(whoop.type);
    expect(Object.keys(oura.metrics)).toEqual(Object.keys(whoop.metrics));
    expect([oura.source, whoop.source]).toEqual(["oura", "whoop"]);
  });

  it("keeps each vendor's proprietary scores on their own event type", () => {
    const whoop = mapWearableRecord(
      { kind: "score", id: "sc1", dateISO: "2025-06-10", scores: { recovery_score: 68 } },
      "whoop",
    )[0]!;
    const oura = mapWearableRecord(
      { kind: "score", id: "sc2", dateISO: "2025-06-10", scores: { readiness_score: 68 } },
      "oura",
    )[0]!;
    // Both are "68 out of 100" and they are not the same measurement.
    expect(whoop.type).toBe("whoop.score");
    expect(oura.type).toBe("oura.score");
    expect(Object.keys(whoop.metrics)).not.toEqual(Object.keys(oura.metrics));
  });

  it("refuses a score the vendor never declared instead of letting an unexplainable number through", () => {
    expect(() =>
      mapWearableRecord({ kind: "score", id: "sc3", dateISO: "2025-06-10", scores: { vibe_index: 91 } }, "oura"),
    ).toThrow(/undeclared scores: vibe_index/);
  });
});

describe("calendar mapping", () => {
  const meeting: CalendarEventRecord = {
    kind: "event",
    id: "c1",
    startsAt: "2025-06-10T09:00:00Z",
    endsAt: "2025-06-10T10:00:00Z",
    attendeeCount: 4,
  };

  it("ignores an invitation the user declined", () => {
    expect(mapCalendarRecord({ ...meeting, response: "declined" }, "google-calendar")).toEqual([]);
  });

  it("ignores an entry marked free, which is a note rather than a commitment", () => {
    expect(mapCalendarRecord({ ...meeting, availability: "free" }, "outlook-calendar")).toEqual([]);
  });

  it("ignores an all-day entry rather than booking the whole day", () => {
    expect(mapCalendarRecord({ ...meeting, allDay: true }, "google-calendar")).toEqual([]);
  });

  it("carries no titles, descriptions or attendee names into the event", () => {
    const [event] = mapCalendarRecord(meeting, "google-calendar");
    expect(event!.notes).toBeUndefined();
    const values = [...Object.values(event!.attributes ?? {}), event!.subject].map(String);
    for (const value of values) expect(value.length).toBeLessThan(24);
    expect(Object.keys(event!.metrics)).toEqual(["duration_minutes", "attendee_count", "is_recurring", "is_online"]);
  });
});

describe("day shape", () => {
  const nineToTen = { startMinutes: 540, endMinutes: 600, attendeeCount: 4 };
  const halfNineToEleven = { startMinutes: 570, endMinutes: 660, attendeeCount: 2 };
  const evening = { startMinutes: 1260, endMinutes: 1320, attendeeCount: 1 };

  it("merges double-booked entries so a day cannot contain more hours than it has", () => {
    const day = summariseCalendarDay("2025-06-10", [nineToTen, halfNineToEleven]);
    // 09:00–11:00 once, not 60 + 90 minutes.
    expect(day.committedMinutes).toBe(120);
    expect(day.eventCount).toBe(2);
  });

  it("measures the longest free block inside the working window only", () => {
    const day = summariseCalendarDay("2025-06-10", [nineToTen, halfNineToEleven]);
    // Window is 08:00–20:00; the survivors are 08:00–09:00 and 11:00–20:00.
    expect(day.longestFreeBlockMinutes).toBe(540);
  });

  it("counts commitments that butt up against each other", () => {
    const day = summariseCalendarDay("2025-06-10", [nineToTen, halfNineToEleven]);
    expect(day.backToBackCount).toBe(1);
  });

  it("counts only the part of a commitment that falls outside working hours", () => {
    const day = summariseCalendarDay("2025-06-10", [nineToTen, evening]);
    expect(day.afterHoursMinutes).toBe(60);
    expect(day.committedMinutes).toBe(120);
  });

  it("counts all-day entries separately from committed time", () => {
    const day = summariseCalendarDay("2025-06-10", [nineToTen, { startMinutes: 0, endMinutes: 1440, allDay: true }]);
    expect(day.allDayCount).toBe(1);
    expect(day.committedMinutes).toBe(60);
  });

  it("ignores entries marked free when shaping the day", () => {
    const day = summariseCalendarDay("2025-06-10", [nineToTen, { ...evening, busy: false }]);
    expect(day.committedMinutes).toBe(60);
    expect(day.eventCount).toBe(1);
  });

  it("reports an empty day as empty rather than dividing by zero", () => {
    const day = summariseCalendarDay("2025-06-10", []);
    const [event] = mapCalendarRecord(day, "google-calendar");
    expect(event!.metrics.fragmentation).toBe(0);
    expect(event!.metrics.longest_free_block_minutes).toBe(720);
    expect(day.firstCommitmentMinutes).toBeNull();
  });
});
