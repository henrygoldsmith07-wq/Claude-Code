/**
 * P1 statistical safeguards.
 *
 * These are deliberately small, deterministic primitives. Discovery can use
 * them to make a result harder to fool without hiding the checks inside a
 * model or a connector implementation.
 */

import { assertFinite, clamp, mad, mean, median, standardError } from "./descriptive.js";
import { partialCorrelation, pearson, type CorrelationResult } from "./correlation.js";
import { benjaminiHochberg, bonferroni, holmBonferroni, type CorrectionResult } from "./multiple.js";
import { welchTTest, type ComparisonResult } from "./comparisons.js";
import { normalQuantile } from "./distributions.js";
import type { Interval } from "./effects.js";

export const MINIMUM_SAMPLE_THRESHOLDS = {
  observations: 20,
  distinctDays: 14,
  perGroupDays: 5,
  holdoutDays: 7,
  negativeControlDays: 14,
} as const;

export interface SampleThresholds {
  observations: number;
  distinctDays: number;
  perGroupDays: number;
  holdoutDays: number;
  negativeControlDays: number;
}

export interface MinimumSampleInput {
  observations: number;
  distinctDays: number;
  groupDays?: readonly number[];
  holdoutDays?: number;
  negativeControlDays?: number;
  thresholds?: Partial<SampleThresholds>;
}

export interface MinimumSampleGate {
  sufficient: boolean;
  observations: number;
  distinctDays: number;
  reasons: string[];
  checks: {
    observations: boolean;
    distinctDays: boolean;
    groupDays: boolean;
    holdoutDays: boolean;
    negativeControlDays: boolean;
  };
}

/** One explicit gate for every analysis that can become a user-facing claim. */
export function checkMinimumSamples(input: MinimumSampleInput): MinimumSampleGate {
  const thresholds: SampleThresholds = { ...MINIMUM_SAMPLE_THRESHOLDS, ...(input.thresholds ?? {}) };
  const observations = Math.max(0, input.observations);
  const distinctDays = Math.max(0, input.distinctDays);
  const groupDays = input.groupDays ?? [];
  const checks = {
    observations: observations >= thresholds.observations,
    distinctDays: distinctDays >= thresholds.distinctDays,
    groupDays: groupDays.length === 0 || groupDays.every((days) => days >= thresholds.perGroupDays),
    holdoutDays: input.holdoutDays === undefined || input.holdoutDays >= thresholds.holdoutDays,
    negativeControlDays: input.negativeControlDays === undefined || input.negativeControlDays >= thresholds.negativeControlDays,
  };
  const reasons: string[] = [];
  if (!checks.observations) reasons.push(`Need at least ${thresholds.observations} observations (received ${observations})`);
  if (!checks.distinctDays) reasons.push(`Need at least ${thresholds.distinctDays} distinct days (received ${distinctDays})`);
  if (!checks.groupDays) reasons.push(`Every comparison group needs at least ${thresholds.perGroupDays} distinct days`);
  if (!checks.holdoutDays) reasons.push(`Need at least ${thresholds.holdoutDays} holdout days`);
  if (!checks.negativeControlDays) reasons.push(`Need at least ${thresholds.negativeControlDays} negative-control days`);
  return { sufficient: Object.values(checks).every(Boolean), observations, distinctDays, reasons, checks };
}

export const minimumSampleGate = checkMinimumSamples;

export interface AutocorrelationPoint {
  lag: number;
  coefficient: number;
}

export interface AutocorrelationReport {
  n: number;
  maxLag: number;
  coefficients: AutocorrelationPoint[];
  effectiveSampleSize: number;
  inflationFactor: number;
}

function correlationAtLag(values: readonly number[], lag: number): number {
  const x = values.slice(lag);
  const y = values.slice(0, values.length - lag);
  const mx = mean(x);
  const my = mean(y);
  let numerator = 0;
  let xx = 0;
  let yy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    numerator += dx * dy;
    xx += dx * dx;
    yy += dy * dy;
  }
  return xx === 0 || yy === 0 ? 0 : numerator / Math.sqrt(xx * yy);
}

