/**
 * Statistical correctness.
 *
 * Distribution functions are checked against published reference values rather
 * than against themselves, because a self-consistent but wrong implementation
 * is exactly the failure mode that survives casual testing and quietly
 * miscalibrates every p-value in the product.
 */

import { describe, expect, it } from "vitest";
import {
  chiSquareCdf,
  erf,
  incompleteBeta,
  logGamma,
  normalCdf,
  normalQuantile,
  tCdf,
  tQuantile,
  tTwoSidedP,
} from "../src/statistics/distributions.js";
import { mad, mean, median, quantile, rank, stdDev, summarise, variance } from "../src/statistics/descriptive.js";
import {
  compareGroups,
  mannWhitneyU,
  pairedTTest,
  twoProportionTest,
  welchTTest,
  wilcoxonSignedRank,
} from "../src/statistics/comparisons.js";
import { partialCorrelation, pearson, residualise, spearman } from "../src/statistics/correlation.js";
import { benjaminiHochberg, bonferroni, holmBonferroni, pairwiseFamilySize } from "../src/statistics/multiple.js";
import { detectableEffect, minSamplePerGroup, twoSampleTPower } from "../src/statistics/power.js";
import { bootstrapCi, createRng, normalDeviate, permutationTest } from "../src/statistics/random.js";
import { cohensD, hedgesG, magnitudeForD, rankBiserial } from "../src/statistics/effects.js";
import { causalityCaveat, gradeConfidence } from "../src/statistics/confidence.js";

describe("distribution functions", () => {
  it("matches reference values for the standard normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 12);
    expect(normalCdf(1)).toBeCloseTo(0.8413447460685429, 10);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021048517795, 10);
    expect(normalCdf(-2.5)).toBeCloseTo(0.006209665325776132, 10);
    expect(normalCdf(3)).toBeCloseTo(0.9986501019683699, 10);
  });

  it("inverts the normal CDF accurately", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959963984540054, 8);
    expect(normalQuantile(0.95)).toBeCloseTo(1.6448536269514722, 8);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 10);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.959963984540054, 8);
    for (const p of [0.001, 0.1, 0.3, 0.7, 0.9, 0.999]) {
      expect(normalCdf(normalQuantile(p))).toBeCloseTo(p, 9);
    }
  });

  it("matches reference values for erf and logGamma", () => {
    expect(erf(0.5)).toBeCloseTo(0.5204998778130465, 10);
    expect(erf(-1)).toBeCloseTo(-0.8427007929497149, 10);
    expect(logGamma(1)).toBeCloseTo(0, 10);
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 10);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.sqrt(Math.PI)), 10);
  });

  it("matches reference values for Student's t", () => {
    // t = 2.228 at 10 df is the 97.5th percentile.
    expect(tCdf(2.228138852, 10)).toBeCloseTo(0.975, 7);
    expect(tCdf(0, 5)).toBeCloseTo(0.5, 12);
    expect(tCdf(-1.812461123, 10)).toBeCloseTo(0.05, 7);
    expect(tQuantile(0.975, 10)).toBeCloseTo(2.228138852, 6);
    expect(tQuantile(0.975, 30)).toBeCloseTo(2.042272456, 6);
    // With huge df, t converges on the normal.
    expect(tQuantile(0.975, 1e8)).toBeCloseTo(1.959963985, 5);
  });

  it("computes two-sided p-values from t statistics", () => {
    expect(tTwoSidedP(2.228138852, 10)).toBeCloseTo(0.05, 7);
    expect(tTwoSidedP(0, 10)).toBeCloseTo(1, 10);
    expect(tTwoSidedP(-2.228138852, 10)).toBeCloseTo(0.05, 7);
  });

  it("matches reference values for the incomplete beta and chi-square", () => {
    expect(incompleteBeta(0.5, 1, 1)).toBeCloseTo(0.5, 10);
    expect(incompleteBeta(0.5, 2, 3)).toBeCloseTo(0.6875, 10);
    // chi-square(1) at 3.841 is the 95th percentile.
    expect(chiSquareCdf(3.841458821, 1)).toBeCloseTo(0.95, 7);
    expect(chiSquareCdf(5.991464547, 2)).toBeCloseTo(0.95, 7);
  });
});

