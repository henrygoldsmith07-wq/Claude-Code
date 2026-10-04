import { describe, expect, it } from "vitest";
import {
  ageBehaviourStates,
  applyBehaviourEvidence,
  behaviourConfidenceGap,
  behaviourHalfLifeDays,
  decayBehaviourState,
  initialBehaviourState,
  rankBehavioursByExpectedGain,
} from "@/domain/behaviour-state";
import type { BehaviourEvidence, UserBehaviourState } from "@/domain/behaviour-state";
import { BEHAVIOUR_KEYS } from "@/domain/types";

const NOW = "2026-03-20T09:00:00.000Z";
const at = (daysAgo: number) => new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();
const USER = "u1";

function state(behaviour: UserBehaviourState["behaviour"] = "floorEntry"): UserBehaviourState {
  return initialBehaviourState(USER, behaviour, at(10));
}

function ev(over: Partial<BehaviourEvidence> = {}): BehaviourEvidence {
  return {
    behaviour: "floorEntry",
    performance: 0.7,
    difficulty: 3,
    kind: "simulation",
    reliability: 0.8,
    at: at(1),
    ...over,
  };
}

describe("behaviour state: initial", () => {
  it("starts every behaviour from the same neutral prior", () => {
    // No behaviour has an intrinsic difficulty, so unlike skills (which are
    // seeded by baseDifficulty) all behaviours start equal.
    const a = state("empathy");
    const b = state("clarity");
    expect(a.mastery).toBe(b.mastery);
    expect(a.mastery).toBeCloseTo(0.5, 5);
    expect(a.masteryUncertainty).toBe(b.masteryUncertainty);
  });

  it("has no evidence or last-observed time before anything is observed", () => {
    const s = state();
    expect(s.observationCount).toBe(0);
    expect(s.successEvidence).toBe(0);
    expect(s.lastObservedAt).toBeUndefined();
  });
});

describe("behaviour state: applying evidence", () => {
  it("moves mastery up on a good performance", () => {
    const next = applyBehaviourEvidence(state(), ev({ performance: 0.9 }));
    expect(next.mastery).toBeGreaterThan(0.5);
    expect(next.observationCount).toBe(1);
    expect(next.lastObservedAt).toBe(at(1));
  });

  it("moves mastery down on a poor performance", () => {
    const next = applyBehaviourEvidence(state(), ev({ performance: 0.1 }));
    expect(next.mastery).toBeLessThan(0.5);
  });

  it("shrinks uncertainty with each consistent observation", () => {
    let s = state();
    const first = applyBehaviourEvidence(s, ev({ performance: 0.5 }));
    expect(first.masteryUncertainty).toBeLessThan(s.masteryUncertainty);
    s = first;
    const second = applyBehaviourEvidence(s, ev({ performance: 0.5, at: at(0) }));
    expect(second.masteryUncertainty).toBeLessThan(first.masteryUncertainty);
  });

  it("never collapses uncertainty below the floor", () => {
    let s = state();
    for (let i = 0; i < 200; i += 1) {
      s = applyBehaviourEvidence(s, ev({ performance: 0.9, at: at(i) }));
    }
    expect(s.masteryUncertainty).toBeGreaterThan(0.05);
    expect(s.masteryUncertainty).toBeGreaterThanOrEqual(0.06);
  });

  it("counts success evidence and rewards a challenge double", () => {
    const sim = applyBehaviourEvidence(state(), ev({ kind: "simulation", performance: 0.9 }));
    const chal = applyBehaviourEvidence(state(), ev({ kind: "challenge", performance: 0.9 }));
    expect(chal.successEvidence).toBeGreaterThan(sim.successEvidence);
  });

  it("ratchets difficulty tolerance up on success at or above it", () => {
    const s = state();
    const held = applyBehaviourEvidence(s, ev({ performance: 0.9, difficulty: 4 }));
    expect(held.difficultyTolerance).toBeGreaterThan(s.difficultyTolerance);
  });

  it("ratchets difficulty tolerance down on clear failure below it", () => {
    const s = { ...state(), difficultyTolerance: 4 };
    const failed = applyBehaviourEvidence(s, ev({ performance: 0.1, difficulty: 3 }));
    expect(failed.difficultyTolerance).toBeLessThan(s.difficultyTolerance);
  });

  it("ignores a comfort-only observation for competence but moves comfort", () => {
    const before = state();
    const after = applyBehaviourEvidence(
      before,
      ev({ comfortOnly: true, performance: 0, difficulty: 5, comfort: 0.9 }),
    );
    expect(after.mastery).toBe(before.mastery);
    expect(after.successEvidence).toBe(before.successEvidence);
    expect(after.difficultyTolerance).toBe(before.difficultyTolerance);
    expect(after.observationCount).toBe(before.observationCount);
    expect(after.confidence).toBeGreaterThan(before.confidence);
  });

  it("is a no-op when reliability is zero", () => {
    const before = state();
    const after = applyBehaviourEvidence(before, ev({ reliability: 0 }));
    expect(after).toBe(before);
  });

  it("treats comfort separately from competence (confidence moves slower)", () => {
    const s = state();
    const withComfort = applyBehaviourEvidence(s, ev({ performance: 0.9, comfort: 0.9 }));
    const withoutComfort = applyBehaviourEvidence(s, ev({ performance: 0.9 }));
    // Both improve competence, but the self-reported comfort path tracks the
    // reported number rather than the performance-derived one.
    expect(withComfort.mastery).toBeCloseTo(withoutComfort.mastery, 5);
    expect(withComfort.confidence).not.toBeCloseTo(withoutComfort.confidence, 3);
  });
});

