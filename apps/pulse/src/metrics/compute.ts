/**
 * Metric computation.
 *
 * Two shapes come out of here and everything downstream uses one of them:
 *   - `MetricObservation[]` — one row per event, for comparisons and pairing;
 *   - `DailySeries`         — one row per local day, for trend and anomaly work.
 *
 * Gap handling is explicit. A day with no study is a *missing* observation for
 * accuracy but a *zero* for minutes studied, and conflating the two is how a
 * trend line ends up claiming a collapse that was actually a holiday.
 */

import type { PulseEvent } from "../events/schema.js";
import { addDays, daysBetween, eachLocalDate } from "../events/time.js";
import { max, mean, median, min, sum } from "../statistics/descriptive.js";
import type { Aggregation, MetricDefinition } from "./registry.js";

export interface MetricObservation {
  metricId: string;
  value: number;
  /** Instant the underlying event occurred. */
  at: string;
  localDate: string;
  localMinutes: number;
  localDayOfWeek: number;
  eventId: string;
  source: string;
  eventType: string;
  subject?: string;
  attributes: Record<string, string | number | boolean>;
}

export interface DailySeries {
  metricId: string;
  aggregation: Aggregation;
  dates: string[];
  /** NaN marks a day with no data — never silently zero. */
  values: number[];
  /** Observations behind each day's value. */
  counts: number[];
}

