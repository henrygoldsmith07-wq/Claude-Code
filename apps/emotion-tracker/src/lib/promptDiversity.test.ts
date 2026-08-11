import { describe, it, expect } from "vitest";
import { coveredSteps, diverseQuestionHint, personalAdaptationHint, uncertaintySentence } from "./promptDiversity";

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

  it("personalAdaptationHint returns null with <3 entries", () => {
    expect(personalAdaptationHint([])).toBeNull();
  });

  it("uncertaintySentence varies by confidence", () => {
    expect(uncertaintySentence(0.9)).toMatch(/Fairly confident/i);
    expect(uncertaintySentence(0.3)).toMatch(/Low confidence/i);
  });
});
