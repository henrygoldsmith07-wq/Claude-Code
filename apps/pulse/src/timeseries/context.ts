/**
 * Context and temporal safeguards for personal time series.
 *
 * Context is data, not a footnote. These helpers keep travel, illness,
 * school/work and holidays out of a generic baseline when the event stream
 * records them, while still falling back honestly when the history is thin.
 */

import { addDays, daysBetween, localDayOfWeek, localDayStart } from "../events/time.js";
import type { DailySeries, MetricObservation } from "../metrics/compute.js";
import { alignSeries } from "../metrics/compute.js";
import { mad, mean, median } from "../statistics/descriptive.js";
import { autocorrelationControl } from "../statistics/safeguards.js";
import { spearman, type CorrelationResult } from "../statistics/correlation.js";
import { rollingBaseline, type BaselinePoint } from "./baseline.js";

export type PersonalContext = "travel" | "illness" | "school" | "work" | "holiday";

export type ContextAttributes = Readonly<Record<string, string | number | boolean>>;

const CONTEXT_KEYS: Record<PersonalContext, readonly string[]> = {
  travel: ["travel", "travel_context", "is_travelling", "travelling", "trip", "location_changed"],
  illness: ["illness", "illness_context", "sick", "is_sick", "unwell"],
  school: ["school", "school_context", "term", "exam_period"],
  work: ["work", "work_context", "working_day", "on_call"],
  holiday: ["holiday", "holiday_context", "bank_holiday", "public_holiday"],
};

function activeAttribute(attributes: ContextAttributes, key: string): string | null {
  const value = attributes[key];
  if (value === undefined || value === false || value === 0 || value === "") return null;
  if (value === true || value === 1) return key;
  return String(value);
}

/** Derives stable context families plus optional values from event metadata. */
export function contextLabelsForDate(
  date: string,
  attributes: ContextAttributes = {},
  timezone = "UTC",
): string[] {
  const labels = new Set<string>();
  const dow = localDayOfWeek(localDayStart(date, timezone), timezone);
  labels.add(dow === 0 || dow === 6 ? "weekend" : "weekday");
  labels.add(`season:${seasonForDate(date)}`);

  for (const [context, keys] of Object.entries(CONTEXT_KEYS) as [PersonalContext, readonly string[]][]) {
    for (const key of keys) {
      const value = activeAttribute(attributes, key);
      if (value === null) continue;
      labels.add(context);
      if (value !== key) labels.add(`${context}:${value.toLowerCase().replace(/\s+/g, "-")}`);
      break;
    }
  }

  const generic = attributes.context;
  if (typeof generic === "string") {
    for (const value of generic.split(",")) {
      const clean = value.trim().toLowerCase();
      if (clean) labels.add(clean);
    }
  }
  return [...labels].sort();
}

/** Builds the date-level context map used by `contextAwareBaseline`. */
export function contextMapFromObservations(
  observations: readonly Pick<MetricObservation, "localDate" | "attributes">[],
  timezone = "UTC",
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const observation of observations) {
    const existing = map.get(observation.localDate) ?? [];
    map.set(observation.localDate, [...new Set([...existing, ...contextLabelsForDate(observation.localDate, observation.attributes, timezone)])].sort());
  }
  return map;
}

export function seasonForDate(date: string): "winter" | "spring" | "summer" | "autumn" {
  const month = Number(date.slice(5, 7));
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

export type ContextMap =
  | ReadonlyMap<string, readonly string[] | string>
  | Readonly<Record<string, readonly string[] | string>>;

function mappedContext(map: ContextMap | undefined, date: string): string[] {
  if (!map) return [];
  const value = map instanceof Map ? map.get(date) : (map as Readonly<Record<string, readonly string[] | string>>)[date];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => item.toLowerCase());
}

function explicitFamilies(labels: readonly string[]): string[] {
  return labels.filter((label) => !label.startsWith("season:") && label !== "weekday" && label !== "weekend").map((label) => label.split(":", 1)[0]!);
}

