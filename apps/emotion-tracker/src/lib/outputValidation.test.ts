import { describe, it, expect } from "vitest";
import { validateProviderOutput } from "./outputValidation";
import type { ReflectionSummary } from "./types";

function summary(over: Partial<ReflectionSummary> = {}): ReflectionSummary {
  return {
    trace: {
      event:"Manager gave brief feedback in standup.",
      observations:["Manager said 'needs more detail in handover'"],
      assumptions:["They think I'm incompetent"],
      namedEmotion:"shame",
      alternativeInterpretations:["Manager wanted quicker handovers for the release"],
      intendedOutcome:"Feel competent and trusted",
      intendedAction:"Ask for one concrete example",
      predictedOutcome:"If I ask, they'll give an example.",
      followUpAt:"2026-01-20",
      followUpNote:null,
    },
    coreEmotion:"shame",
    underlyingTriggers:["Critical feedback"],
    possibleBiases:[
      { type:"catastrophizing", description:"This interpretation may involve catastrophizing; brief delay was read as permanent rejection.", evidenceFor:["User said 'it will ruin everything'"], evidenceAgainst:["No evidence delay is permanent"], confidence:0.7 }
    ],
    otherPerspective:"Manager may see this as routine coaching.",
    balancedAssessment:"Feedback was blunt but not personal.",
    cautionFlags:[],
    suggestedNextSteps:["Ask for an example"],
    hedgedDisclaimer:"These are tentative readings, not diagnoses; weigh them against the evidence listed.",
    ...over,
  };
}

describe("output validation", () => {
  it("accepts valid question", () => {
    expect(validateProviderOutput({question:"What was actually said?"}).outcome).toBe("accept");
  });
  it("rejects empty question with retry", () => {
    expect(validateProviderOutput({question:""}).outcome).toBe("retry");
  });
  it("rejects malformed response neither question nor summary", () => {
    expect(validateProviderOutput({foo:"bar"}).outcome).toBe("reject");
  });
  it("rejects missing observations", () => {
    const r = validateProviderOutput({ ...summary(), trace: { ...summary().trace, observations:[] } });
    expect(r.outcome).toBe("retry");
    expect(r.errors.join(" ")).toMatch(/observations/i);
  });
  it("rejects missing alternative interpretations", () => {
    const r = validateProviderOutput({ ...summary(), trace: { ...summary().trace, alternativeInterpretations:[] } });
    expect(r.errors.join(" ")).toMatch(/alternative/i);
  });
  it("rejects unsupported certainty", () => {
    const r = validateProviderOutput({ ...summary(), balancedAssessment:"You have catastrophizing bias and need treatment" });
    expect(r.outcome).toBe("reject");
    expect(r.errors.join(" ")).toMatch(/false certainty/i);
  });
  it("rejects contradictory output (assumption duplicates observation)", () => {
    const s = summary();
    const r = validateProviderOutput({ ...s, trace: { ...s.trace, assumptions:["Manager said 'needs more detail in handover'"] } });
    expect(r.errors.join(" ")).toMatch(/duplicates observation/i);
  });
  it("rejects missing evidenceFor in bias", () => {
    const s = summary();
    const r = validateProviderOutput({ ...s, possibleBiases:[{ type:"catastrophizing", description:"This interpretation may involve catastrophizing", evidenceFor:[], evidenceAgainst:["x"], confidence:0.7 }]});
    expect(r.errors.join(" ")).toMatch(/evidenceFor/i);
  });
  it("rejects malformed confidence", () => {
    const s = summary();
    const r = validateProviderOutput({ ...s, possibleBiases:[{ type:"catastrophizing", description:"This interpretation may involve catastrophizing", evidenceFor:["a"], evidenceAgainst:["b"], confidence: 2 } as unknown as ReflectionSummary["possibleBiases"][number] ]});
    expect(r.errors.join(" ")).toMatch(/confidence/i);
  });
  it("accepts valid hedged summary", () => {
    expect(validateProviderOutput(summary()).outcome).toBe("accept");
  });
});
