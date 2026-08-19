import { describe, expect, it } from "vitest";
import { confidenceLanguage } from "./confidence";

describe("confidenceLanguage", () => {
  it("uses bounded, plain-English bands", () => {
    expect(confidenceLanguage(0.2).label).toBe("Very tentative");
    expect(confidenceLanguage(0.55).label).toBe("Tentative");
    expect(confidenceLanguage(0.7).label).toBe("Plausible");
    expect(confidenceLanguage(0.82).label).toBe("Fairly clear");
    expect(confidenceLanguage(1).label).toBe("Strongly supported");
  });

  it("does not expose the old percentage-only framing", () => {
    expect(confidenceLanguage(0.7).detail).toMatch(/evidence|explanations/i);
    expect(confidenceLanguage(0.7).detail).not.toMatch(/%/);
  });
});