describe("descriptive statistics", () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];

  it("computes the standard summary correctly", () => {
    expect(mean(values)).toBe(5);
    expect(variance(values)).toBeCloseTo(4.571428571, 8);
    expect(stdDev(values)).toBeCloseTo(2.138089935, 8);
    expect(median(values)).toBe(4.5);
  });

  it("returns NaN rather than a fake answer for undefined statistics", () => {
    expect(mean([])).toBeNaN();
    expect(variance([1])).toBeNaN();
    expect(median([])).toBeNaN();
  });

  it("computes type-7 quantiles matching R", () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(data, 0.25)).toBeCloseTo(3.25, 10);
    expect(quantile(data, 0.75)).toBeCloseTo(7.75, 10);
    expect(quantile(data, 0)).toBe(1);
    expect(quantile(data, 1)).toBe(10);
  });

  it("uses a scaled MAD that estimates sigma for normal data", () => {
    const rng = createRng("mad-check");
    const normal = Array.from({ length: 4000 }, () => normalDeviate(rng, 10, 2));
    expect(mad(normal)).toBeCloseTo(2, 0);
    // And unlike SD, it barely moves when a wild outlier is added.
    const withOutlier = [...normal, 5000];
    expect(Math.abs(mad(withOutlier) - mad(normal))).toBeLessThan(0.05);
    expect(stdDev(withOutlier)).toBeGreaterThan(stdDev(normal) * 5);
  });

  it("averages tied ranks", () => {
    expect(rank([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(rank([5, 5, 5])).toEqual([2, 2, 2]);
  });

  it("summarises in one pass", () => {
    const summary = summarise(values);
    expect(summary.n).toBe(8);
    expect(summary.min).toBe(2);
    expect(summary.max).toBe(9);
  });
});

describe("group comparisons", () => {
  it("reproduces a known Welch t-test", () => {
    const a = [27.5, 21, 19, 23.6, 17, 17.9, 16.9, 20.1, 21.9, 22.6];
    const b = [27.1, 22, 20.8, 23.4, 23.4, 23.5, 25.8, 22, 24.8, 20.2];
    const result = welchTTest(a, b);
    // Hand-computed: means 20.75 vs 23.30, Welch-Satterthwaite df 15.4979.
    expect(result.statistic).toBeCloseTo(-2.035662, 5);
    expect(result.df).toBeCloseTo(15.4979, 3);
    expect(result.pValue).toBeCloseTo(0.059254, 5);
    expect(result.differenceCi!.low).toBeLessThan(0);
    expect(result.differenceCi!.high).toBeGreaterThan(0);
  });

  it("reports an effect size and interval alongside every p-value", () => {
    const a = [10, 12, 11, 13, 12, 14, 11, 12, 13, 12, 11, 13, 12, 14, 13];
    const b = [8, 9, 7, 10, 9, 8, 9, 7, 8, 9, 10, 8, 9, 7, 8];
    const result = welchTTest(a, b);
    expect(result.effect.kind).toBe("hedges_g");
    expect(result.effect.value).toBeGreaterThan(2);
    expect(result.effect.magnitude).toBe("large");
    expect(result.effect.ci).toBeDefined();
  });

  it("declines to test when a group is too small", () => {
    const result = welchTTest([1], [2, 3, 4]);
    expect(result.insufficient).toMatch(/at least 2/);
    expect(result.pValue).toBeNaN();
  });

  it("declines when both groups are constant", () => {
    expect(welchTTest([5, 5, 5], [5, 5, 5]).insufficient).toMatch(/constant/);
  });

  it("computes Mann-Whitney U with a tie correction", () => {
    const a = [1, 2, 3, 4, 5, 6];
    const b = [7, 8, 9, 10, 11, 12];
    const result = mannWhitneyU(a, b);
    expect(result.statistic).toBe(0);
    expect(result.pValue).toBeLessThan(0.01);
    expect(result.effect.value).toBeCloseTo(-1, 10);
  });

  it("returns a near-null result for identical distributions", () => {
    const values = [3, 5, 7, 9, 11, 13, 15, 17];
    const result = mannWhitneyU(values, [...values]);
    expect(result.pValue).toBeGreaterThan(0.5);
    expect(Math.abs(result.effect.value)).toBeLessThan(0.1);
  });

  it("computes a paired t-test on differences, not on group means", () => {
    const before = [200, 190, 210, 205, 195, 200, 215, 190];
    const after = [205, 197, 213, 210, 199, 206, 219, 195];
    const result = pairedTTest(before, after);
    // Differences are [5, 7, 3, 5, 4, 6, 4, 5], mean 4.875.
    expect(result.difference).toBeCloseTo(4.875, 10);
    expect(result.pValue).toBeLessThan(0.001);
    expect(result.nA).toBe(8);
  });

  it("rejects mismatched paired series", () => {
    expect(() => pairedTTest([1, 2, 3], [1, 2])).toThrow(/equal-length/);
  });

  it("computes Wilcoxon signed-rank and needs enough non-zero differences", () => {
    const before = [10, 12, 14, 16, 18, 20, 22, 24];
    const after = [12, 15, 15, 19, 21, 22, 26, 27];
    const result = wilcoxonSignedRank(before, after);
    expect(result.pValue).toBeLessThan(0.05);
    expect(wilcoxonSignedRank([1, 2, 3], [2, 3, 4]).insufficient).toMatch(/at least 6/);
  });

  it("compares proportions with an interval on the difference", () => {
    const result = twoProportionTest(45, 100, 30, 100);
    expect(result.meanA).toBeCloseTo(0.45, 10);
    expect(result.difference).toBeCloseTo(0.15, 10);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.differenceCi!.low).toBeGreaterThan(0);
  });

  it("chooses ranks for small or skewed samples and t otherwise", () => {
    const small = compareGroups([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]);
    expect(small.test).toBe("mann_whitney_u");

    const rng = createRng("large-normal");
    const a = Array.from({ length: 40 }, () => normalDeviate(rng, 10, 2));
    const b = Array.from({ length: 40 }, () => normalDeviate(rng, 11, 2));
    expect(compareGroups(a, b).test).toBe("welch_t");

    // A heavy right tail routes to ranks even at a large sample size.
    const skewed = Array.from({ length: 40 }, (_, i) => (i === 39 ? 500 : i));
    expect(compareGroups(skewed, b).test).toBe("mann_whitney_u");
  });
});

