import { describe, it, expect } from "vitest";
import { defaultBenchmarkCases, runBenchmark, runBenchmarkCase, runLongitudinalBenchmark, runRealisticLongitudinalBenchmark } from "./benchmark";

describe("benchmark harness", () => {
  it("valid hedged case passes", () => {
    const c = defaultBenchmarkCases()[0];
    const r = runBenchmarkCase(c);
    expect(r.verdict).toBe("pass");
    expect(r.errors).toEqual([]);
  });

  it("thin-evidence biases are flagged", () => {
    const c = defaultBenchmarkCases()[0];
    const thin = {
      ...c,
      id: "thin",
      summary: {
        ...c.summary,
        possibleBiases: [{ ...c.summary.possibleBiases[0], evidenceFor: [] }],
      },
    };
    const r = runBenchmarkCase(thin as unknown as typeof c);
    expect(r.ungroundedBiasCount).toBe(1);
    expect(r.verdict).toBe("fail");
  });

  it("default suite aggregates", () => {
    const { passed, failed, results } = runBenchmark(defaultBenchmarkCases());
    expect(results.length).toBe(3);
    // First and third should pass
    expect(passed).toBeGreaterThanOrEqual(2);
    void failed;
  });
});

describe("longitudinal benchmark", () => {
  it("all planted structure is recovered", () => {
    const checks = runLongitudinalBenchmark();
    const failed = checks.filter((c) => !c.pass);
    expect(checks.length).toBe(6);
    expect(failed).toEqual([]);
  });
});

describe("realistic longitudinal benchmark", () => {
  it("pattern detection survives real-world noise with precision", () => {
    const checks = runRealisticLongitudinalBenchmark();
    const failed = checks.filter((c) => !c.pass);
    expect(checks.length).toBe(5);
    expect(failed).toEqual([]);
  });
});
