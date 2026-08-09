import { describe, it, expect } from "vitest";
import { containsFalseCertainty, isHedgedDescription, validateBiasFlag, validateTrace, validateSummary } from "./validation";
import type { BiasFlag, ReflectionSummary, StructuredTrace } from "./types";

function hedgedBias(overrides: Partial<BiasFlag> = {}): BiasFlag {
  return {
    type: "catastrophizing",
    description: "This interpretation may involve catastrophizing; the short delay was read as permanent rejection.",
    evidenceFor: ["User said 'it will ruin everything'"],
    evidenceAgainst: ["No evidence the delay is permanent"],
    confidence: 0.7,
    ...overrides,
  };
}

function validTrace(overrides: Partial<StructuredTrace> = {}): StructuredTrace {
  return {
    event: "Manager gave brief critical feedback in standup.",
    observations: ["Manager said 'needs more detail in handover'"],
    assumptions: ["They think I'm incompetent"],
    namedEmotion: "shame",
    alternativeInterpretations: ["Manager wanted quicker handovers for the release, not a judgment on ability"],
    intendedOutcome: "Feel competent and trusted in handovers",
    intendedAction: "Ask manager for one concrete example of good handover",
    followUpAt: "2026-01-20",
    followUpNote: null,
    ...overrides,
  };
}

function validSummary(overrides: Partial<ReflectionSummary> = {}): ReflectionSummary {
  return {
    trace: validTrace(),
    coreEmotion: "shame",
    underlyingTriggers: ["Critical feedback in front of peers"],
    possibleBiases: [hedgedBias()],
    otherPerspective: "Manager may see this as routine coaching.",
    balancedAssessment: "Feedback was blunt but not personal.",
    cautionFlags: [],
    suggestedNextSteps: ["Ask for an example"],
    hedgedDisclaimer: "These are tentative readings, not diagnoses; weigh them against the evidence listed.",
    ...overrides,
  };
}

describe("containsFalseCertainty", () => {
  it("flags 'you have X bias' constructions", () => {
    expect(containsFalseCertainty("You have catastrophizing bias")).toBe(true);
    expect(containsFalseCertainty("You are suffering from anxiety")).toBe(true);
    expect(containsFalseCertainty("Diagnosis: catastrophizing")).toBe(true);
  });

  it("does not flag hedged phrasing", () => {
    expect(containsFalseCertainty("This interpretation may involve catastrophizing")).toBe(false);
    expect(containsFalseCertainty("This reading could involve mind-reading")).toBe(false);
  });
});

describe("isHedgedDescription", () => {
  it("requires a hedge and no false certainty", () => {
    expect(isHedgedDescription("This interpretation may involve catastrophizing.")).toBe(true);
    expect(isHedgedDescription("You have catastrophizing bias.")).toBe(false);
    expect(isHedgedDescription("This is catastrophizing.")).toBe(false); // no hedge word
  });
});

describe("validateBiasFlag", () => {
  it("passes a hedged flag", () => {
    expect(validateBiasFlag(hedgedBias())).toEqual([]);
  });

  it("fails false-certainty description", () => {
    const errs = validateBiasFlag(hedgedBias({ description: "You have catastrophizing bias." }));
    expect(errs.join(" ")).toMatch(/false certainty/i);
  });

  it("fails unhedged description", () => {
    const errs = validateBiasFlag(hedgedBias({ description: "This is catastrophizing." }));
    expect(errs.join(" ")).toMatch(/hedged/i);
  });

  it("fails low confidence without omission", () => {
    const errs = validateBiasFlag(hedgedBias({ confidence: 0.2 }));
    expect(errs.join(" ")).toMatch(/omit/i);
  });

  it("requires evidence arrays", () => {
    const b = hedgedBias({ evidenceFor: null as unknown as string[], evidenceAgainst: [] });
    expect(validateBiasFlag(b).join(" ")).toMatch(/evidenceFor/i);
  });
});

describe("validateTrace", () => {
  it("passes a valid trace", () => {
    expect(validateTrace(validTrace())).toEqual([]);
  });

  it("requires event, observations, alternatives, outcome, action", () => {
    const errs = validateTrace(
      validTrace({ event: "", observations: [], alternativeInterpretations: [], intendedOutcome: "", intendedAction: "" }),
    );
    expect(errs.length).toBeGreaterThan(3);
  });

  it("flags mind-reading in observations", () => {
    const errs = validateTrace(validTrace({ observations: ["they think I'm lazy"] }));
    expect(errs.join(" ")).toMatch(/mind-reading|observations/i);
  });
});

describe("validateSummary", () => {
  it("passes a valid summary", () => {
    expect(validateSummary(validSummary())).toEqual([]);
  });

  it("requires hedgedDisclaimer when biases present", () => {
    const errs = validateSummary(validSummary({ hedgedDisclaimer: null }));
    expect(errs.join(" ")).toMatch(/hedgedDisclaimer/i);
  });

  it("allows empty biases without disclaimer", () => {
    expect(validateSummary(validSummary({ possibleBiases: [], hedgedDisclaimer: null })).length).toBe(0);
  });

  it("propagates bias and trace errors", () => {
    const s = validSummary({
      trace: validTrace({ event: "" }),
      possibleBiases: [hedgedBias({ description: "You have catastrophizing bias." })],
    });
    expect(validateSummary(s).length).toBeGreaterThan(1);
  });
});
