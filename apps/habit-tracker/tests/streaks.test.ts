import { describe, expect, it } from "vitest";
import { bestStreak, completionRate, currentStreak, weekCounts } from "../src/lib/streaks";

describe("currentStreak", () => {
  it("is zero with no check-ins", () => {
    expect(currentStreak([], "2025-07-04")).toBe(0);
  });

  it("counts a run that includes today", () => {
    const days = ["2025-07-02", "2025-07-03", "2025-07-04"];
    expect(currentStreak(days, "2025-07-04")).toBe(3);
  });

  it("keeps a streak alive when today is not done yet but yesterday was", () => {
    const days = ["2025-07-02", "2025-07-03"];
    expect(currentStreak(days, "2025-07-04")).toBe(2);
  });

  it("breaks the streak after a missed day", () => {
    const days = ["2025-07-02", "2025-07-04"];
    expect(currentStreak(days, "2025-07-04")).toBe(1);
  });

  it("ignores duplicates and out-of-order input", () => {
    const days = ["2025-07-03", "2025-07-02", "2025-07-02", "2025-07-01"];
    expect(currentStreak(days, "2025-07-03")).toBe(3);
  });
});

describe("bestStreak", () => {
  it("is the longest consecutive run, not the current one", () => {
    const days = ["2025-07-01", "2025-07-02", "2025-07-03", "2025-07-07", "2025-07-08"];
    expect(bestStreak(days)).toBe(3);
  });

  it("handles an empty log", () => {
    expect(bestStreak([])).toBe(0);
  });
});

describe("completionRate", () => {
  it("is the share of days completed within the window", () => {
    const days = ["2025-06-28", "2025-06-30", "2025-07-03"];
    expect(completionRate(days, 7, "2025-07-04")).toBeCloseTo(3 / 7);
  });

  it("ignores days outside the window", () => {
    const days = ["2025-06-01", "2025-07-02"];
    expect(completionRate(days, 7, "2025-07-04")).toBeCloseTo(1 / 7);
  });
});

describe("weekCounts", () => {
  it("groups days into Sunday-start weeks, oldest first", () => {
    // 2025-06-30 is a Monday; its week starts 2025-06-29.
    // 2025-07-06 is the Sunday that ends the window.
    const days = ["2025-06-30", "2025-07-01", "2025-07-06"];
    const counts = weekCounts(days, "2025-07-06", 3);
    expect(counts.at(-1)).toEqual({ weekStart: "2025-07-06", count: 1 });
    expect(counts[counts.length - 2]).toEqual({ weekStart: "2025-06-29", count: 2 });
  });

  it("returns exactly the requested number of weeks", () => {
    expect(weekCounts([], "2025-07-04", 8)).toHaveLength(8);
  });
});
