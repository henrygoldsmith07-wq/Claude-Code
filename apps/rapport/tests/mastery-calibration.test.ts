import { describe, it, expect } from "vitest";
import { calibrateMastery, validateEvidenceWeighting, syntheticEvidenceLog } from "../src/domain/mastery-calibration";

describe("calibrateMastery", () => {
  it("is perfectly calibrated when predictions equal outcomes", () => {
    const observations = [
      { predicted: 0.2, uncertainty: 0.15, actual: 0.2 },
      { predicted: 0.5, uncertainty: 0.15, actual: 0.5 },
      { predicted: 0.8, uncertainty: 0.15, actual: 0.8 },
    ];
    const result = calibrateMastery(observations, 5);
    expect(result.ece).toBeCloseTo(0, 6);
    expect(result.brier).toBeCloseTo(0, 6);
    expect(result.oneSigmaCoverage).toBe(1);
  });

  it("reports overconfidence: predicted 0.8 realises 0.5", () => {
    const observations = Array.from({ length: 20 }, () => ({ predicted: 0.8, uncertainty: 0.1, actual: 0.5 }));
    const result = calibrateMastery(observations, 5);
    expect(result.ece).toBeGreaterThan(0.2);
    expect(result.brier).toBeGreaterThan(0.05);
    expect(result.oneSigmaCoverage).toBe(0); // 0.3 gap > 0.1 uncertainty
  });

  it("returns an empty report for no data", () => {
    expect(calibrateMastery([]).observations).toBe(0);
  });

  it("bins reflect realised performance per predicted band", () => {
    const observations = [
      ...Array.from({ length: 10 }, () => ({ predicted: 0.3, uncertainty: 0.1, actual: 0.35 })),
      ...Array.from({ length: 10 }, () => ({ predicted: 0.7, uncertainty: 0.1, actual: 0.65 })),
    ];
    const result = calibrateMastery(observations, 5);
    expect(result.bins.length).toBe(2);
    const low = result.bins.find((b) => b.lo === 0) ?? result.bins[0]!;
    expect(low!.meanActual).toBeCloseTo(0.35, 5);
  });
});

describe("evidence weighting validation", () => {
  it("synthetic log alternates real-world and simulation evidence", () => {
    const log = syntheticEvidenceLog({ skillId: "conv.follow-up", trueSkill: 0.7, events: 30, seed: 5 });
    expect(log.length).toBe(30);
    expect(log.some((e) => e.kind === "challenge")).toBe(true);
    expect(log.some((e) => e.kind === "simulation")).toBe(true);
  });

  it("shipped weights (real > sim) recover the planted skill better than equal weights", () => {
    // Simulations systematically overstate the skill (rehearsals run easier
    // than real life); trusting real-world evidence must win out.
    const result = validateEvidenceWeighting({ skillId: "conv.follow-up", trueSkill: 0.75, events: 60, seed: 21, simBias: 0.2 });
    expect(result.shippedWins).toBe(true);
    expect(result.shippedMAE).toBeLessThan(result.equalMAE);
    expect(result.shippedFinalError).toBeLessThan(result.equalFinalError);
    expect(result.events).toBe(60);
  });

  it("is deterministic for a fixed seed", () => {
    const a = validateEvidenceWeighting({ skillId: "conf.opinions", trueSkill: 0.6, events: 30, seed: 9 });
    const b = validateEvidenceWeighting({ skillId: "conf.opinions", trueSkill: 0.6, events: 30, seed: 9 });
    expect(a).toEqual(b);
  });
});
