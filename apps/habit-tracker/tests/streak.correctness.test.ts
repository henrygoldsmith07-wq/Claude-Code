import { describe, expect, it } from "vitest";
import { addDays, parseISO, toISODate } from "../src/lib/date";
import { bestStreak, completionRate, currentStreak, weekCounts } from "../src/lib/streaks";

describe("streak correctness — deterministic", () => {
  it("is deterministic regardless of input order and duplicates", () => {
    const base = ["2025-03-10", "2025-03-11", "2025-03-12"];
    const shuffled = ["2025-03-12", "2025-03-10", "2025-03-11", "2025-03-11"];
    expect(currentStreak(base, "2025-03-12")).toBe(currentStreak(shuffled, "2025-03-12"));
    expect(bestStreak(base)).toBe(bestStreak(shuffled));
  });

  it("duplicate check-ins do not inflate streak", () => {
    const days = ["2025-07-01", "2025-07-01", "2025-07-02", "2025-07-02", "2025-07-03"];
    expect(currentStreak(days, "2025-07-03")).toBe(3);
    expect(bestStreak(days)).toBe(3);
  });

  it("midnight boundary: today not done keeps streak until day ends", () => {
    // If today is 2025-07-04, streak ending yesterday should still count.
    const days = ["2025-07-01", "2025-07-02", "2025-07-03"];
    expect(currentStreak(days, "2025-07-04")).toBe(3); // yesterday's streak alive
    expect(currentStreak([], "2025-07-04")).toBe(0);
    // Missed day breaks it: gap before yesterday.
    const withGap = ["2025-07-01", "2025-07-03"];
    expect(currentStreak(withGap, "2025-07-04")).toBe(1); // only yesterday, not 01 because 02 missed
  });

  it("missed day breaks current streak but not best", () => {
    const days = ["2025-07-01", "2025-07-02", "2025-07-04", "2025-07-05"];
    expect(currentStreak(days, "2025-07-05")).toBe(2); // 04-05
    expect(bestStreak(days)).toBe(2); // max run is 2 (01-02 or 04-05)
    const longer = ["2025-07-01", "2025-07-02", "2025-07-03", "2025-07-05"];
    expect(currentStreak(longer, "2025-07-05")).toBe(1);
    expect(bestStreak(longer)).toBe(3);
  });

  it("historic check-ins affect best but not current if gap", () => {
    const days = ["2025-01-01", "2025-01-02", "2025-01-03", "2025-06-10"];
    expect(bestStreak(days)).toBe(3);
    expect(currentStreak(days, "2025-06-10")).toBe(1);
    expect(currentStreak(days, "2025-06-11")).toBe(1); // 10 is yesterday, so 1
    expect(currentStreak(days, "2025-06-12")).toBe(0); // missed 11
  });

  it("manual correction (removing a day) reduces streak deterministically", () => {
    const full = ["2025-07-01", "2025-07-02", "2025-07-03", "2025-07-04"];
    expect(currentStreak(full, "2025-07-04")).toBe(4);
    const corrected = ["2025-07-01", "2025-07-02", "2025-07-04"]; // removed 03
    expect(currentStreak(corrected, "2025-07-04")).toBe(1);
    expect(bestStreak(corrected)).toBe(2);
  });

  it("date changes via addDays handle DST spring-forward (US 2025-03-09)", () => {
    // In many zones DST jumps 2025-03-09. Our local-day helpers must still add correctly.
    expect(addDays("2025-03-08", 1)).toBe("2025-03-09");
    expect(addDays("2025-03-09", 1)).toBe("2025-03-10");
    // Streak across DST should be contiguous if days are consecutive.
    const acrossDST = ["2025-03-08", "2025-03-09", "2025-03-10"];
    expect(currentStreak(acrossDST, "2025-03-10")).toBe(3);
  });

  it("DST fall-back (2025-11-02) similarly", () => {
    expect(addDays("2025-11-01", 1)).toBe("2025-11-02");
    expect(addDays("2025-11-02", 1)).toBe("2025-11-03");
    const days = ["2025-11-01", "2025-11-02", "2025-11-03"];
    expect(bestStreak(days)).toBe(3);
  });

  it("timezone boundary: toISODate uses local components, not UTC", () => {
    // Construct a date that in UTC would be next day but locally is same day.
    const d = new Date(2025, 6, 4, 23, 30, 0);
    expect(toISODate(d)).toBe("2025-07-04");
    // Midnight edge: 00:00 should be next day.
    const midnight = new Date(2025, 6, 5, 0, 0, 0);
    expect(toISODate(midnight)).toBe("2025-07-05");
    // parseISO -> toISODate round-trips.
    expect(toISODate(parseISO("2025-07-04"))).toBe("2025-07-04");
  });

  it("leap year handling", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01"); // non-leap
    const leapStreak = ["2024-02-28", "2024-02-29", "2024-03-01"];
    expect(currentStreak(leapStreak, "2024-03-01")).toBe(3);
  });

  it("weekCounts deterministic across week boundaries", () => {
    // 2025-03-09 is Sunday (DST day in US). Week start should be itself.
    const days = ["2025-03-09", "2025-03-10"];
    const counts = weekCounts(days, "2025-03-10", 2);
    // Oldest week: 2025-03-02 (Sun), newest: 2025-03-09
    expect(counts[0].weekStart).toBe("2025-03-02");
    expect(counts[1].weekStart).toBe("2025-03-09");
    // Both days are in week starting 2025-03-09
    expect(counts[1].count).toBe(2);
    expect(counts[0].count).toBe(0);
  });

  it("completionRate window slices correctly at boundaries", () => {
    // Window 7 ending 2025-07-04 includes 06-28 to 07-04.
    const edge = ["2025-06-28", "2025-07-04"];
    expect(completionRate(edge, 7, "2025-07-04")).toBeCloseTo(2 / 7);
    // Outside window should not.
    const outside = ["2025-06-27", "2025-07-05"];
    expect(completionRate(outside, 7, "2025-07-04")).toBeCloseTo(0);
  });

  it("streaks remain deterministic after multiple corrections", () => {
    let days: string[] = [];
    expect(currentStreak(days, "2025-07-10")).toBe(0);
    days = ["2025-07-08", "2025-07-09", "2025-07-10"];
    expect(currentStreak(days, "2025-07-10")).toBe(3);
    // Remove middle (manual correction)
    days = ["2025-07-08", "2025-07-10"];
    expect(currentStreak(days, "2025-07-10")).toBe(1);
    expect(bestStreak(days)).toBe(1);
    // Re-add
    days = ["2025-07-08", "2025-07-09", "2025-07-10"];
    expect(currentStreak(days, "2025-07-10")).toBe(3);
  });
});
