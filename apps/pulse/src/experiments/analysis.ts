/**
 * Experiment analysis.
 *
 * The verdict logic is the part that matters. Four outcomes, and three of them
 * are not "it worked":
 *
 *   supported    — effect in the predicted direction, CI excludes zero, and the
 *                  effect is at least half the size predicted
 *   refuted      — effect in the opposite direction and clearly non-zero, OR
 *                  adequately powered with a CI that excludes anything
 *                  practically meaningful
 *   inconclusive — anything underpowered, under-adhered, or genuinely ambiguous
 *   invalid      — the run did not happen as designed
 *
 * `inconclusive` is the honest answer far more often than a product's
 * incentives would like, so it is the default rather than the exception.
 */

import type { PulseEvent } from "../events/schema.js";
import { observationsFor, type MetricObservation } from "../metrics/compute.js";
import type { MetricRegistry } from "../metrics/registry.js";
import { mannWhitneyU, pairedTTest, welchTTest, wilcoxonSignedRank, type ComparisonResult } from "../statistics/comparisons.js";
import { mean } from "../statistics/descriptive.js";
import { intervalCrossesZero, type Interval } from "../statistics/effects.js";
import { gradeConfidence, causalityCaveat, type ConfidenceAssessment } from "../statistics/confidence.js";
import { twoSampleTPower } from "../statistics/power.js";
import { conditionForDate, type ExperimentDesign } from "./design.js";

export type ExperimentVerdict = "supported" | "refuted" | "inconclusive" | "invalid";

export interface AdherenceReport {
  assignedDays: number;
  daysWithSessions: number;
  /** Days with a session, as a share of assigned days. */
  adherence: number;
  conditionASessions: number;
  conditionBSessions: number;
  /** Sessions that fell outside the experiment window entirely. */
  outOfWindowSessions: number;
}

export interface ExperimentResult {
  experimentId: string;
  hypothesisId: string;
  analysedAt: string;
  verdict: ExperimentVerdict;
  /** Plain sentence stating the outcome, assembled from the numbers. */
  summary: string;
  reasons: string[];
  comparison: ComparisonResult | null;
  /** Secondary test, reported alongside so a single method cannot drive the verdict. */
  secondaryComparison: ComparisonResult | null;
  differenceCi: Interval | null;
  observedEffect: number;
  predictedEffect: number;
  adherence: AdherenceReport;
  confidence: ConfidenceAssessment;
  causalityNote: string;
  /** Blocks used, for crossover designs. */
  blocks: { block: number; condition: "A" | "B"; n: number; mean: number }[];
  achievedPower: number;
}

export interface AnalysisOptions {
  registry: MetricRegistry;
  predictedEffect: number;
  dataQuality?: number;
  now?: () => number;
  /** Minimum adherence before the run is called invalid. */
  minAdherence?: number;
}

