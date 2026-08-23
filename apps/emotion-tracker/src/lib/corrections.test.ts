import { describe, it, expect } from "vitest";
import type { Entry } from "./types";
import {
  assumptionGroupKey, patternKey, withoutDismissed, annotatePatterns, annotateAssumptionGroups,
} from "./corrections";
import { detectRecurringAssumptions, detectRecurringPatterns, summaryInsights } from "./longitudinal";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: `e-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    title: "T",
    messages: [{ role: "user", content: "hi" }],
    status: "complete",
    summary: {
      trace: {
        event: "E", observations: [], assumptions: ["they think I'm incompetent"],
        namedEmotion: "shame", alternativeInterpretations: [],
        intendedOutcome: "o", intendedAction: "a", predictedOutcome: "p",
        followUpAt: null, followUpNote: null,
      },
      coreEmotion: "shame", underlyingTriggers: ["critical feedback"], possibleBiases: [],
      otherPerspective: "p", balancedAssessment: "b", cautionFlags: [], suggestedNextSteps: [],
      hedgedDisclaimer: null,
    },
    ...overrides,
  };
}

describe("corrections — stable keys", () => {
  it("patternKey is stable across label case/space variants", () => {
    expect(patternKey({ kind: "emotion", label: "Shame" })).toBe(patternKey({ kind: "emotion", label: "  shame " }));
  });
  it("assumptionGroupKey is stable", () => {
    expect(assumptionGroupKey("They think I'm incompetent")).toBe(assumptionGroupKey("they think I'm incompetent"));
  });
});

describe("corrections — rejected patterns never resurface", () => {
  it("withoutDismissed filters annotated patterns", () => {
    const two = [entry({ id: "a" }), entry({ id: "b" })];
    const patterns = annotatePatterns(detectRecurringPatterns(two));
    expect(patterns.length).toBeGreaterThan(0);
    // dismiss every inferred pattern — none may resurface
    const dismissed = patterns.map((p) => ({ key: p.key, kind: "pattern" as const, rejectedAt: "2026-01-01" }));
    expect(withoutDismissed(patterns, dismissed)).toEqual([]);
  });

  it("summaryInsights excludes dismissed patterns and assumption groups", () => {
    const two = [
      entry({ id: "a", summary: { ...entry().summary!, coreEmotion: "shame", trace: { ...entry().summary!.trace, assumptions: ["they think I am incompetent at work"] } } }),
      entry({ id: "b", summary: { ...entry().summary!, coreEmotion: "shame", trace: { ...entry().summary!.trace, assumptions: ["they think I am incompetent at my job"] } } }),
    ];
    const before = summaryInsights(two);
    expect(before.some((i) => i.title === "shame")).toBe(true);
    const dismissed = [
      { key: patternKey({ kind: "emotion", label: "shame" }), kind: "pattern" as const, rejectedAt: "2026-01-02" },
      { key: assumptionGroupKey("they think I am incompetent at work"), kind: "assumption" as const, rejectedAt: "2026-01-02" },
    ];
    const after = summaryInsights(two, dismissed);
    expect(after.some((i) => i.title === "shame")).toBe(false);
    expect(after.some((i) => i.detail.includes("Recurring assumption"))).toBe(false);
  });

  it("detectRecurringAssumptions groups are annotatable and filterable", () => {
    const two = [
      entry({ id: "a", summary: { ...entry().summary!, trace: { ...entry().summary!.trace, assumptions: ["they think I am incompetent at work"] } } }),
      entry({ id: "b", summary: { ...entry().summary!, trace: { ...entry().summary!.trace, assumptions: ["they think I am incompetent"] } } }),
    ];
    const groups = annotateAssumptionGroups(detectRecurringAssumptions(two));
    expect(groups.length).toBe(1);
    expect(withoutDismissed(groups, [{ key: groups[0].key, kind: "assumption", rejectedAt: "2026-01-01" }])).toEqual([]);
  });
});
