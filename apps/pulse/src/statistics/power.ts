/**
 * Power and sample-size arithmetic.
 *
 * Used in two places: gating discoveries (refusing to report an
 * underpowered comparison as a finding) and designing experiments (telling the
 * user up front how many sessions they need before the answer means anything).
 */

import { normalCdf, normalQuantile } from "./distributions.js";

export interface PowerResult {
  power: number;
  /** Effect the design can detect at the requested power — the honest headline. */
  detectableEffect: number;
  n: number;
}

/**
 * Power of a two-sample t-test, normal approximation with a df adjustment.
 * Accurate to within ~0.02 of the exact non-central t for n >= 10 per group,
 * which is well inside the precision this decision needs.
 */
export function twoSampleTPower(effectSize: number, nPerGroup: number, alpha = 0.05): number {
  if (nPerGroup < 2) return 0;
  const ncp = Math.abs(effectSize) * Math.sqrt(nPerGroup / 2);
  const df = 2 * nPerGroup - 2;
  const crit = normalQuantile(1 - alpha / 2) * (1 + 1 / (4 * df));
  return normalCdf(ncp - crit) + normalCdf(-ncp - crit);
}

/** Minimum per-group sample for a target power. Returns Infinity for a zero effect. */
export function minSamplePerGroup(effectSize: number, power = 0.8, alpha = 0.05): number {
  const d = Math.abs(effectSize);
  if (d === 0) return Infinity;
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  const approx = Math.ceil((2 * (za + zb) ** 2) / (d * d));
  // Step up until the more accurate power function agrees; the closed form
  // under-estimates for small n because it ignores the t-distribution's tails.
  for (let n = Math.max(2, approx); n < approx + 60; n += 1) {
    if (twoSampleTPower(d, n, alpha) >= power) return n;
  }
  return approx;
}

/** Minimum number of pairs for a paired/crossover design. */
export function minSamplePaired(effectSize: number, power = 0.8, alpha = 0.05): number {
  const d = Math.abs(effectSize);
  if (d === 0) return Infinity;
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  return Math.max(6, Math.ceil((za + zb) ** 2 / (d * d)) + 2);
}

/** Smallest standardised effect this sample could detect at the given power. */
export function detectableEffect(nPerGroup: number, power = 0.8, alpha = 0.05): number {
  if (nPerGroup < 2) return Infinity;
  let lo = 0.001;
  let hi = 5;
  for (let i = 0; i < 80; i += 1) {
    const mid = (lo + hi) / 2;
    if (twoSampleTPower(mid, nPerGroup, alpha) < power) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Minimum sample per group for a correlation of magnitude `r`. */
export function minSampleForCorrelation(r: number, power = 0.8, alpha = 0.05): number {
  const rho = Math.abs(r);
  if (rho === 0 || rho >= 1) return Infinity;
  const z = 0.5 * Math.log((1 + rho) / (1 - rho));
  const za = normalQuantile(1 - alpha / 2);
  const zb = normalQuantile(power);
  return Math.ceil(((za + zb) / z) ** 2 + 3);
}

export function assess(effectSize: number, nPerGroup: number, alpha = 0.05, target = 0.8): PowerResult {
  return {
    power: twoSampleTPower(effectSize, nPerGroup, alpha),
    detectableEffect: detectableEffect(nPerGroup, target, alpha),
    n: nPerGroup,
  };
}

/**
 * Whether a comparison is worth reporting at all.
 *
 * A non-significant result from an underpowered comparison is "we don't know",
 * not "no effect" — the distinction matters enough that the discovery layer
 * refuses to publish either verdict when this returns false.
 */
export function isAdequatelyPowered(nA: number, nB: number, expectedEffect = 0.5, alpha = 0.05): boolean {
  const harmonic = (2 * nA * nB) / (nA + nB);
  return twoSampleTPower(expectedEffect, harmonic / 2, alpha) >= 0.5;
}
