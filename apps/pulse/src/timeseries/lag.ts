/**
 * Lag analysis — "does X, some hours or days earlier, relate to Y?"
 *
 * Two complementary tools:
 *
 *  - `splitByExposureWindow` works at *event* resolution and is what powers
 *    claims like "revision within four hours of exercise". It pairs each
 *    outcome with the most recent preceding exposure and splits on a window.
 *  - `crossCorrelate` works at *daily* resolution and scans a range of lags.
 *    Scanning lags multiplies the comparison family, so the number of lags
 *    tested is returned for the multiple-testing correction to consume.
 *
 * Neither establishes causation. Temporal precedence rules out one direction
 * of confounding and nothing more, which the finding text always says.
 */

import { toInstant } from "../events/time.js";
import { alignSeries, type DailySeries, type MetricObservation } from "../metrics/compute.js";
import { spearman, type CorrelationResult } from "../statistics/correlation.js";

export interface ExposureSplit {
  /** Outcomes that occurred within the window after an exposure. */
  exposed: MetricObservation[];
  /** Outcomes with no exposure in the preceding window. */
  unexposed: MetricObservation[];
  /** Hours between each exposed outcome and its triggering exposure. */
  hoursSinceExposure: number[];
  windowHours: number;
  /** Outcomes dropped because their timestamp was assumed rather than recorded. */
  excludedEstimatedTime: number;
}

export interface ExposureOptions {
  windowHours: number;
  /**
   * Outcomes before the first exposure are dropped by default: at that point
   * the user may simply not have been doing the exposure behaviour yet, and
   * including them compares two different eras of their life.
   */
  dropBeforeFirstExposure?: boolean;
  /** Exclude outcomes whose event time was assumed by the connector. */
  requireRecordedTime?: boolean;
}

/**
 * Splits outcome observations by whether an exposure occurred in the preceding
 * `windowHours`.
 */
export function splitByExposureWindow(
  outcomes: readonly MetricObservation[],
  exposures: readonly MetricObservation[],
  options: ExposureOptions,
): ExposureSplit {
  const windowMs = options.windowHours * 3_600_000;
  const requireRecordedTime = options.requireRecordedTime ?? true;

  const exposureTimes = exposures
    .filter((exposure) => !requireRecordedTime || exposure.attributes.time_estimated !== true)
    .map((exposure) => toInstant(exposure.at))
    .sort((a, b) => a - b);

  const split: ExposureSplit = {
    exposed: [],
    unexposed: [],
    hoursSinceExposure: [],
    windowHours: options.windowHours,
    excludedEstimatedTime: 0,
  };

  if (exposureTimes.length === 0) return split;
  const firstExposure = exposureTimes[0]!;

  for (const outcome of outcomes) {
    if (requireRecordedTime && outcome.attributes.time_estimated === true) {
      split.excludedEstimatedTime += 1;
      continue;
    }
    const at = toInstant(outcome.at);
    if ((options.dropBeforeFirstExposure ?? true) && at < firstExposure) continue;

    const previous = latestAtOrBefore(exposureTimes, at);
    if (previous !== null && at - previous <= windowMs) {
      split.exposed.push(outcome);
      split.hoursSinceExposure.push((at - previous) / 3_600_000);
    } else {
      split.unexposed.push(outcome);
    }
  }

  return split;
}

/** Binary search for the largest exposure time <= `at`. */
function latestAtOrBefore(sorted: readonly number[], at: number): number | null {
  let lo = 0;
  let hi = sorted.length - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! <= at) {
      best = sorted[mid]!;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export interface LagResult {
  lagDays: number;
  correlation: CorrelationResult;
  n: number;
}

export interface CrossCorrelationResult {
  metricA: string;
  metricB: string;
  lags: LagResult[];
  /** Lag with the largest |rho| among those meeting the sample floor. */
  best: LagResult | null;
  /** Number of lags tested — feeds the multiple-testing family size. */
  lagsTested: number;
  /**
   * True when the forward lag (A leads B) is clearly stronger than the mirror
   * lag (B leads A). Suggestive of direction; never proof of it.
   */
  forwardDominant: boolean;
}

export interface CrossCorrelationOptions {
  /** Lags scanned run 0..maxLagDays. */
  maxLagDays?: number;
  minPairs?: number;
}

/**
 * Correlates series A at day d against series B at day d + lag.
 * A positive lag means A precedes B.
 */
export function crossCorrelate(
  a: DailySeries,
  b: DailySeries,
  options: CrossCorrelationOptions = {},
): CrossCorrelationResult {
  const maxLag = options.maxLagDays ?? 3;
  const minPairs = options.minPairs ?? 10;

  const lags: LagResult[] = [];
  for (let lag = 0; lag <= maxLag; lag += 1) {
    const aligned = alignSeries(a, b, lag);
    if (aligned.dates.length < minPairs) continue;
    lags.push({ lagDays: lag, correlation: spearman(aligned.a, aligned.b), n: aligned.dates.length });
  }

  const usable = lags.filter((lag) => Number.isFinite(lag.correlation.r));
  const best = usable.length
    ? usable.reduce((bestSoFar, lag) => (Math.abs(lag.correlation.r) > Math.abs(bestSoFar.correlation.r) ? lag : bestSoFar))
    : null;

  let forwardDominant = false;
  if (best && best.lagDays > 0) {
    const mirror = alignSeries(b, a, best.lagDays);
    if (mirror.dates.length >= minPairs) {
      const reverse = spearman(mirror.a, mirror.b);
      forwardDominant = Math.abs(best.correlation.r) > Math.abs(reverse.r) * 1.5;
    }
  }

  return {
    metricA: a.metricId,
    metricB: b.metricId,
    lags,
    best,
    lagsTested: lags.length,
    forwardDominant,
  };
}

/**
 * Dose-response check within the exposure window: does the effect fade as the
 * gap grows? A monotone fade is weak corroboration; its absence is a reason to
 * suspect the window boundary was arbitrary.
 */
export function doseResponseWithinWindow(split: ExposureSplit): CorrelationResult | null {
  if (split.exposed.length < 8) return null;
  const values = split.exposed.map((observation) => observation.value);
  return spearman(split.hoursSinceExposure, values);
}
