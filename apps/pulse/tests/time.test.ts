/**
 * Timezone and DST tests.
 *
 * These are the cheapest bugs to ship and the most expensive to notice: an
 * hour of behaviour silently lands in the wrong bucket twice a year, and every
 * time-of-day insight is quietly wrong for those days.
 */

import { describe, expect, it } from "vitest";
import {
  addDays,
  assertValidTimeZone,
  daysBetween,
  eachLocalDate,
  isoWeekKey,
  localDate,
  localDayEnd,
  localDayLengthHours,
  localDayOfWeek,
  localDayStart,
  localMinutes,
  startOfIsoWeek,
  toInstant,
  utcOffsetMinutes,
} from "../src/events/time.js";

describe("local calendar conversion", () => {
  it("places a UTC instant on the right local date and minute", () => {
    // 23:30 UTC on 5 Jan is 00:30 on 6 Jan in Berlin (UTC+1 in winter).
    const instant = Date.parse("2025-01-05T23:30:00Z");
    expect(localDate(instant, "Europe/Berlin")).toBe("2025-01-06");
    expect(localMinutes(instant, "Europe/Berlin")).toBe(30);
    expect(localDate(instant, "UTC")).toBe("2025-01-05");
    expect(localMinutes(instant, "UTC")).toBe(23 * 60 + 30);
  });

  it("handles zones behind UTC", () => {
    const instant = Date.parse("2025-03-01T02:00:00Z");
    expect(localDate(instant, "America/New_York")).toBe("2025-02-28");
    expect(localMinutes(instant, "America/New_York")).toBe(21 * 60);
  });

  it("handles half-hour and 45-minute offsets", () => {
    const instant = Date.parse("2025-06-01T12:00:00Z");
    expect(localMinutes(instant, "Asia/Kolkata")).toBe(17 * 60 + 30);
    expect(localMinutes(instant, "Asia/Kathmandu")).toBe(17 * 60 + 45);
    expect(utcOffsetMinutes(instant, "Asia/Kathmandu")).toBe(345);
  });

  it("rejects an unknown zone at the boundary rather than defaulting to UTC", () => {
    expect(() => assertValidTimeZone("Mars/Olympus_Mons")).toThrow(/Unknown IANA time zone/);
    expect(() => assertValidTimeZone("Europe/London")).not.toThrow();
  });

  it("reports the correct local day of week across a midnight boundary", () => {
    // Sunday 23:00 UTC is already Monday in Tokyo.
    const instant = Date.parse("2025-01-05T23:00:00Z");
    expect(localDayOfWeek(instant, "UTC")).toBe(0);
    expect(localDayOfWeek(instant, "Asia/Tokyo")).toBe(1);
  });
});

describe("DST transitions", () => {
  it("spring forward: the local day is 23 hours long", () => {
    // 30 March 2025, Europe/London goes 01:00 -> 02:00.
    expect(localDayLengthHours("2025-03-30", "Europe/London")).toBe(23);
    expect(localDayLengthHours("2025-03-29", "Europe/London")).toBe(24);
  });

  it("autumn back: the local day is 25 hours long", () => {
    // 26 October 2025, Europe/London goes 02:00 -> 01:00.
    expect(localDayLengthHours("2025-10-26", "Europe/London")).toBe(25);
  });

  it("keeps wall-clock minutes correct on both sides of a spring transition", () => {
    const before = Date.parse("2025-03-30T00:30:00Z"); // 00:30 GMT
    const after = Date.parse("2025-03-30T09:30:00Z"); // 10:30 BST
    expect(localMinutes(before, "Europe/London")).toBe(30);
    expect(localMinutes(after, "Europe/London")).toBe(10 * 60 + 30);
    expect(localDate(before, "Europe/London")).toBe("2025-03-30");
    expect(localDate(after, "Europe/London")).toBe("2025-03-30");
  });

  it("keeps the ambiguous repeated hour on the correct date in autumn", () => {
    // Both of these are "01:30 local" on 26 Oct — BST then GMT.
    const first = Date.parse("2025-10-26T00:30:00Z");
    const second = Date.parse("2025-10-26T01:30:00Z");
    expect(localMinutes(first, "Europe/London")).toBe(90);
    expect(localMinutes(second, "Europe/London")).toBe(90);
    expect(localDate(first, "Europe/London")).toBe("2025-10-26");
    expect(localDate(second, "Europe/London")).toBe("2025-10-26");
  });

  it("finds local midnight on transition days", () => {
    for (const date of ["2025-03-30", "2025-10-26"]) {
      const start = localDayStart(date, "Europe/London");
      expect(localDate(start, "Europe/London")).toBe(date);
      expect(localMinutes(start, "Europe/London")).toBe(0);
    }
  });

  it("finds the first valid instant in a zone that skips midnight", () => {
    // America/Santiago springs forward at 00:00 on 7 September 2025, so the
    // day's first wall-clock time is 01:00 and midnight does not exist.
    const start = localDayStart("2025-09-07", "America/Santiago");
    expect(localDate(start, "America/Santiago")).toBe("2025-09-07");
    expect(localMinutes(start, "America/Santiago")).toBe(60);
    // The day must still be contiguous with the previous one.
    expect(localDate(start - 60_000, "America/Santiago")).toBe("2025-09-06");
  });

  it("day end equals the next day's start", () => {
    for (const date of ["2025-03-30", "2025-06-15", "2025-10-26"]) {
      expect(localDayEnd(date, "Europe/London")).toBe(localDayStart(addDays(date, 1), "Europe/London"));
    }
  });

  it("southern-hemisphere transitions run the other way", () => {
    // Australia/Sydney: 5 October 2025 springs forward, 6 April falls back.
    expect(localDayLengthHours("2025-10-05", "Australia/Sydney")).toBe(23);
    expect(localDayLengthHours("2025-04-06", "Australia/Sydney")).toBe(25);
  });
});

describe("date arithmetic", () => {
  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2025-01-31", 1)).toBe("2025-02-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });

  it("counts days between dates regardless of DST", () => {
    // This span contains a spring-forward; it is still 31 calendar days.
    expect(daysBetween("2025-03-15", "2025-04-15")).toBe(31);
    expect(daysBetween("2025-04-15", "2025-03-15")).toBe(-31);
    expect(daysBetween("2025-01-01", "2025-01-01")).toBe(0);
  });

  it("enumerates an inclusive date range", () => {
    expect(eachLocalDate("2025-03-29", "2025-04-01")).toEqual([
      "2025-03-29",
      "2025-03-30",
      "2025-03-31",
      "2025-04-01",
    ]);
  });

  it("computes ISO week keys, including the year boundary", () => {
    expect(isoWeekKey("2025-01-06")).toBe("2025-W02");
    // 1 Jan 2026 is a Thursday, so it belongs to week 1 of 2026.
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    // 31 Dec 2024 is a Tuesday, belonging to week 1 of 2025.
    expect(isoWeekKey("2024-12-31")).toBe("2025-W01");
  });

  it("finds Monday of the containing ISO week", () => {
    expect(startOfIsoWeek("2025-01-09")).toBe("2025-01-06");
    expect(startOfIsoWeek("2025-01-06")).toBe("2025-01-06");
    expect(startOfIsoWeek("2025-01-12")).toBe("2025-01-06");
  });

  it("rejects malformed dates instead of coercing them", () => {
    expect(() => addDays("06/01/2025", 1)).toThrow(/Expected YYYY-MM-DD/);
    expect(() => toInstant("not a date")).toThrow(/Unparseable timestamp/);
  });
});
