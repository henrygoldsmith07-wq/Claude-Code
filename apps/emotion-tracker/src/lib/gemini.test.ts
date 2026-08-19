import { describe, expect, it } from "vitest";
import { __test } from "./gemini";

describe("reflection modes", () => {
  it("keeps one-question steps explicit", () => {
    expect(__test.buildSystemPrompt(0, { mode: "full" })).toMatch(/exactly one question per turn/i);
  });

  it("gives quick reflections a shorter question budget", () => {
    const prompt = __test.buildSystemPrompt(0, { mode: "quick" });
    expect(prompt).toMatch(/quick reflection/i);
    expect(prompt).toMatch(/no more than two questions/i);
  });
});
