/**
 * Two-sample and paired comparisons.
 *
 * Every function returns the same `ComparisonResult` shape so the discovery,
 * experiment and reporting layers can treat "how big, how sure, how many"
 * uniformly regardless of which test was appropriate.
 */

import { assertFinite, mean, rank, stdDev, tieGroups, variance } from "./descriptive.js";
import { normalCdf, tQuantile, tTwoSidedP } from "./distributions.js";
import {
  cohensD,
  hedgesG,
  magnitudeForD,
  magnitudeForR,
  rankBiserial,
  standardisedDifferenceCi,
  type EffectSize,
  type Interval,
} from "./effects.js";

export type TestName =
  | "welch_t"
  | "paired_t"
  | "mann_whitney_u"
  | "wilcoxon_signed_rank"
  | "two_proportion_z";

export interface ComparisonResult {
  test: TestName;
  statistic: number;
  df?: number;
  pValue: number;
  nA: number;
  nB: number;
  meanA: number;
  meanB: number;
  /** meanA - meanB, in the metric's own units. */
  difference: number;
  differenceCi?: Interval;
  effect: EffectSize;
  /** Set when the inputs were too thin to test honestly. */
  insufficient?: string;
}

const Z_95 = 1.959963984540054;

function insufficientResult(test: TestName, nA: number, nB: number, reason: string): ComparisonResult {
  return {
    test,
    statistic: NaN,
    pValue: NaN,
    nA,
    nB,
    meanA: nA ? mean([]) : NaN,
    meanB: NaN,
    difference: NaN,
    effect: { kind: "mean_difference", value: NaN, magnitude: "negligible", label: "not estimable" },
    insufficient: reason,
  };
}

/**
 * Welch's t-test — the default two-sample comparison.
 *
 * Student's pooled-variance test is never used: personal data routinely has
 * unequal group sizes and unequal spread (an "after exercise" group is smaller
 * and more variable), and Welch costs nothing when variances happen to match.
 */
export function welchTTest(a: readonly number[], b: readonly number[], level = 0.95): ComparisonResult {
  assertFinite(a, "group A");
  assertFinite(b, "group B");
  if (a.length < 2 || b.length < 2) {
    return insufficientResult("welch_t", a.length, b.length, "Each group needs at least 2 observations");
  }

  const nA = a.length;
  const nB = b.length;
  const mA = mean(a);
  const mB = mean(b);
  const vA = variance(a);
  const vB = variance(b);
  const se = Math.sqrt(vA / nA + vB / nB);

  if (se === 0) {
    return insufficientResult("welch_t", nA, nB, "Both groups are constant — no variance to test");
  }

  const t = (mA - mB) / se;
  // Welch-Satterthwaite degrees of freedom.
  const df = (vA / nA + vB / nB) ** 2 / ((vA / nA) ** 2 / (nA - 1) + (vB / nB) ** 2 / (nB - 1));
  const pValue = tTwoSidedP(t, df);

  const tCrit = tQuantile(1 - (1 - level) / 2, df);
  const difference = mA - mB;
  const differenceCi: Interval = {
    low: difference - tCrit * se,
    high: difference + tCrit * se,
    level,
  };

  const d = cohensD(mA, stdDev(a), nA, mB, stdDev(b), nB);
  const g = hedgesG(d, nA, nB);

  return {
    test: "welch_t",
    statistic: t,
    df,
    pValue,
    nA,
    nB,
    meanA: mA,
    meanB: mB,
    difference,
    differenceCi,
    effect: {
      kind: "hedges_g",
      value: g,
      ci: standardisedDifferenceCi(g, nA, nB),
      magnitude: magnitudeForD(g),
      label: `${g >= 0 ? "+" : ""}${g.toFixed(2)} SD`,
    },
  };
}

/** Paired comparison — used for crossover experiments and before/after on the same unit. */
export function pairedTTest(before: readonly number[], after: readonly number[], level = 0.95): ComparisonResult {
  assertFinite(before, "before");
  assertFinite(after, "after");
  if (before.length !== after.length) throw new Error("pairedTTest requires equal-length series");
  if (before.length < 2) {
    return insufficientResult("paired_t", before.length, after.length, "Need at least 2 pairs");
  }

  const diffs = after.map((v, i) => v - before[i]!);
  const n = diffs.length;
  const mDiff = mean(diffs);
  const sdDiff = stdDev(diffs);
  const se = sdDiff / Math.sqrt(n);

  if (se === 0) {
    return insufficientResult("paired_t", n, n, "All pairs differ by exactly the same amount");
  }

  const t = mDiff / se;
  const df = n - 1;
  const tCrit = tQuantile(1 - (1 - level) / 2, df);
  // Standardised by the SD of the differences (Cohen's d_z).
  const dz = mDiff / sdDiff;

  return {
    test: "paired_t",
    statistic: t,
    df,
    pValue: tTwoSidedP(t, df),
    nA: n,
    nB: n,
    meanA: mean(after),
    meanB: mean(before),
    difference: mDiff,
    differenceCi: { low: mDiff - tCrit * se, high: mDiff + tCrit * se, level },
    effect: {
      kind: "cohens_d",
      value: dz,
      magnitude: magnitudeForD(dz),
      label: `${dz >= 0 ? "+" : ""}${dz.toFixed(2)} SD (paired)`,
    },
  };
}

/**
 * Mann-Whitney U with a tie correction and normal approximation.
 *
 * The fallback when a metric is ordinal (self-rated focus 1-5) or visibly
 * skewed (session duration). Reports rank-biserial correlation as its effect
 * size, which is interpretable as "probability of superiority, rescaled".
 */
