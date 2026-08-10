import { describe, it, expect } from "vitest";
import { evaluateBenchmark, SAMPLE_CASES } from "./benchmark";

describe("benchmark", () => {
  it("duplicate-wire-copy clusters correctly", () => {
    const r = evaluateBenchmark(SAMPLE_CASES[0]);
    expect(r.precision).toBeGreaterThanOrEqual(0.5);
    expect(r.recall).toBeGreaterThanOrEqual(0.5);
  });
  it("multi-country same event clusters correctly", () => {
    const r = evaluateBenchmark(SAMPLE_CASES[1]);
    expect(r.f1).toBeGreaterThanOrEqual(0.5);
  });
});
