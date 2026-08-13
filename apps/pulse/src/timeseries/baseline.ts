/**
 * Baselines and anomaly detection.
 *
 * A baseline answers "what is normal for me?", which every anomaly and every
 * "what changed" statement depends on. Two deliberate choices:
 *
 *  - trailing-only windows, so today is never compared against a band that
 *    already contains today (that would suppress the very spikes we want);
 *  - day-of-week adjustment, because a weekday/weekend rhythm otherwise
 *    generates a false anomaly every Saturday.
 */

import { addDays, daysBetween, localDayOfWeek, localDayStart } from "../events/time.js";
import { mad, median } from "../statistics/descriptive.js";
import type { DailySeries } from "../metrics/compute.js";

export interface BaselinePoint {
  date: string;
  value: number;
  /** Expected value from the trailing window. NaN when the window was too thin. */
  expected: number;
  /** Robust spread of the trailing window. */
  spread: number;
  /** (value - expected) / spread, using MAD-based spread. */
  robustZ: number;
  windowSize: number;
}

export interface BaselineOptions {
  /** Trailing days considered. */
  windowDays?: number;
  /** Minimum observations in the window before a baseline is emitted. */
  minObservations?: number;
  /** Compare each day only against the same weekday. */
  dayOfWeekAdjusted?: boolean;
  timezone?: string;
}

export function rollingBaseline(series: DailySeries, options: BaselineOptions = {}): BaselinePoint[] {
  // A 28-day window holds only four of each weekday, which is below the
  // default minimum — so a day-of-week-adjusted baseline would silently fall
  // back to the pooled window and adjust nothing. Widen the default when the
  // caller asks for the adjustment.
  const windowDays = options.windowDays ?? (options.dayOfWeekAdjusted ? 84 : 28);
  const minObservations = options.minObservations ?? 5;
  const timezone = options.timezone ?? "UTC";

  const points: BaselinePoint[] = [];
  const observed: { date: string; value: number; dow: number }[] = [];
  for (let i = 0; i < series.dates.length; i += 1) {
    const value = series.values[i]!;
    const date = series.dates[i]!;
    observed.push({ date, value, dow: localDayOfWeek(localDayStart(date, timezone), timezone) });
  }

  for (let i = 0; i < observed.length; i += 1) {
    const current = observed[i]!;
    if (!Number.isFinite(current.value)) continue;

    const windowStart = addDays(current.date, -windowDays);
    let window = observed
      .slice(0, i)
      .filter((point) => Number.isFinite(point.value) && point.date > windowStart);

    if (options.dayOfWeekAdjusted) {
      const sameDay = window.filter((point) => point.dow === current.dow);
      // Fall back to the full window when the same-weekday history is too thin
      // — a noisy baseline beats no baseline, and windowSize discloses which.
      if (sameDay.length >= minObservations) window = sameDay;
    }

    if (window.length < minObservations) {
      points.push({
        date: current.date,
        value: current.value,
        expected: NaN,
        spread: NaN,
        robustZ: NaN,
        windowSize: window.length,
      });
      continue;
    }

    const values = window.map((point) => point.value);
    const expected = median(values);
    const spread = mad(values);
    // A degenerate window (every value identical) gets a floor, otherwise any
    // deviation at all would read as infinitely anomalous.
    const usableSpread = spread > 0 ? spread : Math.max(1e-9, Math.abs(expected) * 0.05);

    points.push({
      date: current.date,
      value: current.value,
      expected,
      spread: usableSpread,
      robustZ: (current.value - expected) / usableSpread,
      windowSize: window.length,
    });
  }

  return points;
}

export type AnomalyDirection = "above" | "below";

export interface Anomaly {
  metricId: string;
  date: string;
  value: number;
  expected: number;
  robustZ: number;
  direction: AnomalyDirection;
  severity: "notable" | "strong" | "extreme";
  windowSize: number;
}

export interface AnomalyOptions extends BaselineOptions {
  /** Robust-z threshold. 3.0 keeps false alarms rare on ~90 days of data. */
  threshold?: number;
}

export function detectAnomalies(series: DailySeries, options: AnomalyOptions = {}): Anomaly[] {
  const threshold = options.threshold ?? 3;
  return rollingBaseline(series, options)
    .filter((point) => Number.isFinite(point.robustZ) && Math.abs(point.robustZ) >= threshold)
    .map((point) => ({
      metricId: series.metricId,
      date: point.date,
      value: point.value,
      expected: point.expected,
      robustZ: point.robustZ,
      direction: point.robustZ > 0 ? ("above" as const) : ("below" as const),
      severity: Math.abs(point.robustZ) >= 6 ? ("extreme" as const) : Math.abs(point.robustZ) >= 4.5 ? ("strong" as const) : ("notable" as const),
      windowSize: point.windowSize,
    }));
}

export interface StreakSummary {
  metricId: string;
  currentStreak: number;
  longestStreak: number;
  longestGap: number;
  activeDays: number;
  totalDays: number;
  consistency: number;
}

/**
 * Streaks and gaps, for questions like "which routines predict missed
 * sessions". Counts a day as active when it has any observation at all.
 */
export function summariseStreaks(series: DailySeries): StreakSummary {
  const activeDates = series.dates.filter((_, i) => (series.counts[i] ?? 0) > 0);
  if (activeDates.length === 0) {
    return {
      metricId: series.metricId,
      currentStreak: 0,
      longestStreak: 0,
      longestGap: 0,
      activeDays: 0,
      totalDays: 0,
      consistency: 0,
    };
  }

  let currentStreak = 1;
  let longestStreak = 1;
  let longestGap = 0;
  for (let i = 1; i < activeDates.length; i += 1) {
    const gap = daysBetween(activeDates[i - 1]!, activeDates[i]!);
    if (gap === 1) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      longestGap = Math.max(longestGap, gap - 1);
      currentStreak = 1;
    }
  }

  const totalDays = daysBetween(activeDates[0]!, activeDates[activeDates.length - 1]!) + 1;
  return {
    metricId: series.metricId,
    currentStreak,
    longestStreak,
    longestGap,
    activeDays: activeDates.length,
    totalDays,
    consistency: activeDates.length / totalDays,
  };
}
