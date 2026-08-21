import { describe, it, expect } from "vitest";
import { buildMemorySnapshot, retrieveRelevantContext, buildProviderContext } from "./memory";
import type { Entry, ReflectionSummary, StructuredTrace } from "./types";
import type { Correction } from "./corrections";

function trace(over: Partial<StructuredTrace> = {}): StructuredTrace {
  return { event:"Manager gave feedback", observations:["Manager said needs more detail"], assumptions:["They think I'm incompetent"], namedEmotion:"shame", alternativeInterpretations:["Manager wanted faster handovers"], intendedOutcome:"Feel trusted", intendedAction:"Ask", predictedOutcome:"p", followUpAt:null, followUpNote:null, ...over };
}
function summary(over: Partial<ReflectionSummary> = {}, t: Partial<StructuredTrace>={}): ReflectionSummary {
  return { trace: trace(t), coreEmotion:"shame", underlyingTriggers:["Critical feedback"], possibleBiases:[], otherPerspective:"p", balancedAssessment:"b", cautionFlags:[], suggestedNextSteps:[], hedgedDisclaimer:null, ...over };
}
function entry(id:string, createdAt:string, over: Partial<Entry>={}): Entry {
  return { id, createdAt, title:"T"+id, messages:[{role:"user", content:"hi"}], status:"complete", summary: summary(), ...over };
}

describe("memory architecture", () => {
  it("separates recentRaw, validatedFacts, corrections, patterns, summaries", () => {
    const es = [entry("a","2026-01-01T00:00:00.000Z", { longitudinalReview:{actualActionTaken:"asked", actualOutcome:"o", assumptionVerdict:"unsupported", calibrationNote:null, reviewedAt:"2026-01-02T00:00:00.000Z"}}), entry("b","2026-01-02T00:00:00.000Z")];
    const snap = buildMemorySnapshot(es, []);
    expect(snap.recentRaw.length).toBe(2);
    expect(snap.validatedFacts.length).toBeGreaterThan(0);
    expect(snap.summaries.length).toBe(2);
    expect(Array.isArray(snap.patterns)).toBe(true);
    expect(Array.isArray(snap.corrections)).toBe(true);
  });
  it("retrieveRelevantContext returns only relevant facts, not entire history", () => {
    const es = [
      entry("a","2026-01-01T00:00:00.000Z", { summary: summary({coreEmotion:"shame"}, {observations:["Manager said needs more detail"]})}),
      entry("b","2026-01-02T00:00:00.000Z", { summary: summary({coreEmotion:"joy"}, {observations:["Picnic was sunny"]})}),
    ];
    const ctx = retrieveRelevantContext(es, [], "manager feedback handover");
    expect(ctx.facts.join(" ").toLowerCase()).toContain("manager");
    // not returning all observations verbatim
    expect(ctx.facts.length).toBeLessThanOrEqual(6);
  });
  it("buildProviderContext caps entryHints to 5 and strips verbatim", () => {
    const many = Array.from({length:10}, (_,i)=>entry(`e${i}`,`2026-01-${String(i+1).padStart(2,"0")}T00:00:00.000Z`));
    const ctx = buildProviderContext(many, [], many[0].messages as { role: string; content: string }[], "shame");
    expect(ctx.entryHints.length).toBeLessThanOrEqual(5);
    for (const h of ctx.entryHints) {
      expect(h).toHaveProperty("id");
      expect(h).toHaveProperty("coreEmotion");
      expect(h).toHaveProperty("triggers");
      expect(h).not.toHaveProperty("event");
      expect(h).not.toHaveProperty("observations");
    }
  });
  it("avoids sending entire journal history — only relevant hints", () => {
    const es = Array.from({length:20}, (_,i)=>entry(`e${i}`,`2026-01-${String((i%28)+1).padStart(2,"0")}T00:00:00.000Z`, { summary: summary({}, {observations:[`observation ${i} unique token xyz${i}`]})}));
    const ctx = buildProviderContext(es, [], [], "unique token xyz5");
    // should include the matching entry among hints, not all 20
    expect(ctx.entryHints.some(h=>h.id==="e5")).toBe(true);
    expect(ctx.entryHints.length).toBeLessThan(20);
  });
  it("corrections are surfaced separately and not mixed with raw", () => {
    const corr: Correction = { key:"pattern:emotion:shame", kind:"pattern", rejectedAt:"2026-01-03T00:00:00.000Z", reason:"not helpful" };
    const snap = buildMemorySnapshot([entry("a","2026-01-01T00:00:00.000Z")], [corr]);
    expect(snap.corrections.length).toBe(1);
    expect(snap.recentRaw[0].id).toBe("a");
  });
});
