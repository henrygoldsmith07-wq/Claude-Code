import { describe, expect, it } from "vitest";
import { dateAfterDays, localIsoDate } from "./followUp";

describe("delayed follow-up dates", () => {
  it("formats local dates without a UTC rollover", () => {
    expect(localIsoDate(new Date(2026, 0, 9, 12))).toBe("2026-01-09");
  });

  it("offers a predictable delayed date", () => {
    expect(dateAfterDays(3, new Date(2026, 0, 9, 12))).toBe("2026-01-12");
  });
});
