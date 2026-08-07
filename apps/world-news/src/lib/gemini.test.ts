import { describe, it, expect } from "vitest";
import { __test } from "./gemini";

const { normaliseStories, normaliseMeta, extractJson } = __test;

describe("extractJson", () => {
  it("parses fenced JSON", () => {
    const text = "```json\n{\"topics\":[],\"points\":[]}\n```";
    const j = extractJson(text);
    expect(j.topics).toEqual([]);
  });

  it("tolerates surrounding prose", () => {
    const text = "Here you go: {\"topics\":[{\"topic\":\"Politics\",\"summary\":\"hi\",\"keyPoints\":[\"a\"]}],\"points\":[],\"conflicts\":[]}";
    const j = extractJson(text);
    expect(j.topics.length).toBe(1);
  });
});

describe("normaliseStories", () => {
  it("normalises a well-formed story", () => {
    const stories = normaliseStories(
      [
        {
          id: "my-story",
          headline: "Election ruling shocks capital",
          topic: "Politics",
          summary: "The court ruled…",
          keyPoints: ["Point A"],
          location: { label: "Paris", lat: 48.8, lng: 2.3, countryCode: "FR" },
          sources: [{ url: "https://www.bbc.co.uk/news/a", title: "BBC A" }],
          primarySources: [],
          timeline: [{ date: "2025-01-01", label: "Ruling issued" }],
          conflictingClaims: [
            { claim: "Fraud", attributedTo: ["X"], counterClaim: "No fraud", counterAttributedTo: ["Y"] },
          ],
          widelyAgreedFacts: ["Court issued ruling"],
          uncertainty: ["Appeal outcome"],
          corrections: [],
          coverageGaps: ["Limited access"],
        },
      ],
      new Set(["https://www.bbc.co.uk/news/a"]),
      [{ url: "https://www.bbc.co.uk/news/a", title: "BBC A" }],
    );
    expect(stories.length).toBe(1);
    expect(stories[0].id).toBe("my-story");
    expect(stories[0].sourceMix.total).toBe(1);
    expect(stories[0].timeline.length).toBe(1);
    expect(stories[0].conflictingClaims.length).toBe(1);
  });

  it("drops stories without headline or summary", () => {
    expect(normaliseStories([{ id: "x", topic: "Politics", summary: "" }], new Set(), [])).toEqual([]);
  });

  it("falls back to grounding sources when story has no sources", () => {
    const stories = normaliseStories(
      [{ headline: "H", topic: "Politics", summary: "S", sources: [] }],
      new Set(),
      [{ url: "https://example.com/a", title: "A" }],
    );
    expect(stories[0].sources.length).toBeGreaterThan(0);
  });

  it("dedupes by id", () => {
    const stories = normaliseStories(
      [
        { id: "dup", headline: "A", topic: "Politics", summary: "S" },
        { id: "dup", headline: "B", topic: "Politics", summary: "S2" },
      ],
      new Set(),
      [],
    );
    expect(stories.length).toBe(1);
  });
});

describe("normaliseMeta", () => {
  it("keeps null whatChanged when empty", () => {
    const m = normaliseMeta({});
    expect(m.whatChangedSinceYesterday).toBeNull();
  });

  it("trims and caps strings", () => {
    const m = normaliseMeta({
      widelyAgreedFacts: [" a ", ""],
      whatChangedSinceYesterday: " Something changed. ",
    });
    expect(m.widelyAgreedFacts).toEqual(["a"]);
    expect(m.whatChangedSinceYesterday).toBe("Something changed.");
  });
});
