/**
 * User-controlled statistical inspection.
 *
 * This is a diagnostic surface, not a second discovery engine. It rebuilds a
 * selected metric pair from the local event store and lets the user choose
 * the correction and robustness checks they want to see. The returned report
 * is explicit about gates that are unavailable or underpowered.
 */

import type { PulseEvent } from "../events/schema.js";
import {
  alignSeries,
  dailySeries,
  dropMissing,
  observationsFor,
  type MetricObservation,
} from "../metrics/compute.js";
import type { MetricDefinition, MetricRegistry } from "../metrics/registry.js";
import type { Finding } from "../discovery/finding.js";
import type { SourceQuality } from "../quality/score.js";
import { crossCorrelate, type CrossCorrelationResult } from "../timeseries/lag.js";
import { pearson, spearman, type CorrelationResult } from "./correlation.js";
import { mean, median, variance } from "./descriptive.js";
import {
  autocorrelationControl,
  checkMinimumSamples,
  confounderSensitivity,
  effectStability,
  independentHoldoutPeriods,
  multipleTestingSafeguard,
  negativeControlCheck,
  outlierSensitivity,
  propagateMeasurementError,
  reliabilityWeightedEvidence,
  timestampReliability,
  timestampUncertainty,
  type AutocorrelationControl,
  type ConfounderSensitivityResult,
  type EffectStabilityResult,
  type MeasurementErrorPropagation,
  type MultipleTestingMethod,
  type NegativeControlResult,
  type OutlierSensitivityResult,
  type ReliabilityWeightedEvidence,
} from "./safeguards.js";

export const DEFAULT_STATISTICAL_INSPECTOR_OPTIONS = {
  alpha: 0.05,
  correction: "benjamini-hochberg" as MultipleTestingMethod,
  autocorrelationLag: 7,
  holdoutFraction: 0.2,
  outlierCutoff: 3.5,
  reliabilityWeighting: true,
  excludeUncertainTimestamps: false,
  adjustForWeekday: true,
  adjustForTrend: true,
  adjustForSeason: false,
  maxLagDays: 3,
} as const;

export interface StatisticalInspectorOptions {
  outcomeMetricId: string;
  exposureMetricId?: string | null;
  negativeControlMetricId?: string | null;
  alpha?: number;
  correction?: MultipleTestingMethod;
  autocorrelationLag?: number;
  holdoutFraction?: number;
  outlierCutoff?: number;
  reliabilityWeighting?: boolean;
  excludeUncertainTimestamps?: boolean;
  adjustForWeekday?: boolean;
  adjustForTrend?: boolean;
  adjustForSeason?: boolean;
  maxLagDays?: number;
}

export interface StatisticalInspectorInput {
  events: readonly PulseEvent[];
  registry: MetricRegistry;
  findings?: readonly Finding[];
  qualities?: readonly SourceQuality[];
}

export type InspectorCheckStatus = "pass" | "caution" | "not-available";

export interface InspectorCheck {
  id: string;
  label: string;
  status: InspectorCheckStatus;
  summary: string;
  detail: string;
}

export interface InspectorMetric {
  id: string;
  name: string;
  unit: string;
  aggregation: MetricDefinition["aggregation"];
  source: string;
}

export interface InspectorCorrelation {
  method: CorrelationResult["method"];
  r: number;
  n: number;
  pValue: number;
  ci: CorrelationResult["ci"];
  effectLabel: string;
  insufficient?: string;
}

export interface InspectorHoldout {
  trainDays: number;
  holdoutDays: number;
  boundary: string | null;
  independent: boolean;
  sameDirection: boolean | null;
  correlation: InspectorCorrelation | null;
  reason?: string;
}

export interface InspectorSplit {
  threshold: number;
  lowerDays: number;
  higherDays: number;
}

export interface InspectorOutlier {
  removedLower: number;
  removedHigher: number;
  retention: number;
  stable: boolean;
  rawEffect: number;
  adjustedEffect: number;
}

export interface InspectorStability {
  blocks: number;
  directionAgreement: boolean;
  minimumRetention: number;
  stable: boolean;
}

export interface InspectorConfounder {
  name: string;
  r: number;
  pValue: number;
  retention: number;
  stable: boolean;
}

export interface InspectorNegativeControl {
  metric: InspectorMetric;
  r: number;
  pValue: number;
  passes: boolean;
  reason: string;
}