describe("effect sizes", () => {
  it("computes Cohen's d and applies the small-sample correction", () => {
    const d = cohensD(10, 2, 10, 8, 2, 10);
    expect(d).toBeCloseTo(1, 6);
    const g = hedgesG(d, 10, 10);
    expect(g).toBeLessThan(d);
    // J = 1 - 3 / (4 x 18 - 1) = 0.957746...
    expect(g).toBeCloseTo(0.9577465, 6);
    // The correction vanishes as the sample grows.
    expect(hedgesG(d, 500, 500)).toBeCloseTo(d, 2);
  });

  it("labels magnitudes by Cohen's conventions", () => {
    expect(magnitudeForD(0.1)).toBe("negligible");
    expect(magnitudeForD(0.3)).toBe("small");
    expect(magnitudeForD(0.6)).toBe("moderate");
    expect(magnitudeForD(1.2)).toBe("large");
  });

  it("computes rank-biserial correlation from U", () => {
    expect(rankBiserial(0, 5, 5)).toBe(-1);
    expect(rankBiserial(25, 5, 5)).toBe(1);
    expect(rankBiserial(12.5, 5, 5)).toBe(0);
  });
});

describe("correlation", () => {
  it("reproduces a known Pearson correlation and its interval", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const y = [2, 4, 5, 4, 5, 7, 8, 9, 9, 12];
    const result = pearson(x, y);
    // Hand-computed: 79.5 / sqrt(82.5 x 82.5) = 0.9636364.
    expect(result.r).toBeCloseTo(0.9636364, 6);
    expect(result.pValue).toBeLessThan(0.001);
    expect(result.ci.low).toBeLessThan(result.r);
    expect(result.ci.high).toBeGreaterThan(result.r);
    expect(result.ci.high).toBeLessThanOrEqual(1);
  });

  it("gives Spearman = 1 for any monotone relationship, where Pearson does not", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = x.map((value) => value ** 3);
    expect(spearman(x, y).r).toBeCloseTo(1, 10);
    expect(pearson(x, y).r).toBeLessThan(0.95);
  });

  it("declines on constant series and short series", () => {
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4]).insufficient).toMatch(/constant/);
    expect(pearson([1, 2], [1, 2]).insufficient).toMatch(/at least 3/);
  });

  it("removes a common cause with partial correlation", () => {
    // x and y are both driven by z and are otherwise unrelated.
    const rng = createRng("confound");
    const z = Array.from({ length: 200 }, () => normalDeviate(rng, 0, 1));
    const x = z.map((value) => value * 2 + normalDeviate(rng, 0, 0.4));
    const y = z.map((value) => value * 3 + normalDeviate(rng, 0, 0.4));

    expect(Math.abs(pearson(x, y).r)).toBeGreaterThan(0.9);
    expect(Math.abs(partialCorrelation(x, y, [z]).r)).toBeLessThan(0.25);
  });

  it("residualises against multiple predictors", () => {
    const rng = createRng("residual");
    const a = Array.from({ length: 100 }, () => normalDeviate(rng, 0, 1));
    const b = Array.from({ length: 100 }, () => normalDeviate(rng, 0, 1));
    const y = a.map((value, i) => 3 * value + 2 * b[i]! + 5);
    const residuals = residualise(y, [a, b]);
    expect(Math.max(...residuals.map(Math.abs))).toBeLessThan(1e-6);
  });
});

