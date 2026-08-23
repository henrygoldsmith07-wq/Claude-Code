import { describe, it, expect } from "vitest";
import { coveredSteps, diverseQuestionHint, personalAdaptationHint, uncertaintySentence } from "./promptDiversity";
import type { Entry } from "./types";

function entryWith(trigger: string, biasType?: string): Entry {
  return {
    id: `e-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    title: "T",
    messages: [{ role: "user", content: "hi" }],
    status: "complete",
    summary: {
      trace: {
        event: "E", observations: ["o"], assumptions: ["a"], namedEmotion: "shame",
        alternativeInterpretations: ["alt"], intendedOutcome: "o", intendedAction: "a",
        predictedOutcome: "p", followUpAt: null, followUpNote: null,
      },
      coreEmotion: "shame",
      underlyingTriggers: [trigger],
      possibleBiases: biasType ? [{ type: biasType, description: "d", evidenceFor: ["for"], evidenceAgainst: ["against"], confidence: 0.6 }] as unknown as Entry["summary"] extends { possibleBiases: infer T } ? T : never : [],
      otherPerspective: "p", balancedAssessment: "b", cautionFlags: [], suggestedNextSteps: [], hedgedDisclaimer: null,
    },
  } as unknown as Entry;
}

describe("promptDiversity", () => {
  it("diverseQuestionHint nudges uncovered pipeline step", () => {
    const hint = diverseQuestionHint([{ role: "user", content: "My manager said needs more detail" }]);
    expect(hint).toBeTruthy();
    expect(typeof hint).toBe("string");
  });

  it("coveredSteps detects known phrases", () => {
    const s = coveredSteps([
      { role: "user", content: "they said needs more detail" },
      { role: "assistant", content: "What are the verifiable facts — what was actually said?" },
    ]);
    expect(s.has("observations")).toBe(true);
  });

  it("coveredSteps does not fire on factory", () => {
    const s = coveredSteps([{ role: "user", content: "I work at a factory" }]);
    expect(s.has("observations")).toBe(false);
  });

  it("personalAdaptationHint returns null with <3 entries", () => {
    expect(personalAdaptationHint([])).toBeNull();
  });

  it("personalAdaptationHint counts triggers case-insensitively", () => {
    const entries = [entryWith("Work"), entryWith("work"), entryWith("WORK"), entryWith("other")];
    const hint = personalAdaptationHint(entries as unknown as Entry[]);
    expect(hint).toContain("3");
  });

  it("personalAdaptationHint normalizes bias types", () => {
    const entries = [entryWith("x", "Mind-Reading"), entryWith("x", "mind-reading"), entryWith("x", "other")];
    const hint = personalAdaptationHint(entries as unknown as Entry[]);
    expect(hint).toBeTruthy();
  });

  it("uncertaintySentence varies by confidence", () => {
    expect(uncertaintySentence(0.9)).toMatch(/Fairly confident/i);
    expect(uncertaintySentence(0.3)).toMatch(/Low confidence/i);
  });
});