export function analyseExperiment(
  design: ExperimentDesign,
  events: readonly PulseEvent[],
  options: AnalysisOptions,
): ExperimentResult {
  const now = options.now ?? Date.now;
  const definition = options.registry.require(design.targetMetricId);
  const allObservations = observationsFor(events, definition);

  const inWindow = allObservations.filter(
    (observation) => observation.localDate >= design.startDate && observation.localDate <= design.endDate,
  );
  const outOfWindow = allObservations.length - inWindow.length;

  const groupA: MetricObservation[] = [];
  const groupB: MetricObservation[] = [];
  for (const observation of inWindow) {
    const condition = conditionForDate(design, observation.localDate);
    if (condition === "A") groupA.push(observation);
    else if (condition === "B") groupB.push(observation);
  }

  const daysWithSessions = new Set(inWindow.map((observation) => observation.localDate)).size;
  const adherence: AdherenceReport = {
    assignedDays: design.assignments.length,
    daysWithSessions,
    adherence: design.assignments.length ? daysWithSessions / design.assignments.length : 0,
    conditionASessions: groupA.length,
    conditionBSessions: groupB.length,
    outOfWindowSessions: outOfWindow,
  };

  const blocks = summariseBlocks(design, groupA, groupB);
  const reasons: string[] = [];

  // --- validity gates ---------------------------------------------------
  const minAdherence = options.minAdherence ?? 0.4;
  if (groupA.length === 0 || groupB.length === 0) {
    return invalidResult(design, options, adherence, blocks, "One of the conditions has no sessions at all.", now());
  }
  if (adherence.adherence < minAdherence) {
    return invalidResult(
      design,
      options,
      adherence,
      blocks,
      `Only ${Math.round(adherence.adherence * 100)}% of assigned days had a session, below the ${Math.round(minAdherence * 100)}% needed for the result to mean anything.`,
      now(),
    );
  }

  // --- the comparison ---------------------------------------------------
  const paired = design.type === "crossover" && blocks.length >= 4;
  let comparison: ComparisonResult;
  let secondary: ComparisonResult | null = null;

  if (paired) {
    const { a, b } = pairBlocks(blocks);
    if (a.length >= 2) {
      comparison = pairedTTest(b, a);
      // A second method always accompanies the first, so a verdict is never
      // the artefact of one test's assumptions. Wilcoxon needs six pairs;
      // below that, an unpaired rank test on the raw sessions is the honest
      // cross-check available.
      secondary =
        a.length >= 6
          ? wilcoxonSignedRank(b, a)
          : mannWhitneyU(groupA.map((o) => o.value), groupB.map((o) => o.value));
    } else {
      comparison = welchTTest(groupA.map((o) => o.value), groupB.map((o) => o.value));
      secondary = mannWhitneyU(groupA.map((o) => o.value), groupB.map((o) => o.value));
    }
  } else {
    const a = groupA.map((o) => o.value);
    const b = groupB.map((o) => o.value);
    comparison = welchTTest(a, b);
    secondary = mannWhitneyU(a, b);
  }

  const observedEffect = comparison.effect.value;
  const differenceCi = comparison.differenceCi ?? null;
  const harmonicN = (2 * groupA.length * groupB.length) / (groupA.length + groupB.length) / 2;
  const achievedPower = twoSampleTPower(options.predictedEffect, Math.max(2, harmonicN));

  // --- verdict ----------------------------------------------------------
  let verdict: ExperimentVerdict;
  const underSampled = groupA.length < design.minSamplePerCondition || groupB.length < design.minSamplePerCondition;
  const directionMatches = Math.sign(observedEffect) === Math.sign(options.predictedEffect || 1);
  const ciExcludesZero = differenceCi ? !intervalCrossesZero(differenceCi) : comparison.pValue < 0.05;
  const bigEnough = Math.abs(observedEffect) >= Math.abs(options.predictedEffect) * 0.5;

  if (underSampled) {
    reasons.push(
      `Reached ${groupA.length} and ${groupB.length} sessions against a target of ${design.minSamplePerCondition} per condition.`,
    );
  }
  if (secondary && !secondary.insufficient && Math.sign(secondary.effect.value) !== Math.sign(observedEffect)) {
    reasons.push("The two analysis methods disagree on the direction, which is a reason for caution.");
  }

  if (comparison.insufficient) {
    verdict = "inconclusive";
    reasons.push(comparison.insufficient);
  } else if (ciExcludesZero && directionMatches && bigEnough && !underSampled) {
    verdict = "supported";
    reasons.push("The effect is in the predicted direction, large enough to matter, and the interval excludes zero.");
  } else if (ciExcludesZero && !directionMatches) {
    verdict = "refuted";
    reasons.push("The effect is clearly non-zero but runs in the opposite direction to the prediction.");
  } else if (!ciExcludesZero && !underSampled && achievedPower >= 0.8) {
    verdict = "refuted";
    reasons.push(
      `With ${groupA.length} vs ${groupB.length} sessions this run had ${Math.round(achievedPower * 100)}% power to detect the predicted effect and did not find it.`,
    );
  } else {
    verdict = "inconclusive";
    if (ciExcludesZero && !bigEnough) {
      reasons.push("A difference is detectable but smaller than half the predicted effect, which is not enough to act on.");
    } else if (!ciExcludesZero) {
      reasons.push("The confidence interval still includes zero, so the direction is unresolved.");
    }
  }

  const confidence = gradeConfidence({
    evidenceClass: "experiment",
    sampleSize: groupA.length + groupB.length,
    effectMagnitude: Math.abs(observedEffect),
    adjustedP: comparison.pValue,
    dataQuality: options.dataQuality ?? 0.8,
    familySize: 1,
    // Before/after cannot rule out drift or anything else that changed with it.
    uncontrolledConfounders: design.type === "before-after" ? 2 : 0,
  });

  return {
    experimentId: design.id,
    hypothesisId: design.hypothesisId,
    analysedAt: new Date(now()).toISOString(),
    verdict,
    summary: buildSummary(design, verdict, comparison, groupA, groupB),
    reasons,
    comparison,
    secondaryComparison: secondary,
    differenceCi,
    observedEffect,
    predictedEffect: options.predictedEffect,
    adherence,
    confidence,
    causalityNote:
      design.type === "before-after"
        ? "A before/after design cannot separate the change you made from anything else that changed at the same time."
        : (causalityCaveat("experiment") ?? ""),
    blocks,
    achievedPower,
  };
}

