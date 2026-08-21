/**
 * Naive discovery baselines.
 *
 * The question the validation benchmarks have to answer is not "does Pulse
 * find things?" but "does it find them *better than what anyone would build
 * in an afternoon*?". These are those afternoon builds:
 *
 *   - `pearson-dashboard`  — every pair of metrics, Pearson, flag p < alpha.
 *   - `spearman-dashboard` — same, rank-based.
 *   - `naive-trend`        — a linear slope test per metric.
 *   - `before-after`       — first half vs second half, Welch's t.
 *
 * None of them controls confounders, none corrects for multiple
 * comparisons, none gates on sample size beyond a minimum overlap. That is
 * exactly the point: they are the false-positive factories Pulse has to
 * beat, and the comparison harness scores everyone against the same ground
 * truth with the same rules.
 */

import type { MetricRegistry } from "../metrics/registry.js";
import { dailySeries } from "../metrics/compute.js";
import type { PulseEvent } from "../events/schema.js";
import { pearson, spearman } from "../statistics/correlation.js";
import { mean, stdDev } from "../statistics/descriptive.js";
import { tTwoSidedP } from "../statistics/distributions.js";
import { welchTTest } from "../statistics/comparisons.js";

export type BaselineMethod = "pearson-dashboard" | "spearman-dashboard" | "naive-trend" | "before-after";

/** A discovered association, in the shape every method and Pulse itself gets scored in. */
export interface DiscoveryClaim {
  method: BaselineMethod | "pulse";
  /** Behaviour-side metric, when the claim names one. */
  exposureMetricId?: string;
  outcomeMetricId: string;
  /** Sign of the claimed effect on the outcome. */
  direction: 1 | -1;
  pValue: number;
}

export interface SimpleSeries {
  dates: string[];
  values: number[];
}

/** Daily series for every registered metric that appears in the events. */
export function seriesMapFromEvents(events: readonly PulseEvent[], registry: MetricRegistry): Map<string, SimpleSeries> {
  const map = new Map<string, SimpleSeries>();
  const types = new Set(events.map((event) => event.type));
  for (const definition of registry.list()) {
    if (!definition.eventTypes.some((type) => types.has(type))) continue;
    const series = dailySeries(events, definition);
    if (series.dates.length === 0) continue;
    map.set(definition.id, { dates: series.dates, values: series.values });
  }
  return map;
}

/** Values observed on the same dates, both finite. A naive dashboard does no gap filling. */
function align(a: SimpleSeries, b: SimpleSeries): { x: number[]; y: number[] } {
  const bIndex = new Map(b.dates.map((date, i) => [date, b.values[i]!]));
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < a.dates.length; i += 1) {
    const j = bIndex.get(a.dates[i]!);
    if (j === undefined) continue;
    if (!Number.isFinite(a.values[i]!) || !Number.isFinite(j)) continue;
    x.push(a.values[i]!);
    y.push(j);
  }
  return { x, y };
}

export interface BaselineDashboardOptions {
  alpha?: number;
  minOverlap?: number;
}

function correlationDashboard(
  method: "pearson-dashboard" | "spearman-dashboard",
  series: ReadonlyMap<string, SimpleSeries>,
  options: BaselineDashboardOptions = {},
): DiscoveryClaim[] {
  const alpha = options.alpha ?? 0.05;
  const minOverlap = options.minOverlap ?? 10;
  const ids = [...series.keys()].sort();
  const claims: DiscoveryClaim[] = [];

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = 0; j < ids.length; j += 1) {
      if (i === j) continue;
      // One direction only: the pair where the alphabetically-first metric is
      // the exposure. A dashboard shows both arrows; scoring counts one claim.
      if (i > j) continue;
      const exposure = ids[i]!;
      const outcome = ids[j]!;
      const { x, y } = align(series.get(exposure)!, series.get(outcome)!);
      const result = method === "pearson-dashboard" ? pearson(x, y) : spearman(x, y);
      if (!Number.isFinite(result.pValue)) continue;
      if (result.n < minOverlap) continue;
      if (result.pValue >= alpha) continue;
      claims.push({
        method,
        exposureMetricId: exposure,
        outcomeMetricId: outcome,
        direction: result.r > 0 ? 1 : -1,
        pValue: result.pValue,
      });
    }
  }
  return claims;
}

