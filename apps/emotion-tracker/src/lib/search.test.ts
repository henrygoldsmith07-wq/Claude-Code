import { describe, it, expect } from "vitest";
import type { Entry } from "./types";
import { allTopics, entryRelationships, searchEntries, semanticSearch } from "./search";

function entry(overrides: Partial<Entry> = {}, summaryOverrides: Record<string, unknown> = {}): Entry {
  const base = {
    trace: {
      event: "Manager gave feedback",
      observations: ["Manager said needs more detail"],
      assumptions: ["They think I'm incompetent"],
      namedEmotion: "shame",
      alternativeInterpretations: ["Manager wanted faster handovers"],
      intendedOutcome: "Feel trusted",
      intendedAction: "Ask for example",
      predictedOutcome: "They'll give an example.",
      followUpAt: null,
      followUpNote: null,
    },
    coreEmotion: "shame",
    underlyingTriggers: ["Critical feedback"],
    possibleBiases: [] as unknown[],
    otherPerspective: "Routine",
    balancedAssessment: "Blunt",
    cautionFlags: [] as string[],
    suggestedNextSteps: [] as string[],
    hedgedDisclaimer: null as string | null,
    ...summaryOverrides,
  };
  return {
    id: `e-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    title: "Manager feedback",
    messages: [{ role: "user", content: "manager feedback" }],
    status: "complete",
    summary: base as unknown as Entry["summary"],
    ...overrides,
  };
}

describe("searchEntries", () => {
  it("returns all on empty query", () => {
    const list = [entry(), entry()];
    expect(searchEntries(list, "").length).toBe(2);
    expect(searchEntries(list, "   ").length).toBe(2);
  });
  it("matches title and trigger tokens", () => {
    const a = entry({ title: "Cat incident" });
    const b = entry({ title: "Work feedback" });
    expect(searchEntries([a, b], "cat").map((e) => e.id)).toContain(a.id);
    expect(searchEntries([a, b], "cat").map((e) => e.id)).not.toContain(b.id);
  });
});

describe("semanticSearch", () => {
  it("ranks entries with overlapping terms higher", () => {
    const a = entry({ title: "Manager handover feedback shame" });
    const b = entry({ title: "Sunny picnic joy" });
    const hits = semanticSearch([b, a], "manager feedback shame");
    expect(hits[0]?.entry.id).toBe(a.id);
  });
  it("returns [] on empty query", () => {
    expect(semanticSearch([entry()], "")).toEqual([]);
  });
});

describe("allTopics + relationships", () => {
  it("allTopics counts tags", () => {
    const list = [entry({}, { coreEmotion: "shame" }), entry({}, { coreEmotion: "shame" })];
    const t = allTopics(list);
    expect(t.find((x) => x.tag === "shame")?.count).toBe(2);
  });
  it("entryRelationships links shared trigger", () => {
    const a = entry({}, { underlyingTriggers: ["Critical feedback"] });
    const b = entry({}, { underlyingTriggers: ["Critical feedback"] });
    expect(entryRelationships([a, b]).length).toBeGreaterThan(0);
  });
});