/** Estimates serial dependence and converts it into a conservative n. */
export function autocorrelation(values: readonly number[], maxLag = 7): AutocorrelationReport {
  assertFinite(values);
  const n = values.length;
  const usableLag = Math.max(0, Math.min(Math.floor(maxLag), Math.max(0, n - 1)));
  const coefficients: AutocorrelationPoint[] = [{ lag: 0, coefficient: n ? 1 : NaN }];
  let positiveSum = 0;
  for (let lag = 1; lag <= usableLag; lag += 1) {
    const coefficient = correlationAtLag(values, lag);
    coefficients.push({ lag, coefficient });
    if (coefficient <= 0) break;
    positiveSum += coefficient;
  }
  const effectiveSampleSize = n === 0 ? 0 : clamp(n / (1 + 2 * positiveSum), 1, n);
  return {
    n,
    maxLag: usableLag,
    coefficients,
    effectiveSampleSize,
    inflationFactor: n === 0 ? 1 : Math.sqrt(n / effectiveSampleSize),
  };
}

export interface AutocorrelationControl extends AutocorrelationReport {
  standardErrorMultiplier: number;
}

export function autocorrelationControl(values: readonly number[], maxLag = 7): AutocorrelationControl {
  const report = autocorrelation(values, maxLag);
  return { ...report, standardErrorMultiplier: report.inflationFactor };
}

export interface ReliabilityObservation {
  value: number;
  reliability: number;
}

export interface ReliabilityWeightedEvidence {
  estimate: number;
  totalWeight: number;
  effectiveSampleSize: number;
  minimumReliability: number;
  maximumReliability: number;
}

/** Reliability weighting prevents an assumed or low-quality source counting as a full observation. */
export function reliabilityWeightedEvidence(items: readonly ReliabilityObservation[]): ReliabilityWeightedEvidence {
  if (items.length === 0) {
    return { estimate: NaN, totalWeight: 0, effectiveSampleSize: 0, minimumReliability: NaN, maximumReliability: NaN };
  }
  const values = items.map((item) => item.value);
  const weights = items.map((item) => clamp(item.reliability, 0, 1));
  assertFinite(values, "evidence values");
  assertFinite(weights, "evidence reliabilities");
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const estimate = totalWeight > 0 ? values.reduce((total, value, i) => total + value * weights[i]!, 0) / totalWeight : NaN;
  const squaredWeights = weights.reduce((total, weight) => total + weight ** 2, 0);
  return {
    estimate,
    totalWeight,
    effectiveSampleSize: squaredWeights > 0 ? totalWeight ** 2 / squaredWeights : 0,
    minimumReliability: Math.min(...weights),
    maximumReliability: Math.max(...weights),
  };
}

export interface MeasurementErrorPropagation {
  observedEffect: number;
  standardError: number;
  measurementVariance: number;
  confidenceInterval: Interval;
  reliabilityRatio: number;
  deattenuatedEffect: number;
}

/** Widens uncertainty for known measurement error without silently deleting the observation. */
export function propagateMeasurementError(
  effect: number,
  options: {
    standardError: number;
    measurementErrorSd?: number;
    sampleSize?: number;
    signalVariance?: number;
    level?: number;
  },
): MeasurementErrorPropagation {
  if (!Number.isFinite(effect) || !Number.isFinite(options.standardError)) throw new Error("Effect and standard error must be finite");
  const n = Math.max(1, options.sampleSize ?? 1);
  const measurementErrorSd = Math.max(0, options.measurementErrorSd ?? 0);
  const measurementVariance = measurementErrorSd ** 2 / n;
  const correctedSe = Math.sqrt(options.standardError ** 2 + measurementVariance);
  const level = options.level ?? 0.95;
  const critical = normalQuantile(1 - (1 - level) / 2);
  const signalVariance = options.signalVariance;
  const reliabilityRatio =
    signalVariance !== undefined && signalVariance >= 0
      ? signalVariance / (signalVariance + measurementErrorSd ** 2)
      : 1;
  return {
    observedEffect: effect,
    standardError: correctedSe,
    measurementVariance,
    confidenceInterval: { low: effect - critical * correctedSe, high: effect + critical * correctedSe, level },
    reliabilityRatio,
    deattenuatedEffect: reliabilityRatio > 0 ? effect / reliabilityRatio : NaN,
  };
}

