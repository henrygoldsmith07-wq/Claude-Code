import { describe, it, expect } from "vitest";
import { cohenKappa, fleissKappa, krippendorffAlphaNominal, meanAbsoluteScoreDisagreement, scoreAgreementRate, agreementReport, bandScore, rubricHealth } from "../src/domain/agreement";
import type { BehaviourReliability } from "../src/domain/agreement";

describe("cohenKappa", () => {
  it("is 1 for perfect agreement", () => {
    expect(cohenKappa(["a", "b", "a", "b"], ["a", "b", "a", "b"])).toBeCloseTo(1, 6);
  });

  it("is 0 when agreement matches chance", () => {
    // 2 categories, each rater splits 50/50, independent.
    expect(cohenKappa(["a", "a", "b", "b"], ["a", "b", "a", "b"])).toBeCloseTo(0, 5);
  });

  it("is negative when agreement is below chance", () => {
    const k = cohenKappa(["a", "a", "b", "b"], ["b", "b", "a", "a"]);
    expect(k).toBeLessThan(0);
  });

  it("throws on mismatched lengths", () => {
    expect(() => cohenKappa(["a"], ["a", "b"])).toThrow();
  });
});

describe("fleissKappa", () => {
  it("is 1 when all raters agree on every item", () => {
    const matrix = [
      [3, 0, 0],
      [0, 3, 0],
      [3, 0, 0],
    ];
    expect(fleissKappa(matrix)).toBeCloseTo(1, 6);
  });

  it("is 0 when observed agreement equals chance agreement", () => {
    // Two raters, two categories, balanced marginals, half the items agreed
    // and half not — exactly what chance would produce.
    const matrix = [
      [2, 0],
      [0, 2],
      [1, 1],
      [1, 1],
    ];
    expect(fleissKappa(matrix)).toBeCloseTo(0, 5);
  });

  it("is negative when raters systematically disagree", () => {
    // Three raters each forced into a different category on every item.
    const matrix = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    expect(fleissKappa(matrix)).toBeLessThan(0);
  });
});

describe("krippendorffAlphaNominal", () => {
  it("is 1 for full agreement across items with ragged rater counts", () => {
    expect(krippendorffAlphaNominal([["a", "a", "a"], ["b", "b"], ["a", "a", "a", "a"]])).toBeCloseTo(1, 6);
  });

  it("is below 1 with disagreement", () => {
    const alpha = krippendorffAlphaNominal([["a", "a", "b"], ["a", "b", "b"], ["a", "a", "a"]]);
    expect(alpha).toBeGreaterThan(-1);
    expect(alpha).toBeLessThan(1);
  });
});

describe("continuous score agreement", () => {
  it("mean absolute disagreement is 0 for identical raters and positive otherwise", () => {
    expect(meanAbsoluteScoreDisagreement([[0.7, 0.7], [0.5, 0.5]])).toBe(0);
    expect(meanAbsoluteScoreDisagreement([[0.7, 0.5], [0.5, 0.8]])).toBeGreaterThan(0);
  });

  it("scoreAgreementRate respects the tolerance", () => {
    expect(scoreAgreementRate([[0.7, 0.75], [0.5, 0.5]], 0.1)).toBe(1);
    expect(scoreAgreementRate([[0.7, 0.4]], 0.1)).toBe(0);
  });
});

describe("agreementReport", () => {
  it("reports labels and scores independently", () => {
    const report = agreementReport([
      { categorical: ["relevance", "relevance", "relevance"], scores: [0.6, 0.62, 0.58] },
      { categorical: ["empathy", "empathy"], scores: [0.4, 0.45] },
      { categorical: ["assertiveness", "listening", "assertiveness"], scores: [0.8, 0.7, 0.79] },
    ]);
    expect(report.items).toBe(3);
    expect(report.cohenKappa).toBeGreaterThan(0.5);
    expect(report.fleissKappa).toBeGreaterThan(0.5);
    expect(report.krippendorffAlpha).toBeGreaterThan(0.5);
    expect(report.meanAbsScoreDisagreement).toBeLessThan(0.1);
    expect(report.scoreAgreementRate).toBe(1);
    // Rater pair (0,1) disagrees on the third item (listening vs assertiveness),
    // landing Cohen's kappa in the moderate band.
    expect(report.cohenKappa!).toBeGreaterThan(0.4);
    expect(report.verdict).toContain("small");
  });

  it("handles score-only collections", () => {
    const report = agreementReport([{ categorical: [], scores: [0.5, 0.6] }, { categorical: [], scores: [0.8, 0.82] }]);
    expect(report.cohenKappa).toBeNull();
    expect(report.fleissKappa).toBeNull();
    expect(report.meanAbsScoreDisagreement).toBeCloseTo(0.06, 6);
  });

  it("bandScore cuts into four bands", () => {
    expect(bandScore(0.9)).toBe("high");
    expect(bandScore(0.7)).toBe("medium");
    expect(bandScore(0.45)).toBe("low");
    expect(bandScore(0.2)).toBe("very-low");
  });
});

describe("rubricHealth", () => {
  const reliability = (overrides: Partial<BehaviourReliability>): BehaviourReliability => ({
    behaviour: "listening",
    items: 10,
    exactAgreement: null,
    weightedAgreement: null,
    cohenKappa: null,
    meanAbsDisagreement: null,
    pearsonR: null,
    verdict: "",
    ...overrides,
  });

  it("keeps a rubric raters agree on", () => {
    const [entry] = rubricHealth([reliability({ cohenKappa: 0.75, meanAbsDisagreement: 0.08 })]);
    expect(entry!.decision).toBe("keep");
  });

  it("retires a behaviour humans fundamentally cannot rate", () => {
    const [entry] = rubricHealth([reliability({ behaviour: "charisma", cohenKappa: 0.1, meanAbsDisagreement: 0.12 })]);
    expect(entry!.decision).toBe("retire");
    expect(entry!.reason).toContain("kappa");
  });

  it("calls for redesign at borderline agreement rather than dropping it", () => {
    const [entry] = rubricHealth([reliability({ cohenKappa: 0.45, meanAbsDisagreement: 0.2 })]);
    expect(entry!.decision).toBe("redesign");
    expect(entry!.reason).toContain("sharpen");
  });

  it("withholds judgement when too few items were rated", () => {
    const [entry] = rubricHealth([reliability({ items: 2, cohenKappa: 0.1, meanAbsDisagreement: 0.4 })]);
    expect(entry!.decision).toBe("gather-more");
  });

  it("sorts nothing silently � every behaviour passed in gets a decision", () => {
    const entries = rubricHealth([
      reliability({ behaviour: "a", cohenKappa: 0.8, meanAbsDisagreement: 0.05 }),
      reliability({ behaviour: "b", cohenKappa: 0.1, meanAbsDisagreement: 0.35 }),
      reliability({ behaviour: "c" }),
    ]);
    expect(entries.map((e) => e.decision)).toEqual(["keep", "retire", "gather-more"]);
  });
});

