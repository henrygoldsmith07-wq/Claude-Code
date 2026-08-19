/**
 * Counterfactual explanations.
 *
 * A finding answers "what does the data show". The counterfactual analysis
 * asks the companion question: "how much of the data would have to be
 * different for the claim to stop being true?" It is the same robustness
 * instinct as the out-of-sample replication check, pushed further: instead
 * of asking whether the effect survives a different *half* of the period,
 * it asks whether the effect survives losing the sittings that most support
 * it.
 *
 * The probe is deliberately concrete. The finding rests on independent
 * sittings (or days, for a lagged correlation). Working from the sitting
 * that most supports the effect, we remove one at a time and re-run the
 * same test, watching for two failure modes:
 *
 *   - direction flip    — the remaining data points the other way;
 *   - significance loss — the re-run p-value rises above the threshold the
 *                         finding itself survived (its corrected p, or its
 *                         raw p when no correction was recorded).
 *
 * Two honest caveats. First, the family-wise correction is not recomputed
 * per removal — the bar is the finding's own reported threshold, so a
 * counterfactual that "just misses" should be read as "close", not as a
 * fresh verdict on the whole scan. Second, the removal order is greedy
 * (always the most supportive sitting next), which makes it a good probe
 * for fragility but not a proof that fewer removals could never do it.
 *
 * A finding labelled `fragile` reverses direction or loses significance
 * when the three most influential sittings are removed. That does not make
 * the finding false — it makes it *load-bearing*, and acting on it would be
 * acting on a handful of days.
 */

import type { EvaluatedCandidate } from "./candidates.js";
import { clusterBySitting } from "../metrics/compute.js";
import { mean } from "../statistics/descriptive.js";
import { mannWhitneyU, welchTTest, type ComparisonResult } from "../statistics/comparisons.js";
import { spearman } from "../statistics/correlation.js";

export interface CounterfactualBar {
  /** The finding's raw p-value. */
  pValue: number;
  /** The corrected p-value the finding survived, when one was recorded. */
  adjustedP?: number;
}

export interface InfluentialSitting {
  /** The local date the sitting (or day) fell on. */
  localDate: string;
  /** Which side of the comparison it supports: A is the higher side by construction. */
  side: "A" | "B";
  /** The sitting's cluster-mean value (or the day's outcome value, for a correlation). */
  value: number;
}

export interface CounterfactualExplanation {
  /**
   * `fragile` when the effect flips direction or loses significance after
   * removing at most three of its most influential sittings; `robust`
   * otherwise.
   */
  verdict: "robust" | "fragile";
  /** Sittings the greedy probe had to remove before the direction flipped. Infinity = never within the probe. */
  removalsToFlipDirection: number;
  /** Sittings the greedy probe had to remove before the re-run test passed the bar. Infinity = never within the probe. */
  removalsToBreakSignificance: number;
  /** True when removing a single sitting flips the direction or breaks significance. */
  fragileToSingleSitting: boolean;
  /** The sittings most responsible for the effect, most influential first. */
  influentialSittings: InfluentialSitting[];
  /** Deterministic sentence, phrased from the computed numbers. */
  statement: string;
}

/** A finding labelled fragile reverses or fades once this many influential sittings are gone. */
const FRAGILE_THRESHOLD = 3;
/** Cap on probe steps, so a strong finding does not pay for a full sweep. */
const MAX_REMOVALS = 25;
/** Sittings shown to the human. */
const MAX_DISPLAYED = 6;
/** Below this many units per side the re-run test stops being meaningful. */
const MIN_UNITS_PER_SIDE = 3;

interface Unit {
  key: string;
  side: "A" | "B";
  value: number;
}

interface ProbeResult {
  removalsToFlipDirection: number;
  removalsToBreakSignificance: number;
  removed: Unit[];
}

/**
 * Core probe over two sets of cluster values (sitting-level means).
 * Exposed for tests; the engine-facing wrappers cluster the observations
 * first.
 */
export function counterfactualFromClusters(
  clusterA: { keys: string[]; values: number[] },
  clusterB: { keys: string[]; values: number[] },
  bar: CounterfactualBar,
  labels?: { groupALabel: string; groupBLabel: string },
): CounterfactualExplanation {
  const unitsA = clusterA.keys.map((key, i) => ({ key, side: "A" as const, value: clusterA.values[i]! }));
  const unitsB = clusterB.keys.map((key, i) => ({ key, side: "B" as const, value: clusterB.values[i]! }));
  const probe = probeGroups(unitsA, unitsB, bar);
  const fragile = Math.min(probe.removalsToFlipDirection, probe.removalsToBreakSignificance) <= FRAGILE_THRESHOLD;
  const fragileToSingleSitting = probe.removalsToFlipDirection === 1 || probe.removalsToBreakSignificance === 1;
  const explanation: CounterfactualExplanation = {
    verdict: fragile ? "fragile" : "robust",
    removalsToFlipDirection: probe.removalsToFlipDirection,
    removalsToBreakSignificance: probe.removalsToBreakSignificance,
    fragileToSingleSitting,
    influentialSittings: probe.removed.slice(0, MAX_DISPLAYED).map(toInfluential),
    statement: phrase(
      { removalsToFlipDirection: probe.removalsToFlipDirection, removalsToBreakSignificance: probe.removalsToBreakSignificance, fragileToSingleSitting },
      {
        unit: "sitting",
        groupALabel: labels?.groupALabel,
        groupBLabel: labels?.groupBLabel,
      },
    ),
  };
  return explanation;
}

