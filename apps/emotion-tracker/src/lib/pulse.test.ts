import { describe, it, expect } from "vitest";
import { reflectSnapshot } from "./pulse";
import type { Entry } from "./types";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    createdAt: new Date().toISOString(),
    title: "T",
    messages: [{ role: "user", content: "hi" }],
    status: "complete",
    summary: {
      trace: {
        event: "E",
        observations: ["o"],
        assumptions: ["a"],
        namedEmotion: "shame",
        alternativeInterpretations: ["alt"],
        intendedOutcome: "outcome",
        intendedAction: "action",
        predictedOutcome: "p",
        followUpAt: null,
        followUpNote: null,
      },
      coreEmotion: "shame",
      underlyingTriggers: [],
      possibleBiases: [],
      otherPerspective: "p",
      balancedAssessment: "b",
      cautionFlags: [],
      suggestedNextSteps: [],
      hedgedDisclaimer: null,
    },
    ...overrides,
  };
}

describe("reflectSnapshot", () => {
  it("counts without leaking verbatim text", () => {
    const s = reflectSnapshot([entry(), entry({ id: "e2" })]);
    expect(s.totalReflections).toBe(2);
    expect(s.completed).toBe(2);
    expect(s.summary).toBeTruthy();
    // Snapshot should not contain raw assumption text in a structured field — only via summary string
    expect(JSON.stringify(s)).not.toMatch(/they think/i);
  });
});