export interface InspectorTimestamps {
  uncertainDays: number;
  excludedDays: number;
  analysedDays: number;
  meanReliability: number;
}

export interface InspectorLag {
  lagDays: number;
  n: number;
  r: number;
  pValue: number;
  adjustedP: number;
  significant: boolean;
}

export interface StatisticalInspection {
  outcome: InspectorMetric;
  exposure: InspectorMetric | null;
  negativeControl: InspectorMetric | null;
  dateRange: { from: string; to: string } | null;
  pairedDays: number;
  sampleGate: ReturnType<typeof checkMinimumSamples>;
  primary: {
    pearson: InspectorCorrelation | null;
    spearman: InspectorCorrelation | null;
    autocorrelation: AutocorrelationControl | null;
    reliability: ReliabilityWeightedEvidence | null;
    split: InspectorSplit | null;
    lags: InspectorLag[];
    bestLagDays: number | null;
  };
  correction: {
    method: MultipleTestingMethod;
    alpha: number;
    familySize: number;
    rawP: number;
    adjustedP: number;
    significant: boolean;
    discoveries: number;
    expectedFalseDiscoveries: number;
  };
  holdout: InspectorHoldout;
  robustness: {
    outliers: InspectorOutlier | null;
    stability: InspectorStability | null;
    confounders: InspectorConfounder[];
    negativeControl: InspectorNegativeControl | null;
    measurementError: MeasurementErrorPropagation | null;
    timestamps: InspectorTimestamps;
  };
  checks: InspectorCheck[];
  limitations: string[];
}

interface PairData {
  dates: string[];
  outcome: number[];
  exposure: number[];
  outcomeObservations: MetricObservation[];
  exposureObservations: MetricObservation[];
}

interface NormalisedOptions {
  alpha: number;
  correction: MultipleTestingMethod;
  autocorrelationLag: number;
  holdoutFraction: number;
  outlierCutoff: number;
  reliabilityWeighting: boolean;
  excludeUncertainTimestamps: boolean;
  adjustForWeekday: boolean;
  adjustForTrend: boolean;
  adjustForSeason: boolean;
  maxLagDays: number;
}

