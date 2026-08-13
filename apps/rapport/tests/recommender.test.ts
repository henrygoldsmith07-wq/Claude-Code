import { describe, expect, it } from "vitest";
import { nextDifficulty, recommend, selectDailyFocus, suggestedAssistLevel } from "@/domain/recommender";
import type { RecommendationInput } from "@/domain/recommender";
import { initialSkillState } from "@/domain/mastery";
import { SKILLS } from "@/domain/skills";
import { DEFAULT_PREFERENCE } from "@/data/repository";
import type { Goal, Preference, UserSkillState } from "@/domain/types";

const NOW = "2026-03-01T09:00:00.000Z";
const daysAgo = (n: number) => new Date(Date.parse(NOW) - n * 86_400_000).toISOString();

const preference: Preference = { ...DEFAULT_PREFERENCE, userId: "u", updatedAt: NOW };

function states(overrides: Partial<UserSkillState> & { skillId: string }[] | Record<string, Partial<UserSkillState>> = {}): UserSkillState[] {
  const patches = overrides as Record<string, Partial<UserSkillState>>;
  return SKILLS.map((skill) => ({ ...initialSkillState("u", skill.id, NOW), ...(patches[skill.id] ?? {}) }));
}

function input(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    states: states(),
    goals: [],
    preference,
    focusHistory: [],
    recentEvidence: [],
    now: NOW,
    ...overrides,
  };
}

const goal = (skillIds: string[]): Goal => ({
  id: "g1",
  userId: "u",
  statement: "Speak up more",
  skillIds,
  contexts: ["work"],
  createdAt: NOW,
});

