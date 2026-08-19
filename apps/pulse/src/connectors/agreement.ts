/**
 * Cross-source agreement checks.
 *
 * Reconciliation decides which event should be analysed. Agreement answers a
 * different question: do independent sources tell a similar numerical story
 * before one source is allowed to dominate the evidence?
 */

import { toInstant } from "../events/time.js";
import { pearson, type CorrelationResult } from "../statistics/correlation.js";

export interface SourceMeasurement {
  source: string;
  value: number;
  at: string | number | Date;
  metricId?: string;
  eventId?: string;
}

export interface SourceAgreementPair {
  metricId: string;
  sourceA: string;
  sourceB: string;
  n: number;
  meanAbsoluteDifference: number;
  meanRelativeDifference: number;
  agreementRate: number;
  correlation: CorrelationResult;
  consistent: boolean;
}

export interface CrossSourceAgreementReport {
  sources: string[];
  metrics: string[];
  pairs: SourceAgreementPair[];
  overallAgreementRate: number;
  independentSources: boolean;
}

export interface CrossSourceAgreementOptions {
  windowMinutes?: number;
  absoluteTolerance?: number;
  relativeTolerance?: number;
  minimumAgreementRate?: number;
}

interface TimedMeasurement extends SourceMeasurement {
  instant: number;
}

function keyFor(measurement: SourceMeasurement): string {
  return measurement.metricId ?? "__all__";
}

function pairMeasurements(
  a: readonly TimedMeasurement[],
  b: readonly TimedMeasurement[],
  windowMs: number,
): { a: number[]; b: number[] } {
  const used = new Set<number>();
  const left = [...a].sort((x, y) => x.instant - y.instant);
  const right = [...b].sort((x, y) => x.instant - y.instant);
  const valuesA: number[] = [];
  const valuesB: number[] = [];
  for (const measurement of left) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < right.length; index += 1) {
      if (used.has(index)) continue;
      const distance = Math.abs(right[index]!.instant - measurement.instant);
      if (distance <= windowMs && distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }
    if (bestIndex < 0) continue;
    used.add(bestIndex);
    valuesA.push(measurement.value);
    valuesB.push(right[bestIndex]!.value);
  }
  return { a: valuesA, b: valuesB };
}

/** Compares each source pair using nearest timestamp matches and one-to-one pairing. */
export function crossSourceAgreement(
  observations: readonly SourceMeasurement[],
  options: CrossSourceAgreementOptions = {},
): CrossSourceAgreementReport {
  const windowMs = (options.windowMinutes ?? 15) * 60_000;
  const absoluteTolerance = options.absoluteTolerance ?? 0.1;
  const relativeTolerance = options.relativeTolerance ?? 0.1;
  const minimumAgreementRate = options.minimumAgreementRate ?? 0.8;
  const timed = observations.map((observation) => {
    if (!Number.isFinite(observation.value)) throw new Error("Source measurements must contain finite values");
    const instant = toInstant(observation.at);
    if (!Number.isFinite(instant)) throw new Error("Source measurements must contain parseable timestamps");
    return { ...observation, instant };
  });
  const byMetric = new Map<string, TimedMeasurement[]>();
  for (const measurement of timed) {
    const bucket = byMetric.get(keyFor(measurement));
    if (bucket) bucket.push(measurement);
    else byMetric.set(keyFor(measurement), [measurement]);
  }

  const pairs: SourceAgreementPair[] = [];
  for (const [metricId, measurements] of byMetric) {
    const sources = [...new Set(measurements.map((measurement) => measurement.source))].sort();
    for (let i = 0; i < sources.length; i += 1) {
      for (let j = i + 1; j < sources.length; j += 1) {
        const sourceA = sources[i]!;
        const sourceB = sources[j]!;
        const matched = pairMeasurements(
          measurements.filter((measurement) => measurement.source === sourceA),
          measurements.filter((measurement) => measurement.source === sourceB),
          windowMs,
        );
        if (matched.a.length === 0) continue;
        const absoluteDifferences = matched.a.map((value, index) => Math.abs(value - matched.b[index]!));
        const relativeDifferences = matched.a.map((value, index) => Math.abs(value - matched.b[index]!) / Math.max(Math.abs(value), Math.abs(matched.b[index]!), 1e-9));
        const agreementRate = relativeDifferences.filter((difference, index) => difference <= relativeTolerance || absoluteDifferences[index]! <= absoluteTolerance).length / matched.a.length;
        const correlation = pearson(matched.a, matched.b);
        const consistent =
          matched.a.length >= 3 &&
          agreementRate >= minimumAgreementRate &&
          (!Number.isFinite(correlation.r) || correlation.r >= 0.7);
        pairs.push({
          metricId,
          sourceA,
          sourceB,
          n: matched.a.length,
          meanAbsoluteDifference: absoluteDifferences.reduce((total, value) => total + value, 0) / absoluteDifferences.length,
          meanRelativeDifference: relativeDifferences.reduce((total, value) => total + value, 0) / relativeDifferences.length,
          agreementRate,
          correlation,
          consistent,
        });
      }
    }
  }

  const sources = [...new Set(timed.map((measurement) => measurement.source))].sort();
  const metrics = [...new Set(timed.map(keyFor))].filter((metric) => metric !== "__all__").sort();
  const totalMatches = pairs.reduce((total, pair) => total + pair.n, 0);
  const overallAgreementRate = totalMatches > 0 ? pairs.reduce((total, pair) => total + pair.agreementRate * pair.n, 0) / totalMatches : NaN;
  return {
    sources,
    metrics,
    pairs,
    overallAgreementRate,
    independentSources: sources.length >= 2 && pairs.some((pair) => pair.consistent),
  };
}
