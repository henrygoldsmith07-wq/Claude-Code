/**
 * Candidate generation and evaluation.
 *
 * A "candidate" is a question Pulse is willing to ask of the data. Generating
 * them explicitly — rather than correlating everything with everything — is
 * what keeps the multiple-testing family small enough that surviving it means
 * something.
 *
 * Five question shapes, each mapping to something a person would actually ask:
 *   exposure-window   "does doing X shortly before Y change Y?"
 *   lagged-correlation "does more X on a day relate to more Y that day or later?"
 *   time-of-day       "when am I at my best?"
 *   day-of-week       "which days go badly?"
 *   attribute-split   "which method/setting works better?"
 */

import type { PulseEvent } from "../events/schema.js";
import { hash128 } from "../events/hash.js";
import {
  alignSeries,
  clusterBySitting,
  dailySeries,
  groupByAttribute,
  observationsFor,
  timeBucket,
  type DailySeries,
  type MetricObservation,
} from "../metrics/compute.js";
import type { MetricDefinition, MetricRegistry } from "../metrics/registry.js";
import { crossCorrelate, splitByExposureWindow, type ExposureSplit } from "../timeseries/lag.js";
import { mannWhitneyU, welchTTest, type ComparisonResult } from "../statistics/comparisons.js";
import type { CorrelationResult } from "../statistics/correlation.js";
import { mean } from "../statistics/descriptive.js";

export type CandidateKind =
  | "exposure-window"
  | "lagged-correlation"
  | "time-of-day"
  | "day-of-week"
  | "attribute-split";

export interface Candidate {
  id: string;
  kind: CandidateKind;
  outcomeMetricId: string;
  exposureMetricId?: string;
  attribute?: string;
  windowHours?: number;
  maxLagDays?: number;
  /** Human phrasing of the question being asked. */
  question: string;
}

export interface EvaluatedCandidate {
  candidate: Candidate;
  pValue: number;
  /** Standardised effect magnitude used for ranking and confidence. */
  effectMagnitude: number;
  comparison?: ComparisonResult;
  correlation?: CorrelationResult;
  lagDays?: number;
  /** Observations behind each side, kept for confounder analysis. */
  groupA: MetricObservation[];
  groupB: MetricObservation[];
  groupALabel: string;
  groupBLabel: string;
  /**
   * Independent units behind the test — days, not raw observations. This is
   * the n the p-value actually rests on.
   */
  sampleSize: number;
  /** Raw observations behind the sample, for describing it to the user. */
  observationCount?: number;
  /** Independent sittings on each side of the comparison. */
  clusterCountA?: number;
  clusterCountB?: number;
  /** Relative difference between the groups, for plain-language phrasing. */
  relativeDifference: number;
  split?: ExposureSplit;
  forwardDominant?: boolean;
  /** Aligned daily values behind a lagged correlation, for series adjustment. */
  alignedDates?: string[];
  alignedDriver?: number[];
  alignedOutcome?: number[];
  /** Why the candidate was dropped, when it was. */
  skipped?: string;
}

export interface CandidateContext {
  events: readonly PulseEvent[];
  registry: MetricRegistry;
  /** Windows tried for exposure questions. */
  exposureWindowsHours?: number[];
  maxLagDays?: number;
  /** Attributes eligible for attribute-split questions. */
  splitAttributes?: string[];
}

const DEFAULT_WINDOWS = [4, 24];
const DEFAULT_SPLIT_ATTRIBUTES = ["method", "skill", "setting", "location", "calendar_category"];

/**
 * Generates the candidate set.
 *
 * Only `outcome` metrics are ever the dependent side, and only `behaviour` /
 * `context` metrics are ever the independent side. That asymmetry halves the
 * family and, more importantly, stops Pulse proposing that your accuracy
 * causes your sleep.
 */