/** Build a deterministic diagnostic report from the selected local data. */
export function buildStatisticalInspection(
  input: StatisticalInspectorInput,
  options: StatisticalInspectorOptions,
): StatisticalInspection {
  const normalised = normaliseOptions(options);
  const outcomeDefinition = input.registry.require(options.outcomeMetricId);
  const exposureDefinition = options.exposureMetricId ? input.registry.get(options.exposureMetricId) : undefined;
  const negativeControlDefinition = options.negativeControlMetricId
    ? input.registry.get(options.negativeControlMetricId)
    : undefined;
  const analysisEvents = normalised.excludeUncertainTimestamps
    ? input.events.filter((event) => eventTimestampReliability(event) >= 1)
    : input.events;
  const pair = exposureDefinition
    ? buildPair(analysisEvents, outcomeDefinition, exposureDefinition)
    : buildOutcomeOnly(analysisEvents, outcomeDefinition);
  const rawPair = exposureDefinition ? buildPair(input.events, outcomeDefinition, exposureDefinition) : null;
  const outcomeObservations = observationsFor(analysisEvents, outcomeDefinition);
  const exposureObservations = exposureDefinition ? observationsFor(analysisEvents, exposureDefinition) : [];
  const rawOutcomeObservations = observationsFor(input.events, outcomeDefinition);
  const rawExposureObservations = exposureDefinition ? observationsFor(input.events, exposureDefinition) : [];
  const qualityBySource = new Map((input.qualities ?? []).map((quality) => [String(quality.source), quality.score]));

  const pearsonResult = pair.exposure.length ? pearson(pair.exposure, pair.outcome) : null;
  const spearmanResult = pair.exposure.length ? spearman(pair.exposure, pair.outcome) : null;
  const selectedCorrelation = spearmanResult;
  const autocorrelation = pair.outcome.length
    ? autocorrelationControl(pair.outcome, normalised.autocorrelationLag)
    : null;
  const reliabilityItems = pair.dates.map((date, index) => ({
    value: pair.outcome[index]!,
    reliability: Math.min(
      dailyReliability(pair.outcomeObservations, date, qualityBySource, input.qualities !== undefined),
      exposureDefinition
        ? dailyReliability(pair.exposureObservations, date, qualityBySource, input.qualities !== undefined)
        : 1,
    ),
  }));
  const reliability = normalised.reliabilityWeighting && reliabilityItems.length
    ? reliabilityWeightedEvidence(reliabilityItems)
    : null;

  const holdoutPeriods = independentHoldoutPeriods(pair.dates, {
    holdoutFraction: normalised.holdoutFraction,
    holdoutDays: 7,
  });
  const holdoutCorrelation = correlationForDates(pair, new Set(holdoutPeriods.holdoutDates));
  const sameDirection = directionAgreement(selectedCorrelation?.r, holdoutCorrelation?.r);
  const holdout: InspectorHoldout = {
    trainDays: holdoutPeriods.trainDates.length,
    holdoutDays: holdoutPeriods.holdoutDates.length,
    boundary: holdoutPeriods.boundary,
    independent: holdoutPeriods.independent,
    sameDirection,
    correlation: summariseCorrelation(holdoutCorrelation),
    ...(holdoutPeriods.reason ? { reason: holdoutPeriods.reason } : {}),
  };

  const split = pair.exposure.length ? medianSplit(pair.exposure, pair.outcome) : null;
  const lower = split ? pair.outcome.filter((_, index) => pair.exposure[index]! <= split.threshold) : [];
  const higher = split ? pair.outcome.filter((_, index) => pair.exposure[index]! > split.threshold) : [];
  const outlierResult = lower.length >= 2 && higher.length >= 2
    ? outlierSensitivity(lower, higher, { cutoff: normalised.outlierCutoff })
    : null;
  const stabilityResult = lower.length >= 2 && higher.length >= 2 ? effectStability(lower, higher) : null;

  const controls = buildConfounderControls(pair.dates, normalised);
  const confounderResult = pair.exposure.length && Object.keys(controls).length
    ? confounderSensitivity(pair.exposure, pair.outcome, controls)
    : null;
  const confounders = confounderResult ? summariseConfounders(confounderResult) : [];
  const lagScan = exposureDefinition
    ? buildLagScan(analysisEvents, outcomeDefinition, exposureDefinition, normalised.maxLagDays)
    : null;

  const negativeControl = negativeControlDefinition
    ? buildNegativeControl(pair, analysisEvents, exposureDefinition, negativeControlDefinition, input.qualities !== undefined)
    : null;
  const measurementError = buildMeasurementError(pair, outcomeObservations, exposureObservations, selectedCorrelation);
  const timestamps = buildTimestampSummary(
    pair,
    rawPair,
    rawOutcomeObservations,
    rawExposureObservations,
    normalised.excludeUncertainTimestamps,
    qualityBySource,
    input.qualities !== undefined,
  );

  const familyItems = [
    { id: "selected", pValue: selectedCorrelation?.pValue ?? NaN },
    ...(lagScan?.lags ?? [])
      .filter((lag) => lag.lagDays > 0)
      .map((lag) => ({ id: `lag-${lag.lagDays}`, pValue: lag.correlation.pValue })),
    ...(input.findings ?? [])
      .filter((finding) => finding.test?.pValue !== undefined)
      .map((finding) => ({ id: finding.id, pValue: finding.test?.pValue ?? NaN })),
  ];
  const correction = multipleTestingSafeguard(familyItems, (item) => item.pValue, {
    level: normalised.alpha,
    method: normalised.correction,
  });
  const selectedCorrection = correction.results.find((result) => result.item.id === "selected");
  const lagDiagnostics = (lagScan?.lags ?? []).map((lag): InspectorLag => {
    const corrected = correction.results.find((result) => result.item.id === `lag-${lag.lagDays}`);
    return {
      lagDays: lag.lagDays,
      n: lag.n,
      r: lag.correlation.r,
      pValue: lag.correlation.pValue,
      adjustedP: lag.lagDays === 0 ? selectedCorrection?.adjustedP ?? NaN : corrected?.adjustedP ?? NaN,
      significant: lag.lagDays === 0 ? selectedCorrection?.significant ?? false : corrected?.significant ?? false,
    };
  });

  const sampleGate = checkMinimumSamples({
    observations: pair.dates.length,
    distinctDays: pair.dates.length,
    ...(split ? { groupDays: [split.lowerDays, split.higherDays] } : {}),
    holdoutDays: holdout.holdoutDays,
    ...(negativeControlDefinition
      ? { negativeControlDays: negativeControlDays(pair, analysisEvents, negativeControlDefinition) }
      : {}),
  });

  const checks = buildChecks({
    sampleGate,
    selectedCorrelation,
    autocorrelation,
    correction: selectedCorrection,
    correctionSummary: correction.summary,
    lagScan,
    holdout,
    outlierResult,
    stabilityResult,
    confounderResult,
    negativeControl,
    reliability,
    timestamps,
    normalised,
    split,
  });
  const limitations = buildLimitations(checks, sampleGate, pair, normalised, exposureDefinition);

  return {
    outcome: metricSummary(outcomeDefinition),
    exposure: exposureDefinition ? metricSummary(exposureDefinition) : null,
    negativeControl: negativeControlDefinition ? metricSummary(negativeControlDefinition) : null,
    dateRange: dateRange(pair.dates),
    pairedDays: pair.dates.length,
    sampleGate,
    primary: {
      pearson: summariseCorrelation(pearsonResult),
      spearman: summariseCorrelation(spearmanResult),
      autocorrelation,
      reliability,
      split,
      lags: lagDiagnostics,
      bestLagDays: lagScan?.best?.lagDays ?? null,
    },
    correction: {
      method: normalised.correction,
      alpha: normalised.alpha,
      familySize: correction.summary.familySize,
      rawP: selectedCorrection?.pValue ?? NaN,
      adjustedP: selectedCorrection?.adjustedP ?? NaN,
      significant: selectedCorrection?.significant ?? false,
      discoveries: correction.summary.discoveries,
      expectedFalseDiscoveries: correction.summary.expectedFalseDiscoveries,
    },
    holdout,
    robustness: {
      outliers: outlierResult ? summariseOutliers(outlierResult) : null,
      stability: stabilityResult ? summariseStability(stabilityResult) : null,
      confounders,
      negativeControl,
      measurementError,
      timestamps,
    },
    checks,
    limitations,
  };
}