export interface TimestampUncertaintyWindow {
  centreMs: number;
  startMs: number;
  endMs: number;
  uncertaintyMinutes: number;
  estimated: boolean;
}

export type TimestampAttributes = Readonly<Record<string, string | number | boolean>>;

function numericAttribute(attributes: TimestampAttributes, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0) return Number(value);
  }
  return undefined;
}

export function timestampUncertainty(
  at: string | number | Date,
  attributes: TimestampAttributes = {},
  options: { estimatedMinutes?: number } = {},
): TimestampUncertaintyWindow {
  const centreMs = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
  if (!Number.isFinite(centreMs)) throw new Error("Timestamp must be parseable");
  const estimated = attributes.time_estimated === true || attributes.timestamp_estimated === true;
  const uncertaintyMinutes =
    numericAttribute(attributes, ["timestamp_uncertainty_minutes", "time_uncertainty_minutes", "uncertainty_minutes"]) ??
    (estimated ? options.estimatedMinutes ?? 720 : 0);
  const uncertaintyMs = uncertaintyMinutes * 60_000;
  return { centreMs, startMs: centreMs - uncertaintyMs, endMs: centreMs + uncertaintyMs, uncertaintyMinutes, estimated };
}

export function timestampsWithinUncertainty(
  a: TimestampUncertaintyWindow,
  b: TimestampUncertaintyWindow,
  extraMinutes = 0,
): boolean {
  return a.startMs <= b.endMs + extraMinutes * 60_000 && b.startMs <= a.endMs + extraMinutes * 60_000;
}

export function timestampReliability(window: TimestampUncertaintyWindow): number {
  return clamp(1 / (1 + window.uncertaintyMinutes / 60), 0, 1);
}

export interface OutlierSensitivityResult {
  raw: ComparisonResult;
  withoutOutliers: ComparisonResult;
  removedA: number;
  removedB: number;
  retention: number;
  stable: boolean;
}

function outlierMask(values: readonly number[], cutoff: number): boolean[] {
  assertFinite(values);
  if (values.length < 3) return values.map(() => false);
  const centre = median(values);
  const scale = mad(values);
  if (scale === 0) return values.map((value) => value !== centre);
  return values.map((value) => Math.abs((value - centre) / scale) > cutoff);
}

export function outlierSensitivity(
  a: readonly number[],
  b: readonly number[],
  options: { cutoff?: number; retentionThreshold?: number } = {},
): OutlierSensitivityResult {
  const cutoff = options.cutoff ?? 3.5;
  const raw = welchTTest(a, b);
  const maskA = outlierMask(a, cutoff);
  const maskB = outlierMask(b, cutoff);
  const cleanA = a.filter((_, index) => !maskA[index]);
  const cleanB = b.filter((_, index) => !maskB[index]);
  const withoutOutliers = welchTTest(cleanA, cleanB);
  const rawEffect = raw.effect.value;
  const cleanEffect = withoutOutliers.effect.value;
  const retention = Number.isFinite(rawEffect) && Math.abs(rawEffect) > 0 ? Math.abs(cleanEffect / rawEffect) : 1;
  const sameDirection =
    !Number.isFinite(rawEffect) || !Number.isFinite(cleanEffect) || rawEffect === 0 || cleanEffect === 0 || Math.sign(rawEffect) === Math.sign(cleanEffect);
  return {
    raw,
    withoutOutliers,
    removedA: maskA.filter(Boolean).length,
    removedB: maskB.filter(Boolean).length,
    retention,
    stable: sameDirection && retention >= (options.retentionThreshold ?? 0.67),
  };
}

