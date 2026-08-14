import { describe, expect, it } from "vitest";
import { assessStatement, summariseEpistemics, unknownsFor } from "./epistemic";
import type { SourceCorrection } from "./corrections";
import type { SourceAttribution } from "./storyModel";

function src(publisher: string, title: string, at = 0, extra: Partial<SourceAttribution> = {}): SourceAttribution {
  return {
    url: `https://${publisher}/a${at}`,
    title,
    publisher,
    publishedAt: new Date(Date.UTC(2026, 4, 6, 6 + at)).toISOString(),
    ...extra,
  };
}

describe("statement status", () => {
  it("calls a claim known when two separately owned outlets originated it", () => {
    // Scott Trust and Kasturi & Sons, and — importantly — headlines written
    // independently. Two outlets publishing near-identical wording an hour
    // apart is syndication, and would correctly collapse to one origin.
    const s = assessStatement("The central bank raised interest rates in a split decision", [
      src("theguardian.com", "Interest rates increased as the central bank splits over the decision", 0),
      src("thehindu.com", "Split vote at the central bank delivers higher interest rates", 3),
    ]);
    expect(s.status).toBe("known");
    expect(s.origins).toBe(2);
    expect(s.independent).toBe(2);
    expect(s.whatWouldSettleIt).toBeUndefined();
  });

  it("collapses two outlets running matching headlines minutes apart to one origin", () => {
    // The same two owners as above, but this wording is a wire re-run, and the
    // status must fall to unverified however independent the mastheads are.
    const s = assessStatement("The central bank raised interest rates in a split decision", [
      src("theguardian.com", "Central bank raised interest rates in a split decision", 0),
      src("thehindu.com", "Central bank raised interest rates in a split decision", 1),
    ]);
    expect(s.origins).toBe(1);
    expect(s.status).toBe("unverified");
  });

  it("calls a claim unverified when every citation traces to one wire", () => {
    const s = assessStatement("The minister resigned after the audit findings", [
      src("dawn.com", "The minister resigned after the audit (Reuters)", 0),
      src("nation.africa", "The minister resigned after the audit (Reuters)", 1),
      src("bangkokpost.com", "The minister resigned after the audit (Reuters)", 2),
    ]);
    expect(s.status).toBe("unverified");
    expect(s.origins).toBe(1);
    expect(s.citations).toBe(3);
    expect(s.reasons.join(" ")).toContain("one report, not 3");
  });

  it("does not match a supporting source written in another language", () => {
    // Documented limitation, not an aspiration: claim/source matching is
    // lexical, so a French report of the same fact is not counted as support.
    // The effect is to under-count corroboration — a story that is in fact
    // corroborated reads as unverified — which is the safer direction, but it
    // is a real ceiling on the cross-lingual clustering the product claims.
    const s = assessStatement("The central bank raised rates in a split decision", [
      src("theguardian.com", "Central bank raised rates in a split decision", 0),
      src("lemonde.fr", "La banque centrale releve ses taux apres un vote partage", 1),
    ]);
    expect(s.citations).toBe(1);
    expect(s.status).toBe("unverified");
  });

  it("keeps a disputed claim disputed however many outlets take one side", () => {
    // Counting sources on the loudest side is not a resolution.
    const s = assessStatement("Forty people were killed", [
      src("lemonde.fr", "Quarante personnes tuees dans le raid", 0),
      src("thehindu.com", "Forty killed in the raid, ministry says", 1),
      src("elpais.com", "Cuarenta muertos en el ataque", 2),
    ], { disputed: true });
    expect(s.status).toBe("disputed");
    expect(s.whatWouldSettleIt).toContain("primary record");
  });

  it("marks a claim withdrawn when its only support was retracted", () => {
    const supporters = [src("reuters.com", "Court annulled the result", 0)];
    const corrections: SourceCorrection[] = [
      { targetId: supporters[0].url, issuedBy: "Reuters", at: new Date(Date.UTC(2026, 4, 6, 20)).toISOString(), kind: "retraction", note: "Withdrawn in full." },
    ];
    const s = assessStatement("The court annulled the result", supporters, { corrections });
    expect(s.status).toBe("withdrawn");
    expect(s.whatWouldSettleIt).toContain("has not retracted");
  });

  it("says plainly when nothing in the story supports a statement", () => {
    const s = assessStatement("A completely unrelated assertion about shipping tariffs", [
      src("bbc.co.uk", "Local election results announced", 0),
    ]);
    expect(s.citations).toBe(0);
    expect(s.explanation).toContain("Nothing in this story's sources supports");
  });
});