describe("multiple-testing correction", () => {
  it("controls the false discovery rate with Benjamini-Hochberg", () => {
    const pValues = [0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.074, 0.205, 0.212, 0.216];
    const result = benjaminiHochberg(pValues, (p) => p, 0.05);
    expect(result.summary.familySize).toBe(10);
    // Step-up: the largest k with p(k) <= k/m x q is k = 2, since
    // 0.008 <= 0.010 but 0.039 > 0.015. Only two survive at q = 0.05.
    expect(result.results.filter((entry) => entry.significant).map((entry) => entry.item)).toEqual([0.001, 0.008]);
    expect(result.summary.expectedFalseDiscoveries).toBeCloseTo(0.1, 10);
    // At the looser q = 0.25 the largest p (0.216) clears 10/10 x 0.25, so the
    // step-up admits the whole family — which is exactly why q matters.
    expect(benjaminiHochberg(pValues, (p) => p, 0.25).summary.discoveries).toBe(10);
  });

  it("keeps adjusted p-values monotone in the raw p-values", () => {
    const pValues = [0.01, 0.02, 0.03, 0.04, 0.05, 0.9];
    const adjusted = benjaminiHochberg(pValues, (p) => p).results
      .slice()
      .sort((a, b) => a.pValue - b.pValue)
      .map((entry) => entry.adjustedP);
    for (let i = 1; i < adjusted.length; i += 1) {
      expect(adjusted[i]!).toBeGreaterThanOrEqual(adjusted[i - 1]! - 1e-12);
    }
  });

  it("is strictly more conservative under Holm and Bonferroni", () => {
    const pValues = [0.001, 0.008, 0.039, 0.041, 0.042, 0.06];
    const fdr = benjaminiHochberg(pValues, (p) => p).summary.discoveries;
    const holm = holmBonferroni(pValues, (p) => p).summary.discoveries;
    const bonf = bonferroni(pValues, (p) => p).summary.discoveries;
    expect(holm).toBeLessThanOrEqual(fdr);
    expect(bonf).toBeLessThanOrEqual(holm);
  });

  it("finds almost nothing in a family of pure noise", () => {
    const rng = createRng("null-family");
    const pValues = Array.from({ length: 200 }, () => rng.next());
    expect(benjaminiHochberg(pValues, (p) => p, 0.05).summary.discoveries).toBeLessThanOrEqual(2);
  });

  it("reports the size of a pairwise scan", () => {
    expect(pairwiseFamilySize(20)).toBe(190);
    expect(pairwiseFamilySize(20, 3)).toBe(570);
  });
});

describe("power and sample size", () => {
  it("matches standard sample-size tables", () => {
    // Classic result: d = 0.5 at 80% power needs ~64 per group.
    expect(minSamplePerGroup(0.5, 0.8, 0.05)).toBeGreaterThanOrEqual(62);
    expect(minSamplePerGroup(0.5, 0.8, 0.05)).toBeLessThanOrEqual(67);
    // d = 0.8 needs ~26 per group.
    expect(minSamplePerGroup(0.8, 0.8, 0.05)).toBeGreaterThanOrEqual(24);
    expect(minSamplePerGroup(0.8, 0.8, 0.05)).toBeLessThanOrEqual(29);
  });

  it("computes power that rises with sample size and effect", () => {
    expect(twoSampleTPower(0.5, 64)).toBeGreaterThan(0.78);
    expect(twoSampleTPower(0.5, 20)).toBeLessThan(twoSampleTPower(0.5, 64));
    expect(twoSampleTPower(0.2, 40)).toBeLessThan(twoSampleTPower(0.8, 40));
  });

  it("reports what a given sample could actually detect", () => {
    const detectable = detectableEffect(20);
    expect(detectable).toBeGreaterThan(0.8);
    expect(twoSampleTPower(detectable, 20)).toBeCloseTo(0.8, 1);
  });

  it("demands an infinite sample for a zero effect", () => {
    expect(minSamplePerGroup(0)).toBe(Infinity);
  });
});

