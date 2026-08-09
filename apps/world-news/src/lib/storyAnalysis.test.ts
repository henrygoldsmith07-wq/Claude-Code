import { describe, it, expect } from "vitest";
import { normaliseHeadline, headlineOverlap, coverageGapsHeuristic } from "./storyAnalysis";
import type { CountryNews } from "./gemini";

function news(overrides: Partial<CountryNews> = {}): CountryNews {
  return {
    country: "Testland",
    code: "xx",
    generatedAt: new Date().toISOString(),
    topics: [],
    sources: [],
    points: [],
    conflicts: [],
    stories: [],
    meta: { widelyAgreedFacts: [], uncertainty: [], coverageGaps: [], corrections: [], whatChangedSinceYesterday: null },
    ...overrides,
  };
}

describe("normaliseHeadline", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normaliseHeadline("  Hello,  WORLD!  ")).toBe("hello world");
    expect(normaliseHeadline("U.S. Election — 2024")).toBe("us election 2024");
  });
});

describe("headlineOverlap", () => {
  it("is 1 when sets are identical", () => {
    const mk = (h: string) => ({ id: h, headline: h, topic: "Politics", summary: "", keyPoints: [], sources: [], sourceMix: { total: 0, byCountry: [], byPerspective: [], primaryCount: 0 }, primarySources: [], timeline: [], conflictingClaims: [], widelyAgreedFacts: [], uncertainty: [], corrections: [], coverageGaps: [] });
    const a = news({ stories: [mk("Alpha"), mk("Beta")] as unknown as CountryNews["stories"] });
    const b = news({ stories: [mk("Alpha"), mk("Beta")] as unknown as CountryNews["stories"] });
    expect(headlineOverlap(a, b)).toBe(1);
  });

  it("is 0 when disjoint or empty", () => {
    const mk = (h: string) => ({ id: h, headline: h, topic: "Politics", summary: "", keyPoints: [], sources: [], sourceMix: { total: 0, byCountry: [], byPerspective: [], primaryCount: 0 }, primarySources: [], timeline: [], conflictingClaims: [], widelyAgreedFacts: [], uncertainty: [], corrections: [], coverageGaps: [] });
    const a = news({ stories: [mk("Alpha")] as unknown as CountryNews["stories"] });
    const b = news({ stories: [mk("Beta")] as unknown as CountryNews["stories"] });
    expect(headlineOverlap(a, b)).toBe(0);
    expect(headlineOverlap(news(), news())).toBe(0);
  });
});

describe("coverageGapsHeuristic", () => {
  it("uses explicit meta gaps when present", () => {
    const n = news({ meta: { widelyAgreedFacts: [], uncertainty: [], coverageGaps: ["Explicit gap"], corrections: [], whatChangedSinceYesterday: null } });
    expect(coverageGapsHeuristic(n)).toEqual(["Explicit gap"]);
  });

  it("synthesizes gaps from thin sources and missing story features", () => {
    const n = news({
      sources: [{ url: "https://a.com", title: "A" }],
      stories: [
        {
          id: "x",
          headline: "X",
          topic: "Politics",
          summary: "s",
          keyPoints: [],
          sources: [],
          sourceMix: { total: 0, byCountry: [], byPerspective: [], primaryCount: 0 },
          primarySources: [],
          timeline: [],
          conflictingClaims: [],
          widelyAgreedFacts: [],
          uncertainty: [],
          corrections: [],
          coverageGaps: [],
        },
      ] as unknown as CountryNews["stories"],
    });
    const gaps = coverageGapsHeuristic(n);
    expect(gaps.join(" ")).toMatch(/Few distinct sources|Timeline|conflicting/i);
  });
});