describe("recommendation engine", () => {
  it("ranks goal-aligned skills above unrelated ones", () => {
    const result = recommend(input({ goals: [goal(["conf.groups"])] }), 8);
    const goalRank = result.findIndex((item) => item.skillId === "conf.groups");
    expect(goalRank).toBeGreaterThanOrEqual(0);
    expect(goalRank).toBeLessThan(4);
  });

  it("explains every recommendation in a sentence", () => {
    for (const item of recommend(input(), 5)) {
      expect(item.reason.length).toBeGreaterThan(15);
      expect(item.factors.length).toBeGreaterThan(5);
    }
  });

  it("exposes the factor breakdown so the choice can be audited", () => {
    const [top] = recommend(input({ goals: [goal(["asrt.no"])] }), 1);
    const keys = top?.factors.map((factor) => factor.key) ?? [];
    expect(keys).toContain("goalAlignment");
    expect(keys).toContain("prerequisite");
    expect(keys).toContain("fatigue");
    for (const factor of top?.factors ?? []) expect(factor.note.length).toBeGreaterThan(5);
  });

  it("routes to an unmet prerequisite rather than the blocked goal skill", () => {
    // Someone who wants conflict resolution but cannot yet disagree at all.
    const blocked = states({
      "asrt.disagree": { mastery: 0.1, confidence: 0.1 },
      "conf.opinions": { mastery: 0.1, confidence: 0.1 },
    });
    const result = recommend(input({ states: blocked, goals: [goal(["diff.conflict"])] }), 10);
    const ranked = result.map((item) => item.skillId);
    expect(ranked).toContain("asrt.disagree");
    expect(ranked.indexOf("asrt.disagree")).toBeLessThan(ranked.indexOf("diff.conflict"));
  });

  it("applies only mild prerequisite pressure when a prerequisite is nearly met", () => {
    // A shortfall of a few points is not a reason to redirect someone's week.
    const nearlyReady = states({ "asrt.disagree": { mastery: 0.43, confidence: 0.5 } });
    const [item] = recommend(input({ states: nearlyReady, goals: [goal(["diff.conflict"])] }), 60)
      .filter((entry) => entry.skillId === "asrt.disagree");
    const pressure = item?.factors.find((factor) => factor.key === "prerequisite")?.value ?? 1;
    expect(pressure).toBeLessThan(0.2);
  });

  it("de-prioritises a skill that has been the focus repeatedly this week", () => {
    const withoutFatigue = recommend(input({ goals: [goal(["conf.groups"])] }), 10);
    const withFatigue = recommend(
      input({
        goals: [goal(["conf.groups"])],
        focusHistory: [
          { skillId: "conf.groups", date: "2026-02-24" },
          { skillId: "conf.groups", date: "2026-02-26" },
          { skillId: "conf.groups", date: "2026-02-27" },
          { skillId: "conf.groups", date: "2026-02-28" },
        ],
      }),
      10,
    );
    const before = withoutFatigue.find((item) => item.skillId === "conf.groups")?.score ?? 0;
    const after = withFatigue.find((item) => item.skillId === "conf.groups")?.score ?? 0;
    expect(after).toBeLessThan(before);
  });

  it("surfaces skills that have gone stale", () => {
    const stale = states({
      "conv.follow-up": { attemptCount: 5, mastery: 0.6, lastPractisedAt: daysAgo(60), successEvidence: 3 },
    });
    const result = recommend(input({ states: stale }), 10);
    const item = result.find((entry) => entry.skillId === "conv.follow-up");
    const spacing = item?.factors.find((factor) => factor.key === "spacing");
    expect(spacing?.value ?? 0).toBeGreaterThan(0.4);
  });

  it("rewards a confidence gap — competent but uncomfortable is the trainable case", () => {
    const gapped = states({
      "asrt.no": { attemptCount: 6, mastery: 0.7, confidence: 0.35, lastPractisedAt: daysAgo(3) },
    });
    const [item] = recommend(input({ states: gapped }), 40).filter((entry) => entry.skillId === "asrt.no");
    const factor = item?.factors.find((entry) => entry.key === "confidenceGap");
    expect(factor?.value ?? 0).toBeGreaterThan(0.3);
  });

  it("defers to a fresh user correction that says a skill is fine", () => {
    const corrected = states({
      "conv.start": { mastery: 0.8, confidence: 0.8, userAssertedAt: daysAgo(2), attemptCount: 2 },
    });
    const withCorrection = recommend(input({ states: corrected, goals: [goal(["conv.start"])] }), 40)
      .find((item) => item.skillId === "conv.start")?.score ?? 0;
    const withoutCorrection = recommend(
      input({ states: states({ "conv.start": { mastery: 0.8, confidence: 0.8, attemptCount: 2 } }), goals: [goal(["conv.start"])] }),
      40,
    ).find((item) => item.skillId === "conv.start")?.score ?? 0;
    expect(withCorrection).toBeLessThan(withoutCorrection);
  });

  it("always returns a focus, even with a blank profile", () => {
    expect(selectDailyFocus(input())).not.toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    expect(recommend(input(), 5)).toEqual(recommend(input(), 5));
  });
});

describe("difficulty and assistance", () => {
  it("steps difficulty up after a good run and down after a bad one", () => {
    const base = { ...initialSkillState("u", "conv.start", NOW), difficultyTolerance: 3 };
    expect(nextDifficulty(base, [0.9, 0.85])).toBe(4);
    expect(nextDifficulty(base, [0.2, 0.3])).toBe(2);
    expect(nextDifficulty(base, [])).toBe(3);
  });

  it("never jumps more than one level", () => {
    const base = { ...initialSkillState("u", "conv.start", NOW), difficultyTolerance: 2 };
    expect(nextDifficulty(base, [1, 1, 1])).toBeLessThanOrEqual(3);
  });

  it("withdraws assistance as competence rises", () => {
    const state = initialSkillState("u", "conv.start", NOW);
    expect(suggestedAssistLevel({ ...state, attemptCount: 0 })).toBe("full");
    expect(suggestedAssistLevel({ ...state, attemptCount: 4, mastery: 0.45 })).toBe("partial");
    expect(suggestedAssistLevel({ ...state, attemptCount: 8, mastery: 0.65 })).toBe("minimal");
    expect(suggestedAssistLevel({ ...state, attemptCount: 12, mastery: 0.85 })).toBe("none");
  });
});
