/**
 * Trend estimation.
 *
 * Theil-Sen slope with a Mann-Kendall significance test, not ordinary least
 * squares. Personal metric series are short, gappy and contain occasional
 * extreme days; OLS would let one twelve-hour cram session define the
 * "trend" for a month. Theil-Sen has a ~29% breakdown point and Mann-Kendall
 * needs no distributional assumption.
 */

import { daysBetween } from "../events/time.js";
import { median, quantile } from "../statistics/descriptive.js";
import { normalCdf, normalQuantile } from "../statistics/distributions.js";
import type { Interval } from "../statistics/effects.js";
import { dropMissing, type DailySeries } from "../metrics/compute.js";

export type TrendDirection = "rising" | "falling" | "flat" | "unclear";

export interface TrendResult {
  metricId: string;
  n: number;
  /** Units per day. */
  slopePerDay: number;
  slopePerWeek: number;
  slopeCi: Interval;
  intercept: number;
  /** Kendall's tau — a rank measure of monotonic trend. */
  tau: number;
  pValue: number;
  direction: TrendDirection;
  /** Change implied by the fitted slope across the observed window. */
  totalChange: number;
  firstDate: string | null;
  lastDate: string | null;
  insufficient?: string;
}

function emptyTrend(metricId: string, n: number, reason: string): TrendResult {
  return {
    metricId,
    n,
    slopePerDay: NaN,
    slopePerWeek: NaN,
    slopeCi: { low: NaN, high: NaN, level: 0.95 },
    intercept: NaN,
    tau: NaN,
    pValue: NaN,
    direction: "unclear",
    totalChange: NaN,
    firstDate: null,
    lastDate: null,
    insufficient: reason,
  };
}

/** Median of all pairwise slopes. */
export function theilSenSlope(x: readonly number[], y: readonly number[]): number {
  const slopes: number[] = [];
  for (let i = 0; i < x.length - 1; i += 1) {
    for (let j = i + 1; j < x.length; j += 1) {
      const dx = x[j]! - x[i]!;
      if (dx === 0) continue;
      slopes.push((y[j]! - y[i]!) / dx);
    }
  }
  return slopes.length ? median(slopes) : NaN;
}

/**
 * Mann-Kendall S statistic with tie correction, returning tau and a two-sided
 * p-value from the normal approximation.
 */
export function mannKendall(y: readonly number[]): { s: number; tau: number; pValue: number; variance: number } {
  const n = y.length;
  let s = 0;
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) s += Math.sign(y[j]! - y[i]!);
  }

  const counts = new Map<number, number>();
  for (const value of y) counts.set(value, (counts.get(value) ?? 0) + 1);
  let tieTerm = 0;
  for (const t of counts.values()) if (t > 1) tieTerm += t * (t - 1) * (2 * t + 5);

  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
  if (variance <= 0) return { s, tau: 0, pValue: 1, variance: 0 };

  // Continuity correction toward zero.
  const z = s > 0 ? (s - 1) / Math.sqrt(variance) : s < 0 ? (s + 1) / Math.sqrt(variance) : 0;
  const denominator = (n * (n - 1)) / 2;
  return {
    s,
    tau: denominator > 0 ? s / denominator : 0,
    pValue: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))),
    variance,
  };
}

/** Sen's confidence interval for the Theil-Sen slope. */
function senSlopeCi(x: readonly number[], y: readonly number[], variance: number, level = 0.95): Interval {
  const slopes: number[] = [];
  for (let i = 0; i < x.length - 1; i += 1) {
    for (let j = i + 1; j < x.length; j += 1) {
      const dx = x[j]! - x[i]!;
      if (dx !== 0) slopes.push((y[j]! - y[i]!) / dx);
    }
  }
  if (slopes.length < 3 || variance <= 0) return { low: NaN, high: NaN, level };
  slopes.sort((a, b) => a - b);
  const z = normalQuantile(1 - (1 - level) / 2);
  const cInterval = z * Math.sqrt(variance);
  const lowerRank = Math.max(0, Math.floor((slopes.length - cInterval) / 2) - 1);
  const upperRank = Math.min(slopes.length - 1, Math.ceil((slopes.length + cInterval) / 2));
  return { low: slopes[lowerRank]!, high: slopes[upperRank]!, level };
}

export interface TrendOptions {
  level?: number;
  /** Trends are not reported below this many observed days. */
  minPoints?: number;
  /** Significance threshold for calling a direction. */
  alpha?: number;
}