/** Probe for a lagged-correlation finding, over its aligned daily pairs. */
export function counterfactualFromSeries(
  dates: readonly string[],
  driver: readonly number[],
  outcome: readonly number[],
  bar: CounterfactualBar,
): CounterfactualExplanation {
  const pairs = dates.map((date, i) => ({ date, x: driver[i]!, y: outcome[i]! }));
  const probe = probeSeries(pairs, bar);
  const fragile = Math.min(probe.removalsToFlipDirection, probe.removalsToBreakSignificance) <= FRAGILE_THRESHOLD;
  const fragileToSingleSitting = probe.removalsToFlipDirection === 1 || probe.removalsToBreakSignificance === 1;
  const explanation: CounterfactualExplanation = {
    verdict: fragile ? "fragile" : "robust",
    removalsToFlipDirection: probe.removalsToFlipDirection,
    removalsToBreakSignificance: probe.removalsToBreakSignificance,
    fragileToSingleSitting,
    influentialSittings: probe.removed.slice(0, MAX_DISPLAYED).map(toInfluential),
    statement: phrase(
      { removalsToFlipDirection: probe.removalsToFlipDirection, removalsToBreakSignificance: probe.removalsToBreakSignificance, fragileToSingleSitting },
      { unit: "day" },
    ),
  };
  return explanation;
}

/** Engine-facing wrapper: clusters the comparison's observations by sitting. */
export function counterfactualForComparison(
  result: EvaluatedCandidate,
  bar: CounterfactualBar,
): CounterfactualExplanation {
  const a = clusterBySitting(result.groupA);
  const b = clusterBySitting(result.groupB);
  return counterfactualFromClusters(a, b, bar, {
    groupALabel: result.groupALabel || "the higher side",
    groupBLabel: result.groupBLabel || "the rest",
  });
}

/** Engine-facing wrapper: uses the aligned daily pairs behind a lagged correlation. */
export function counterfactualForCorrelation(
  result: EvaluatedCandidate,
  bar: CounterfactualBar,
): CounterfactualExplanation {
  const dates = result.alignedDates ?? [];
  return counterfactualFromSeries(dates, result.alignedDriver ?? [], result.alignedOutcome ?? [], bar);
}

function toInfluential(unit: Unit): InfluentialSitting {
  return { localDate: unit.key.split(":")[0]!, side: unit.side, value: unit.value };
}

/** The same test the engine uses: Welch when both sides are large enough, ranks otherwise. */
function rerunTest(a: readonly number[], b: readonly number[]): ComparisonResult {
  return a.length >= 15 && b.length >= 15 ? welchTTest(a, b) : mannWhitneyU(a, b);
}

function differenceOf(a: readonly Unit[], b: readonly Unit[]): number {
  return mean(a.map((unit) => unit.value)) - mean(b.map((unit) => unit.value));
}

function probeGroups(unitsA: Unit[], unitsB: Unit[], bar: CounterfactualBar): ProbeResult {
  // Mutated in place via splice; never rebound.
  const a = [...unitsA];
  const b = [...unitsB];
  const removed: Unit[] = [];
  let removalsToFlipDirection = Number.POSITIVE_INFINITY;
  let removalsToBreakSignificance = Number.POSITIVE_INFINITY;
  const barP = bar.adjustedP ?? bar.pValue;

  for (let step = 0; step < MAX_REMOVALS; step += 1) {
    if (a.length < MIN_UNITS_PER_SIDE || b.length < MIN_UNITS_PER_SIDE) break;
    if (Number.isFinite(removalsToFlipDirection) && Number.isFinite(removalsToBreakSignificance)) break;

    // Remove whichever single sitting shrinks the difference the most: the
    // highest A-side value or the lowest B-side value.
    const candidates: { side: "A" | "B"; index: number }[] = [];
    if (a.length > MIN_UNITS_PER_SIDE) {
      candidates.push({ side: "A", index: indexOfExtreme(a, "max") });
    }
    if (b.length > MIN_UNITS_PER_SIDE) {
      candidates.push({ side: "B", index: indexOfExtreme(b, "min") });
    }
    if (candidates.length === 0) break;

    let best: { side: "A" | "B"; index: number } | null = null;
    let bestDifference = differenceOf(a, b);
    for (const candidate of candidates) {
      const trialA = candidate.side === "A" ? a.filter((_, i) => i !== candidate.index) : a;
      const trialB = candidate.side === "B" ? b.filter((_, i) => i !== candidate.index) : b;
      const trialDifference = differenceOf(trialA, trialB);
      if (trialDifference < bestDifference) {
        bestDifference = trialDifference;
        best = candidate;
      }
    }
    if (!best) break;

    const source = best.side === "A" ? a : b;
    removed.push(source[best.index]!);
    source.splice(best.index, 1);

    if (!Number.isFinite(removalsToFlipDirection) && bestDifference <= 0) {
      removalsToFlipDirection = removed.length;
    }
    if (!Number.isFinite(removalsToBreakSignificance)) {
      const rerun = rerunTest(a.map((unit) => unit.value), b.map((unit) => unit.value));
      if (!Number.isFinite(rerun.pValue) || rerun.pValue > barP) {
        removalsToBreakSignificance = removed.length;
      }
    }
  }

  return { removalsToFlipDirection, removalsToBreakSignificance, removed };
}