export function generateCandidates(context: CandidateContext): Candidate[] {
  const { registry, events } = context;
  const available = registry.available(events);
  const outcomes = available.filter((definition) => definition.role === "outcome");
  const drivers = available.filter((definition) => definition.role === "behaviour" || definition.role === "context");
  const windows = context.exposureWindowsHours ?? DEFAULT_WINDOWS;
  const maxLagDays = context.maxLagDays ?? 2;
  const splitAttributes = context.splitAttributes ?? DEFAULT_SPLIT_ATTRIBUTES;

  const candidates: Candidate[] = [];
  const add = (candidate: Omit<Candidate, "id">): void => {
    candidates.push({ ...candidate, id: candidateId(candidate) });
  };

  // An exposure window asks "did this *event* happen recently", so several
  // metrics riding on the same event type (volume, sets, effort — all from one
  // workout) would ask an identical question three times, triplicating the
  // finding and inflating the family. One representative per event type.
  const exposureRepresentatives = pickOnePerEventType(drivers.filter((d) => d.role === "behaviour"));

  for (const outcome of outcomes) {
    for (const driver of drivers) {
      if (registry.isTrivialPair(outcome.id, driver.id)) continue;

      if (driver.role === "behaviour" && exposureRepresentatives.has(driver.id)) {
        for (const windowHours of windows) {
          add({
            kind: "exposure-window",
            outcomeMetricId: outcome.id,
            exposureMetricId: driver.id,
            windowHours,
            question: `Is ${outcome.name.toLowerCase()} different within ${windowHours} hours of ${driver.name.toLowerCase()}?`,
          });
        }
      }

      add({
        kind: "lagged-correlation",
        outcomeMetricId: outcome.id,
        exposureMetricId: driver.id,
        maxLagDays,
        question: `Does daily ${driver.name.toLowerCase()} relate to ${outcome.name.toLowerCase()} the same day or up to ${maxLagDays} days later?`,
      });
    }

    add({
      kind: "time-of-day",
      outcomeMetricId: outcome.id,
      question: `Does ${outcome.name.toLowerCase()} depend on the time of day?`,
    });
    add({
      kind: "day-of-week",
      outcomeMetricId: outcome.id,
      question: `Does ${outcome.name.toLowerCase()} differ at the weekend?`,
    });

    for (const attribute of splitAttributes) {
      add({
        kind: "attribute-split",
        outcomeMetricId: outcome.id,
        attribute,
        question: `Does ${outcome.name.toLowerCase()} depend on ${attribute.replace(/_/g, " ")}?`,
      });
    }
  }

  return candidates;
}

/**
 * One metric per event-type signature, chosen deterministically by metric id
 * so the same data always yields the same representative.
 */
function pickOnePerEventType(definitions: readonly MetricDefinition[]): Set<string> {
  const chosen = new Map<string, string>();
  for (const definition of [...definitions].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = [...definition.eventTypes].sort().join("|");
    if (!chosen.has(key)) chosen.set(key, definition.id);
  }
  return new Set(chosen.values());
}

function candidateId(candidate: Omit<Candidate, "id">): string {
  return hash128(
    [candidate.kind, candidate.outcomeMetricId, candidate.exposureMetricId ?? "", candidate.attribute ?? "", candidate.windowHours ?? "", candidate.maxLagDays ?? ""].join("|"),
  ).slice(0, 16);
}

/**
 * Independence floor.
 *
 * Twelve flashcard reviews in one sitting are not twelve independent
 * observations of how well you study — they are one sitting. Counting them as
 * twelve inflates the sample, shrinks the p-value and manufactures findings
 * from three days of data. Pulse does not fit a mixed model for this; it
 * applies a blunt but honest floor on the number of distinct *days* behind
 * each side of a comparison.
 */
const MIN_DISTINCT_DAYS_PER_GROUP = 5;
const MIN_DISTINCT_DAYS_TOTAL = 14;