export interface ContextAwareBaselinePoint extends BaselinePoint {
  contexts: string[];
  baselineSource: "context" | "calendar" | "pooled";
}

export interface ContextAwareBaselineOptions {
  windowDays?: number;
  minObservations?: number;
  weekdayWeekendAdjusted?: boolean;
  seasonalAdjusted?: boolean;
  timezone?: string;
}

/** Uses matching personal contexts first, then calendar context, then pooled history. */
export function contextAwareBaseline(
  series: DailySeries,
  contexts: ContextMap = new Map(),
  options: ContextAwareBaselineOptions = {},
): ContextAwareBaselinePoint[] {
  const windowDays = options.windowDays ?? 84;
  const minObservations = options.minObservations ?? 5;
  const timezone = options.timezone ?? "UTC";
  const useCalendar = options.weekdayWeekendAdjusted ?? true;
  const useSeason = options.seasonalAdjusted ?? false;
  const observed = series.dates.map((date, index) => ({
    date,
    value: series.values[index]!,
    labels: [...contextLabelsForDate(date, {}, timezone), ...mappedContext(contexts, date)],
  }));
  const points: ContextAwareBaselinePoint[] = [];

  for (let index = 0; index < observed.length; index += 1) {
    const current = observed[index]!;
    if (!Number.isFinite(current.value)) continue;
    const start = addDays(current.date, -windowDays);
    const prior = observed.slice(0, index).filter((item) => Number.isFinite(item.value) && item.date > start);
    const currentExplicit = explicitFamilies(current.labels);
    const currentCalendar = current.labels.filter((label) => label === "weekday" || label === "weekend" || label.startsWith("season:"));
    const contextPrior = currentExplicit.length
      ? prior.filter((item) => {
          const families = explicitFamilies(item.labels);
          return currentExplicit.every((family) => families.includes(family));
        })
      : prior.filter((item) => explicitFamilies(item.labels).length === 0);
    const calendarPrior = contextPrior.filter((item) => {
      if (useCalendar && !item.labels.includes(currentCalendar.includes("weekend") ? "weekend" : "weekday")) return false;
      if (useSeason && !item.labels.includes(`season:${seasonForDate(current.date)}`)) return false;
      return true;
    });
    let window = calendarPrior;
    let baselineSource: ContextAwareBaselinePoint["baselineSource"] = currentExplicit.length ? "context" : "calendar";
    if (window.length < minObservations) {
      window = contextPrior;
      baselineSource = currentExplicit.length ? "context" : "pooled";
    }
    if (window.length < minObservations) {
      window = prior;
      baselineSource = "pooled";
    }

    if (window.length < minObservations) {
      points.push({
        date: current.date,
        value: current.value,
        expected: NaN,
        spread: NaN,
        robustZ: NaN,
        windowSize: window.length,
        contexts: current.labels,
        baselineSource,
      });
      continue;
    }
    const values = window.map((item) => item.value);
    const expected = median(values);
    const spread = mad(values);
    const usableSpread = spread > 0 ? spread : Math.max(1e-9, Math.abs(expected) * 0.05);
    points.push({
      date: current.date,
      value: current.value,
      expected,
      spread: usableSpread,
      robustZ: (current.value - expected) / usableSpread,
      windowSize: window.length,
      contexts: current.labels,
      baselineSource,
    });
  }
  return points;
}

export interface BaselineDrift {
  date: string;
  previousDate: string;
  previousBaseline: number;
  currentBaseline: number;
  change: number;
  robustZ: number;
  direction: "up" | "down";
}