function probeSeries(pairs: { date: string; x: number; y: number }[], bar: CounterfactualBar): ProbeResult {
  let x = pairs.map((pair) => pair.x);
  let y = pairs.map((pair) => pair.y);
  let dates = pairs.map((pair) => pair.date);
  const removed: Unit[] = [];
  let removalsToFlipDirection = Number.POSITIVE_INFINITY;
  let removalsToBreakSignificance = Number.POSITIVE_INFINITY;
  const barP = bar.adjustedP ?? bar.pValue;

  const baseline = spearman(x, y);
  if (baseline.insufficient || !Number.isFinite(baseline.r)) {
    return { removalsToFlipDirection, removalsToBreakSignificance, removed };
  }
  const direction = Math.sign(baseline.r);

  for (let step = 0; step < MAX_REMOVALS && x.length > MIN_UNITS_PER_SIDE; step += 1) {
    if (Number.isFinite(removalsToFlipDirection) && Number.isFinite(removalsToBreakSignificance)) break;

    // The point pulling hardest in the direction of the correlation: the
    // largest signed covariance contribution aligned with r.
    const mx = mean(x);
    const my = mean(y);
    let index = -1;
    let bestContribution = -1;
    for (let i = 0; i < x.length; i += 1) {
      const contribution = (x[i]! - mx) * (y[i]! - my) * direction;
      if (contribution > bestContribution) {
        bestContribution = contribution;
        index = i;
      }
    }
    if (index < 0) break;

    // The outcome value is the quantity whose anomaly drives the correlation.
    removed.push({ key: dates[index]!, side: "A", value: y[index]! });
    x = x.filter((_, i) => i !== index);
    y = y.filter((_, i) => i !== index);
    dates = dates.filter((_, i) => i !== index);

    if (x.length < MIN_UNITS_PER_SIDE) break;

    const rerun = spearman(x, y);
    if (rerun.insufficient || !Number.isFinite(rerun.r)) {
      if (!Number.isFinite(removalsToFlipDirection)) removalsToFlipDirection = removed.length;
      if (!Number.isFinite(removalsToBreakSignificance)) removalsToBreakSignificance = removed.length;
      break;
    }
    if (!Number.isFinite(removalsToFlipDirection) && Math.sign(rerun.r) !== direction) {
      removalsToFlipDirection = removed.length;
    }
    if (!Number.isFinite(removalsToBreakSignificance) && rerun.pValue > barP) {
      removalsToBreakSignificance = removed.length;
    }
  }

  return { removalsToFlipDirection, removalsToBreakSignificance, removed };
}

function indexOfExtreme(units: readonly Unit[], which: "max" | "min"): number {
  let index = 0;
  for (let i = 1; i < units.length; i += 1) {
    if (which === "max" ? units[i]!.value > units[index]!.value : units[i]!.value < units[index]!.value) index = i;
  }
  return index;
}
function phrase(
  explanation: Pick<CounterfactualExplanation, "removalsToFlipDirection" | "removalsToBreakSignificance" | "fragileToSingleSitting">,
  options: { unit: "sitting" | "day"; groupALabel?: string; groupBLabel?: string },
): string {
  const { unit, groupALabel } = options;

  if (explanation.fragileToSingleSitting) {
    const flipFirst = explanation.removalsToFlipDirection === 1 && explanation.removalsToBreakSignificance !== 1;
    return `This finding hinges on a single ${unit}, and it is load-bearing: remove the most influential ${unit} and the effect ${
      flipFirst ? "reverses direction" : "no longer reaches significance"
    }. Treat the claim as provisional.`;
  }

  // Report whichever failure comes first; the smaller number is the more
  // imminent fragility, so it is the one worth telling the user about.
  if (
    Number.isFinite(explanation.removalsToBreakSignificance) &&
    explanation.removalsToBreakSignificance <= explanation.removalsToFlipDirection
  ) {
    return `The direction is stable, but the effect is fragile: removing the ${explanation.removalsToBreakSignificance} most influential ${unit}s would push it past the significance threshold this finding survived.`;
  }

  if (Number.isFinite(explanation.removalsToFlipDirection)) {
    return `The effect survives removing any single ${unit}, but it reverses direction once the ${explanation.removalsToFlipDirection} most influential ${unit}s are removed — ${
      groupALabel ?? "the higher side"
    } carries the claim.`;
  }

  return `Robust — removing the most influential ${unit}s one by one does not reverse the direction or erase the significance of this effect.`;
}
