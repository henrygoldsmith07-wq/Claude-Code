import { describe, it, expect } from "vitest";
import type { Entry } from "./types";
import { localOnlyAudit, whatLeavesDevice, containsVerbatimEntryText } from "./privacy";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    createdAt: "2026-01-01T00:00:00.000Z",
    title: "Manager feedback",
    messages: [{ role: "user", content: "Manager said my handover was thin" }],
    status: "complete",
    summary: {
      trace: {
        event: "Manager gave critical feedback in standup", observations: ["they said needs more detail"],
        assumptions: ["they think I am incompetent"], namedEmotion: "shame", alternativeInterpretations: [],
        intendedOutcome: "o", intendedAction: "a", predictedOutcome: "p", followUpAt: null, followUpNote: null,
      },
      coreEmotion: "shame", underlyingTriggers: ["critical feedback"], possibleBiases: [],
      otherPerspective: "p", balancedAssessment: "b", cautionFlags: [], suggestedNextSteps: [], hedgedDisclaimer: null,
    },
    ...overrides,
  };
}

describe("localOnlyAudit", () => {
  it("inventories local processing and the single network call", () => {
    const audit = localOnlyAudit();
    expect(audit.localOnly.length).toBeGreaterThan(5);
    expect(audit.localOnly.some((s) => /encryption/i.test(s))).toBe(true);
    expect(audit.network.length).toBeGreaterThan(0);
    expect(audit.network[0].what).toMatch(/messages/i);
  });
});

describe("whatLeavesDevice", () => {
  it("lists only the current reflection's messages by default", () => {
    const fields = whatLeavesDevice(entry());
    expect(fields.length).toBe(1);
    expect(fields[0]).toMatch(/messages/i);
  });
  it("with hints enabled, adds a non-verbatim hints line", () => {
    const fields = whatLeavesDevice(entry(), { includeEntryHints: true });
    expect(fields.length).toBe(2);
    expect(fields[1]).toMatch(/no event text, no assumptions/i);
  });
  it("local-only session (no messages) sends nothing", () => {
    const e = entry({ messages: [] });
    expect(whatLeavesDevice(e)).toEqual(["Nothing — local-only mode, no API call."]);
  });
});

describe("containsVerbatimEntryText", () => {
  it("detects verbatim assumption text in a payload", () => {
    const e = entry();
    const leak = containsVerbatimEntryText("User wrote: they think I am incompetent and then stopped", [e]);
    expect(leak).toBe("they think I am incompetent");
  });
  it("does not flag counts-only summaries", () => {
    const e = entry();
    expect(containsVerbatimEntryText("3 reflections · 1 reviewed · 1 unsupported", [e])).toBeNull();
  });
  it("does not flag short category labels like emotions", () => {
    const e = entry({ summary: { ...entry().summary!, coreEmotion: "shame" } });
    expect(containsVerbatimEntryText("core emotion: shame", [e])).toBeNull();
  });
});
