/**
 * Prediction models.
 *
 * Last in the build order, and deliberately the most constrained part of
 * Pulse. A personal dataset is small, non-stationary and self-selected — the
 * conditions under which prediction models are most likely to look impressive
 * in-sample and be worthless out of it.
 *
 * Two rules make this safe to ship:
 *
 *  1. Validation is walk-forward only. The model is never scored on data that
 *     existed before it was fitted, because a shuffled split on a time series
 *     leaks the future into the training set and inflates every number.
 *  2. A model that does not beat the naive baselines by a clear margin is
 *     marked unpublishable and the UI shows nothing. "Slightly better than
 *     guessing yesterday's value" is not a prediction worth acting on.
 */

import type { PulseEvent } from "../events/schema.js";
import { addDays } from "../events/time.js";
import { dailySeries, type DailySeries } from "../metrics/compute.js";
import type { MetricDefinition, MetricRegistry } from "../metrics/registry.js";
import { solveLeastSquares } from "../statistics/correlation.js";
import { mean, median, stdDev } from "../statistics/descriptive.js";

export interface FeatureRow {
  date: string;
  target: number;
  features: number[];
  featureNames: string[];
}

export interface ValidationScore {
  n: number;
  mae: number;
  rmse: number;
  /** Share of variance explained, out of sample. Can be negative. */
  r2: number;
}

export interface PredictionModel {
  targetMetricId: string;
  featureNames: string[];
  coefficients: number[];
  trainedOn: number;
  validation: ValidationScore;
  baselines: {
    /** Predict the previous observed value. */
    persistence: ValidationScore;
    /** Predict the trailing median. */
    rollingMedian: ValidationScore;
  };
  /** True only when the model clearly beats both baselines on enough data. */
  publishable: boolean;
  /** Why it is or is not publishable, in the user's language. */
  verdict: string;
  limitations: string[];
}

export interface PredictionOptions {
  registry: MetricRegistry;
  targetMetricId: string;
  /** Driver metrics offered as same-day and previous-day features. */
  driverMetricIds?: string[];
  /** Days of history before the first prediction is attempted. */
  minTrainDays?: number;
  /** Ridge penalty. Small but non-zero: features here are highly collinear. */
  ridge?: number;
  /** Minimum improvement over the better baseline to be publishable. */
  minImprovement?: number;
}

export function buildFeatureTable(events: readonly PulseEvent[], options: PredictionOptions): FeatureRow[] {
  const target = options.registry.require(options.targetMetricId);
  const targetSeries = dailySeries(events, target, { fillGaps: true });

  const drivers = (options.driverMetricIds ?? [])
    .map((id) => options.registry.get(id))
    .filter((definition): definition is MetricDefinition => Boolean(definition))
    .map((definition) => ({ definition, series: dailySeries(events, definition, { fillGaps: true }) }));

  const valueAt = (series: DailySeries, date: string): number | null => {
    const index = series.dates.indexOf(date);
    if (index < 0) return null;
    const value = series.values[index]!;
    return Number.isFinite(value) ? value : null;
  };

  const rows: FeatureRow[] = [];
  const history: number[] = [];

  for (let i = 0; i < targetSeries.dates.length; i += 1) {
    const date = targetSeries.dates[i]!;
    const value = targetSeries.values[i]!;

    // Features are computed strictly from *earlier* days plus same-day driver
    // values that are known before the outcome (a workout that morning).
    const previous = history.length ? history[history.length - 1]! : null;
    const trailing = history.slice(-14);

    if (Number.isFinite(value)) history.push(value);
    if (previous === null || trailing.length < 5) continue;

    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const featureNames = ["previous_value", "trailing_median", "trailing_sd", "is_weekend"];
    const features = [previous, median(trailing), stdDev(trailing) || 0, dow === 0 || dow === 6 ? 1 : 0];

    for (const driver of drivers) {
      const sameDay = valueAt(driver.series, date);
      const priorDay = valueAt(driver.series, addDays(date, -1));
      featureNames.push(`${driver.definition.id}_today`, `${driver.definition.id}_yesterday`);
      features.push(sameDay ?? 0, priorDay ?? 0);
    }

    if (!Number.isFinite(value)) continue;
    rows.push({ date, target: value, features, featureNames });
  }

  return rows;
}

/**
 * Walk-forward validation: fit on everything up to day t, predict day t+1,
 * repeat. Slow relative to a single fit, and the only version worth trusting.
 */
