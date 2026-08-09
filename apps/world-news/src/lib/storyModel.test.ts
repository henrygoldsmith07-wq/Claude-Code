import { describe, it, expect } from "vitest";
import { buildSourceMix, inferSourceAttribution, emptyMeta, emptySourceMix } from "./storyModel";
import type { SourceAttribution } from "./storyModel";

describe("inferSourceAttribution", () => {
  it("maps known domains to country and perspective", () => {
    const a = inferSourceAttribution("https://www.bbc.co.uk/news/world-123", "BBC title");
    expect(a.countryCode).toBe("GB");
    expect(a.perspective).toBe("center");
    expect(a.publisher).toBe("bbc.co.uk");
  });

  it("marks gov URLs as primary", () => {
    const a = inferSourceAttribution("https://www.whitehouse.gov/briefing/xyz", "Statement");
    expect(a.isPrimary).toBe(true);
  });

  it("marks press-release titles as primary even on non-gov domains", () => {
    const a = inferSourceAttribution("https://example.com/a", "Official press release: something");
    expect(a.isPrimary).toBe(true);
  });

  it("returns unknown perspective for unknown domains", () => {
    const a = inferSourceAttribution("https://example.com/a", "Hello");
    expect(a.perspective).toBe("unknown");
    expect(a.isPrimary).toBeUndefined();
  });
});

describe("buildSourceMix", () => {
  it("aggregates by country and perspective and counts primaries", () => {
    const sources: SourceAttribution[] = [
      { url: "https://bbc.co.uk/a", title: "A", countryCode: "GB", perspective: "center" },
      { url: "https://nytimes.com/b", title: "B", countryCode: "US", perspective: "center-left" },
      { url: "https://nytimes.com/c", title: "C", countryCode: "US", perspective: "center-left", isPrimary: true },
      { url: "https://example.com/d", title: "D", countryCode: "US", perspective: "center-left" },
    ];
    const mix = buildSourceMix(sources);
    expect(mix.total).toBe(4);
    expect(mix.primaryCount).toBe(1);
    expect(mix.byCountry[0]).toEqual(expect.objectContaining({ code: "US", count: 3 }));
    expect(mix.byPerspective[0]).toEqual(expect.objectContaining({ perspective: "center-left", count: 3 }));
  });

  it("handles empty input", () => {
    expect(emptySourceMix().total).toBe(0);
    expect(buildSourceMix([]).total).toBe(0);
  });

  it("emptyMeta is stable", () => {
    const m = emptyMeta();
    expect(m.widelyAgreedFacts).toEqual([]);
    expect(m.whatChangedSinceYesterday).toBeNull();
  });
});