export function observationsFor(
  events: readonly PulseEvent[],
  definition: MetricDefinition,
): MetricObservation[] {
  const types = new Set(definition.eventTypes);
  const out: MetricObservation[] = [];
  for (const event of events) {
    if (!types.has(event.type)) continue;
    const value = event.metrics[definition.metricKey];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (definition.range && (value < definition.range.min || value > definition.range.max)) continue;
    out.push({
      metricId: definition.id,
      value,
      at: event.occurredAt,
      localDate: event.localDate,
      localMinutes: event.localMinutes,
      localDayOfWeek: event.localDayOfWeek,
      eventId: event.id,
      source: String(event.source),
      eventType: event.type,
      ...(event.subject !== undefined ? { subject: event.subject } : {}),
      attributes: event.attributes,
    });
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function aggregate(values: readonly number[], aggregation: Aggregation): number {
  if (values.length === 0) return NaN;
  switch (aggregation) {
    case "mean":
      return mean(values);
    case "median":
      return median(values);
    case "sum":
      return sum(values);
    case "count":
      return values.length;
    case "max":
      return max(values);
    case "min":
      return min(values);
    case "rate":
      // Rate is "per observation" — identical to mean, named for intent.
      return mean(values);
  }
}

export interface DailySeriesOptions {
  /** Emit a row for every calendar day in range, not only days with data. */
  fillGaps?: boolean;
  /** For count/sum metrics, a day with no events genuinely is zero. */
  zeroFillEmptyDays?: boolean;
  from?: string;
  to?: string;
}

export function dailySeries(
  events: readonly PulseEvent[],
  definition: MetricDefinition,
  options: DailySeriesOptions = {},
): DailySeries {
  const observations = observationsFor(events, definition);
  const byDate = new Map<string, number[]>();
  for (const observation of observations) {
    const bucket = byDate.get(observation.localDate);
    if (bucket) bucket.push(observation.value);
    else byDate.set(observation.localDate, [observation.value]);
  }

  const observed = [...byDate.keys()].sort();
  const from = options.from ?? observed[0];
  const to = options.to ?? observed[observed.length - 1];

  const dates =
    options.fillGaps && from && to ? eachLocalDate(from, to) : observed.filter((d) => (!from || d >= from) && (!to || d <= to));

  const zeroFill =
    options.zeroFillEmptyDays ?? (definition.aggregation === "sum" || definition.aggregation === "count");

  const values: number[] = [];
  const counts: number[] = [];
  for (const date of dates) {
    const bucket = byDate.get(date);
    if (bucket && bucket.length) {
      values.push(aggregate(bucket, definition.aggregation));
      counts.push(bucket.length);
    } else {
      values.push(zeroFill ? 0 : NaN);
      counts.push(0);
    }
  }

  return { metricId: definition.id, aggregation: definition.aggregation, dates, values, counts };
}

/** Drops missing days, keeping dates and values aligned. */
export function dropMissing(series: DailySeries): { dates: string[]; values: number[] } {
  const dates: string[] = [];
  const values: number[] = [];
  for (let i = 0; i < series.values.length; i += 1) {
    const value = series.values[i]!;
    if (Number.isFinite(value)) {
      dates.push(series.dates[i]!);
      values.push(value);
    }
  }
  return { dates, values };
}

/**
 * Aligns two daily series on the dates they share, optionally shifting the
 * second by `lagDays`. Returns only days where both sides have real data —
 * pairing a real value against an imputed one is how spurious lag effects are
 * manufactured.
 */
export function alignSeries(
  a: DailySeries,
  b: DailySeries,
  lagDays = 0,
): { dates: string[]; a: number[]; b: number[] } {
  const bByDate = new Map<string, number>();
  for (let i = 0; i < b.dates.length; i += 1) {
    const value = b.values[i]!;
    if (Number.isFinite(value)) bByDate.set(b.dates[i]!, value);
  }

  const dates: string[] = [];
  const aValues: number[] = [];
  const bValues: number[] = [];
  for (let i = 0; i < a.dates.length; i += 1) {
    const aValue = a.values[i]!;
    if (!Number.isFinite(aValue)) continue;
    const targetDate = lagDays === 0 ? a.dates[i]! : addDays(a.dates[i]!, lagDays);
    const bValue = bByDate.get(targetDate);
    if (bValue === undefined) continue;
    dates.push(a.dates[i]!);
    aValues.push(aValue);
    bValues.push(bValue);
  }
  return { dates, a: aValues, b: bValues };
}

/** Splits observations into groups by an attribute value. */
export function groupByAttribute(
  observations: readonly MetricObservation[],
  attribute: string,
): Map<string, MetricObservation[]> {
  const groups = new Map<string, MetricObservation[]>();
  for (const observation of observations) {
    const raw = observation.attributes[attribute];
    if (raw === undefined) continue;
    const key = String(raw);
    const bucket = groups.get(key);
    if (bucket) bucket.push(observation);
    else groups.set(key, [observation]);
  }
  return groups;
}

/**
 * Collapses observations to one value per local day.
 *
 * Twelve flashcard reviews in one sitting share a mood, a topic and a level of
 * tiredness; treating them as twelve independent draws inflates every sample
 * size and shrinks every p-value in the product. Averaging within the cluster
 * and testing the cluster means is the standard, conservative correction, and
 * it is what every group comparison in Pulse runs on.
 */
export function clusterByDay(observations: readonly MetricObservation[]): { keys: string[]; values: number[] } {
  return clusterBy(observations, (observation) => observation.localDate);
}

/**
 * Clusters by *sitting* — the same local date and the same two-hour band.
 *
 * A sitting is the honest unit of independence for study data: the dozen
 * reviews inside one session share everything, while a morning session and an
 * evening session on the same day genuinely differ. Clustering to whole days
 * would throw away that real within-day contrast; clustering to nothing would
 * treat twelve reviews as twelve people.
 */
export function clusterBySitting(observations: readonly MetricObservation[]): { keys: string[]; values: number[] } {
  return clusterBy(
    observations,
    (observation) => `${observation.localDate}:${Math.floor(observation.localMinutes / 120)}`,
  );
}

function clusterBy(
  observations: readonly MetricObservation[],
  keyOf: (observation: MetricObservation) => string,
): { keys: string[]; values: number[] } {
  const byKey = new Map<string, number[]>();
  for (const observation of observations) {
    const key = keyOf(observation);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(observation.value);
    else byKey.set(key, [observation.value]);
  }
  const keys = [...byKey.keys()].sort();
  return { keys, values: keys.map((key) => mean(byKey.get(key)!)) };
}

/** Local-time-of-day bucket, used for "when do I study best" questions. */
export type TimeBucket = "early-morning" | "morning" | "afternoon" | "evening" | "night";

export function timeBucket(localMinutes: number): TimeBucket {
  if (localMinutes < 360) return "night";
  if (localMinutes < 720) return localMinutes < 540 ? "early-morning" : "morning";
  if (localMinutes < 1020) return "afternoon";
  if (localMinutes < 1320) return "evening";
  return "night";
}

export function coverageDays(series: DailySeries): number {
  if (series.dates.length === 0) return 0;
  return daysBetween(series.dates[0]!, series.dates[series.dates.length - 1]!) + 1;
}
