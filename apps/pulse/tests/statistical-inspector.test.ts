import { describe, expect, it } from "vitest";
import {
  createDefaultStatisticalInspectorOptions,
  normaliseStatisticalInspectorOptions,
  sameStatisticalInspectorOptions,
} from "../src/statistics/inspector.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";

describe("statistical inspector controls", () => {
  it("normalises thresholds and keeps at least one exposure window", () => {
    const options = normaliseStatisticalInspectorOptions({
      fdrLevel: 0.8,
      minEffect: -1,
      exposureWindowsHours: [24, 4, 4, 0, 200],
      maxLagDays: 99,
    });

    expect(options).toEqual({
      fdrLevel: 0.2,
      minEffect: 0.05,
      exposureWindowsHours: [4, 24],
      maxLagDays: 14,
    });
    expect(normaliseStatisticalInspectorOptions({ exposureWindowsHours: [] }).exposureWindowsHours).toEqual([4, 24]);
  });

  it("recognises the default control state", () => {
    const defaults = createDefaultStatisticalInspectorOptions();
    expect(sameStatisticalInspectorOptions(defaults, createDefaultStatisticalInspectorOptions())).toBe(true);
    expect(sameStatisticalInspectorOptions(defaults, { ...defaults, maxLagDays: 7 })).toBe(false);
  });

  it("previews different analysis controls without adding an insight-history scan", async () => {
    const { pulse } = await createSyntheticPulse({ days: 90, seed: "statistical-inspector" });
    pulse.discover();
    const historySize = pulse.insightHistory.size();

    const preview = pulse.inspectStatistics({
      fdrLevel: 0.1,
      minEffect: 0.8,
      exposureWindowsHours: [1],
      maxLagDays: 7,
    });

    expect(preview.fdrLevel).toBe(0.1);
    expect(preview.candidatesGenerated).toBeGreaterThan(0);
    expect(pulse.insightHistory.size()).toBe(historySize);
  });
});