function invalidResult(
  design: ExperimentDesign,
  options: AnalysisOptions,
  adherence: AdherenceReport,
  blocks: ExperimentResult["blocks"],
  reason: string,
  nowMs: number,
): ExperimentResult {
  return {
    experimentId: design.id,
    hypothesisId: design.hypothesisId,
    analysedAt: new Date(nowMs).toISOString(),
    verdict: "invalid",
    summary: `This run cannot be analysed. ${reason}`,
    reasons: [reason],
    comparison: null,
    secondaryComparison: null,
    differenceCi: null,
    observedEffect: NaN,
    predictedEffect: options.predictedEffect,
    adherence,
    confidence: gradeConfidence({
      evidenceClass: "experiment",
      sampleSize: adherence.conditionASessions + adherence.conditionBSessions,
      effectMagnitude: 0,
      dataQuality: options.dataQuality ?? 0.8,
      uncontrolledConfounders: 3,
    }),
    causalityNote: "No causal claim can be made from a run that did not follow its design.",
    blocks,
    achievedPower: 0,
  };
}

function summariseBlocks(
  design: ExperimentDesign,
  groupA: readonly MetricObservation[],
  groupB: readonly MetricObservation[],
): ExperimentResult["blocks"] {
  const blockByDate = new Map(design.assignments.map((assignment) => [assignment.date, assignment]));
  const buckets = new Map<string, { block: number; condition: "A" | "B"; values: number[] }>();

  for (const observation of [...groupA, ...groupB]) {
    const assignment = blockByDate.get(observation.localDate);
    if (!assignment) continue;
    const key = `${assignment.block}:${assignment.condition}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.values.push(observation.value);
    else buckets.set(key, { block: assignment.block, condition: assignment.condition, values: [observation.value] });
  }

  return [...buckets.values()]
    .map((bucket) => ({ block: bucket.block, condition: bucket.condition, n: bucket.values.length, mean: mean(bucket.values) }))
    .sort((a, b) => a.block - b.block || a.condition.localeCompare(b.condition));
}

/**
 * Pairs consecutive A and B blocks for the paired analysis. Only complete
 * pairs are used — an unmatched trailing block would import exactly the time
 * trend the crossover exists to remove.
 */
function pairBlocks(blocks: ExperimentResult["blocks"]): { a: number[]; b: number[] } {
  const a: number[] = [];
  const b: number[] = [];
  const byBlock = new Map<number, { condition: "A" | "B"; mean: number }>();
  for (const block of blocks) byBlock.set(block.block, { condition: block.condition, mean: block.mean });

  const indices = [...byBlock.keys()].sort((x, y) => x - y);
  for (let i = 0; i + 1 < indices.length; i += 2) {
    const first = byBlock.get(indices[i]!)!;
    const second = byBlock.get(indices[i + 1]!)!;
    if (first.condition === second.condition) continue;
    if (!Number.isFinite(first.mean) || !Number.isFinite(second.mean)) continue;
    if (first.condition === "A") {
      a.push(first.mean);
      b.push(second.mean);
    } else {
      a.push(second.mean);
      b.push(first.mean);
    }
  }
  return { a, b };
}

function buildSummary(
  design: ExperimentDesign,
  verdict: ExperimentVerdict,
  comparison: ComparisonResult,
  groupA: readonly MetricObservation[],
  groupB: readonly MetricObservation[],
): string {
  const meanA = mean(groupA.map((o) => o.value));
  const meanB = mean(groupB.map((o) => o.value));
  const relative = meanB !== 0 ? ((meanA - meanB) / Math.abs(meanB)) * 100 : NaN;
  const change = Number.isFinite(relative)
    ? `${Math.abs(relative).toFixed(1)}% ${relative >= 0 ? "higher" : "lower"}`
    : `${(meanA - meanB).toFixed(3)} different`;

  const head = `Across ${groupA.length} sessions under ${design.conditionA.label} and ${groupB.length} under ${design.conditionB.label}, ${design.targetMetricId} was ${change} under ${design.conditionA.label}`;
  const ci = comparison.differenceCi
    ? ` (95% CI ${comparison.differenceCi.low.toFixed(3)} to ${comparison.differenceCi.high.toFixed(3)})`
    : "";

  switch (verdict) {
    case "supported":
      return `${head}${ci}. That matches the prediction, so the hypothesis is supported for you, under these conditions.`;
    case "refuted":
      return `${head}${ci}. That does not match the prediction, so the hypothesis is refuted.`;
    case "inconclusive":
      return `${head}${ci}. The result is inconclusive — the data cannot yet separate a real effect from noise.`;
    default:
      return `${head}${ci}.`;
  }
}
