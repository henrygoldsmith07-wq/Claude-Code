import { describe, expect, it } from "vitest";
import { crossSourceAgreement } from "../src/connectors/agreement.js";

describe("cross-source agreement", () => {
  it("pairs independent measurements and reports agreement", () => {
    const observations = Array.from({ length: 6 }, (_, index) => {
      const at = `2025-07-01T${String(8 + index).padStart(2, "0")}:00:00Z`;
      const value = index + 10;
      return [
        { metricId: "accuracy", source: "revise", at, value },
        { metricId: "accuracy", source: "french", at: new Date(Date.parse(at) + 60_000), value: value + 0.02 },
      ];
    }).flat();
    const report = crossSourceAgreement(observations, { absoluteTolerance: 0.1 });
    expect(report.sources).toEqual(["french", "revise"]);
    expect(report.pairs).toHaveLength(1);
    expect(report.pairs[0]!.n).toBe(6);
    expect(report.pairs[0]!.consistent).toBe(true);
    expect(report.independentSources).toBe(true);
  });
});
