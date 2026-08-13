import { describe, it, expect } from "vitest";
import { detectDiminishingReturns, diminishingReturnsInsight } from "../src/domain/diminishing-returns";
import type { SkillAttempt } from "../src/domain/diminishing-returns";

const at = (day: number) => new Date(Date.UTC(2026, 0, 1 + day, 10)).toISOString();

/** Improving history: each attempt betters the last. */
function improving(skillId: string, n: number, start = 0.3, step = 0.08): SkillAttempt[] {
  return Array.from({ length: n }, (_, i) => ({ skillId, at: at(i), performance: Math.min(0.98, start + step * i) }));
}

/** Plateaued history: rises then goes flat. */
function plateaued(skillId: string, n: number, start = 0.3, step = 0.08): SkillAttempt[] {
  const out: SkillAttempt[] = [];
  for (let i = 0; i < n; i++) out.push({ skillId, at: at(i), performance: Math.min(0.5, start + step * i) });
  return out;
}

/** Declining history: improvement stops and performance drifts down. */
function declining(skillId: string, n: number): SkillAttempt[] {
  return Array.from({ length: n }, (_, i) => ({ skillId, at: at(i), performance: Math.max(0.2, 0.6 - i * 0.01) }));
}

describe("detectDiminishingReturns", () => {
  it("does not flag a steadily improving skill", () => {
    const reports = detectDiminishingReturns(improving("conv.follow-up", 12));
    expect(reports.length).toBe(0);
  });

  it("flags a plateaued skill as saturated", () => {
    const reports = detectDiminishingReturns(plateaued("conv.balance", 10));
    expect(reports.some((r) => r.skillId === "conv.balance" && r.saturated)).toBe(true);
  });

  it("flags a declining skill and reports the negative slope", () => {
    const reports = detectDiminishingReturns(declining("conf.opinions", 10));
    const report = reports.find((r) => r.skillId === "conf.opinions");
    expect(report).toBeDefined();
    expect(report!.recentSlope).toBeLessThan(0);
    expect(report!.message).toContain("drifting back down");
  });

  it("ignores histories too short to judge", () => {
    expect(detectDiminishingReturns(improving("conv.start", 3))).toEqual([]);
  });

  it("separates a saturated skill from a healthy one in a mixed log", () => {
    const log = [...plateaued("conv.balance", 10), ...improving("nv.eye-contact", 10)];
    const reports = detectDiminishingReturns(log);
    expect(reports.map((r) => r.skillId)).toContain("conv.balance");
    expect(reports.map((r) => r.skillId)).not.toContain("nv.eye-contact");
  });
});

describe("diminishingReturnsInsight", () => {
  it("produces a hedged insight with the evidence attached", () => {
    const [report] = detectDiminishingReturns(plateaued("conv.balance", 10));
    expect(report).toBeDefined();
    const insight = diminishingReturnsInsight(report!, "user-1", "2026-06-01T00:00:00.000Z");
    expect(insight).not.toBeNull();
    expect(insight!.possibleExplanation).toContain("One explanation");
    expect(insight!.evidence.length).toBeGreaterThanOrEqual(2);
    expect(insight!.recommendedAction).toContain("real conversation");
  });
});
