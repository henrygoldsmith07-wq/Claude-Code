import { describe, it, expect } from "vitest";
import {
  attributionOf,
  breakdownClaims,
  buildDisputedFact,
  classifyClaim,
  corroborationFor,
  independenceGroups,
} from "./claims";
import { lookupSource, ownerOf, transparencyScore, localSourcesFor, registrySize, shareOwner } from "./sourceRegistry";
import { assessDiversity, localSourcingSuggestions } from "./sourcing";
import { coverageBias, POPULATION_BASELINE, regionOf, sourcingSuggestions } from "./coverageBias";
import type { SourceAttribution } from "./storyModel";
import type { CountryNews } from "./gemini";

const src = (url: string, title: string): SourceAttribution => ({
  url,
  title,
  publisher: new URL(url).hostname.replace(/^www\./, ""),
});

describe("source registry", () => {
  it("covers a meaningful spread of outlets, countries and owners", () => {
    const s = registrySize();
    expect(s.outlets).toBeGreaterThan(80);
    expect(s.countries).toBeGreaterThan(30);
    expect(s.owners).toBeGreaterThan(60);
  });

  it("resolves subdomains to the parent outlet", () => {
    expect(lookupSource("https://news.bbc.co.uk/story").name).toBe("BBC News");
    expect(lookupSource("www.theguardian.com").owner).toBe("Scott Trust");
  });

  it("returns a conservative record for unknown domains rather than undefined", () => {
    const rec = lookupSource("https://some-blog.example/post");
    expect(rec.ownerType).toBe("unknown");
    expect(rec.owner).toMatch(/^unregistered:/);
  });

  it("detects outlets that share an owner", () => {
    expect(shareOwner("wsj.com", "nypost.com")).toBe(true); // both News Corp
    expect(shareOwner("wsj.com", "nytimes.com")).toBe(false);
  });

  it("never treats two unregistered outlets as sharing an owner", () => {
    expect(shareOwner("unknown-a.example", "unknown-b.example")).toBe(false);
  });

  it("scores transparency without conflating it with reliability", () => {
    const bbc = transparencyScore(lookupSource("bbc.co.uk"));
    const unknown = transparencyScore(lookupSource("mystery.example"));
    expect(bbc.score).toBeGreaterThan(unknown.score);
    expect(bbc.reasons.join(" ")).toMatch(/Ownership publicly disclosed/);
  });

  it("finds local outlets for a country", () => {
    const uk = localSourcesFor("GB");
    expect(uk.length).toBeGreaterThan(3);
    // Local and regional titles sort ahead of national ones.
    expect(["local", "regional"]).toContain(uk[0].reach);
  });
});

describe("independence", () => {
  it("groups outlets that share an owner into one account", () => {
    const groups = independenceGroups(
      [src("https://wsj.com/a", "A"), src("https://nypost.com/b", "B"), src("https://nytimes.com/c", "C")],
      ownerOf,
    );
    expect(groups.size).toBe(2);
  });

  it("treats different wires as independent of each other", () => {
    const groups = independenceGroups(
      [src("https://reuters.com/a", "A"), src("https://apnews.com/b", "B")],
      ownerOf,
    );
    expect(groups.size).toBe(2);
  });
});

describe("corroboration", () => {
  const sources = [
    src("https://reuters.com/1", "ECB holds rates at 3.25% as inflation cools"),
    src("https://ft.com/2", "European Central Bank keeps rates unchanged at 3.25%"),
    src("https://bbc.co.uk/3", "Storm warnings issued across the south coast"),
  ];

  it("counts only the sources whose text supports the claim", () => {
    const c = corroborationFor("The ECB held rates at 3.25%", sources, ownerOf);
    expect(c.supporting).toBe(2);
    expect(c.independent).toBe(2);
  });

  it("reports one account when supporters share an owner", () => {
    const owned = [
      src("https://wsj.com/1", "Fed cuts rates by 25 basis points"),
      src("https://nypost.com/2", "Fed cuts rates by 25 basis points"),
    ];
    const c = corroborationFor("The Fed cut rates by 25 basis points", owned, ownerOf);
    expect(c.supporting).toBe(2);
    expect(c.independent).toBe(1);
    expect(c.note).toMatch(/not independent/i);
  });
});

describe("claim classification", () => {
  const sources = [
    src("https://reuters.com/1", "Ceasefire extended for two weeks, mediators confirm"),
    src("https://apnews.com/2", "Israel and Hamas agree to extend Gaza ceasefire by two weeks"),
  ];

  it("marks forward-looking statements as predictions", () => {
    expect(classifyClaim("The deal is expected to take effect next month").type).toBe("prediction");
    expect(classifyClaim("Output will rise by 2030").type).toBe("prediction");
  });

  it("marks attributed and unverified statements as allegations", () => {
    expect(classifyClaim("The ministry alleged that shells were fired from the north").type).toBe("allegation");
    expect(classifyClaim("Rebels reportedly seized the airport").type).toBe("allegation");
  });

  it("marks interpretation as analysis", () => {
    expect(classifyClaim("The move suggests a shift in strategy").type).toBe("analysis");
    expect(classifyClaim("Analysts say the decision reflects weak demand").type).toBe("analysis");
  });

  it("marks corroborated statements as confirmed", () => {
    const c = classifyClaim("The ceasefire was extended for two weeks", sources, { ownerOf });
    expect(c.type).toBe("confirmed");
    expect(c.corroboration.independent).toBe(2);
  });

  it("refuses to call hedged wording confirmed", () => {
    const c = classifyClaim("The ceasefire was reportedly extended for two weeks", sources, { ownerOf });
    expect(c.type).not.toBe("confirmed");
    expect(c.hedges).toContain("reportedly");
  });

  it("does not call a single uncorroborated assertion confirmed", () => {
    const c = classifyClaim("The airport perimeter was secured overnight", [], { ownerOf });
    expect(c.type).not.toBe("confirmed");
  });

  it("extracts who a statement is attributed to", () => {
    expect(attributionOf("According to the Interior Ministry, twelve were detained").join(" ")).toMatch(/Interior Ministry/);
    expect(attributionOf("Officials said the road had reopened").join(" ")).toMatch(/[Oo]fficials/);
  });

  it("splits a story's statements into the four kinds", () => {
    const b = breakdownClaims(
      [
        "The ceasefire was extended for two weeks",
        "The ministry alleged that shells were fired from the north",
        "The move suggests a shift in strategy",
        "Talks are expected to resume next month",
      ],
      sources,
      { ownerOf },
    );
    expect(b.confirmed).toHaveLength(1);
    expect(b.allegations).toHaveLength(1);
    expect(b.analysis).toHaveLength(1);
    expect(b.predictions).toHaveLength(1);
    expect(b.summary).toMatch(/Of 4 statements/);
  });
});