export function checkIndependence(
  groupA: readonly MetricObservation[],
  groupB: readonly MetricObservation[],
): string | null {
  const daysA = new Set(groupA.map((observation) => observation.localDate));
  const daysB = new Set(groupB.map((observation) => observation.localDate));
  const total = new Set([...daysA, ...daysB]);

  if (total.size < MIN_DISTINCT_DAYS_TOTAL) {
    return `Only ${total.size} distinct days of data; repeated sessions on the same day are not independent evidence (need ${MIN_DISTINCT_DAYS_TOTAL})`;
  }
  if (daysA.size < MIN_DISTINCT_DAYS_PER_GROUP || daysB.size < MIN_DISTINCT_DAYS_PER_GROUP) {
    return `One side spans too few days (${daysA.size} vs ${daysB.size}); need at least ${MIN_DISTINCT_DAYS_PER_GROUP} each so the comparison is not driven by a handful of sittings`;
  }
  return null;
}

export function evaluateCandidate(candidate: Candidate, context: CandidateContext): EvaluatedCandidate {
  const evaluated = evaluateCandidateInner(candidate, context);
  if (evaluated.skipped || evaluated.groupA.length === 0) return evaluated;

  const independence = checkIndependence(evaluated.groupA, evaluated.groupB);
  return independence ? { ...evaluated, skipped: independence } : evaluated;
}

function evaluateCandidateInner(candidate: Candidate, context: CandidateContext): EvaluatedCandidate {
  const outcome = context.registry.require(candidate.outcomeMetricId);
  const outcomeObservations = observationsFor(context.events, outcome);

  const base: EvaluatedCandidate = {
    candidate,
    pValue: NaN,
    effectMagnitude: NaN,
    groupA: [],
    groupB: [],
    groupALabel: "",
    groupBLabel: "",
    sampleSize: outcomeObservations.length,
    relativeDifference: NaN,
  };

  if (outcomeObservations.length < outcome.minSampleForInsight) {
    return { ...base, skipped: `Only ${outcomeObservations.length} observations of ${outcome.name} (need ${outcome.minSampleForInsight})` };
  }

  switch (candidate.kind) {
    case "exposure-window":
      return evaluateExposure(candidate, context, outcome, outcomeObservations, base);
    case "lagged-correlation":
      return evaluateLagged(candidate, context, outcome, base);
    case "time-of-day":
      return evaluateTimeOfDay(outcomeObservations, base);
    case "day-of-week":
      return evaluateDayOfWeek(outcomeObservations, base);
    case "attribute-split":
      return evaluateAttributeSplit(candidate, outcomeObservations, base);
  }
}

function evaluateExposure(
  candidate: Candidate,
  context: CandidateContext,
  _outcome: MetricDefinition,
  outcomeObservations: MetricObservation[],
  base: EvaluatedCandidate,
): EvaluatedCandidate {
  const exposureDefinition = context.registry.require(candidate.exposureMetricId!);
  const exposures = observationsFor(context.events, exposureDefinition);
  if (exposures.length < 8) return { ...base, skipped: `Only ${exposures.length} ${exposureDefinition.name} events` };

  const split = splitByExposureWindow(outcomeObservations, exposures, {
    windowHours: candidate.windowHours!,
    requireRecordedTime: true,
  });

  if (split.exposed.length < 8 || split.unexposed.length < 8) {
    return {
      ...base,
      split,
      skipped: `Groups too small (${split.exposed.length} within window, ${split.unexposed.length} outside)`,
    };
  }

  const { comparison, daysA, daysB } = compareClustered(split.exposed, split.unexposed);

  return {
    ...base,
    comparison,
    split,
    pValue: comparison.pValue,
    effectMagnitude: Math.abs(comparison.effect.value),
    groupA: split.exposed,
    groupB: split.unexposed,
    groupALabel: `within ${candidate.windowHours}h of ${exposureDefinition.name.toLowerCase()}`,
    groupBLabel: `not within ${candidate.windowHours}h`,
    sampleSize: daysA + daysB,
    clusterCountA: daysA,
    clusterCountB: daysB,
    observationCount: split.exposed.length + split.unexposed.length,
    relativeDifference: relativeDiff(
      mean(split.exposed.map((o) => o.value)),
      mean(split.unexposed.map((o) => o.value)),
    ),
  };
}