export interface EffectStabilityBlock {
  index: number;
  comparison: ComparisonResult;
}

export interface EffectStabilityResult {
  full: ComparisonResult;
  blocks: EffectStabilityBlock[];
  stable: boolean;
  directionAgreement: boolean;
  minimumRetention: number;
}

export function effectStability(
  a: readonly number[],
  b: readonly number[],
  options: { blocks?: number; minPerBlock?: number; retentionThreshold?: number } = {},
): EffectStabilityResult {
  const full = welchTTest(a, b);
  const blockCount = Math.max(2, Math.floor(options.blocks ?? 3));
  const minPerBlock = options.minPerBlock ?? 3;
  const blocks: EffectStabilityBlock[] = [];
  for (let index = 0; index < blockCount; index += 1) {
    const aStart = Math.floor((index * a.length) / blockCount);
    const aEnd = Math.floor(((index + 1) * a.length) / blockCount);
    const bStart = Math.floor((index * b.length) / blockCount);
    const bEnd = Math.floor(((index + 1) * b.length) / blockCount);
    if (aEnd - aStart < minPerBlock || bEnd - bStart < minPerBlock) continue;
    blocks.push({ index, comparison: welchTTest(a.slice(aStart, aEnd), b.slice(bStart, bEnd)) });
  }
  const fullEffect = full.effect.value;
  const finiteEffects = blocks.map((block) => block.comparison.effect.value).filter(Number.isFinite);
  const directionAgreement = finiteEffects.every((effect) => fullEffect === 0 || effect === 0 || Math.sign(effect) === Math.sign(fullEffect));
  const minimumRetention = finiteEffects.length && Number.isFinite(fullEffect) && Math.abs(fullEffect) > 0
    ? Math.min(...finiteEffects.map((effect) => Math.abs(effect / fullEffect)))
    : 1;
  return {
    full,
    blocks,
    directionAgreement,
    minimumRetention,
    stable: directionAgreement && minimumRetention >= (options.retentionThreshold ?? 0.67),
  };
}

export interface ConfounderSensitivityResult {
  raw: CorrelationResult;
  adjusted: { name: string; correlation: CorrelationResult; retention: number; stable: boolean }[];
  survivesAll: boolean;
}

export function confounderSensitivity(
  exposure: readonly number[],
  outcome: readonly number[],
  controls: Readonly<Record<string, readonly number[]>>,
  options: { retentionThreshold?: number } = {},
): ConfounderSensitivityResult {
  const raw = pearson(exposure, outcome);
  const threshold = options.retentionThreshold ?? 0.67;
  const adjusted = Object.entries(controls).map(([name, values]) => {
    if (values.length !== exposure.length) throw new Error(`Control ${name} must have the same length as the exposure`);
    const correlation = partialCorrelation(exposure, outcome, [values]);
    const retention = Number.isFinite(raw.r) && Math.abs(raw.r) > 0 ? Math.abs(correlation.r / raw.r) : 1;
    const stable =
      !Number.isFinite(raw.r) || !Number.isFinite(correlation.r) || raw.r === 0 || correlation.r === 0 || Math.sign(raw.r) === Math.sign(correlation.r)
        ? retention >= threshold
        : false;
    return { name, correlation, retention, stable };
  });
  return { raw, adjusted, survivesAll: adjusted.every((item) => item.stable) };
}

export const confounderSensitivityAnalysis = confounderSensitivity;

export interface NegativeControlResult {
  name: string;
  correlation: CorrelationResult;
  passes: boolean;
  reason: string;
}

