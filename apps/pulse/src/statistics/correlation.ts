/**
 * Association measures.
 *
 * Correlation is where personal analytics most often goes wrong: with ~20
 * metrics there are ~190 pairs, and at alpha 0.05 roughly ten of them will
 * "reach significance" on pure noise. Nothing here decides anything on its own
 * — the discovery layer always runs these through FDR control and a minimum
 * sample gate before a result is allowed to become a finding.
 */

import { assertFinite, mean, rank, stdDev } from "./descriptive.js";
import { normalQuantile, tTwoSidedP } from "./distributions.js";
import { magnitudeForR, type EffectSize, type Interval } from "./effects.js";

export interface CorrelationResult {
  method: "pearson" | "spearman";
  r: number;
  n: number;
  df: number;
  pValue: number;
  ci: Interval;
  effect: EffectSize;
  insufficient?: string;
}

function emptyResult(method: "pearson" | "spearman", n: number, reason: string): CorrelationResult {
  return {
    method,
    r: NaN,
    n,
    df: Math.max(0, n - 2),
    pValue: NaN,
    ci: { low: NaN, high: NaN, level: 0.95 },
    effect: { kind: method === "pearson" ? "pearson_r" : "spearman_rho", value: NaN, magnitude: "negligible", label: "not estimable" },
    insufficient: reason,
  };
}

/** Fisher z-transform interval — asymmetric in r, which is correct near ±1. */
export function fisherCi(r: number, n: number, level = 0.95): Interval {
  if (n < 4 || Math.abs(r) >= 1) return { low: NaN, high: NaN, level };
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const crit = normalQuantile(1 - (1 - level) / 2);
  const lo = Math.tanh(z - crit * se);
  const hi = Math.tanh(z + crit * se);
  return { low: lo, high: hi, level };
}

export function pearson(x: readonly number[], y: readonly number[], level = 0.95): CorrelationResult {
  assertFinite(x, "x");
  assertFinite(y, "y");
  if (x.length !== y.length) throw new Error("pearson requires equal-length series");
  const n = x.length;
  if (n < 3) return emptyResult("pearson", n, "Need at least 3 paired observations");

  const mx = mean(x);
  const my = mean(y);
  const sx = stdDev(x);
  const sy = stdDev(y);
  if (sx === 0 || sy === 0) return emptyResult("pearson", n, "One series is constant");

  let cov = 0;
  for (let i = 0; i < n; i += 1) cov += (x[i]! - mx) * (y[i]! - my);
  cov /= n - 1;
  const r = Math.max(-1, Math.min(1, cov / (sx * sy)));

  const df = n - 2;
  const t = r * Math.sqrt(df / Math.max(1e-12, 1 - r * r));
  const ci = fisherCi(r, n, level);

  return {
    method: "pearson",
    r,
    n,
    df,
    pValue: tTwoSidedP(t, df),
    ci,
    effect: {
      kind: "pearson_r",
      value: r,
      ci,
      magnitude: magnitudeForR(r),
      label: `r = ${r.toFixed(2)} (${(r * r * 100).toFixed(0)}% of variance shared)`,
    },
  };
}

/** Spearman's rho — Pearson on ranks. Robust to the outliers real logs contain. */
export function spearman(x: readonly number[], y: readonly number[], level = 0.95): CorrelationResult {
  assertFinite(x, "x");
  assertFinite(y, "y");
  if (x.length !== y.length) throw new Error("spearman requires equal-length series");
  const n = x.length;
  if (n < 3) return emptyResult("spearman", n, "Need at least 3 paired observations");

  const result = pearson(rank(x), rank(y), level);
  if (result.insufficient) return { ...result, method: "spearman" };

  return {
    ...result,
    method: "spearman",
    effect: {
      kind: "spearman_rho",
      value: result.r,
      ci: result.ci,
      magnitude: magnitudeForR(result.r),
      label: `rho = ${result.r.toFixed(2)}`,
    },
  };
}

/**
 * Partial correlation of x and y controlling for a set of covariates,
 * computed by correlating the residuals of both against the controls.
 *
 * This is how Pulse checks whether an association survives the obvious
 * confounders (time of day, day of week, session length) rather than merely
 * warning about them.
 */
export function partialCorrelation(
  x: readonly number[],
  y: readonly number[],
  controls: readonly (readonly number[])[],
  level = 0.95,
): CorrelationResult {
  if (controls.length === 0) return pearson(x, y, level);
  const rx = residualise(x, controls);
  const ry = residualise(y, controls);
  const result = pearson(rx, ry, level);
  if (result.insufficient) return result;
  // Each control costs a degree of freedom.
  const df = Math.max(1, x.length - 2 - controls.length);
  const t = result.r * Math.sqrt(df / Math.max(1e-12, 1 - result.r * result.r));
  return { ...result, df, pValue: tTwoSidedP(t, df) };
}

/** OLS residuals of `y` on `predictors` (with intercept), via normal equations. */
export function residualise(y: readonly number[], predictors: readonly (readonly number[])[]): number[] {
  const n = y.length;
  const design: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row = [1];
    for (const p of predictors) row.push(p[i]!);
    design.push(row);
  }
  const coefficients = solveLeastSquares(design, [...y]);
  return y.map((value, i) => {
    let fitted = 0;
    for (let j = 0; j < coefficients.length; j += 1) fitted += coefficients[j]! * design[i]![j]!;
    return value - fitted;
  });
}

/**
 * Least squares by Gaussian elimination on X'X with ridge stabilisation.
 * The tiny ridge keeps collinear controls (a common case: duration and
 * question count) from producing an unusable singular system.
 */
export function solveLeastSquares(design: readonly (readonly number[])[], target: readonly number[]): number[] {
  const p = design[0]?.length ?? 0;
  const n = design.length;
  if (p === 0 || n === 0) return [];

  const xtx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i += 1) {
    const row = design[i]!;
    for (let j = 0; j < p; j += 1) {
      xty[j]! += row[j]! * target[i]!;
      for (let k = 0; k < p; k += 1) xtx[j]![k]! += row[j]! * row[k]!;
    }
  }
  for (let j = 1; j < p; j += 1) xtx[j]![j]! += 1e-8;

  // Gauss-Jordan with partial pivoting.
  for (let col = 0; col < p; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < p; r += 1) {
      if (Math.abs(xtx[r]![col]!) > Math.abs(xtx[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(xtx[pivot]![col]!) < 1e-12) continue;
    [xtx[col], xtx[pivot]] = [xtx[pivot]!, xtx[col]!];
    [xty[col], xty[pivot]] = [xty[pivot]!, xty[col]!];

    const diag = xtx[col]![col]!;
    for (let k = col; k < p; k += 1) xtx[col]![k]! /= diag;
    xty[col]! /= diag;

    for (let r = 0; r < p; r += 1) {
      if (r === col) continue;
      const factor = xtx[r]![col]!;
      if (factor === 0) continue;
      for (let k = col; k < p; k += 1) xtx[r]![k]! -= factor * xtx[col]![k]!;
      xty[r]! -= factor * xty[col]!;
    }
  }
  return xty;
}