describe("disputed facts", () => {
  it("names the dimension of disagreement and adjudicates neither side", () => {
    const d = buildDisputedFact(
      "The ministry said fourteen people were detained",
      [src("https://reuters.com/1", "Security operation detains 14, officials say")],
      "Local media reported nineteen people were detained",
      [src("https://elpais.com/2", "Operativo deja 19 detenidos")],
      { ownerOf },
    );
    expect(d.dimension).toBe("how many were detained");
    expect(d.status).toBe("disputed");
    expect(d.sides).toHaveLength(2);
    expect(d.summary).toMatch(/Neither version is independently settled/);
  });

  it("records a resolution when one is supplied", () => {
    const d = buildDisputedFact("A", [], "B", [], { resolution: "Investigators confirmed A" });
    expect(d.status).toBe("resolved");
  });
});

describe("diversity on independence", () => {
  it("reports one independent owner when every source shares a parent", () => {
    const r = assessDiversity([src("https://wsj.com/1", "x"), src("https://nypost.com/2", "y")], "US");
    expect(r.independentGroups).toBe(1);
    expect(r.note).toMatch(/single account/i);
  });

  it("flags the absence of a source local to the story", () => {
    const r = assessDiversity([src("https://bbc.co.uk/1", "x"), src("https://reuters.com/2", "y")], "NG");
    expect(r.localShare).toBe(0);
    expect(r.gaps.join(" ")).toMatch(/No source based in NG/);
  });

  it("suggests real registered outlets for a country", () => {
    const s = localSourcingSuggestions("NG");
    expect(s.outlets.length).toBeGreaterThan(0);
    expect(s.outlets.every((o) => o.countryCode === "NG")).toBe(true);
  });
});

describe("coverage bias", () => {
  const news = (stories: CountryNews["stories"]): CountryNews =>
    ({ country: "x", code: "XX", generatedAt: "", topics: [], sources: [], points: [], conflicts: [], stories, meta: {} }) as unknown as CountryNews;

  const story = (id: string, topic: string, cc: string, sources: SourceAttribution[]) =>
    ({
      id, topic, headline: id, summary: "", keyPoints: [], sources,
      location: { label: cc, lat: 0, lng: 0, countryCode: cc },
      sourceMix: { total: sources.length, byCountry: [], byPerspective: [], byKind: [], primaryCount: 0, perspectiveEntropy: 0, kindDistinctCount: 0 },
      primarySources: [], timeline: [], conflictingClaims: [], widelyAgreedFacts: [],
      uncertainty: [], corrections: [], coverageGaps: [],
    }) as unknown as NonNullable<CountryNews["stories"]>[number];

  it("maps countries to regions", () => {
    expect(regionOf("NG")).toBe("Africa");
    expect(regionOf("DE")).toBe("Europe");
    expect(regionOf("ZZ")).toBe("Unknown");
  });

  it("measures over-representation against a stated baseline", () => {
    const report = coverageBias(
      [news([
        story("a", "Politics", "GB", [src("https://bbc.co.uk/1", "t")]),
        story("b", "Politics", "FR", [src("https://lemonde.fr/2", "t")]),
        story("c", "Economy & Business", "DE", [src("https://faz.net/3", "t")]),
        story("d", "Politics", "NG", [src("https://bbc.co.uk/4", "t")]),
      ])],
      POPULATION_BASELINE,
    );
    const europe = report.byRegion.find((r) => r.region === "Europe")!;
    expect(europe.verdict).toBe("over-covered");
    expect(report.findings[0]).toMatch(/population baseline/i);
  });

  it("flags regions covered through a single topic lens", () => {
    const report = coverageBias([news([
      story("a", "World & Conflict", "SO", [src("https://reuters.com/1", "t")]),
      story("b", "World & Conflict", "SS", [src("https://reuters.com/2", "t")]),
      story("c", "Politics", "GB", [src("https://bbc.co.uk/3", "t")]),
    ])]);
    expect(report.monotopicRegions.some((m) => m.region === "Africa")).toBe(true);
  });

  it("reports the share of sources local to the story", () => {
    const report = coverageBias([news([
      story("a", "Politics", "NG", [src("https://bbc.co.uk/1", "t"), src("https://reuters.com/2", "t")]),
    ])]);
    expect(report.sourceOrigin.localShare).toBe(0);
  });

  it("turns gaps into fetchable outlet suggestions", () => {
    const report = coverageBias([news([story("a", "Politics", "GB", [src("https://bbc.co.uk/1", "t")])])]);
    const suggestions = sourcingSuggestions(report, ["NG", "KE", "IN"]);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].outlets.length).toBeGreaterThan(0);
  });
});
