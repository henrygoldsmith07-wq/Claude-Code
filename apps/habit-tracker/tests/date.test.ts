import { describe, expect, it } from "vitest";
import { addDays, lastNDays, startOfWeekISO, toISODate, todayISO } from "../src/lib/date";

describe("date helpers", () => {
  it("formats a date in the local calendar", () => {
    // Local components: 2025-07-04 regardless of the machine's timezone.
    expect(toISODate(new Date(2025, 6, 4, 15, 30))).toBe("2025-07-04");
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2025-07-31", 1)).toBe("2025-08-01");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });

  it("starts the week on Sunday", () => {
    expect(startOfWeekISO("2025-07-03")).toBe("2025-06-29"); // Thursday -> Sunday
    expect(startOfWeekISO("2025-06-29")).toBe("2025-06-29"); // Sunday itself
  });

  it("returns a window ending at the given day", () => {
    const days = lastNDays(7, "2025-07-04");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2025-06-28");
    expect(days.at(-1)).toBe("2025-07-04");
  });
});
