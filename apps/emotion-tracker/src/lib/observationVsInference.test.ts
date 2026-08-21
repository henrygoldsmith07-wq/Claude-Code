import { describe, it, expect } from "vitest";
import { tierStyle, TIER_LABEL, classifyTraceField, validateTierSeparation, tieredTrace } from "./observationVsInference";
import type { ReflectionSummary, StructuredTrace } from "./types";

function trace(over: Partial<StructuredTrace> = {}): StructuredTrace {
  return { event:"Manager gave feedback", observations:["Manager said needs more detail"], assumptions:["They think I'm incompetent"], namedEmotion:"shame", alternativeInterpretations:["Manager wanted faster handovers"], intendedOutcome:"Feel trusted", intendedAction:"Ask", predictedOutcome:"they will clarify", followUpAt:null, followUpNote:null, ...over };
}
function summary(): ReflectionSummary {
  return { trace: trace(), coreEmotion:"shame", underlyingTriggers:[], possibleBiases:[{type:"catastrophizing", description:"This interpretation may involve catastrophizing", evidenceFor:["a"], evidenceAgainst:["b"], confidence:0.7}], otherPerspective:"p", balancedAssessment:"b", cautionFlags:[], suggestedNextSteps:[], hedgedDisclaimer:"hedged" };
}

describe("observation vs inference", () => {
  it("tiers never render with equal certainty — distinct labels", () => {
    expect(TIER_LABEL.user_stated_fact).not.toBe(TIER_LABEL.hypothesis);
    expect(TIER_LABEL.direct_observation).not.toBe(TIER_LABEL.hypothesis);
    expect(TIER_LABEL.computed_pattern).not.toBe(TIER_LABEL.direct_observation);
  });
  it("tier styles differ", () => {
    expect(tierStyle("direct_observation")).not.toBe(tierStyle("hypothesis"));
    expect(tierStyle("user_stated_fact")).not.toBe(tierStyle("user_confirmed"));
  });
  it("classifyTraceField maps correctly", () => {
    expect(classifyTraceField("observations")).toBe("direct_observation");
    expect(classifyTraceField("assumptions")).toBe("hypothesis");
    expect(classifyTraceField("event")).toBe("user_stated_fact");
  });
  it("tieredTrace produces separation", () => {
    const items = tieredTrace(summary());
    expect(items.some(i=>i.tier==="direct_observation")).toBe(true);
    expect(items.some(i=>i.tier==="hypothesis")).toBe(true);
    expect(items.filter(i=>i.tier==="hypothesis").some(i=>i.confidence!=null)).toBe(true); // bias flag has confidence
  });
  it("validateTierSeparation flags hypothesis without confidence", () => {
    const errors = validateTierSeparation([{text:"maybe", tier:"hypothesis", confidence:null, evidenceFor:[], evidenceAgainst:[]}]);
    expect(errors.join(" ")).toMatch(/confidence/i);
  });
});