export function trainAndValidate(events: readonly PulseEvent[], options: PredictionOptions): PredictionModel {
  const rows = buildFeatureTable(events, options);
  const minTrain = options.minTrainDays ?? 30;
  const ridge = options.ridge ?? 1e-3;
  const minImprovement = options.minImprovement ?? 0.05;

  const featureNames = rows[0]?.featureNames ?? [];
  const limitations: string[] = [];

  if (rows.length < minTrain + 15) {
    return unpublishable(
      options.targetMetricId,
      featureNames,
      `Only ${rows.length} usable days; at least ${minTrain + 15} are needed before a model can be validated.`,
      ["Personal prediction needs months of consistent logging, not weeks."],
    );
  }

  const predictions: number[] = [];
  const actuals: number[] = [];
  const persistencePredictions: number[] = [];
  const medianPredictions: number[] = [];

  for (let split = minTrain; split < rows.length; split += 1) {
    const train = rows.slice(0, split);
    const test = rows[split]!;

    const design = train.map((row) => [1, ...row.features]);
    const targets = train.map((row) => row.target);
    const coefficients = solveRidge(design, targets, ridge);

    let prediction = coefficients[0] ?? 0;
    for (let j = 0; j < test.features.length; j += 1) prediction += (coefficients[j + 1] ?? 0) * test.features[j]!;

    predictions.push(prediction);
    actuals.push(test.target);
    // previous_value and trailing_median are features 0 and 1 by construction.
    persistencePredictions.push(test.features[0]!);
    medianPredictions.push(test.features[1]!);
  }

  const validation = score(predictions, actuals);
  const persistence = score(persistencePredictions, actuals);
  const rollingMedian = score(medianPredictions, actuals);

  const bestBaseline = Math.min(persistence.mae, rollingMedian.mae);
  const improvement = bestBaseline > 0 ? (bestBaseline - validation.mae) / bestBaseline : 0;

  const publishable = validation.n >= 25 && validation.r2 > 0 && improvement >= minImprovement;

  if (validation.r2 <= 0) limitations.push("The model explains none of the out-of-sample variance.");
  if (improvement < minImprovement) {
    limitations.push(
      `It beats simply predicting your recent typical value by ${(improvement * 100).toFixed(1)}%, which is below the ${(minImprovement * 100).toFixed(0)}% bar for showing a prediction at all.`,
    );
  }
  limitations.push("Predictions describe patterns in your past behaviour and will degrade whenever your routine changes.");

  // Final coefficients are fitted on everything, for inspection only —
  // the reported scores come from the walk-forward run above.
  const fullDesign = rows.map((row) => [1, ...row.features]);
  const coefficients = solveRidge(fullDesign, rows.map((row) => row.target), ridge);

  return {
    targetMetricId: options.targetMetricId,
    featureNames,
    coefficients,
    trainedOn: rows.length,
    validation,
    baselines: { persistence, rollingMedian },
    publishable,
    verdict: publishable
      ? `Validated on ${validation.n} out-of-sample days, beating the best simple baseline by ${(improvement * 100).toFixed(1)}% on average error.`
      : `Not shown: this model does not predict your ${options.targetMetricId} better than a simple rule of thumb.`,
    limitations,
  };
}

function unpublishable(
  targetMetricId: string,
  featureNames: string[],
  verdict: string,
  limitations: string[],
): PredictionModel {
  const empty: ValidationScore = { n: 0, mae: NaN, rmse: NaN, r2: NaN };
  return {
    targetMetricId,
    featureNames,
    coefficients: [],
    trainedOn: 0,
    validation: empty,
    baselines: { persistence: empty, rollingMedian: empty },
    publishable: false,
    verdict,
    limitations,
  };
}

function solveRidge(design: readonly (readonly number[])[], targets: readonly number[], ridge: number): number[] {
  // solveLeastSquares already applies a small ridge to the non-intercept
  // diagonal; scale the design's later columns when a stronger penalty is
  // wanted rather than duplicating the solver.
  if (ridge <= 1e-8) return solveLeastSquares(design, targets);
  const augmentedDesign = [...design.map((row) => [...row])];
  const augmentedTargets = [...targets];
  const width = design[0]?.length ?? 0;
  const penalty = Math.sqrt(ridge);
  for (let j = 1; j < width; j += 1) {
    const row = new Array<number>(width).fill(0);
    row[j] = penalty;
    augmentedDesign.push(row);
    augmentedTargets.push(0);
  }
  return solveLeastSquares(augmentedDesign, augmentedTargets);
}

export function score(predictions: readonly number[], actuals: readonly number[]): ValidationScore {
  const n = predictions.length;
  if (n === 0) return { n: 0, mae: NaN, rmse: NaN, r2: NaN };

  let absoluteError = 0;
  let squaredError = 0;
  for (let i = 0; i < n; i += 1) {
    const error = predictions[i]! - actuals[i]!;
    absoluteError += Math.abs(error);
    squaredError += error * error;
  }
  const actualMean = mean(actuals);
  const totalSquares = actuals.reduce((acc, value) => acc + (value - actualMean) ** 2, 0);

  return {
    n,
    mae: absoluteError / n,
    rmse: Math.sqrt(squaredError / n),
    r2: totalSquares > 0 ? 1 - squaredError / totalSquares : NaN,
  };
}

/** Point prediction for the next day, only when the model earned the right to make one. */
export function predictNext(model: PredictionModel, latestFeatures: readonly number[]): number | null {
  if (!model.publishable || model.coefficients.length === 0) return null;
  let prediction = model.coefficients[0] ?? 0;
  for (let i = 0; i < latestFeatures.length; i += 1) {
    prediction += (model.coefficients[i + 1] ?? 0) * latestFeatures[i]!;
  }
  return prediction;
}
