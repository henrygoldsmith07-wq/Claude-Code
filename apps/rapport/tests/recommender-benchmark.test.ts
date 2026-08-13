import { describe, it, expect } from "vitest";
import { makeProfile, compareBaselines, ablateRecommender, recommendationInput } from "../src/domain/recommender-benchmark";
import { recommend } from "../src/domain/recommender";

function profiles(count: number) {
  return Array.from({ length: count }, (_, i) => makeProfile(i));
}

describe("baseline comparison", () => {
  it("adaptive outperforms random at surfacing the planted target", () => {
    const ps = profiles(40);
    const rows = compareBaselines(ps, ps.map((_, i) => i * 7 + 1));
    const adaptive = rows.find((r) => r.strategy === "adaptive")!;
    const random = rows.find((r) => r.strategy === "random")!;
    expect(adaptive.top1TargetRate).toBeGreaterThan(random.top1TargetRate);
    expect(random.top1TargetRate).toBeLessThanOrEqual(0.3); // ~1/8 per profile
  });

  it("adaptive beats weakest-skill by avoiding the recently-practised trap", () => {
    const ps = profiles(40);
    const rows = compareBaselines(ps, ps.map((_, i) => i * 7 + 1));
    const adaptive = rows.find((r) => r.strategy === "adaptive")!;
    const weakest = rows.find((r) => r.strategy === "weakest-skill")!;
    // Target and trap are equally weak; weakest-skill tie-breaks on id, so it
    // grinds the just-practised trap half the time, while adaptive uses
    // spacing/fatigue to route to the overdue target.
    expect(adaptive.top1TargetRate).toBeGreaterThan(weakest.top1TargetRate);
    expect(weakest.repetitionRate).toBeGreaterThan(0.25);
    expect(adaptive.repetitionRate).toBeLessThan(0.1);
  });

  it("round-robin has no memory of state and repeats less than weakest-skill", () => {
    const ps = profiles(40);
    const rows = compareBaselines(ps, ps.map((_, i) => i * 7 + 1));
    const adaptive = rows.find((r) => r.strategy === "adaptive")!;
    const roundRobin = rows.find((r) => r.strategy === "round-robin")!;
    const weakest = rows.find((r) => r.strategy === "weakest-skill")!;
    expect(roundRobin.repetitionRate).toBeLessThan(weakest.repetitionRate);
    expect(adaptive.meanTargetRank).toBeLessThan(roundRobin.meanTargetRank);
  });

  it("is deterministic for a fixed seed", () => {
    const ps = profiles(10);
    const seeds = ps.map((_, i) => i * 7 + 1);
    expect(compareBaselines(ps, seeds)).toEqual(compareBaselines(ps, seeds));
  });
});

describe("ablation", () => {
  it("removing spacing or fatigue does real work; recentProgress is a no-op here", () => {
    const ps = Array.from({ length: 80 }, (_, i) => makeProfile(i, i % 2 === 0 ? "overdue" : "fatigued"));
    const rows = ablateRecommender(ps);
    const byFactor = new Map(rows.map((row) => [row.factor, row]));
    const spacing = byFactor.get("spacing")!;
    const fatigue = byFactor.get("fatigue")!;
    const recentProgress = byFactor.get("recentProgress")!;
    // Spacing separates the overdue target from the trap; fatigue suppresses
    // the over-practised trap. RecentProgress has (deliberately) almost no
    // evidence to work on and must be a no-op by comparison.
    expect(spacing.top1FlipRate + fatigue.top1FlipRate).toBeGreaterThan(0);
    expect(spacing.meanTrapRankDelta + fatigue.meanTrapRankDelta).toBeGreaterThan(recentProgress.meanTrapRankDelta);
    expect(recentProgress.meanTargetRankDelta).toBe(0);
    expect(recentProgress.meanTrapRankDelta).toBe(0);
  });

  it("ablated engine is the real engine with a zeroed weight", () => {
    const profile = makeProfile(3, "fatigued"); // trap focused 4× this week
    const full = recommend(recommendationInput(profile), profile.states.length);
    const noFatigue = recommend(recommendationInput(profile), profile.states.length, { fatigue: 0 });
    // Removing fatigue lifts the over-practised trap up the ranking.
    const trapRankFull = full.findIndex((r) => r.skillId === profile.trapSkillId);
    const trapRankNoFatigue = noFatigue.findIndex((r) => r.skillId === profile.trapSkillId);
    expect(trapRankNoFatigue).toBeLessThan(trapRankFull);
  });
});