/** Every metric pair at p < alpha, Pearson, no correction of any kind. */
export function pearsonDashboard(series: ReadonlyMap<string, SimpleSeries>, options?: BaselineDashboardOptions): DiscoveryClaim[] {
  return correlationDashboard("pearson-dashboard", series, options);
}

/** Every metric pair at p < alpha, Spearman, no correction of any kind. */
export function spearmanDashboard(series: ReadonlyMap<string, SimpleSeries>, options?: BaselineDashboardOptions): DiscoveryClaim[] {
  return correlationDashboard("spearman-dashboard", series, options);
}

/**
 * Linear-slope significance per metric: "is this number going up or down?"
 * The classic personal-analytics claim, tested exactly as naively as it is made.
 */
export function naiveTrendDetector(
  series: ReadonlyMap<string, SimpleSeries>,
  options: BaselineDashboardOptions = {},
): DiscoveryClaim[] {
  const alpha = options.alpha ?? 0.05;
  const minOverlap = options.minOverlap ?? 10;
  const claims: DiscoveryClaim[] = [];

  for (const id of [...series.keys()].sort()) {
    const { dates, values } = series.get(id)!;
    const pairs = dates
      .map((_date, i) => ({ t: i, v: values[i]! }))
      .filter((pair) => Number.isFinite(pair.v));
    if (pairs.length < minOverlap) continue;

    const n = pairs.length;
    const tMean = mean(pairs.map((pair) => pair.t));
    const vMean = mean(pairs.map((pair) => pair.v));
    let cov = 0;
    let varT = 0;
    for (const pair of pairs) {
      cov += (pair.t - tMean) * (pair.v - vMean);
      varT += (pair.t - tMean) ** 2;
    }
    const slope = cov / varT;
    let residualSs = 0;
    for (const pair of pairs) residualSs += (pair.v - vMean - slope * (pair.t - tMean)) ** 2;
    const residualMs = residualSs / Math.max(1, n - 2);
    const se = Math.sqrt(residualMs / varT);
    if (!(se > 0)) continue;
    const t = slope / se;
    const pValue = tTwoSidedP(t, n - 2);
    if (!Number.isFinite(pValue) || pValue >= alpha) continue;
    claims.push({ method: "naive-trend", outcomeMetricId: id, direction: slope > 0 ? 1 : -1, pValue });
  }
  return claims;
}

/**
 * First half vs second half, Welch's t — the "it felt better after I started"
 * analysis, run per metric with nothing held constant.
 */
export function simpleBeforeAfter(
  series: ReadonlyMap<string, SimpleSeries>,
  options: BaselineDashboardOptions = {},
): DiscoveryClaim[] {
  const alpha = options.alpha ?? 0.05;
  const minOverlap = options.minOverlap ?? 10;
  const claims: DiscoveryClaim[] = [];

  for (const id of [...series.keys()].sort()) {
    const { values } = series.get(id)!;
    const observed = values.filter((value) => Number.isFinite(value));
    if (observed.length < minOverlap) continue;
    const half = Math.floor(observed.length / 2);
    const before = observed.slice(0, half);
    const after = observed.slice(half);
    if (stdDev(before) === 0 && stdDev(after) === 0) continue;
    const result = welchTTest(after, before);
    if (!Number.isFinite(result.pValue) || result.pValue >= alpha) continue;
    claims.push({
      method: "before-after",
      outcomeMetricId: id,
      direction: result.effect.value > 0 ? 1 : -1,
      pValue: result.pValue,
    });
  }
  return claims;
}

/** All four baselines at once, keyed by their method name. */
export function runAllBaselines(
  series: ReadonlyMap<string, SimpleSeries>,
  options?: BaselineDashboardOptions,
): Record<BaselineMethod, DiscoveryClaim[]> {
  return {
    "pearson-dashboard": pearsonDashboard(series, options),
    "spearman-dashboard": spearmanDashboard(series, options),
    "naive-trend": naiveTrendDetector(series, options),
    "before-after": simpleBeforeAfter(series, options),
  };
}