function normaliseOptions(options: StatisticalInspectorOptions): NormalisedOptions {
  return {
    alpha: clampNumber(options.alpha ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.alpha, 0.001, 0.2),
    correction: options.correction ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.correction,
    autocorrelationLag: Math.max(1, Math.min(30, Math.floor(options.autocorrelationLag ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.autocorrelationLag))),
    holdoutFraction: clampNumber(options.holdoutFraction ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.holdoutFraction, 0.1, 0.5),
    outlierCutoff: clampNumber(options.outlierCutoff ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.outlierCutoff, 2, 6),
    reliabilityWeighting: options.reliabilityWeighting ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.reliabilityWeighting,
    excludeUncertainTimestamps: options.excludeUncertainTimestamps ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.excludeUncertainTimestamps,
    adjustForWeekday: options.adjustForWeekday ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.adjustForWeekday,
    adjustForTrend: options.adjustForTrend ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.adjustForTrend,
    adjustForSeason: options.adjustForSeason ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.adjustForSeason,
    maxLagDays: Math.max(0, Math.min(14, Math.floor(options.maxLagDays ?? DEFAULT_STATISTICAL_INSPECTOR_OPTIONS.maxLagDays))),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

function metricSummary(definition: MetricDefinition): InspectorMetric {
  return {
    id: definition.id,
    name: definition.name,
    unit: definition.unit,
    aggregation: definition.aggregation,
    source: String(definition.source),
  };
}

function buildPair(events: readonly PulseEvent[], outcome: MetricDefinition, exposure: MetricDefinition): PairData {
  const outcomeSeries = dailySeries(events, outcome);
  const exposureSeries = dailySeries(events, exposure);
  const aligned = alignSeries(outcomeSeries, exposureSeries);
  const outcomeObservations = observationsFor(events, outcome);
  const exposureObservations = observationsFor(events, exposure);
  return {
    dates: aligned.dates,
    outcome: aligned.a,
    exposure: aligned.b,
    outcomeObservations,
    exposureObservations,
  };
}

function buildOutcomeOnly(events: readonly PulseEvent[], outcome: MetricDefinition): PairData {
  const series = dropMissing(dailySeries(events, outcome));
  return {
    dates: series.dates,
    outcome: series.values,
    exposure: [],
    outcomeObservations: observationsFor(events, outcome),
    exposureObservations: [],
  };
}

function correlationForDates(pair: PairData, dates: Set<string>): CorrelationResult | null {
  if (pair.exposure.length === 0) return null;
  const indices = pair.dates.map((date, index) => (dates.has(date) ? index : -1)).filter((index) => index >= 0);
  if (indices.length === 0) return null;
  return spearman(
    indices.map((index) => pair.exposure[index]!),
    indices.map((index) => pair.outcome[index]!),
  );
}

function buildLagScan(
  events: readonly PulseEvent[],
  outcome: MetricDefinition,
  exposure: MetricDefinition,
  maxLagDays: number,
): CrossCorrelationResult {
  return crossCorrelate(
    dailySeries(events, exposure),
    dailySeries(events, outcome),
    { maxLagDays, minPairs: 3 },
  );
}

function summariseCorrelation(result: CorrelationResult | null): InspectorCorrelation | null {
  if (!result) return null;
  return {
    method: result.method,
    r: result.r,
    n: result.n,
    pValue: result.pValue,
    ci: result.ci,
    effectLabel: result.effect.label,
    ...(result.insufficient ? { insufficient: result.insufficient } : {}),
  };
}

function directionAgreement(primary: number | undefined, holdout: number | undefined): boolean | null {
  if (primary === undefined || holdout === undefined || !Number.isFinite(primary) || !Number.isFinite(holdout)) return null;
  if (primary === 0 || holdout === 0) return true;
  return Math.sign(primary) === Math.sign(holdout);
}

function medianSplit(exposure: readonly number[], outcome: readonly number[]): InspectorSplit {
  const threshold = median(exposure);
  return {
    threshold,
    lowerDays: exposure.filter((value) => value <= threshold).length,
    higherDays: outcome.length - exposure.filter((value) => value <= threshold).length,
  };
}

function buildConfounderControls(dates: readonly string[], options: NormalisedOptions): Record<string, number[]> {
  const controls: Record<string, number[]> = {};
  if (options.adjustForWeekday) {
    controls["weekday/weekend"] = dates.map((date) => {
      const day = new Date(`${date}T00:00:00Z`).getUTCDay();
      return day === 0 || day === 6 ? 1 : 0;
    });
  }
  if (options.adjustForTrend) controls["calendar trend"] = dates.map((_, index) => index);
  if (options.adjustForSeason) {
    controls["seasonal cycle"] = dates.map((date) => {
      const year = date.slice(0, 4);
      const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${year}-01-01T00:00:00Z`)) / 86_400_000);
      return Math.sin((2 * Math.PI * day) / 365.25);
    });
  }
  return controls;
}

function summariseConfounders(result: ConfounderSensitivityResult): InspectorConfounder[] {
  return result.adjusted.map((item) => ({
    name: item.name,
    r: item.correlation.r,
    pValue: item.correlation.pValue,
    retention: item.retention,
    stable: item.stable,
  }));
}

function summariseOutliers(result: OutlierSensitivityResult): InspectorOutlier {
  return {
    removedLower: result.removedA,
    removedHigher: result.removedB,
    retention: result.retention,
    stable: result.stable,
    rawEffect: result.raw.effect.value,
    adjustedEffect: result.withoutOutliers.effect.value,
  };
}

function summariseStability(result: EffectStabilityResult): InspectorStability {
  return {
    blocks: result.blocks.length,
    directionAgreement: result.directionAgreement,
    minimumRetention: result.minimumRetention,
    stable: result.stable,
  };
}

function buildNegativeControl(
  pair: PairData,
  events: readonly PulseEvent[],
  exposureDefinition: MetricDefinition | undefined,
  negativeControlDefinition: MetricDefinition,
  hasQuality: boolean,
): InspectorNegativeControl | null {
  if (!exposureDefinition || negativeControlDefinition.id === exposureDefinition.id) return null;
  const controlSeries = dailySeries(events, negativeControlDefinition);
  const dropped = dropMissing(controlSeries);
  const controlByDate = new Map(dropped.dates.map((date, index) => [date, dropped.values[index]!]))
  const dates = pair.dates.filter((date) => controlByDate.has(date));
  if (dates.length < 3) return null;
  const exposure = dates.map((date) => pair.exposure[pair.dates.indexOf(date)]!);
  const outcome = dates.map((date) => pair.outcome[pair.dates.indexOf(date)]!);
  const control = dates.map((date) => controlByDate.get(date)!);
  const result = negativeControlCheck(exposure, outcome, { [negativeControlDefinition.id]: control });
  const checked: NegativeControlResult | undefined = result.controls[0];
  if (!checked) return null;
  return {
    metric: metricSummary(negativeControlDefinition),
    r: checked.correlation.r,
    pValue: checked.correlation.pValue,
    passes: checked.passes,
    reason: `${checked.reason}${hasQuality ? " Reliability is included in the source profile." : ""}`,
  };
}

function negativeControlDays(
  pair: PairData,
  events: readonly PulseEvent[],
  definition: MetricDefinition | undefined,
): number {
  if (!definition) return 0;
  const controlDates = new Set(dropMissing(dailySeries(events, definition)).dates);
  return pair.dates.filter((date) => controlDates.has(date)).length;
}

function eventTimestampReliability(event: PulseEvent): number {
  return timestampReliability(timestampUncertainty(event.occurredAt, event.attributes));
}

function dailyReliability(
  observations: readonly MetricObservation[],
  date: string,
  qualityBySource: Map<string, number>,
  hasQuality: boolean,
): number {
  const values = observations.filter((observation) => observation.localDate === date);
  if (values.length === 0) return hasQuality ? 0.5 : 1;
  return mean(
    values.map((observation) => {
      const source = hasQuality ? qualityBySource.get(observation.source) ?? 0.5 : 1;
      return source * timestampReliability(timestampUncertainty(observation.at, observation.attributes));
    }),
  );
}

function buildTimestampSummary(
  pair: PairData,
  rawPair: PairData | null,
  outcomeObservations: readonly MetricObservation[],
  exposureObservations: readonly MetricObservation[],
  excluded: boolean,
  qualityBySource: Map<string, number>,
  hasQuality: boolean,
): InspectorTimestamps {
  const relevant = [...outcomeObservations, ...exposureObservations];
  const uncertainDays = new Set(
    relevant
      .filter((observation) => timestampUncertainty(observation.at, observation.attributes).uncertaintyMinutes > 0)
      .map((observation) => observation.localDate),
  );
  const rawDays = rawPair?.dates ?? pair.dates;
  const analysed = new Set(pair.dates);
  const excludedDays = excluded ? rawDays.filter((date) => !analysed.has(date)).length : 0;
  const reliabilities = pair.dates.map((date) =>
    Math.min(
      dailyReliability(outcomeObservations, date, qualityBySource, hasQuality),
      exposureObservations.length ? dailyReliability(exposureObservations, date, qualityBySource, hasQuality) : 1,
    ),
  );
  return {
    uncertainDays: uncertainDays.size,
    excludedDays,
    analysedDays: pair.dates.length,
    meanReliability: reliabilities.length ? mean(reliabilities) : 0,
  };
}

function buildMeasurementError(
  pair: PairData,
  outcomeObservations: readonly MetricObservation[],
  exposureObservations: readonly MetricObservation[],
  correlation: CorrelationResult | null,
): MeasurementErrorPropagation | null {
  if (!correlation || !Number.isFinite(correlation.r)) return null;
  const observations = [...outcomeObservations, ...exposureObservations];
  const errors = observations
    .map((observation) => measurementErrorSd(observation.attributes))
    .filter((value): value is number => value !== undefined);
  if (errors.length === 0) return null;
  const sd = mean(errors);
  const standardError = 1 / Math.sqrt(Math.max(1, pair.outcome.length - 2));
  return propagateMeasurementError(correlation.r, {
    standardError,
    measurementErrorSd: sd,
    sampleSize: pair.outcome.length,
    signalVariance: variance(pair.outcome),
  });
}

function measurementErrorSd(attributes: Readonly<Record<string, string | number | boolean>>): number | undefined {
  for (const key of ["measurement_error_sd", "measurement_error", "measurement_error_standard_deviation"]) {
    const value = attributes[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  }
  return undefined;
}

interface CheckInput {
  sampleGate: ReturnType<typeof checkMinimumSamples>;
  selectedCorrelation: CorrelationResult | null;
  autocorrelation: AutocorrelationControl | null;
  correction: { adjustedP: number; significant: boolean } | undefined;
  correctionSummary: { familySize: number; discoveries: number };
  lagScan: CrossCorrelationResult | null;
  holdout: InspectorHoldout;
  outlierResult: OutlierSensitivityResult | null;
  stabilityResult: EffectStabilityResult | null;
  confounderResult: ConfounderSensitivityResult | null;
  negativeControl: InspectorNegativeControl | null;
  reliability: ReliabilityWeightedEvidence | null;
  timestamps: InspectorTimestamps;
  normalised: NormalisedOptions;
  split: InspectorSplit | null;
}

function buildChecks(input: CheckInput): InspectorCheck[] {
  const checks: InspectorCheck[] = [];
  checks.push({
    id: "minimum-sample",
    label: "Minimum sample gate",
    status: input.sampleGate.sufficient ? "pass" : "caution",
    summary: input.sampleGate.sufficient ? "Enough independent days for the selected thresholds" : "The selected data is below one or more minimum thresholds",
    detail: input.sampleGate.reasons.join("; ") || `${input.sampleGate.observations} paired days across ${input.sampleGate.distinctDays} distinct days`,
  });

  checks.push({
    id: "multiple-testing",
    label: "Multiple-testing correction",
    status: input.correction ? (input.correction.significant ? "pass" : "caution") : "not-available",
    summary: input.correction
      ? input.correction.significant
        ? "The selected association survives the chosen correction"
        : "The selected association does not survive the chosen correction"
      : "No estimable p-value is available",
    detail: `Family size ${input.correctionSummary.familySize}; ${input.correctionSummary.discoveries} discovery(ies) at the selected level`,
  });

  checks.push({
    id: "autocorrelation",
    label: "Autocorrelation control",
    status: input.autocorrelation
      ? input.autocorrelation.effectiveSampleSize < input.autocorrelation.n * 0.8
        ? "caution"
        : "pass"
      : "not-available",
    summary: input.autocorrelation
      ? `Effective sample size is about ${Math.round(input.autocorrelation.effectiveSampleSize)} of ${input.autocorrelation.n}`
      : "No outcome series is available",
    detail: input.autocorrelation
      ? `Checked through lag ${input.autocorrelation.maxLag}; standard-error multiplier ${input.autocorrelation.standardErrorMultiplier.toFixed(2)}`
      : "Select a metric pair with at least one observed day",
  });

  checks.push({
    id: "lag-scan",
    label: "Temporal lag scan",
    status: input.lagScan
      ? input.lagScan.best
        ? input.lagScan.best.lagDays === 0 || input.lagScan.forwardDominant
          ? "pass"
          : "caution"
        : "caution"
      : "not-available",
    summary: input.lagScan
      ? input.lagScan.best
        ? input.lagScan.best.lagDays === 0
          ? "The strongest observed association is on the same day"
          : `The strongest observed association is at a ${input.lagScan.best.lagDays}-day lead`
        : "No tested lag has enough paired days"
      : "No exposure metric is selected",
    detail: input.lagScan
      ? `${input.lagScan.lagsTested} lag(s) tested; a forward lead is ${input.lagScan.forwardDominant ? "stronger than the reverse comparison" : "not stronger than the reverse comparison"}`
      : "Select an exposure metric to inspect temporal precedence",
  });

  checks.push({
    id: "holdout",
    label: "Independent holdout",
    status: input.holdout.independent && input.holdout.sameDirection === true ? "pass" : "caution",
    summary: input.holdout.independent
      ? input.holdout.sameDirection === true
        ? "The direction holds in the final holdout period"
        : "The holdout period does not confirm the direction"
      : "There are not enough training and holdout days for an independent check",
    detail: `${input.holdout.trainDays} training days · ${input.holdout.holdoutDays} holdout days${input.holdout.boundary ? ` · boundary ${input.holdout.boundary}` : ""}`,
  });

  checks.push({
    id: "outliers",
    label: "Outlier sensitivity",
    status: input.outlierResult ? (input.outlierResult.stable ? "pass" : "caution") : "not-available",
    summary: input.outlierResult
      ? input.outlierResult.stable
        ? "The median-split effect keeps its direction after robust outlier removal"
        : "The median-split effect is sensitive to robust outlier removal"
      : "Needs at least two days in each median-split group",
    detail: input.outlierResult
      ? `Removed ${input.outlierResult.removedA + input.outlierResult.removedB} point(s); retained ${(input.outlierResult.retention * 100).toFixed(0)}% of the effect`
      : "This diagnostic is not estimable for the selected pair",
  });

  checks.push({
    id: "stability",
    label: "Effect stability",
    status: input.stabilityResult ? (input.stabilityResult.stable ? "pass" : "caution") : "not-available",
    summary: input.stabilityResult
      ? input.stabilityResult.stable
        ? "The median-split effect keeps its direction across time blocks"
        : "The median-split effect is not stable across time blocks"
      : "Needs enough observations for at least two time blocks",
    detail: input.stabilityResult
      ? `${input.stabilityResult.blocks} blocks; minimum effect retention ${(input.stabilityResult.minimumRetention * 100).toFixed(0)}%`
      : "This diagnostic is not estimable for the selected pair",
  });

  checks.push({
    id: "confounders",
    label: "Confounder sensitivity",
    status: input.confounderResult
      ? input.confounderResult.survivesAll
        ? "pass"
        : "caution"
      : "not-available",
    summary: input.confounderResult
      ? input.confounderResult.survivesAll
        ? "The association survives the selected calendar adjustments"
        : "The association changes materially under at least one selected adjustment"
      : "No calendar adjustments selected or no pair is available",
    detail: input.confounderResult
      ? `${input.confounderResult.adjusted.length} adjustment(s) were re-estimated`
      : "Choose weekday/weekend, trend, or seasonal adjustment to inspect sensitivity",
  });

  checks.push({
    id: "negative-control",
    label: "Negative-control check",
    status: input.negativeControl ? (input.negativeControl.passes ? "pass" : "caution") : "not-available",
    summary: input.negativeControl
      ? input.negativeControl.passes
        ? "The selected negative-control metric is not materially associated with the exposure"
        : "The selected negative-control metric is associated with the exposure"
      : "No negative-control metric selected",
    detail: input.negativeControl?.reason ?? "Choose a third metric to run a negative-control check",
  });

  checks.push({
    id: "reliability",
    label: "Reliability weighting",
    status: input.reliability
      ? input.reliability.minimumReliability < 0.6
        ? "caution"
        : "pass"
      : "not-available",
    summary: input.reliability
      ? `Weighted effective sample size is about ${input.reliability.effectiveSampleSize.toFixed(1)} days`
      : "Reliability weighting is switched off",
    detail: input.reliability
      ? `Reliability range ${(input.reliability.minimumReliability * 100).toFixed(0)}–${(input.reliability.maximumReliability * 100).toFixed(0)}%`
      : "Turn on reliability weighting to prevent weak inputs counting as full observations",
  });

  checks.push({
    id: "timestamps",
    label: "Timestamp uncertainty",
    status: input.timestamps.uncertainDays === 0 || input.normalised.excludeUncertainTimestamps ? "pass" : "caution",
    summary: input.timestamps.uncertainDays === 0
      ? "All analysed days have recorded timestamps"
      : input.normalised.excludeUncertainTimestamps
        ? `Excluded ${input.timestamps.excludedDays} day(s) with uncertain timestamps`
        : `${input.timestamps.uncertainDays} day(s) include timestamp uncertainty`,
    detail: `Mean timestamp reliability ${(input.timestamps.meanReliability * 100).toFixed(0)}% across ${input.timestamps.analysedDays} analysed days`,
  });

  return checks;
}

function buildLimitations(
  checks: readonly InspectorCheck[],
  sampleGate: ReturnType<typeof checkMinimumSamples>,
  pair: PairData,
  options: NormalisedOptions,
  exposure: MetricDefinition | undefined,
): string[] {
  const limitations = checks.filter((check) => check.status === "caution").map((check) => `${check.label}: ${check.summary}`);
  if (!exposure) limitations.push("No exposure metric is selected, so pairwise association and lag diagnostics are unavailable");
  if (!sampleGate.sufficient) limitations.push("This report is exploratory only until the minimum sample thresholds are met");
  if (pair.dates.length < 3) limitations.push("At least three paired days are needed to estimate a correlation");
  if (!options.reliabilityWeighting) limitations.push("Reliability weighting is off; low-quality observations count equally");
  return [...new Set(limitations)];
}

function dateRange(dates: readonly string[]): { from: string; to: string } | null {
  if (dates.length === 0) return null;
  return { from: dates[0]!, to: dates[dates.length - 1]! };
}
