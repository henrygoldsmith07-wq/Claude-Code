/**
 * Effect sizes and confidence intervals.
 *
 * Pulse never reports a p-value on its own. A significant result with a
 * negligible effect is not a finding worth acting on, and the UI is built to
 * show the effect first, so this module is on the critical path for every
 * insight.
 */

export interface Interval {
  low: number;
  high: number;
  /** Confidence level, e.g. 0.95. */
  level: number;
}

export type EffectKind =
  | "cohens_d"
  | "hedges_g"
  | "rank_biserial"
  | "pearson_r"
  | "spearman_rho"
  | "mean_difference"
  | "relative_change";

export type Magnitude = "negligible" | "small" | "moderate" | "large";

export interface EffectSize {
  kind: EffectKind;
  value: number;
  ci?: Interval;
  magnitude: Magnitude;
  /** Plain-language reading of the number, e.g. "8.7% higher". */
  label: string;
}

/** Cohen's conventions for standardised mean differences. */
export function magnitudeForD(d: number): Magnitude {
  const a = Math.abs(d);
  if (a < 0.2) return "negligible";
  if (a < 0.5) return "small";
  if (a < 0.8) return "moderate";
  return "large";
}

/** Conventions for correlation-like quantities on [-1, 1]. */
export function magnitudeForR(r: number): Magnitude {
  const a = Math.abs(r);
  if (a < 0.1) return "negligible";
  if (a < 0.3) return "small";
  if (a < 0.5) return "moderate";
  return "large";
}

export function pooledSd(sdA: number, nA: number, sdB: number, nB: number): number {
  if (nA + nB - 2 <= 0) return NaN;
  return Math.sqrt(((nA - 1) * sdA * sdA + (nB - 1) * sdB * sdB) / (nA + nB - 2));
}

export function cohensD(meanA: number, sdA: number, nA: number, meanB: number, sdB: number, nB: number): number {
  const sp = pooledSd(sdA, nA, sdB, nB);
  if (!Number.isFinite(sp) || sp === 0) return 0;
  return (meanA - meanB) / sp;
}

/**
 * Hedges' g — Cohen's d with the small-sample bias correction. Personal
 * analytics runs on tens of sessions, not thousands, so the correction is not
 * optional here.
 */
export function hedgesG(d: number, nA: number, nB: number): number {
  const df = nA + nB - 2;
  if (df <= 0) return d;
  const j = 1 - 3 / (4 * df - 1);
  return d * j;
}

/** Approximate CI for a standardised mean difference (Hedges 1981). */
export function standardisedDifferenceCi(g: number, nA: number, nB: number, z = 1.959963985): Interval {
  const df = nA + nB - 2;
  if (df <= 0) return { low: NaN, high: NaN, level: 0.95 };
  const se = Math.sqrt((nA + nB) / (nA * nB) + (g * g) / (2 * df));
  return { low: g - z * se, high: g + z * se, level: 0.95 };
}

/** Rank-biserial correlation from a Mann-Whitney U — the non-parametric effect size. */
export function rankBiserial(u: number, nA: number, nB: number): number {
  if (nA === 0 || nB === 0) return 0;
  return (2 * u) / (nA * nB) - 1;
}

export function relativeChange(from: number, to: number): number {
  if (from === 0) return NaN;
  return (to - from) / Math.abs(from);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatSigned(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}`;
}

export function describeInterval(interval: Interval | undefined, decimals = 2): string {
  if (!interval || !Number.isFinite(interval.low) || !Number.isFinite(interval.high)) return "unavailable";
  return `${interval.low.toFixed(decimals)} to ${interval.high.toFixed(decimals)} (${Math.round(interval.level * 100)}% CI)`;
}

/** True when the interval straddles the null value — i.e. direction is unresolved. */
export function intervalCrossesZero(interval: Interval | undefined): boolean {
  if (!interval || !Number.isFinite(interval.low) || !Number.isFinite(interval.high)) return true;
  return interval.low <= 0 && interval.high >= 0;
}