export function negativeControlCheck(
  exposure: readonly number[],
  outcome: readonly number[],
  controls: Readonly<Record<string, readonly number[]>>,
  options: { maxAbsoluteCorrelation?: number; alpha?: number } = {},
): { outcome: CorrelationResult; controls: NegativeControlResult[]; passes: boolean } {
  const outcomeCorrelation = pearson(exposure, outcome);
  const maxAbsoluteCorrelation = options.maxAbsoluteCorrelation ?? 0.2;
  const alpha = options.alpha ?? 0.05;
  const checked = Object.entries(controls).map(([name, values]) => {
    if (values.length !== exposure.length) throw new Error(`Negative control ${name} must have the same length as the exposure`);
    const correlation = pearson(exposure, values);
    const estimable = Number.isFinite(correlation.r) && Number.isFinite(correlation.pValue);
    const passes = estimable && Math.abs(correlation.r) <= maxAbsoluteCorrelation && correlation.pValue > alpha;
    return {
      name,
      correlation,
      passes,
      reason: !estimable
        ? "Negative control is not estimable"
        : passes
          ? "No material association with the exposure"
          : `Negative control is associated with the exposure (r = ${correlation.r.toFixed(2)}, p = ${correlation.pValue.toFixed(3)})`,
    };
  });
  return { outcome: outcomeCorrelation, controls: checked, passes: checked.every((control) => control.passes) };
}

export const runNegativeControlChecks = negativeControlCheck;

export interface IndependentHoldoutPeriods {
  trainDates: string[];
  holdoutDates: string[];
  boundary: string | null;
  independent: boolean;
  reason?: string;
}

export function independentHoldoutPeriods(
  dates: readonly string[],
  options: { holdoutDays?: number; holdoutFraction?: number; minimumTrainDays?: number } = {},
): IndependentHoldoutPeriods {
  const unique = [...new Set(dates)].sort();
  const holdoutDays = Math.max(1, Math.floor(options.holdoutDays ?? 7));
  const requested = Math.max(holdoutDays, Math.ceil(unique.length * (options.holdoutFraction ?? 0.2)));
  const split = Math.max(0, unique.length - requested);
  const trainDates = unique.slice(0, split);
  const holdoutDates = unique.slice(split);
  const minimumTrainDays = options.minimumTrainDays ?? MINIMUM_SAMPLE_THRESHOLDS.distinctDays;
  const independent = trainDates.length >= minimumTrainDays && holdoutDates.length >= holdoutDays;
  return {
    trainDates,
    holdoutDates,
    boundary: holdoutDates[0] ?? null,
    independent,
    ...(!independent ? { reason: `Need ${minimumTrainDays} training days and ${holdoutDays} holdout days` } : {}),
  };
}

export type MultipleTestingMethod = "benjamini-hochberg" | "holm" | "bonferroni";

/** Named entry point for callers that want to make the correction policy explicit. */
export function multipleTestingSafeguard<T>(
  items: readonly T[],
  pValueOf: (item: T) => number,
  options: { level?: number; method?: MultipleTestingMethod } = {},
): CorrectionResult<T> {
  const level = options.level ?? 0.05;
  switch (options.method ?? "benjamini-hochberg") {
    case "holm":
      return holmBonferroni(items, pValueOf, level);
    case "bonferroni":
      return bonferroni(items, pValueOf, level);
    default:
      return benjaminiHochberg(items, pValueOf, level);
  }
}

export interface ReliabilityWeightedEffect {
  estimate: number;
  effectiveSampleSize: number;
  totalWeight: number;
}

export function reliabilityWeightedEffect(items: readonly ReliabilityObservation[]): ReliabilityWeightedEffect {
  const evidence = reliabilityWeightedEvidence(items);
  return { estimate: evidence.estimate, effectiveSampleSize: evidence.effectiveSampleSize, totalWeight: evidence.totalWeight };
}

export function robustZ(value: number, reference: readonly number[]): number {
  assertFinite(reference, "reference");
  const scale = mad(reference);
  return scale > 0 ? (value - median(reference)) / scale : 0;
}

export function standardErrorWithAutocorrelation(values: readonly number[], maxLag = 7): number {
  const control = autocorrelationControl(values, maxLag);
  return standardError(values) * control.standardErrorMultiplier;
}