export function analyseTrend(series: DailySeries, options: TrendOptions = {}): TrendResult {
  const minPoints = options.minPoints ?? 8;
  const alpha = options.alpha ?? 0.05;
  const { dates, values } = dropMissing(series);

  if (values.length < minPoints) {
    return emptyTrend(series.metricId, values.length, `Need at least ${minPoints} days with data`);
  }

  // x is days elapsed, so gaps are honoured rather than treated as equal steps.
  const origin = dates[0]!;
  const x = dates.map((date) => daysBetween(origin, date));

  const slopePerDay = theilSenSlope(x, values);
  const kendall = mannKendall(values);
  const slopeCi = senSlopeCi(x, values, kendall.variance, options.level ?? 0.95);

  // Sen intercept: median of (y - slope*x), the companion to the Theil-Sen slope.
  const intercept = median(values.map((value, i) => value - slopePerDay * x[i]!));
  const spanDays = x[x.length - 1]! - x[0]!;
  const totalChange = slopePerDay * spanDays;

  let direction: TrendDirection;
  if (!Number.isFinite(slopePerDay)) direction = "unclear";
  else if (kendall.pValue > alpha) direction = "flat";
  else direction = slopePerDay > 0 ? "rising" : "falling";

  return {
    metricId: series.metricId,
    n: values.length,
    slopePerDay,
    slopePerWeek: slopePerDay * 7,
    slopeCi,
    intercept,
    tau: kendall.tau,
    pValue: kendall.pValue,
    direction,
    totalChange,
    firstDate: dates[0]!,
    lastDate: dates[dates.length - 1]!,
  };
}

/**
 * Week-over-week comparison for "what changed this week?".
 *
 * Reports the change against the *typical* preceding week (median of the
 * prior weeks) as well as against the immediately previous one, because a
 * single previous week is itself noisy.
 */
export interface WeekChange {
  metricId: string;
  currentMean: number;
  previousMean: number;
  typicalMean: number;
  absoluteChange: number;
  relativeChange: number;
  /** How many robust standard deviations from the typical week. */
  robustZ: number;
  currentN: number;
  previousN: number;
  notable: boolean;
}

export function weekOverWeek(
  series: DailySeries,
  currentWeekDates: readonly string[],
  previousWeekDates: readonly string[],
  priorWeeks: readonly (readonly string[])[] = [],
): WeekChange {
  const valueByDate = new Map<string, number>();
  for (let i = 0; i < series.dates.length; i += 1) {
    const value = series.values[i]!;
    if (Number.isFinite(value)) valueByDate.set(series.dates[i]!, value);
  }
  const pick = (dates: readonly string[]): number[] =>
    dates.map((date) => valueByDate.get(date)).filter((v): v is number => v !== undefined);

  const current = pick(currentWeekDates);
  const previous = pick(previousWeekDates);
  const priorMeans = priorWeeks.map((week) => averageOf(pick(week))).filter(Number.isFinite);

  const currentMean = averageOf(current);
  const previousMean = averageOf(previous);
  const typicalMean = priorMeans.length ? median(priorMeans) : previousMean;

  const spread = priorMeans.length >= 3 ? robustSpread(priorMeans) : NaN;
  const robustZ = Number.isFinite(spread) && spread > 0 ? (currentMean - typicalMean) / spread : NaN;
  const relativeChange = typicalMean !== 0 ? (currentMean - typicalMean) / Math.abs(typicalMean) : NaN;

  return {
    metricId: series.metricId,
    currentMean,
    previousMean,
    typicalMean,
    absoluteChange: currentMean - typicalMean,
    relativeChange,
    robustZ,
    currentN: current.length,
    previousN: previous.length,
    // "Notable" needs both a real sample and a move that is large in context.
    notable: current.length >= 2 && Number.isFinite(robustZ) && Math.abs(robustZ) >= 1.5,
  };
}

function averageOf(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function robustSpread(values: readonly number[]): number {
  const spread = quantile(values, 0.75) - quantile(values, 0.25);
  // IQR/1.349 estimates sigma for normal data without being dragged by outliers.
  if (spread > 0) return spread / 1.349;
  // A perfectly steady history has zero IQR. Returning NaN there would mean
  // the most consistent person in the world can never be told that something
  // changed, so fall back to a small floor proportional to the level.
  const level = Math.abs(median(values));
  return level > 0 ? level * 0.05 : NaN;
}