export function mannWhitneyU(a: readonly number[], b: readonly number[]): ComparisonResult {
  assertFinite(a, "group A");
  assertFinite(b, "group B");
  const nA = a.length;
  const nB = b.length;
  if (nA < 3 || nB < 3) {
    return insufficientResult("mann_whitney_u", nA, nB, "Each group needs at least 3 observations");
  }

  const combined = [...a, ...b];
  const ranks = rank(combined);
  const rankSumA = ranks.slice(0, nA).reduce((acc, r) => acc + r, 0);
  const uA = rankSumA - (nA * (nA + 1)) / 2;

  const n = nA + nB;
  const meanU = (nA * nB) / 2;
  const tieCorrection = tieGroups(combined).reduce((acc, t) => acc + (t ** 3 - t), 0);
  const sdU = Math.sqrt((nA * nB * (n + 1)) / 12 - (nA * nB * tieCorrection) / (12 * n * (n - 1)));

  if (!Number.isFinite(sdU) || sdU === 0) {
    return insufficientResult("mann_whitney_u", nA, nB, "All observations are tied");
  }

  // Continuity correction, applied toward the null.
  const z = (uA - meanU - Math.sign(uA - meanU) * 0.5) / sdU;
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  const rb = rankBiserial(uA, nA, nB);

  return {
    test: "mann_whitney_u",
    statistic: uA,
    pValue,
    nA,
    nB,
    meanA: mean(a),
    meanB: mean(b),
    difference: mean(a) - mean(b),
    effect: {
      kind: "rank_biserial",
      value: rb,
      magnitude: magnitudeForR(rb),
      label: `${(((rb + 1) / 2) * 100).toFixed(0)}% chance a group-A session scores higher`,
    },
  };
}

/** Wilcoxon signed-rank — the paired non-parametric counterpart. */
export function wilcoxonSignedRank(before: readonly number[], after: readonly number[]): ComparisonResult {
  assertFinite(before, "before");
  assertFinite(after, "after");
  if (before.length !== after.length) throw new Error("wilcoxonSignedRank requires equal-length series");

  const diffs = after.map((v, i) => v - before[i]!).filter((d) => d !== 0);
  const n = diffs.length;
  if (n < 6) {
    return insufficientResult("wilcoxon_signed_rank", n, n, "Need at least 6 non-zero differences");
  }

  const ranks = rank(diffs.map(Math.abs));
  let wPlus = 0;
  for (let i = 0; i < n; i += 1) if (diffs[i]! > 0) wPlus += ranks[i]!;

  const meanW = (n * (n + 1)) / 4;
  const tieCorrection = tieGroups(diffs.map(Math.abs)).reduce((acc, t) => acc + (t ** 3 - t), 0);
  const sdW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieCorrection / 48);
  if (sdW === 0) return insufficientResult("wilcoxon_signed_rank", n, n, "No rank variation");

  const z = (wPlus - meanW - Math.sign(wPlus - meanW) * 0.5) / sdW;
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  const rb = z / Math.sqrt(n);

  return {
    test: "wilcoxon_signed_rank",
    statistic: wPlus,
    pValue,
    nA: n,
    nB: n,
    meanA: mean(after),
    meanB: mean(before),
    difference: mean(after) - mean(before),
    effect: {
      kind: "rank_biserial",
      value: rb,
      magnitude: magnitudeForR(rb),
      label: `${rb >= 0 ? "+" : ""}${rb.toFixed(2)} rank effect`,
    },
  };
}

/** Two-proportion z-test with a Wilson-style interval on the difference. */
export function twoProportionTest(
  successesA: number,
  nA: number,
  successesB: number,
  nB: number,
  level = 0.95,
): ComparisonResult {
  if (nA < 5 || nB < 5) {
    return insufficientResult("two_proportion_z", nA, nB, "Each group needs at least 5 trials");
  }
  const pA = successesA / nA;
  const pB = successesB / nB;
  const pooled = (successesA + successesB) / (nA + nB);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  if (sePooled === 0) return insufficientResult("two_proportion_z", nA, nB, "No variation in outcomes");

  const z = (pA - pB) / sePooled;
  const seDiff = Math.sqrt((pA * (1 - pA)) / nA + (pB * (1 - pB)) / nB);
  const zCrit = level === 0.95 ? Z_95 : Math.abs(tQuantile(1 - (1 - level) / 2, 1e8));
  const difference = pA - pB;
  // Cohen's h — the effect size appropriate to proportions.
  const h = 2 * Math.asin(Math.sqrt(pA)) - 2 * Math.asin(Math.sqrt(pB));

  return {
    test: "two_proportion_z",
    statistic: z,
    pValue: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))),
    nA,
    nB,
    meanA: pA,
    meanB: pB,
    difference,
    differenceCi: { low: difference - zCrit * seDiff, high: difference + zCrit * seDiff, level },
    effect: {
      kind: "cohens_d",
      value: h,
      magnitude: magnitudeForD(h),
      label: `${(difference * 100).toFixed(1)} percentage points`,
    },
  };
}

/**
 * Picks the defensible test for the data rather than always reaching for t.
 * Falls back to ranks when a group is small or heavily skewed.
 */
export function compareGroups(a: readonly number[], b: readonly number[]): ComparisonResult {
  const small = a.length < 15 || b.length < 15;
  const skewed = isHeavilySkewed(a) || isHeavilySkewed(b);
  if (small || skewed) {
    const nonParametric = mannWhitneyU(a, b);
    if (!nonParametric.insufficient) return nonParametric;
  }
  return welchTTest(a, b);
}

function isHeavilySkewed(values: readonly number[]): boolean {
  if (values.length < 4) return false;
  const m = mean(values);
  const sd = stdDev(values);
  if (!Number.isFinite(sd) || sd === 0) return false;
  const skew = mean(values.map((v) => ((v - m) / sd) ** 3));
  return Math.abs(skew) > 1.5;
}