export function detectBaselineDrift(
  series: DailySeries,
  options: { windowDays?: number; minObservations?: number; lookbackPoints?: number; threshold?: number } = {},
): BaselineDrift[] {
  const points = rollingBaseline(series, {
    windowDays: options.windowDays ?? 28,
    minObservations: options.minObservations ?? 5,
  }).filter((point) => Number.isFinite(point.expected));
  const lookback = Math.max(1, Math.floor(options.lookbackPoints ?? 7));
  const threshold = options.threshold ?? 2;
  const drifts: BaselineDrift[] = [];
  for (let index = lookback; index < points.length; index += 1) {
    const current = points[index]!;
    const previous = points[index - lookback]!;
    const change = current.expected - previous.expected;
    const scale = Math.max(current.spread, previous.spread, 1e-9);
    const robustZ = Math.abs(change) / scale;
    if (robustZ < threshold) continue;
    drifts.push({
      date: current.date,
      previousDate: previous.date,
      previousBaseline: previous.expected,
      currentBaseline: current.expected,
      change,
      robustZ,
      direction: change >= 0 ? "up" : "down",
    });
  }
  return drifts;
}

export interface ChangePoint {
  index: number;
  date: string;
  beforeMean: number;
  afterMean: number;
  difference: number;
  statistic: number;
}

/** Robust mean-shift scan with a minimum segment length and non-maximum suppression. */
export function detectChangePoints(
  series: DailySeries,
  options: { minSegmentLength?: number; threshold?: number; maxPoints?: number } = {},
): ChangePoint[] {
  const points = series.dates
    .map((date, index) => ({ date, value: series.values[index]! }))
    .filter((point) => Number.isFinite(point.value));
  const minSegmentLength = Math.max(2, Math.floor(options.minSegmentLength ?? 7));
  const threshold = options.threshold ?? 2.5;
  const scale = Math.max(mad(points.map((point) => point.value)), 1e-9);
  const candidates: ChangePoint[] = [];
  for (let index = minSegmentLength; index <= points.length - minSegmentLength; index += 1) {
    // Local windows keep a long, already-shifted history from pulling the
    // estimated boundary towards the middle of the new regime.
    const before = points.slice(index - minSegmentLength, index).map((point) => point.value);
    const after = points.slice(index, index + minSegmentLength).map((point) => point.value);
    const beforeMean = mean(before);
    const afterMean = mean(after);
    const difference = afterMean - beforeMean;
    const statistic = Math.abs(difference) / scale;
    if (statistic >= threshold) candidates.push({ index, date: points[index]!.date, beforeMean, afterMean, difference, statistic });
  }
  const selected: ChangePoint[] = [];
  const sorted = [...candidates].sort((a, b) => b.statistic - a.statistic);
  for (const candidate of sorted) {
    if (selected.every((point) => Math.abs(point.index - candidate.index) >= minSegmentLength)) selected.push(candidate);
    if (selected.length >= (options.maxPoints ?? 10)) break;
  }
  return selected.sort((a, b) => a.index - b.index);
}

export interface SeasonalAdjustmentResult {
  series: DailySeries;
  effects: Record<string, number>;
  keys: string[];
}

export function seasonalAdjustment(
  series: DailySeries,
  options: { periodDays?: number; weekdayWeekend?: boolean } = {},
): SeasonalAdjustmentResult {
  const periodDays = Math.max(2, Math.floor(options.periodDays ?? 7));
  const firstDate = series.dates[0] ?? "1970-01-01";
  const keys = series.dates.map((date) => {
    const cycle = daysBetween(firstDate, date) % periodDays;
    if (options.weekdayWeekend) {
      const dow = localDayOfWeek(localDayStart(date, "UTC"), "UTC");
      return dow === 0 || dow === 6 ? "weekend" : "weekday";
    }
    return `cycle:${cycle}`;
  });
  const overallValues = series.values.filter(Number.isFinite);
  const overall = mean(overallValues);
  const byKey = new Map<string, number[]>();
  for (let index = 0; index < series.values.length; index += 1) {
    const value = series.values[index]!;
    if (!Number.isFinite(value)) continue;
    const key = keys[index]!;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(value);
    else byKey.set(key, [value]);
  }
  const effects: Record<string, number> = {};
  for (const [key, values] of byKey) effects[key] = mean(values) - overall;
  const values = series.values.map((value, index) => (Number.isFinite(value) ? value - (effects[keys[index]!] ?? 0) : NaN));
  return { series: { ...series, values }, effects, keys };
}