describe("unknowns", () => {
  it("says when there is no primary record", () => {
    const u = unknownsFor({
      sources: [src("bbc.co.uk", "Ministry announces closure", 0)],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
    });
    expect(u.some((x) => x.question.includes("primary record"))).toBe(true);
  });

  it("does not claim a primary record is missing when one is cited", () => {
    const u = unknownsFor({
      sources: [src("gov.uk", "Department statement on the closure", 0, { isPrimary: true })],
      primarySources: [src("gov.uk", "Department statement", 0)],
      uncertainty: [],
      coverageGaps: [],
    });
    expect(u.some((x) => x.question.includes("primary record"))).toBe(false);
  });

  it("says when all coverage collapses to one account", () => {
    const u = unknownsFor({
      sources: [
        src("thetimes.co.uk", "Deal agreed after talks", 0),
        src("nypost.com", "Deal agreed after talks", 1),
      ],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
    });
    expect(u.some((x) => x.question.includes("confirmed this independently"))).toBe(true);
  });

  it("says when no local outlet has covered a located story", () => {
    const u = unknownsFor({
      sources: [src("bbc.co.uk", "Floods hit the delta region", 0)],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
      location: { label: "Dhaka", lat: 23.8, lng: 90.4, countryCode: "BD" },
    });
    expect(u.some((x) => x.question.includes("based in Dhaka"))).toBe(true);
  });

  it("does not raise a local-coverage gap when a local outlet is present", () => {
    const u = unknownsFor({
      sources: [src("thedailystar.net", "Floods hit the delta region", 0)],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
      location: { label: "Dhaka", lat: 23.8, lng: 90.4, countryCode: "BD" },
    });
    expect(u.some((x) => x.question.includes("based in Dhaka"))).toBe(false);
  });

  it("says when no source dates the event", () => {
    const u = unknownsFor({
      sources: [src("bbc.co.uk", "Ministry announces closure", 0)],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
    });
    expect(u.some((x) => x.question.includes("When did this actually happen"))).toBe(true);
  });

  it("carries through gaps the reporting itself named", () => {
    const u = unknownsFor({
      sources: [src("bbc.co.uk", "Ministry announces closure on Tuesday", 0)],
      primarySources: [],
      uncertainty: ["How many workers are affected"],
      coverageGaps: ["No reporting from the northern districts"],
    });
    expect(u.some((x) => x.origin === "reported" && x.question.includes("How many workers"))).toBe(true);
    expect(u.some((x) => x.question.includes("northern districts"))).toBe(true);
  });
});

describe("story rollup", () => {
  it("reports open questions in the headline, not only what is established", () => {
    // A page with one thin fact and six open questions must not read as complete.
    const summary = summariseEpistemics({
      keyPoints: ["The plant will close"],
      widelyAgreedFacts: [],
      conflictingClaims: [],
      sources: [src("dawn.com", "The plant will close (Reuters)", 0)],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
    });
    expect(summary.headline).toContain("open question");
    expect(summary.unverified).toHaveLength(1);
    expect(summary.known).toHaveLength(0);
  });

  it("does not double-count a statement listed as both key point and agreed fact", () => {
    const summary = summariseEpistemics({
      keyPoints: ["The bridge reopened"],
      widelyAgreedFacts: ["The bridge reopened"],
      conflictingClaims: [],
      sources: [
        src("lemonde.fr", "Le pont a rouvert mardi", 0),
        src("thehindu.com", "The bridge reopened on Tuesday", 1),
      ],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
    });
    expect(summary.known.length + summary.unverified.length + summary.disputed.length).toBe(1);
  });

  it("routes a conflicting claim into the disputed bucket", () => {
    const summary = summariseEpistemics({
      keyPoints: ["Forty people were killed"],
      widelyAgreedFacts: [],
      conflictingClaims: [
        { claim: "Forty people were killed", attributedTo: ["Ministry"], counterClaim: "Twelve people were killed", counterAttributedTo: ["Red Crescent"] },
      ],
      sources: [src("bbc.co.uk", "Forty killed in the raid, ministry says", 0)],
      primarySources: [],
      uncertainty: [],
      coverageGaps: [],
    });
    expect(summary.disputed).toHaveLength(1);
    expect(summary.known).toHaveLength(0);
  });

  it("handles an empty story without inventing content", () => {
    const summary = summariseEpistemics({
      keyPoints: [], widelyAgreedFacts: [], conflictingClaims: [],
      sources: [], primarySources: [], uncertainty: [], coverageGaps: [],
    });
    expect(summary.headline).toBe("Nothing to assess yet.");
  });
});