describe("seeded randomness", () => {
  it("produces identical sequences for the same seed", () => {
    const a = Array.from({ length: 10 }, () => createRng("x").next());
    expect(new Set(a).size).toBe(1);
    const first = createRng(42);
    const second = createRng(42);
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(Array.from({ length: 20 }, () => second.next()));
  });

  it("produces different sequences for different seeds", () => {
    expect(createRng("a").next()).not.toBe(createRng("b").next());
  });

  it("bootstraps an interval that contains the true mean", () => {
    const rng = createRng("bootstrap");
    const sample = Array.from({ length: 200 }, () => normalDeviate(rng, 50, 10));
    const result = bootstrapCi(sample, (values) => values.reduce((a, b) => a + b, 0) / values.length, {
      seed: "fixed",
      iterations: 1000,
    });
    expect(result.low).toBeLessThan(50);
    expect(result.high).toBeGreaterThan(50);
    // And it is reproducible.
    const repeat = bootstrapCi(sample, (values) => values.reduce((a, b) => a + b, 0) / values.length, {
      seed: "fixed",
      iterations: 1000,
    });
    expect(repeat.low).toBe(result.low);
  });

  it("permutation-tests a real difference and a null one", () => {
    const rng = createRng("perm");
    const a = Array.from({ length: 30 }, () => normalDeviate(rng, 10, 1));
    const b = Array.from({ length: 30 }, () => normalDeviate(rng, 12, 1));
    expect(permutationTest(a, b, { seed: "p1", iterations: 2000 }).pValue).toBeLessThan(0.01);

    const c = Array.from({ length: 30 }, () => normalDeviate(rng, 10, 1));
    expect(permutationTest(a, c, { seed: "p2", iterations: 2000 }).pValue).toBeGreaterThan(0.05);
  });

  it("never returns a p-value of exactly zero", () => {
    const a = Array.from({ length: 20 }, (_, i) => i);
    const b = Array.from({ length: 20 }, (_, i) => i + 1000);
    expect(permutationTest(a, b, { iterations: 500 }).pValue).toBeGreaterThan(0);
  });
});

describe("confidence grading", () => {
  const base = {
    sampleSize: 80,
    effectMagnitude: 0.6,
    adjustedP: 0.01,
    dataQuality: 0.9,
    familySize: 10,
  } as const;

  it("caps observational evidence below high confidence, however good the data", () => {
    const correlation = gradeConfidence({
      ...base,
      evidenceClass: "correlation",
      sampleSize: 5000,
      effectMagnitude: 2,
      adjustedP: 1e-12,
      dataQuality: 1,
      familySize: 1,
      replicatedOutOfSample: true,
    });
    expect(correlation.level).not.toBe("high");
    expect(correlation.score).toBeLessThanOrEqual(0.74);
  });

  it("grades an experiment higher than the same numbers observed", () => {
    const observed = gradeConfidence({ ...base, evidenceClass: "correlation" });
    const experimental = gradeConfidence({ ...base, evidenceClass: "experiment" });
    expect(experimental.score).toBeGreaterThan(observed.score);
  });

  it("penalises small samples, weak data and uncontrolled confounders", () => {
    const strong = gradeConfidence({ ...base, evidenceClass: "correlation" });
    const weak = gradeConfidence({
      ...base,
      evidenceClass: "correlation",
      sampleSize: 12,
      dataQuality: 0.3,
      uncontrolledConfounders: 3,
    });
    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.limitations.length).toBeGreaterThan(strong.limitations.length);
    expect(weak.limitations.some((text) => /Small sample/.test(text))).toBe(true);
  });

  it("penalises a result found in a large search", () => {
    // Deliberately below the observational cap, so the penalty is visible
    // rather than hidden behind the 0.74 ceiling.
    const modest = { ...base, effectMagnitude: 0.3, dataQuality: 0.6, adjustedP: 0.04 } as const;
    const focused = gradeConfidence({ ...modest, evidenceClass: "correlation", familySize: 3 });
    const fished = gradeConfidence({ ...modest, evidenceClass: "correlation", familySize: 400 });
    expect(focused.score).toBeLessThan(0.74);
    expect(fished.score).toBeLessThan(focused.score);
    expect(fished.limitations.some((text) => /scanning 400/.test(text))).toBe(true);
  });

  it("flags failure to survive correction as a limitation", () => {
    const graded = gradeConfidence({ ...base, evidenceClass: "correlation", adjustedP: 0.4 });
    expect(graded.limitations.some((text) => /does not survive/i.test(text))).toBe(true);
  });

  it("always supplies a causality caveat, and only an experiment gets a causal reading", () => {
    expect(causalityCaveat("correlation")).toMatch(/not a cause/i);
    expect(causalityCaveat("observation")).toMatch(/not an explanation/i);
    expect(causalityCaveat("hypothesis")).toMatch(/untested/i);
    expect(causalityCaveat("experiment")).toMatch(/causal reading is defensible/i);
  });
});
