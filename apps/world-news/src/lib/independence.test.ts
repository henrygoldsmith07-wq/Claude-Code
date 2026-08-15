import { describe, expect, it } from "vitest";
import {
  claimsSharingOrigin,
  explainIndependence,
  independenceReport,
  originsForClaim,
  sourcesAsArticles,
} from "./independence";
import { reconstructSyndication } from "./syndication";
import type { SourceAttribution } from "./storyModel";

function src(publisher: string, title: string, at?: number): SourceAttribution {
  return {
    url: `https://${publisher}/${title.slice(0, 12).replace(/\W+/g, "-").toLowerCase()}`,
    title,
    publisher,
    publishedAt: at === undefined ? undefined : new Date(Date.UTC(2026, 2, 9, 6 + at)).toISOString(),
  };
}

describe("pairwise independence", () => {
  it("names the shared owner rather than returning a bare false", () => {
    // The Times and The Sun are both News Corp; a reader can check that.
    const v = explainIndependence(
      { publisher: "thetimes.co.uk", url: "https://thetimes.co.uk/a" },
      { publisher: "nypost.com", url: "https://nypost.com/b" },
    );
    expect(v.independent).toBe(false);
    expect(v.reason).toBe("same-owner");
    expect(v.explanation).toContain("News Corp");
  });

  it("treats the same outlet as one account", () => {
    const v = explainIndependence(
      { publisher: "bbc.co.uk", url: "https://bbc.co.uk/a" },
      { publisher: "www.bbc.co.uk", url: "https://www.bbc.co.uk/b" },
    );
    expect(v.independent).toBe(false);
    expect(v.reason).toBe("same-outlet");
  });

  it("calls two separately-owned newsrooms independent and says why", () => {
    const v = explainIndependence(
      { publisher: "theguardian.com", url: "https://theguardian.com/a" },
      { publisher: "lemonde.fr", url: "https://lemonde.fr/b" },
    );
    expect(v.independent).toBe(true);
    expect(v.explanation).toContain("Scott Trust");
    expect(v.explanation).toContain("Groupe Le Monde");
  });

  it("refuses to call an unregistered outlet independent", () => {
    // The distinction that matters: unknown is not the same as verified.
    const v = explainIndependence(
      { publisher: "theguardian.com", url: "https://theguardian.com/a" },
      { publisher: "some-aggregator.example", url: "https://some-aggregator.example/b" },
    );
    expect(v.independent).toBe(false);
    expect(v.reason).toBe("ownership-unknown");
    expect(v.explanation).toContain("unknown, not confirmed");
  });

  it("detects that one outlet is carrying the other's report", () => {
    const articles = sourcesAsArticles([
      src("reuters.com", "Border crossing reopens after three weeks", 0),
      src("dawn.com", "Border crossing reopens after three weeks", 2),
    ]);
    const graph = reconstructSyndication(articles);
    const v = explainIndependence(
      { publisher: "reuters.com", url: articles[0].url },
      { publisher: "dawn.com", url: articles[1].url },
      { graph },
    );
    expect(v.independent).toBe(false);
    expect(v.reason).toBe("derives-from");
    expect(v.explanation).toContain("carrying");
  });

  it("detects two outlets sharing a wire origin neither of them is", () => {
    const articles = sourcesAsArticles([
      src("dawn.com", "Aid convoy crosses the northern corridor (Reuters)", 0),
      src("nation.africa", "Aid convoy crosses northern corridor (Reuters)", 1),
    ]);
    const graph = reconstructSyndication(articles);
    const v = explainIndependence(
      { publisher: "dawn.com", url: articles[0].url },
      { publisher: "nation.africa", url: articles[1].url },
      { graph },
    );
    expect(v.independent).toBe(false);
    expect(v.reason).toBe("same-origin");
    expect(v.explanation).toContain("Reuters");
  });
});

describe("independence report", () => {
  it("collapses same-owner mastheads into one account", () => {
    const r = independenceReport([
      { publisher: "thetimes.co.uk", url: "https://thetimes.co.uk/a" },
      { publisher: "nypost.com", url: "https://nypost.com/b" },
      { publisher: "lemonde.fr", url: "https://lemonde.fr/c" },
    ]);
    expect(r.independent).toBe(2);
    expect(r.note).toContain("2 independent accounts among 3");
  });

  it("keeps unregistered outlets out of the independent count", () => {
    const r = independenceReport([
      { publisher: "unknown-site.example", url: "https://unknown-site.example/a" },
      { publisher: "another-unknown.example", url: "https://another-unknown.example/b" },
    ]);
    expect(r.independent).toBe(0);
    expect(r.unverifiable).toHaveLength(2);
    expect(r.note).toContain("independence cannot be established");
  });
});

describe("claim origins", () => {
  it("reports six wire carriers as one report, not six", () => {
    const supporters = [
      src("dawn.com", "Minister resigns after audit findings (Reuters)", 1),
      src("nation.africa", "Minister resigns after audit findings (Reuters)", 2),
      src("bangkokpost.com", "Minister resigns after audit findings (Reuters)", 3),
      src("thedailystar.net", "Minister resigns after audit findings (Reuters)", 4),
      src("jakartapost.com", "Minister resigns after audit findings (Reuters)", 5),
      src("koreaherald.com", "Minister resigns after audit findings (Reuters)", 6),
    ];
    const r = originsForClaim("The minister resigned after the audit", supporters);
    expect(r.citations).toBe(6);
    expect(r.originCount).toBe(1);
    expect(r.overstated).toBe(true);
    expect(r.note).toContain("That is one report, not 6.");
  });

  it("does not flag genuinely separate reports as overstated", () => {
    const supporters = [
      src("lemonde.fr", "Le parlement rejette le projet de loi", 0),
      src("elpais.com", "Un tribunal ordena revisar el contrato minero", 1),
    ];
    const r = originsForClaim("Separate developments", supporters);
    expect(r.originCount).toBe(2);
    expect(r.overstated).toBe(false);
  });

  it("handles a claim with no supporting sources", () => {
    const r = originsForClaim("Nobody reported this", []);
    expect(r.citations).toBe(0);
    expect(r.originCount).toBe(0);
    expect(r.note).toContain("No source");
  });

  it("surfaces when several claims rest on the same single report", () => {
    // A reader discounting that origin should discount all of them together.
    const shared = [src("reuters.com", "Ministry confirms the plant will close", 0)];
    const groups = claimsSharingOrigin([
      { text: "The plant will close", supporters: shared },
      { text: "The ministry confirmed the closure", supporters: shared },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].claims).toHaveLength(2);
    expect(groups[0].outlets).toContain("Reuters");
  });
});
