import { describe, it, expect } from "vitest";
import { COUNTRY_NAMES, normaliseCode, getCountryName } from "./countries";

describe("countries", () => {
  it("normalises codes case-insensitively", () => {
    expect(normaliseCode(" us ")).toBe("US");
    expect(getCountryName("gb")).toBe("United Kingdom");
    expect(getCountryName("GB")).toBe("United Kingdom");
  });

  it("returns null for unknown codes", () => {
    expect(getCountryName("ZZ")).toBeNull();
  });

  it("has an entry for every value (smoke)", () => {
    expect(Object.keys(COUNTRY_NAMES).length).toBeGreaterThan(150);
  });
});