export const adjustForWeekdayWeekend = (series: DailySeries): SeasonalAdjustmentResult => seasonalAdjustment(series, { weekdayWeekend: true });

export const weekdayWeekendAdjustment = adjustForWeekdayWeekend;

export interface DistributedLagPoint {
  lagDays: number;
  correlation: CorrelationResult;
  weight: number;
  effectiveSampleSize: number;
}

export interface DistributedLagModel {
  points: DistributedLagPoint[];
  best: DistributedLagPoint | null;
  aggregateCorrelation: number;
  carryoverScore: number;
  autocorrelationInflation: number;
  lagsTested: number;
}

export function distributedLagModel(
  exposure: DailySeries,
  outcome: DailySeries,
  options: { maxLagDays?: number; minPairs?: number; halfLifeDays?: number } = {},
): DistributedLagModel {
  const maxLagDays = Math.max(0, Math.floor(options.maxLagDays ?? 7));
  const minPairs = options.minPairs ?? 14;
  const halfLifeDays = options.halfLifeDays ?? 3;
  const points: DistributedLagPoint[] = [];
  for (let lagDays = 0; lagDays <= maxLagDays; lagDays += 1) {
    const aligned = alignSeries(exposure, outcome, lagDays);
    if (aligned.dates.length < minPairs) continue;
    const correlation = spearman(aligned.a, aligned.b);
    const weight = Math.exp(-lagDays / Math.max(0.1, halfLifeDays));
    const effectiveSampleSize = autocorrelationControl(aligned.b).effectiveSampleSize;
    points.push({ lagDays, correlation, weight, effectiveSampleSize });
  }
  const usable = points.filter((point) => Number.isFinite(point.correlation.r));
  const weightTotal = usable.reduce((total, point) => total + point.weight, 0);
  const aggregateCorrelation = weightTotal > 0 ? usable.reduce((total, point) => total + point.correlation.r * point.weight, 0) / weightTotal : NaN;
  const positiveLag = usable.filter((point) => point.lagDays > 0);
  const positiveWeight = positiveLag.reduce((total, point) => total + point.weight, 0);
  const carryoverScore = positiveWeight > 0 ? positiveLag.reduce((total, point) => total + point.correlation.r * point.weight, 0) / positiveWeight : 0;
  const best = usable.length ? usable.reduce((current, point) => (Math.abs(point.correlation.r) > Math.abs(current.correlation.r) ? point : current)) : null;
  const autocorrelationInflation = usable.length && best ? Math.max(1, best.correlation.n / best.effectiveSampleSize) ** 0.5 : 1;
  return { points, best, aggregateCorrelation, carryoverScore, autocorrelationInflation, lagsTested: points.length };
}

export interface CarryoverDetection {
  detected: boolean;
  supportingLags: number[];
  aggregateCorrelation: number;
  direction: "positive" | "negative" | "mixed" | "none";
}

export function detectCarryover(
  model: DistributedLagModel,
  options: { minimumSupportingLags?: number; minimumAbsoluteCorrelation?: number } = {},
): CarryoverDetection {
  const minimumSupportingLags = options.minimumSupportingLags ?? 2;
  const minimumAbsoluteCorrelation = options.minimumAbsoluteCorrelation ?? 0.2;
  const supporting = model.points.filter((point) => point.lagDays > 0 && Math.abs(point.correlation.r) >= minimumAbsoluteCorrelation);
  const positives = supporting.filter((point) => point.correlation.r > 0).length;
  const negatives = supporting.filter((point) => point.correlation.r < 0).length;
  const direction = positives && negatives ? "mixed" : positives ? "positive" : negatives ? "negative" : "none";
  return {
    detected: supporting.length >= minimumSupportingLags,
    supportingLags: supporting.map((point) => point.lagDays),
    aggregateCorrelation: model.carryoverScore,
    direction,
  };
}
