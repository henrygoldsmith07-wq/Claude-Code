import { describe, expect, it } from "vitest";
import { isCompatibleStoredValue } from "./useLocalStorage";

describe("isCompatibleStoredValue", () => {
  it("accepts persisted primitive values such as API keys", () => {
    expect(isCompatibleStoredValue("sk-or-saved", "")).toBe(true);
    expect(isCompatibleStoredValue(false, true)).toBe(true);
    expect(isCompatibleStoredValue(7, 0)).toBe(true);
  });

  it("rejects values with the wrong shape", () => {
    expect(isCompatibleStoredValue({ value: "key" }, "")).toBe(false);
    expect(isCompatibleStoredValue("not an array", [])).toBe(false);
    expect(isCompatibleStoredValue(null, {})).toBe(false);
  });
});