function evaluateLagged(
  candidate: Candidate,
  context: CandidateContext,
  outcome: MetricDefinition,
  base: EvaluatedCandidate,
): EvaluatedCandidate {
  const driver = context.registry.require(candidate.exposureMetricId!);
  const outcomeSeries: DailySeries = dailySeries(context.events, outcome, { fillGaps: true });
  const driverSeries: DailySeries = dailySeries(context.events, driver, { fillGaps: true });

  const result = crossCorrelate(driverSeries, outcomeSeries, {
    maxLagDays: candidate.maxLagDays ?? 2,
    // The same independence floor the group comparisons use: a correlation
    // over a fortnight of days is not evidence about a person's life.
    minPairs: MIN_DISTINCT_DAYS_TOTAL,
  });

  if (!result.best) {
    return {
      ...base,
      skipped: `Fewer than ${MIN_DISTINCT_DAYS_TOTAL} days where both metrics have data`,
    };
  }

  const aligned = alignSeries(driverSeries, outcomeSeries, result.best.lagDays);

  return {
    ...base,
    correlation: result.best.correlation,
    lagDays: result.best.lagDays,
    alignedDates: aligned.dates,
    alignedDriver: aligned.a,
    alignedOutcome: aligned.b,
    forwardDominant: result.forwardDominant,
    pValue: result.best.correlation.pValue,
    effectMagnitude: Math.abs(result.best.correlation.r),
    groupALabel: driver.name,
    groupBLabel: outcome.name,
    sampleSize: result.best.n,
    relativeDifference: NaN,
  };
}

function evaluateTimeOfDay(observations: MetricObservation[], base: EvaluatedCandidate): EvaluatedCandidate {
  const reliable = observations.filter((o) => o.attributes.time_estimated !== true);
  if (reliable.length < 20) return { ...base, skipped: "Too few sessions with a recorded clock time" };

  const buckets = new Map<string, MetricObservation[]>();
  for (const observation of reliable) {
    const key = timeBucket(observation.localMinutes);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(observation);
    else buckets.set(key, [observation]);
  }

  const usable = [...buckets.entries()].filter(([, items]) => items.length >= 8);
  if (usable.length < 2) return { ...base, skipped: "Sessions are concentrated in one part of the day" };

  // Best bucket against everything else — a focused question with one test,
  // rather than an all-pairs sweep that would inflate the family.
  const best = usable.reduce((bestSoFar, entry) =>
    mean(entry[1].map((o) => o.value)) > mean(bestSoFar[1].map((o) => o.value)) ? entry : bestSoFar,
  );
  const rest = reliable.filter((o) => timeBucket(o.localMinutes) !== best[0]);
  if (rest.length < 8) return { ...base, skipped: "Not enough sessions outside the best time band" };

  const { comparison, daysA, daysB } = compareClustered(best[1], rest);

  return {
    ...base,
    comparison,
    pValue: comparison.pValue,
    effectMagnitude: Math.abs(comparison.effect.value),
    groupA: best[1],
    groupB: rest,
    groupALabel: `${best[0].replace(/-/g, " ")} sessions`,
    groupBLabel: "sessions at other times",
    sampleSize: daysA + daysB,
    clusterCountA: daysA,
    clusterCountB: daysB,
    observationCount: reliable.length,
    relativeDifference: relativeDiff(mean(best[1].map((o) => o.value)), mean(rest.map((o) => o.value))),
  };
}

