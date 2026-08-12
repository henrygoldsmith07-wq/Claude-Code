import { describe, expect, it } from "vitest";
import {
  applyEvidence,
  applyUserCorrection,
  confidenceGap,
  correctionIsFresh,
  decay,
  effectiveMastery,
  initialSkillState,
  retentionHalfLifeDays,
  stateFor,
  stateIsConfident,
} from "@/domain/mastery";
import type { Evidence } from "@/domain/mastery";

const T0 = "2026-01-01T10:00:00.000Z";
const days = (n: number) => new Date(Date.parse(T0) + n * 86_400_000).toISOString();

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    skillId: "conv.follow-up",
    performance: 0.8,
    difficulty: 3,
    kind: "simulation",
    reliability: 1,
    at: days(1),
    ...overrides,
  };
}

describe("mastery model", () => {
  it("bands mastery into the four states", () => {
    expect(stateFor(0.1)).toBe("developing");
    expect(stateFor(0.5)).toBe("functional");
    expect(stateFor(0.7)).toBe("strong");
    expect(stateFor(0.95)).toBe("advanced");
  });

  it("moves further on early evidence than on late evidence", () => {
    let state = initialSkillState("u", "conv.follow-up", T0);
    const before = state.mastery;
    state = applyEvidence(state, evidence());
    const firstJump = state.mastery - before;

    for (let i = 0; i < 6; i += 1) state = applyEvidence(state, evidence({ at: days(2 + i) }));
    const settled = state.mastery;
    state = applyEvidence(state, evidence({ at: days(20) }));
    const lateJump = state.mastery - settled;

    expect(firstJump).toBeGreaterThan(lateJump);
  });

  it("weights real-world evidence above simulation evidence", () => {
    const base = initialSkillState("u", "conv.follow-up", T0);
    const fromSim = applyEvidence(base, evidence({ kind: "simulation" }));
    const fromChallenge = applyEvidence(base, evidence({ kind: "challenge" }));
    expect(fromChallenge.mastery).toBeGreaterThan(fromSim.mastery);
    expect(fromChallenge.successEvidence).toBeGreaterThan(fromSim.successEvidence);
  });

  it("credits harder occasions more than easy ones for the same performance", () => {
    const base = initialSkillState("u", "conv.follow-up", T0);
    const easy = applyEvidence(base, evidence({ difficulty: 1 }));
    const hard = applyEvidence(base, evidence({ difficulty: 5 }));
    expect(hard.mastery).toBeGreaterThan(easy.mastery);
  });

  it("narrows uncertainty with evidence but never to zero", () => {
    let state = initialSkillState("u", "conv.follow-up", T0);
    const initial = state.masteryUncertainty;
    for (let i = 0; i < 25; i += 1) state = applyEvidence(state, evidence({ at: days(i + 1) }));
    expect(state.masteryUncertainty).toBeLessThan(initial);
    expect(state.masteryUncertainty).toBeGreaterThan(0.05);
  });

  it("widens uncertainty again once a skill goes unpractised", () => {
    let state = initialSkillState("u", "conv.follow-up", T0);
    for (let i = 0; i < 8; i += 1) state = applyEvidence(state, evidence({ at: days(i + 1) }));
    const tight = state.masteryUncertainty;
    const aged = decay(state, days(200));
    expect(aged.masteryUncertainty).toBeGreaterThan(tight);
  });

  it("decays retention but not the mastery estimate itself", () => {
    let state = initialSkillState("u", "conv.follow-up", T0);
    state = applyEvidence(state, evidence());
    const aged = decay(state, days(120));
    expect(aged.retentionEstimate).toBeLessThan(0.5);
    expect(aged.mastery).toBe(state.mastery);
  });

  it("extends the retention half-life as corroborating evidence accumulates", () => {
    let state = initialSkillState("u", "conv.follow-up", T0);
    const early = retentionHalfLifeDays(state);
    for (let i = 0; i < 10; i += 1) state = applyEvidence(state, evidence({ kind: "challenge", at: days(i + 1) }));
    expect(retentionHalfLifeDays(state)).toBeGreaterThan(early);
  });

  it("tracks confidence separately from mastery", () => {
    let state = initialSkillState("u", "asrt.no", T0);
    // Performs well but reports it felt awful.
    for (let i = 0; i < 5; i += 1) {
      state = applyEvidence(state, evidence({ skillId: "asrt.no", kind: "challenge", performance: 0.85, comfort: 0.15, at: days(i + 1) }));
    }
    expect(state.mastery).toBeGreaterThan(0.5);
    expect(state.confidence).toBeLessThan(0.4);
    expect(confidenceGap(state)).toBeLessThan(-0.2);
  });

  it("raises difficulty tolerance on success and lowers it after clear failure", () => {
    let state = initialSkillState("u", "conv.follow-up", T0);
    const start = state.difficultyTolerance;
    state = applyEvidence(state, evidence({ performance: 0.9, difficulty: 3 }));
    expect(state.difficultyTolerance).toBeGreaterThan(start);

    const raised = state.difficultyTolerance;
    state = applyEvidence(state, evidence({ performance: 0.2, difficulty: 2, at: days(3) }));
    expect(state.difficultyTolerance).toBeLessThan(raised);
  });

  it("ignores zero-reliability observations entirely", () => {
    const base = initialSkillState("u", "conv.follow-up", T0);
    const after = applyEvidence(base, evidence({ reliability: 0 }));
    expect(after).toEqual(base);
  });

  it("treats a user correction as authoritative for a fortnight", () => {
    const base = initialSkillState("u", "conv.follow-up", T0);
    const corrected = applyUserCorrection(base, { mastery: 0.8, at: T0 });
    expect(corrected.mastery).toBe(0.8);
    expect(correctionIsFresh(corrected, days(5))).toBe(true);
    expect(correctionIsFresh(corrected, days(20))).toBe(false);
  });

  it("only asserts a band when the estimate is tight enough", () => {
    const fresh = initialSkillState("u", "conv.follow-up", T0);
    expect(stateIsConfident(fresh)).toBe(false);
    let state = fresh;
    for (let i = 0; i < 10; i += 1) state = applyEvidence(state, evidence({ at: days(i + 1) }));
    expect(stateIsConfident(state)).toBe(true);
  });

  it("discounts a skill whose prerequisites are missing", () => {
    const masteryOf = (id: string) => (id === "conv.follow-up" ? 0.8 : 0.05);
    // conv.follow-up requires open questions and active listening.
    expect(effectiveMastery("conv.follow-up", masteryOf)).toBeLessThan(0.8);
    expect(effectiveMastery("conv.follow-up", () => 0.8)).toBeCloseTo(0.8, 5);
  });

  it("keeps mastery inside [0,1] under extreme input", () => {
    let state = initialSkillState("u", "conv.follow-up", T0);
    for (let i = 0; i < 40; i += 1) state = applyEvidence(state, evidence({ performance: 1, difficulty: 5, at: days(i + 1) }));
    expect(state.mastery).toBeLessThanOrEqual(1);
    for (let i = 0; i < 40; i += 1) state = applyEvidence(state, evidence({ performance: 0, difficulty: 1, at: days(50 + i) }));
    expect(state.mastery).toBeGreaterThanOrEqual(0);
  });
});
