import { describe, it, expect } from "vitest";
import { buildOutcomeMetrics, patternStability, CLINICAL_DISCLAIMER } from "./outcomeEvidence";
import type { Entry, ReflectionSummary, StructuredTrace } from "./types";

function trace(over: Partial<StructuredTrace> = {}): StructuredTrace {
  return { event:"E", observations:["o"], assumptions:["they think I am incompetent"], namedEmotion:"shame", alternativeInterpretations:["alt"], intendedOutcome:"o", intendedAction:"a", predictedOutcome:"p", followUpAt:null, followUpNote:null, ...over };
}
function summary(over: Partial<ReflectionSummary> = {}, t: Partial<StructuredTrace>={}): ReflectionSummary {
  return { trace: trace(t), coreEmotion:"shame", underlyingTriggers:["Critical feedback"], possibleBiases:[], otherPerspective:"p", balancedAssessment:"b", cautionFlags:[], suggestedNextSteps:["Ask"], hedgedDisclaimer:null, ...over };
}
function entry(id:string, createdAt:string, over: Partial<Entry>={}): Entry {
  return { id, createdAt, title:"T"+id, messages:[{role:"user", content:"hi"}], status:"complete", summary: summary(), ...over };
}

describe("outcome evidence", () => {
  it("measures supportedRate without claiming benefit", () => {
    const es = [
      entry("a","2026-01-01T00:00:00.000Z", { longitudinalReview:{actualActionTaken:"asked", actualOutcome:"o", assumptionVerdict:"supported", calibrationNote:null, reviewedAt:"2026-01-02T00:00:00.000Z"}}),
      entry("b","2026-01-02T00:00:00.000Z", { longitudinalReview:{actualActionTaken:"asked", actualOutcome:"o", assumptionVerdict:"unsupported", calibrationNote:null, reviewedAt:"2026-01-03T00:00:00.000Z"}}),
    ];
    const m = buildOutcomeMetrics(es, []);
    expect(m.reviewed).toBe(2);
    expect(m.supportedRate).toBe(0.5);
    expect(m.note).toBeTruthy();
    expect(CLINICAL_DISCLAIMER).toMatch(/not a diagnosis/i);
  });
  it("patternStability needs 6+ reflections", () => {
    const few = [entry("a","2026-01-01T00:00:00.000Z"), entry("b","2026-01-02T00:00:00.000Z")];
    expect(patternStability(few)).toBeNull();
  });
  it("patternStability computed across halves", () => {
    const es = Array.from({length:6}, (_,i)=> entry(`e${i}`,`2026-01-${String(i+1).padStart(2,"0")}T00:00:00.000Z`, { summary: summary({coreEmotion:"shame"})}));
    const s = patternStability(es);
    expect(s).not.toBeNull();
    expect(s!).toBeGreaterThanOrEqual(0);
    expect(s!).toBeLessThanOrEqual(1);
  });
  it("rejectedRate reflects corrections", () => {
    const es = [
      entry("a","2026-01-01T00:00:00.000Z",{ summary: summary({coreEmotion:"shame"})}),
      entry("b","2026-01-08T00:00:00.000Z",{ summary: summary({coreEmotion:"shame"})}),
      entry("c","2026-01-15T00:00:00.000Z",{ summary: summary({coreEmotion:"shame"})}),
    ];
    const corr = [{key:"pattern:emotion:shame", kind:"pattern" as const, rejectedAt:"2026-01-16T00:00:00.000Z"}];
    const m = buildOutcomeMetrics(es, corr);
    expect(m.rejectedRate).not.toBeNull();
  });
  it("does not claim clinical benefit", () => {
    const m = buildOutcomeMetrics([entry("a","2026-01-01T00:00:00.000Z")]);
    expect(m.note.toLowerCase()).not.toMatch(/clinical benefit|therapy|treatment effective/);
    expect(CLINICAL_DISCLAIMER.toLowerCase()).toContain("not a diagnosis");
  });
});
