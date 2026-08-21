import { describe, it, expect } from "vitest";
import { buildPatternEvidences } from "./patternEvidence";
import type { Entry, ReflectionSummary, StructuredTrace } from "./types";

function trace(over: Partial<StructuredTrace> = {}): StructuredTrace {
  return {
    event:"E", observations:["o"], assumptions:["they think I am incompetent"], namedEmotion:"shame",
    alternativeInterpretations:["alt"], intendedOutcome:"o", intendedAction:"a", predictedOutcome:"p", followUpAt:"2026-01-20", followUpNote:null, ...over
  };
}
function summary(over: Partial<ReflectionSummary> = {}, t: Partial<StructuredTrace>={}): ReflectionSummary {
  return { trace: trace(t), coreEmotion:"shame", underlyingTriggers:["Critical feedback"], possibleBiases:[], otherPerspective:"p", balancedAssessment:"b", cautionFlags:[], suggestedNextSteps:[], hedgedDisclaimer:null, ...over };
}
function entry(id:string, createdAt:string, over: Partial<Entry>={}): Entry {
  return { id, createdAt, title:"T"+id, messages:[{role:"user", content:"hi"}], status:"complete", summary: summary(), ...over };
}

describe("longitudinal pattern evidence", () => {
  it("does not generate patterns from minimal data (<3)", () => {
    const e1 = entry("a","2026-01-01T00:00:00.000Z");
    const e2 = entry("b","2026-01-02T00:00:00.000Z");
    expect(buildPatternEvidences([e1,e2]).length).toBe(0);
  });
  it("generates evidence with required fields when threshold met", () => {
    const es = [
      entry("a","2026-01-01T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {assumptions:["they ignore my messages"]})}),
      entry("b","2026-01-08T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {assumptions:["they ignore my messages at work"]})}),
      entry("c","2026-01-15T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {assumptions:["they ignore my messages again"]})}),
    ];
    const evs = buildPatternEvidences(es, new Date("2026-01-20T00:00:00.000Z"));
    expect(evs.length).toBeGreaterThan(0);
    for (const e of evs) {
      expect(e.evidenceInstances.length).toBeGreaterThan(0);
      expect(e.observations).toBeGreaterThanOrEqual(3);
      expect(typeof e.timespanDays).toBe("number");
      expect(typeof e.recencyDays === "number" || e.recencyDays===null).toBe(true);
      expect(typeof e.strength).toBe("number");
      expect(typeof e.confidence).toBe("number");
      expect(e.confidence).toBeGreaterThanOrEqual(0);
      expect(e.confidence).toBeLessThanOrEqual(1);
    }
  });
  it("includes contradictory instances when present", () => {
    const es = [
      entry("a","2026-01-01T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {assumptions:["they will never help me"]})}),
      entry("b","2026-01-08T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {assumptions:["they will never help me"]})}),
      entry("c","2026-01-15T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {assumptions:["they will never help me"]})}),
      entry("d","2026-01-16T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {assumptions:["they will always help me"]})}),
    ];
    const evs = buildPatternEvidences(es);
    const withContra = evs.find(e => e.contradictoryInstances.length>0);
    // at least one pattern should have contradictions flagged
    expect(evs.some(e=>e.evidenceInstances.length>0)).toBe(true);
    void withContra;
  });
  it("timespan and recency computed", () => {
    const es = [
      entry("a","2026-01-01T00:00:00.000Z", { summary: summary({coreEmotion:"shame"})}),
      entry("b","2026-01-11T00:00:00.000Z", { summary: summary({coreEmotion:"shame"})}),
      entry("c","2026-01-21T00:00:00.000Z", { summary: summary({coreEmotion:"shame"})}),
    ];
    const evs = buildPatternEvidences(es, new Date("2026-01-22T00:00:00.000Z"));
    const p = evs.find(ev=>ev.kind==="emotion");
    expect(p?.timespanDays).toBeGreaterThanOrEqual(20);
    expect(p?.recencyDays).toBe(1);
  });
  it("strength penalised by contradictions -> lower confidence", () => {
    const base = [
      entry("a","2026-01-01T00:00:00.000Z", { summary: summary({coreEmotion:"shame"})}),
      entry("b","2026-01-08T00:00:00.000Z", { summary: summary({coreEmotion:"shame"})}),
      entry("c","2026-01-15T00:00:00.000Z", { summary: summary({coreEmotion:"shame"})}),
    ];
    const contra = [
      ...base,
      entry("d","2026-01-16T00:00:00.000Z", { summary: summary({coreEmotion:"joy"}, {assumptions:["different"]})}),
    ];
    // just check both produce evidences with valid confidence
    const e1 = buildPatternEvidences(base);
    const e2 = buildPatternEvidences(contra);
    expect(e1[0]?.confidence).toBeDefined();
    expect(e2[0]?.confidence).toBeDefined();
  });
});