function evaluateDayOfWeek(observations: MetricObservation[], base: EvaluatedCandidate): EvaluatedCandidate {
  const weekend = observations.filter((o) => o.localDayOfWeek === 0 || o.localDayOfWeek === 6);
  const weekday = observations.filter((o) => o.localDayOfWeek !== 0 && o.localDayOfWeek !== 6);
  if (weekend.length < 8 || weekday.length < 8) {
    return { ...base, skipped: `Need at least 8 sessions on each of weekend and weekday (have ${weekend.length}/${weekday.length})` };
  }

  const { comparison, daysA, daysB } = compareClustered(weekend, weekday);

  return {
    ...base,
    comparison,
    pValue: comparison.pValue,
    effectMagnitude: Math.abs(comparison.effect.value),
    groupA: weekend,
    groupB: weekday,
    groupALabel: "weekend sessions",
    groupBLabel: "weekday sessions",
    sampleSize: daysA + daysB,
    clusterCountA: daysA,
    clusterCountB: daysB,
    observationCount: weekend.length + weekday.length,
    relativeDifference: relativeDiff(mean(weekend.map((o) => o.value)), mean(weekday.map((o) => o.value))),
  };
}

function evaluateAttributeSplit(
  candidate: Candidate,
  observations: MetricObservation[],
  base: EvaluatedCandidate,
): EvaluatedCandidate {
  const groups = groupByAttribute(observations, candidate.attribute!);
  const usable = [...groups.entries()].filter(([, items]) => items.length >= 10);
  if (usable.length < 2) return { ...base, skipped: `Fewer than two well-populated values of ${candidate.attribute}` };

  const best = usable.reduce((bestSoFar, entry) =>
    mean(entry[1].map((o) => o.value)) > mean(bestSoFar[1].map((o) => o.value)) ? entry : bestSoFar,
  );
  const rest = observations.filter(
    (o) => o.attributes[candidate.attribute!] !== undefined && String(o.attributes[candidate.attribute!]) !== best[0],
  );
  if (rest.length < 10) return { ...base, skipped: "Not enough comparison sessions" };

  // Guard against comparing different kinds of thing. When a metric spans
  // several event types (a flashcard review and a written question both have
  // an accuracy), an attribute split can end up contrasting one event type
  // against another. That difference is structural, not behavioural, and
  // reporting it as a finding would be a category error.
  const typesA = new Set(best[1].map((o) => o.eventType));
  const typesB = new Set(rest.map((o) => o.eventType));
  if (![...typesA].some((type) => typesB.has(type))) {
    return {
      ...base,
      skipped: `Groups come from different event types (${[...typesA].join(", ")} vs ${[...typesB].join(", ")}), so the comparison would measure the format rather than the behaviour`,
    };
  }

  const { comparison, daysA, daysB } = compareClustered(best[1], rest);

  return {
    ...base,
    comparison,
    pValue: comparison.pValue,
    effectMagnitude: Math.abs(comparison.effect.value),
    groupA: best[1],
    groupB: rest,
    groupALabel: `${candidate.attribute!.replace(/_/g, " ")} = ${best[0]}`,
    groupBLabel: "all other values",
    sampleSize: daysA + daysB,
    clusterCountA: daysA,
    clusterCountB: daysB,
    observationCount: best[1].length + rest.length,
    relativeDifference: relativeDiff(mean(best[1].map((o) => o.value)), mean(rest.map((o) => o.value))),
  };
}

/**
 * Runs the comparison on sitting-level cluster means rather than on raw
 * observations, then reports both counts. `sampleSize` is the number of
 * independent sittings, because that is the number the statistics actually
 * rest on; `observationCount` is kept for describing the sample to the user.
 */
function compareClustered(
  groupA: readonly MetricObservation[],
  groupB: readonly MetricObservation[],
): { comparison: ComparisonResult; daysA: number; daysB: number } {
  const a = clusterBySitting(groupA).values;
  const b = clusterBySitting(groupB).values;
  const comparison = a.length >= 15 && b.length >= 15 ? welchTTest(a, b) : mannWhitneyU(a, b);
  return { comparison, daysA: a.length, daysB: b.length };
}

function relativeDiff(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return NaN;
  return (a - b) / Math.abs(b);
}
