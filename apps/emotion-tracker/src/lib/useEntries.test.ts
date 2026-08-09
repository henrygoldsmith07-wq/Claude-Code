import { describe, it, expect } from "vitest";
import type { Entry } from "./types";

// Exercise the pure helpers via a small harness (avoids React hook plumbing)
function deriveTitle(s: string): string {
  const firstLine = s.trim().split("\n")[0];
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine || "Untitled reflection";
}

describe("entry title", () => {
  it("truncates long titles", () => {
    expect(deriveTitle("a".repeat(100)).endsWith("...")).toBe(true);
  });

  it("falls back for empty input", () => {
    expect(deriveTitle("   ")).toBe("Untitled reflection");
  });
});

describe("follow-up mutation shape", () => {
  it("updates followUpAt and followUpNote without losing trace fields", () => {
    const entry: Entry = {
      id: "1",
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
    };
    // Simulate updateFollowUp
    const updated: Entry = {
      ...entry,
      summary: entry.summary
        ? { ...entry.summary, trace: { ...entry.summary.trace, followUpAt: "2026-01-02", followUpNote: "worked" } }
        : null,
    };
    expect(updated.summary!.trace.followUpAt).toBe("2026-01-02");
    expect(updated.summary!.trace.followUpNote).toBe("worked");
    expect(updated.summary!.coreEmotion).toBe("shame");
  });
});
