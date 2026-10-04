import { describe, expect, it } from "vitest";
import { recomputeBehaviourStates, recomputeStates } from "@/domain/events";
import type { DomainEvent } from "@/domain/events";

const NOW = "2026-03-20T09:00:00.000Z";
const at = (daysAgo: number) => new Date(Date.parse(NOW) - daysAgo * 86_400_000).toISOString();
const USER = "u1";

/**
 * Decay-to-now (R4).
 *
 * The fold applies each observation at its own timestamp, which is right for
 * building the estimate but left retention frozen at the last event's time. These
 * tests pin that both projections now age to `now`, so a lapsed user's retention
 * reflects the gap since their last practice — the signal an independence model
 * needs, and the number that would otherwise read stale and flattering.
 */

describe("decay-to-now: skill projection", () => {
  it("ages retention to now rather than freezing it at the last event", () => {
    // The stub skill graph exposes one skill (conv.follow-up) via SKILLS; the
    // fold must return a state whose retention reflects the 40-day gap.
    const events: DomainEvent[] = [
      {
        kind: "challenge-attempted",
        at: at(40),
        attemptId: "a1",
        skillId: "conv.follow-up",
        outcome: "yes",
        difficulty: 3,
        performance: 0.8,
        reliability: 0.9,
      },
    ];
    const states = recomputeStates(USER, events, NOW);
    const skill = states.find((s) => s.skillId === "conv.follow-up");
    expect(skill).toBeDefined();
    // lastPractisedAt is 40 days ago, so retention must be well below 1 by now.
    expect(skill!.retentionEstimate).toBeLessThan(1);
  });

  it("does not change mastery through decay (only retention/uncertainty age)", () => {
    const events: DomainEvent[] = [
      {
        kind: "challenge-attempted",
        at: at(40),
        attemptId: "a1",
        skillId: "conv.follow-up",
        outcome: "yes",
        difficulty: 3,
        performance: 0.8,
        reliability: 0.9,
      },
    ];
    const aged = recomputeStates(USER, events, NOW);
    const fresh = recomputeStates(USER, events, at(40));
    const a = aged.find((s) => s.skillId === "conv.follow-up")!;
    const f = fresh.find((s) => s.skillId === "conv.follow-up")!;
    // Mastery (what they can do) is stable; retention (would they do it today) is not.
    expect(a.mastery).toBeCloseTo(f.mastery, 5);
    expect(a.retentionEstimate).toBeLessThan(f.retentionEstimate);
  });
});

describe("decay-to-now: behaviour projection", () => {
  it("ages every observed behaviour to now", () => {
    const events: DomainEvent[] = [
      {
        kind: "simulation-evaluated",
        at: at(40),
        simulationId: "sim-1",
        skillIds: ["conv.follow-up"],
        performance: 0.6,
        difficulty: 3,
        reliability: 0.8,
        behaviours: [
          { key: "followUpQuality", score: 0.4 },
          { key: "empathy", score: 0.7 },
        ],
      },
    ];
    const states = recomputeBehaviourStates(USER, events, NOW);
    const followUp = states.find((s) => s.behaviour === "followUpQuality");
    expect(followUp).toBeDefined();
    expect(followUp!.lastObservedAt).toBe(at(40));
    expect(followUp!.retentionEstimate).toBeLessThan(1);
  });

  it("leaves never-observed behaviours without a fabricated retention", () => {
    const events: DomainEvent[] = [
      {
        kind: "simulation-evaluated",
        at: at(2),
        simulationId: "sim-1",
        skillIds: ["conv.follow-up"],
        performance: 0.6,
        difficulty: 3,
        reliability: 0.8,
        behaviours: [{ key: "followUpQuality", score: 0.4 }],
      },
    ];
    const states = recomputeBehaviourStates(USER, events, NOW);
    const empathy = states.find((s) => s.behaviour === "empathy");
    expect(empathy).toBeDefined();
    expect(empathy!.observationCount).toBe(0);
    expect(empathy!.lastObservedAt).toBeUndefined();
  });

  it("is pure — the same log and now always produce the same projection", () => {
    const events: DomainEvent[] = [
      {
        kind: "simulation-evaluated",
        at: at(5),
        simulationId: "sim-1",
        skillIds: ["conv.follow-up"],
        performance: 0.6,
        difficulty: 3,
        reliability: 0.8,
        behaviours: [{ key: "clarity", score: 0.5 }],
      },
    ];
    const a = recomputeBehaviourStates(USER, events, NOW);
    const b = recomputeBehaviourStates(USER, events, NOW);
    expect(a).toEqual(b);
  });
});