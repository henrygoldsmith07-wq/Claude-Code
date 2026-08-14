import { describe, expect, it } from "vitest";
import { correctionEffectOnClaim, propagateCorrections, type SourceCorrection } from "./corrections";
import { reconstructSyndication } from "./syndication";
import { sourcesAsArticles } from "./independence";
import type { SourceAttribution } from "./storyModel";

function src(publisher: string, title: string, at: number): SourceAttribution {
  return {
    url: `https://${publisher}/r${at}`,
    title,
    publisher,
    publishedAt: new Date(Date.UTC(2026, 3, 12, 6 + at)).toISOString(),
  };
}

function iso(hoursAfter: number): string {
  return new Date(Date.UTC(2026, 3, 12, 6 + hoursAfter)).toISOString();
}

describe("correction propagation", () => {
  it("names the outlets still carrying a corrected wire report", () => {
    // The failure this module exists to expose: the wire fixed it, the
    // mastheads carrying it did not.
    const sources = [
      src("reuters.com", "Blast kills 40 at the port, officials say", 0),
      src("dawn.com", "Blast kills 40 at the port, officials say", 1),
      src("nation.africa", "Blast kills 40 at the port, officials say", 2),
      src("bangkokpost.com", "Blast kills 40 at the port, officials say", 3),
    ];
    const articles = sourcesAsArticles(sources);
    const corrections: SourceCorrection[] = [
      {
        targetId: articles[0].url,
        issuedBy: "Reuters",
        at: iso(8),
        kind: "factual",
        note: "Death toll revised from 40 to 12 after the health ministry update.",
      },
    ];

    const p = propagateCorrections(articles, corrections);
    expect(p.uncorrectedCarriers).toEqual(["Bangkok Post", "Dawn", "Nation"]);
    expect(p.summary).toContain("still carrying uncorrected material");
    const direct = p.affected.find((a) => a.relation === "direct")!;
    expect(direct.stillUncorrected).toBe(false);
    expect(direct.explanation).toContain("corrected this report");
  });

  it("does not fault a carrier that published its own correction", () => {
    const sources = [
      src("reuters.com", "Bridge collapse toll stands at 12", 0),
      src("dawn.com", "Bridge collapse toll stands at 12", 1),
    ];
    const articles = sourcesAsArticles(sources);
    const corrections: SourceCorrection[] = [
      { targetId: articles[0].url, issuedBy: "Reuters", at: iso(6), kind: "factual", note: "Toll revised to 9." },
      { targetId: articles[1].url, issuedBy: "Dawn", at: iso(7), kind: "factual", note: "Toll revised to 9." },
    ];
    const p = propagateCorrections(articles, corrections);
    expect(p.uncorrectedCarriers).toEqual([]);
    expect(p.summary).toContain("every outlet carrying the affected report has also corrected it");
  });

  it("does not propagate a correction to an outlet that published after it", () => {
    // That outlet had the corrected version available; the upstream correction
    // says nothing about what it printed.
    const sources = [
      src("reuters.com", "Talks end without agreement", 0),
      src("dawn.com", "Talks end without agreement", 10),
    ];
    const articles = sourcesAsArticles(sources);
    const corrections: SourceCorrection[] = [
      { targetId: articles[0].url, issuedBy: "Reuters", at: iso(4), kind: "factual", note: "Venue corrected." },
    ];
    const p = propagateCorrections(articles, corrections);
    expect(p.uncorrectedCarriers).toEqual([]);
  });

  it("propagates from a wire origin whose own copy was never in the set", () => {
    const sources = [
      src("dawn.com", "Election result annulled by the court (Reuters)", 0),
      src("nation.africa", "Election result annulled by the court (Reuters)", 1),
    ];
    const articles = sourcesAsArticles(sources);
    const graph = reconstructSyndication(articles);
    const corrections: SourceCorrection[] = [
      {
        targetId: graph.chains[0].originId, // the virtual Reuters node
        issuedBy: "Reuters",
        at: iso(5),
        kind: "retraction",
        note: "Report withdrawn; the court issued no such ruling.",
      },
    ];
    const p = propagateCorrections(articles, corrections, graph);
    expect(p.uncorrectedCarriers.sort()).toEqual(["Dawn", "Nation"]);
    expect(p.retractedOrigins).toHaveLength(1);
  });

  it("reports no corrections without inventing an affected set", () => {
    const articles = sourcesAsArticles([src("bbc.co.uk", "Budget passes", 0)]);
    const p = propagateCorrections(articles, []);
    expect(p.affected).toEqual([]);
    expect(p.summary).toBe("No corrections recorded.");
  });
});

describe("effect on a claim", () => {
  it("marks a claim withdrawn when all of its support is retracted", () => {
    const supporters = [src("reuters.com", "Ministry says the dam was breached", 0)];
    const articles = sourcesAsArticles(supporters);
    const effect = correctionEffectOnClaim("The dam was breached", supporters, [
      { targetId: articles[0].url, issuedBy: "Reuters", at: iso(9), kind: "retraction", note: "Withdrawn in full." },
    ]);
    expect(effect.status).toBe("withdrawn");
    expect(effect.remainingSupport).toBe(0);
    // Struck through, never silently removed.
    expect(effect.note).toContain("struck through rather than removed");
  });

  it("marks a claim weakened when only part of its support was corrected", () => {
    const supporters = [
      src("reuters.com", "Ministry says the dam was breached", 0),
      src("lemonde.fr", "Le ministere confirme la rupture du barrage", 1),
    ];
    const articles = sourcesAsArticles(supporters);
    const effect = correctionEffectOnClaim("The dam was breached", supporters, [
      { targetId: articles[0].url, issuedBy: "Reuters", at: iso(9), kind: "factual", note: "Location corrected." },
    ]);
    expect(effect.status).toBe("weakened");
    expect(effect.remainingSupport).toBe(1);
  });

  it("ignores a correction that names a different claim", () => {
    const supporters = [src("reuters.com", "Ministry says the dam was breached", 0)];
    const articles = sourcesAsArticles(supporters);
    const effect = correctionEffectOnClaim("The dam was breached", supporters, [
      {
        targetId: articles[0].url,
        issuedBy: "Reuters",
        at: iso(9),
        kind: "factual",
        note: "The minister's job title was wrong.",
        affectsClaim: "The minister is head of the water authority",
      },
    ]);
    expect(effect.status).toBe("standing");
  });

  it("leaves an uncorrected claim standing", () => {
    const supporters = [src("bbc.co.uk", "Parliament approved the bill", 0)];
    const effect = correctionEffectOnClaim("Parliament approved the bill", supporters, []);
    expect(effect.status).toBe("standing");
    expect(effect.corrections).toEqual([]);
  });
});
