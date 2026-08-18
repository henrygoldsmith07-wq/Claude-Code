import { describe, expect, it } from "vitest";
import {
  autocorrelationControl,
  checkMinimumSamples,
  confounderSensitivity,
  effectStability,
  independentHoldoutPeriods,
  multipleTestingSafeguard,
  negativeControlCheck,
  outlierSensitivity,
  propagateMeasurementError,
  reliabilityWeightedEvidence,
  timestampReliability,
  timestampUncertainty,
} from "../src/statistics/safeguards.js";

describe("P1 statistical safeguards", () => {
  it("requires both enough observations and enough independent days", () => {
    const insufficient = checkMinimumSamples({ observations: 40, distinctDays: 8, groupDays: [6, 2] });
    expect(insufficient.sufficient).toBe(false);
    expect(insufficient.reasons.join(" ")).toMatch(/distinct days|group/);

    const sufficient = checkMinimumSamples({ observations: 40, distinctDays: 21, groupDays: [8, 9], holdoutDays: 7 });
    expect(sufficient.sufficient).toBe(true);
  });

  it("reduces the effective sample size for serially correlated values", () => {
    const report = autocorrelationControl([1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9], 4);
    expect(report.coefficients[1]!.coefficient).toBeGreaterThan(0.8);
    expect(report.effectiveSampleSize).toBeLessThan(report.n);
    expect(report.inflationFactor).toBeGreaterThan(1);
  });

  it("weights lower-reliability evidence down and widens for measurement error", () => {
    const weighted = reliabilityWeightedEvidence([
      { value: 10, reliability: 1 },
      { value: 20, reliability: 0 },
    ]);
    expect(weighted.estimate).toBe(10);
    expect(weighted.effectiveSampleSize).toBe(1);

    const propagated = propagateMeasurementError(2, {
      standardError: 0.2,
      measurementErrorSd: 1,
      sampleSize: 10,
      signalVariance: 4,
    });
    expect(propagated.standardError).toBeGreaterThan(0.2);
    expect(propagated.confidenceInterval.low).toBeLessThan(2);
    expect(propagated.reliabilityRatio).toBeLessThan(1);
  });

  it("represents assumed timestamps as uncertain windows", () => {
    const window = timestampUncertainty("2025-07-01T12:00:00Z", { time_estimated: true });
    expect(window.uncertaintyMinutes).toBe(720);
    expect(window.startMs).toBeLessThan(window.centreMs);
    expect(timestampReliability(window)).toBeLessThan(0.2);
  });

  it("reports when a comparison depends on outliers or a time block", () => {
    const outliers = outlierSensitivity([1, 2, 3, 4, 100], [1, 2, 3, 4, 5]);
    expect(outliers.removedA).toBe(1);
    expect(outliers.stable).toBe(false);

    const stable = effectStability(
      [5, 6, 5, 6, 5, 6, 5, 6, 5, 6, 5, 6],
      [2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3],
    );
    expect(stable.blocks).toHaveLength(3);
    expect(stable.stable).toBe(true);
  });

  it("checks confounder sensitivity and negative controls", () => {
    const exposure = Array.from({ length: 20 }, (_, index) => index + 1);
    const outcome = exposure.map((value) => value * 2 + (value % 2));
    const sensitivity = confounderSensitivity(exposure, outcome, { trend: exposure });
    expect(sensitivity.survivesAll).toBe(false);

    const negative = negativeControlCheck(exposure, outcome, {
      unrelated: exposure.map((_, index) => (index % 2 ? 1 : 0)),
    });
    expect(negative.passes).toBe(true);
    expect(negative.controls[0]!.passes).toBe(true);
  });

  it("creates a chronological holdout and applies the selected correction", () => {
    const dates = Array.from({ length: 30 }, (_, index) => `2025-07-${String(index + 1).padStart(2, "0")}`);
    const holdout = independentHoldoutPeriods(dates, { holdoutDays: 7, minimumTrainDays: 14 });
    expect(holdout.independent).toBe(true);
    expect(holdout.trainDates.at(-1)).toBe("2025-07-23");
    expect(holdout.holdoutDates[0]).toBe("2025-07-24");

    const correction = multipleTestingSafeguard([0.001, 0.2, 0.9], (value) => value);
    expect(correction.summary.method).toBe("benjamini_hochberg");
    expect(correction.summary.familySize).toBe(3);
  });
});