describe("behaviour state: decay", () => {
  it("leaves an unobserved state untouched", () => {
    const s = state();
    expect(decayBehaviourState(s, NOW)).toBe(s);
  });

  it("reduces retention and regrows uncertainty with time", () => {
    const observed = applyBehaviourEvidence(state(), ev({ performance: 0.6, at: at(3) }));
    const later = decayBehaviourState(observed, NOW);
    expect(later.retentionEstimate).toBeLessThan(1);
    expect(later.masteryUncertainty).toBeGreaterThan(observed.masteryUncertainty);
    // Mastery itself is not what decays.
    expect(later.mastery).toBe(observed.mastery);
  });

  it("gives corroborated behaviours a longer half-life", () => {
    const weak = state();
    const strong = { ...weak, successEvidence: 5, mastery: 0.8 };
    expect(behaviourHalfLifeDays(strong)).toBeGreaterThan(behaviourHalfLifeDays(weak));
  });

  it("ages a whole set to now in one call", () => {
    const observed = applyBehaviourEvidence(state(), ev({ performance: 0.6, at: at(3) }));
    const aged = ageBehaviourStates([observed], NOW);
    expect(aged[0].retentionEstimate).toBeLessThan(1);
  });
});

describe("behaviour state: confidence gap", () => {
  it("is positive when more confident than competent", () => {
    const s: UserBehaviourState = { ...state(), confidence: 0.8, mastery: 0.4 };
    expect(behaviourConfidenceGap(s)).toBeCloseTo(0.4, 5);
  });

  it("is negative when better than they feel (the common case)", () => {
    const s: UserBehaviourState = { ...state(), confidence: 0.3, mastery: 0.7 };
    expect(behaviourConfidenceGap(s)).toBeCloseTo(-0.4, 5);
  });
});

describe("ranking behaviours by expected gain", () => {
  function observed(
    behaviour: UserBehaviourState["behaviour"],
    performance: number,
    obs: number,
  ): UserBehaviourState {
    let s = initialBehaviourState(USER, behaviour, at(30));
    for (let i = 0; i < obs; i += 1) {
      s = applyBehaviourEvidence(s, {
        behaviour,
        performance,
        difficulty: 3,
        kind: "simulation",
        reliability: 0.8,
        at: at(20 - i),
      });
    }
    return s;
  }

  it("excludes behaviours never observed", () => {
    const ranked = rankBehavioursByExpectedGain([observed("floorEntry", 0.3, 3)], NOW);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].behaviour).toBe("floorEntry");
  });

  it("ranks a weak, fading, under-observed behaviour above a strong one", () => {
    const weak = observed("floorEntry", 0.15, 2);
    const strong = observed("clarity", 0.95, 6);
    const ranked = rankBehavioursByExpectedGain([weak, strong], NOW);
    expect(ranked[0].behaviour).toBe("floorEntry");
    expect(ranked[0].expectedGain).toBeGreaterThan(ranked[1].expectedGain);
  });

  it("returns expectedGain in 0..1 and a plain-language reason", () => {
    const ranked = rankBehavioursByExpectedGain([observed("assertiveness", 0.2, 2)], NOW);
    const top = ranked[0];
    expect(top.expectedGain).toBeGreaterThanOrEqual(0);
    expect(top.expectedGain).toBeLessThanOrEqual(1);
    expect(top.reason).toMatch(/next because/i);
  });

  it("raises gain for a thin-evidence behaviour over a well-measured one of equal weakness", () => {
    const thin = observed("empathy", 0.2, 1);
    const wellMeasured = observed("reciprocity", 0.2, 6);
    const ranked = rankBehavioursByExpectedGain([thin, wellMeasured], NOW);
    expect(ranked[0].behaviour).toBe("empathy");
  });

  it("gives every behaviour key a valid initial state", () => {
    const all = BEHAVIOUR_KEYS.map((b) => initialBehaviourState(USER, b, NOW));
    expect(all).toHaveLength(BEHAVIOUR_KEYS.length);
    for (const s of all) {
      expect(s.mastery).toBeGreaterThanOrEqual(0);
      expect(s.mastery).toBeLessThanOrEqual(1);
      expect(BEHAVIOUR_KEYS).toContain(s.behaviour);
    }
  });
});