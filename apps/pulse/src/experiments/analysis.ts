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
import { daysBetween, localDate } from "../events/time.js";
import { observationsFor, type MetricObservation } from "../metrics/compute.js";
import type { MetricRegistry } from "../metrics/registry.js";
import { mannWhitneyU, pairedTTest, welchTTest, wilcoxonSignedRank, type ComparisonResult } from "../statistics/comparisons.js";
import { mean, slope } from "../statistics/descriptive.js";
import { intervalCrossesZero, type Interval } from "../statistics/effects.js";
import { gradeConfidence, causalityCaveat, type ConfidenceAssessment } from "../statistics/confidence.js";
import { twoSampleTPower } from "../statistics/power.js";
import { benjaminiHochberg } from "../statistics/multiple.js";
import { adaptiveEndDate } from "./calendar.js";
import type { StopDecision } from "./stopping.js";
import {
  assignmentDateForOutcome,
  conditionForDateFrom,
  extendedAssignments,
  type Assignment,
  type ExperimentDesign,
  type ExperimentOutcome,
} from "./design.js";

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

/**
 * The washout gap of a crossover with `washoutDays` set (P1 #3). Days with
 * no condition are excluded from the per-block means and from adherence, but
 * their sessions are still counted here: the mean is the visible hangover,
 * the carry-over that the gap exists to let decay.
 */
export interface WashoutReport {
  /** Washout days in the schedule. */
  days: number;
  /** Observations recorded on washout days. */
  sessions: number;
  /** Mean of the washout observations, when any exist. */
  mean: number | null;
}

/**
 * The baseline lead-in of a design with `baselineDays` set (P1 #1). Its days
 * have no condition and are excluded from the comparison and adherence, but
 * they are reported so the user can see the starting level and any drift
 * before the intervention — the context the effect is judged against.
 */
export interface BaselineReport {
  /** Baseline days in the schedule. */
  days: number;
  /** Observations recorded on baseline days. */
  sessions: number;
  /** Mean of the baseline observations, when any exist — the starting level. */
  mean: number | null;
  /** Least-squares drift per day over the baseline; null when unmeasurable. */
  trendPerDay: number | null;
}

/**
 * A secondary outcome's readout (P1 #12). Reported alongside the primary,
 * corrected within the family, and never allowed to flip the verdict.
 */
export interface SecondaryOutcomeResult {
  metricId: string;
  predictedDirection: "increase" | "decrease";
  predictedEffect: number;
  comparison: ComparisonResult;
  observedEffect: number;
  /** Raw p-value of this outcome's comparison. */
  pValue: number;
  /** Benjamini-Hochberg adjusted p across the family; NaN when the comparison was insufficient. */
  adjustedP: number;
  significant: boolean;
  /** Plain reading — reported, not decisive. */
  note: string;
}

export interface ExperimentResult {
  experimentId: string;
  hypothesisId: string;
  /** Metric the design registered as its primary outcome. */
  targetMetricId?: string;
  analysedAt: string;
  /** The window actually analysed: the design's end, or the adaptive-duration end (P1 #4). */
  effectiveEndDate: string;
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
  /** The baseline lead-in: starting level and drift, when the design has one; null otherwise. */
  baseline: BaselineReport | null;
  /** The washout gap and its hangover readout, for crossover designs with one; null otherwise. */
  washout: WashoutReport | null;
  /** The pre-registered early-stopping decision (P1 #5) the verdict integrates; null when the run ran its course. */
  stopping: StopDecision | null;
  /** Family correction applied over the outcomes (P1 #12); null when the experiment measures only the primary. */
  family: { size: number; primaryAdjustedP: number | null } | null;
  /** Secondary outcomes, reported but never allowed to flip the verdict. */
  secondaryOutcomes: SecondaryOutcomeResult[];
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
  /** Timezone for the analysis date, which drives the adaptive-duration rule. */
  timezone?: string;
  /** Minimum adherence before the run is called invalid. */
  minAdherence?: number;
  /** A pre-registered early-stopping decision (P1 #5), evaluated live; the verdict integrates it. */
  stopping?: StopDecision | null;
}

export function analyseExperiment(
  design: ExperimentDesign,
  events: readonly PulseEvent[],
  options: AnalysisOptions,
): ExperimentResult {
  const now = options.now ?? Date.now;
  const definition = options.registry.require(design.targetMetricId);
  const allObservations = observationsFor(events, definition);

  // The data-collection window adapts (P1 #4): the end date is recomputed
  // from the observed sessions-per-week, so sessions recorded during an
  // extension count. The analysis method and the planned sample never change
  // — only the window does.
  const today = localDate(now(), options.timezone ?? "UTC");
  const adaptiveEnd = adaptiveEndDate(
    design,
    allObservations.map((observation) => assignmentDateForOutcome(design, observation.localDate)),
    today,
  );
  // A run stopped by a pre-registered rule (P1 #5) ended on the day it was
  // stopped: the window closes there, so sessions collected after the stop
  // are out of window rather than silently counted against the run.
  const effectiveEnd =
    options.stopping && options.stopping.decidedOn < adaptiveEnd ? options.stopping.decidedOn : adaptiveEnd;


  const effectiveAssignments = extendedAssignments(design, effectiveEnd);

  const inWindow = allObservations.filter(
    (observation) =>
      assignmentDateForOutcome(design, observation.localDate) >= design.startDate &&
      assignmentDateForOutcome(design, observation.localDate) <= effectiveEnd,
  );
  const outOfWindow = allObservations.length - inWindow.length;

  // Days with a condition are the only "assigned" days: baseline and washout
  // days have no condition to follow, so they cannot be failed. Their
  // sessions stay in the window and are reported separately — baseline as the
  // starting level and drift (P1 #1), washout as the hangover (P1 #3).
  const byDate = [...effectiveAssignments].sort((a, b) => a.date.localeCompare(b.date));
  const firstConditionIndex = byDate.findIndex((assignment) => assignment.condition !== null);
  const baselineDates = new Set(
    (firstConditionIndex === -1 ? byDate : byDate.slice(0, firstConditionIndex))
      .filter((assignment) => assignment.condition === null)
      .map((assignment) => assignment.date),
  );
  const washoutDates = new Set(
    (firstConditionIndex === -1 ? [] : byDate.slice(firstConditionIndex))
      .filter((assignment) => assignment.condition === null)
      .map((assignment) => assignment.date),
  );
  const conditionDates = new Set(
    byDate.filter((assignment) => assignment.condition !== null).map((assignment) => assignment.date),
  );
  const baseline = buildBaselineReport(design, inWindow, baselineDates);
  const washout = buildWashoutReport(design, inWindow, washoutDates);

  const { groupA, groupB } = splitByCondition(design, inWindow, effectiveAssignments);

  const daysWithSessions = new Set(
    inWindow
      .filter((observation) => conditionDates.has(assignmentDateForOutcome(design, observation.localDate)))
      .map((observation) => assignmentDateForOutcome(design, observation.localDate)),
  ).size;
  const adherence: AdherenceReport = {
    assignedDays: conditionDates.size,
    daysWithSessions,
    adherence: conditionDates.size ? daysWithSessions / conditionDates.size : 0,
    conditionASessions: groupA.length,
    conditionBSessions: groupB.length,
    outOfWindowSessions: outOfWindow,
  };

  const blocks = summariseBlocks(groupA, groupB, effectiveAssignments, design);
  const reasons: string[] = [];

  if (effectiveEnd > design.endDate) {
    const observed = groupA.length + groupB.length;
    const elapsedDays = Math.max(1, daysBetween(design.startDate, today) + 1);
    const rate = (observed / elapsedDays) * 7;
    const assumed = design.assumedSessionsPerWeek ?? 4;
    reasons.push(
      `Run extended to ${effectiveEnd} (from ${design.endDate}) to reach the planned ${design.minSamplePerCondition * 2} sessions — observed ${rate.toFixed(1)}/week against the assumed ${assumed}/week.`,
    );
  }

  // --- validity gates ---------------------------------------------------
  // A pre-registered stop recorded on the live run (P1 #5) is authoritative:
  // a futility stop is inconclusive — never refuted — and still reports the
  // comparison below; an adherence or quality stop means the run did not
  // happen as designed, so it is invalid before any comparison is attempted.
  const minAdherence = options.minAdherence ?? 0.4;
  if (options.stopping && options.stopping.rule !== "futility") {
    return invalidResult(design, options, adherence, blocks, baseline, washout, options.stopping.reason, now());
  }
  if (groupA.length === 0 || groupB.length === 0) {
    return invalidResult(design, options, adherence, blocks, baseline, washout, "One of the conditions has no sessions at all.", now());
  }
  if (adherence.adherence < minAdherence) {
    return invalidResult(
      design,
      options,
      adherence,
      blocks,
      baseline,
      washout,
      `Only ${Math.round(adherence.adherence * 100)}% of assigned days had a session, below the ${Math.round(minAdherence * 100)}% needed for the result to mean anything.`,
      now(),
    );
  }

  // --- the comparison ---------------------------------------------------
  const { comparison, secondary } = computeComparison(design, groupA, groupB, blocks);

  const observedEffect = comparison.effect.value;
  const differenceCi = comparison.differenceCi ?? null;
  const harmonicN = (2 * groupA.length * groupB.length) / (groupA.length + groupB.length) / 2;

  // --- outcomes and family correction (P1 #12) ---------------------------
  // The primary is the hypothesis's own outcome and the only one that may
  // drive the verdict. Secondaries get the same comparison machinery and are
  // corrected with Benjamini-Hochberg across the whole family, so running
  // several outcomes in one experiment does not quietly multiply the
  // false-positive rate the way several separate experiments would.
  const outcomeSpecs: ExperimentOutcome[] =
    design.outcomes ??
    [
      {
        metricId: design.targetMetricId,
        predictedDirection: options.predictedEffect >= 0 ? "increase" : "decrease",
        predictedEffect: options.predictedEffect,
        role: "primary",
      },
    ];
  const primarySpec = outcomeSpecs.find((outcome) => outcome.role === "primary") ?? outcomeSpecs[0]!;

  const secondaryReadouts: {
    spec: ExperimentOutcome;
    comparison: ComparisonResult;
    observedEffect: number;
    pValue: number;
  }[] = [];
  for (const spec of outcomeSpecs) {
    if (spec.role === "primary") continue;
    const secondaryWindow = observationsFor(events, options.registry.require(spec.metricId)).filter((observation) => {
      const assigned = assignmentDateForOutcome(design, observation.localDate);
      return assigned >= design.startDate && assigned <= effectiveEnd;
    });
    const secondaryGroups = splitByCondition(design, secondaryWindow, effectiveAssignments);
    const secondaryBlocks = summariseBlocks(secondaryGroups.groupA, secondaryGroups.groupB, effectiveAssignments, design);
    const secondaryComparison = computeComparison(design, secondaryGroups.groupA, secondaryGroups.groupB, secondaryBlocks);
    secondaryReadouts.push({
      spec,
      comparison: secondaryComparison.comparison,
      observedEffect: secondaryComparison.comparison.effect.value,
      pValue: secondaryComparison.comparison.pValue,
    });
  }

  const family =
    secondaryReadouts.length > 0
      ? benjaminiHochberg(
          [
            { spec: primarySpec, pValue: comparison.pValue },
            ...secondaryReadouts.map((readout) => ({ spec: readout.spec, pValue: readout.pValue })),
          ],
          (item) => item.pValue,
          0.05,
        )
      : null;
  const primaryAdjustedP = family?.results.find((result) => result.item.spec.role === "primary")?.adjustedP ?? null;

  const secondaryOutcomes: SecondaryOutcomeResult[] = secondaryReadouts.map((readout) => {
    const adjusted = family?.results.find((result) => result.item.spec.metricId === readout.spec.metricId)?.adjustedP ?? NaN;
    return {
      metricId: readout.spec.metricId,
      predictedDirection: readout.spec.predictedDirection,
      predictedEffect: readout.spec.predictedEffect,
      comparison: readout.comparison,
      observedEffect: readout.observedEffect,
      pValue: readout.pValue,
      adjustedP: adjusted,
      significant: Number.isFinite(adjusted) && adjusted <= 0.05,
      note: secondaryNote(readout.spec, readout.comparison, adjusted),
    };
  });

  const achievedPower = twoSampleTPower(primarySpec.predictedEffect, Math.max(2, harmonicN));

  // --- verdict ----------------------------------------------------------
  let verdict: ExperimentVerdict;
  const underSampled = groupA.length < design.minSamplePerCondition || groupB.length < design.minSamplePerCondition;
  const directionMatches =
    Math.sign(observedEffect) === (primarySpec.predictedDirection === "increase" ? 1 : -1);
  const ciExcludesZero = differenceCi ? !intervalCrossesZero(differenceCi) : comparison.pValue < 0.05;
  const bigEnough = Math.abs(observedEffect) >= Math.abs(primarySpec.predictedEffect) * 0.5;
  // With secondaries registered, the primary must survive the family
  // correction to be supported — a borderline effect that the family-wide
  // search cannot single out is inconclusive, not a win.
  const familyAllowsSupport = !family || (primaryAdjustedP !== null && primaryAdjustedP <= 0.05);

  if (underSampled) {
    reasons.push(
      `Reached ${groupA.length} and ${groupB.length} sessions against a target of ${design.minSamplePerCondition} per condition.`,
    );
  }
  if (secondary && !secondary.insufficient && Math.sign(secondary.effect.value) !== Math.sign(observedEffect)) {
    reasons.push("The two analysis methods disagree on the direction, which is a reason for caution.");
  }

  if (options.stopping?.rule === "futility") {
    // A futility stop is never evidence of no effect — the run could not
    // answer its question, so the verdict is inconclusive by pre-registered
    // rule, with the comparison still reported for transparency.
    verdict = "inconclusive";
    reasons.push(options.stopping.reason);
  } else if (comparison.insufficient) {
    verdict = "inconclusive";
    reasons.push(comparison.insufficient);
  } else if (ciExcludesZero && directionMatches && bigEnough && !underSampled && familyAllowsSupport) {
    verdict = "supported";
    reasons.push("The effect is in the predicted direction, large enough to matter, and the interval excludes zero.");
    if (family) {
      reasons.push(
        `It remains significant after Benjamini-Hochberg correction across ${family.summary.familySize} outcomes (adjusted p ${primaryAdjustedP!.toFixed(3)}).`,
      );
    }
  } else if (ciExcludesZero && !directionMatches) {
    verdict = "refuted";
    reasons.push("The effect is clearly non-zero but runs in the opposite direction to the prediction.");
  } else if (!ciExcludesZero && !underSampled && achievedPower >= 0.8) {
    verdict = "refuted";
    reasons.push(
      `With ${groupA.length} vs ${groupB.length} sessions this run had ${Math.round(achievedPower * 100)}% power to detect the predicted effect and did not find it.`,
    );
  } else if (ciExcludesZero && directionMatches && bigEnough && !underSampled && !familyAllowsSupport) {
    // The effect looks real on its own but does not survive the family: this
    // is precisely the false-positive the correction exists to catch.
    verdict = "inconclusive";
    reasons.push(
      `The primary's effect is in the predicted direction and the interval excludes zero, but after Benjamini-Hochberg correction across ${family!.summary.familySize} outcomes the adjusted p is ${primaryAdjustedP!.toFixed(3)} — the family-wide search cannot single this outcome out.`,
    );
  } else {
    verdict = "inconclusive";
    if (ciExcludesZero && !bigEnough) {
      reasons.push("A difference is detectable but smaller than half the predicted effect, which is not enough to act on.");
    } else if (!ciExcludesZero) {
      reasons.push("The confidence interval still includes zero, so the direction is unresolved.");
    }
  }

  let confidence = gradeConfidence({
    evidenceClass: "experiment",
    sampleSize: groupA.length + groupB.length,
    effectMagnitude: Math.abs(observedEffect),
    adjustedP: comparison.pValue,
    dataQuality: options.dataQuality ?? 0.8,
    familySize: 1,
    // Before/after cannot rule out drift or anything else that changed with it.
    uncontrolledConfounders: design.type === "before-after" ? 2 : 0,
  });
  // Before/after is uncontrolled: never present as high confidence, however good the numbers look.
  if (design.type === "before-after" && confidence.level === "high") {
    confidence = { ...confidence, level: "moderate" as const, score: Math.min(confidence.score, 0.74), limitations: [...confidence.limitations, "Before/after comparisons are uncontrolled — treat as suggestive, not causal proof"], reasons: confidence.reasons };
  }
  // Missing-data honesty: if adherence is modest, cap confidence accordingly
  if (adherence.adherence < 0.6 && confidence.level === "high") {
    confidence = { ...confidence, level: "moderate" as const, score: Math.min(confidence.score, 0.74), limitations: [...confidence.limitations, "Adherence was modest, so the dose actually received is uncertain"] };
  }

  return {
    experimentId: design.id,
    hypothesisId: design.hypothesisId,
    targetMetricId: design.targetMetricId,
    analysedAt: new Date(now()).toISOString(),
    effectiveEndDate: effectiveEnd,
    verdict,
    summary: appendLagNote(
      appendWashoutNote(appendBaselineNote(buildSummary(design, verdict, comparison, groupA, groupB), baseline), washout),
      design,
    ),
    reasons,
    comparison,
    secondaryComparison: secondary,
    differenceCi,
    observedEffect,
    predictedEffect: options.predictedEffect,
    adherence,
    baseline,
    washout,
    stopping: options.stopping ?? null,
    family: family ? { size: family.summary.familySize, primaryAdjustedP } : null,
    secondaryOutcomes,
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
  baseline: BaselineReport | null,
  washout: WashoutReport | null,
  reason: string,
  nowMs: number,
): ExperimentResult {
  return {
    experimentId: design.id,
    hypothesisId: design.hypothesisId,
    targetMetricId: design.targetMetricId,
    analysedAt: new Date(nowMs).toISOString(),
    effectiveEndDate: design.endDate,
    verdict: "invalid",
    summary: `This run cannot be analysed. ${reason}`,
    reasons: [reason],
    comparison: null,
    secondaryComparison: null,
    differenceCi: null,
    observedEffect: NaN,
    predictedEffect: options.predictedEffect,
    adherence,
    baseline,
    washout,
    stopping: options.stopping ?? null,
    family: null,
    secondaryOutcomes: [],
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

function buildWashoutReport(
  design: ExperimentDesign,
  inWindow: readonly MetricObservation[],
  washoutDates: ReadonlySet<string>,
): WashoutReport | null {
  const washoutDays = design.assignments.filter((assignment) => washoutDates.has(assignment.date));
  if (washoutDays.length === 0) return null;
  const observations = inWindow.filter((observation) => washoutDates.has(assignmentDateForOutcome(design, observation.localDate)));
  return {
    days: washoutDays.length,
    sessions: observations.length,
    mean: observations.length > 0 ? mean(observations.map((observation) => observation.value)) : null,
  };
}

function buildBaselineReport(
  design: ExperimentDesign,
  inWindow: readonly MetricObservation[],
  baselineDates: ReadonlySet<string>,
): BaselineReport | null {
  const baselineDays = design.assignments.filter((assignment) => baselineDates.has(assignment.date));
  if (baselineDays.length === 0) return null;
  const observations = inWindow
    .filter((observation) => baselineDates.has(assignmentDateForOutcome(design, observation.localDate)))
    .sort((a, b) => assignmentDateForOutcome(design, a.localDate).localeCompare(assignmentDateForOutcome(design, b.localDate)));
  const values = observations.map((observation) => observation.value);
  const firstDate = baselineDays[0]!.date;
  const trend = slope(
    observations.map((observation) => daysBetween(firstDate, assignmentDateForOutcome(design, observation.localDate))),
    values,
  );
  // A slope of exactly zero is no slope to report — "drift of +0.000/day"
  // would be a claim dressed as a number.
  const trendPerDay = Number.isFinite(trend) && Math.abs(trend) >= 1e-9 ? trend : null;
  return {
    days: baselineDays.length,
    sessions: observations.length,
    mean: observations.length > 0 ? mean(values) : null,
    trendPerDay,
  };
}

/** The baseline gets one plain sentence in the summary, not a buried footnote. */
function appendBaselineNote(summary: string, baseline: BaselineReport | null): string {
  if (!baseline) return summary;
  const readout = baseline.mean === null ? "no sessions recorded" : `averaged ${baseline.mean.toFixed(3)}`;
  const trendReadout =
    baseline.trendPerDay === null ? "with a stable level across the lead-in" : `with a drift of ${baseline.trendPerDay >= 0 ? "+" : ""}${baseline.trendPerDay.toFixed(3)}/day`;
  return `${summary} ${baseline.days} baseline day${baseline.days === 1 ? "" : "s"} preceded the run; ${baseline.sessions} session${baseline.sessions === 1 ? "" : "s"} recorded there ${readout}, ${trendReadout} — the starting level before any intervention.`;
}

/** The washout gets one plain sentence in the summary, not a buried footnote. */
function appendWashoutNote(summary: string, washout: WashoutReport | null): string {
  if (!washout) return summary;
  const readout = washout.mean === null ? "no sessions recorded" : `mean ${washout.mean.toFixed(3)}`;
  return `${summary} ${washout.days} washout day${washout.days === 1 ? "" : "s"} separated the blocks; ${washout.sessions} session${washout.sessions === 1 ? "" : "s"} recorded there (${readout}) were excluded from the comparison as possible carry-over.`;
}

/** A lagged outcome gets one plain sentence in the summary, so the pairing is visible. */
function appendLagNote(summary: string, design: ExperimentDesign): string {
  const lag = design.outcomeLagDays ?? 0;
  if (lag <= 0) return summary;
  return `${summary} Outcomes were paired to the assignment ${lag === 1 ? "the day before" : `${lag} days before`} they were recorded.`;
}

function summariseBlocks(
  groupA: readonly MetricObservation[],
  groupB: readonly MetricObservation[],
  effectiveAssignments: readonly Assignment[],
  design: ExperimentDesign,
): ExperimentResult["blocks"] {
  const blockByDate = new Map(effectiveAssignments.map((assignment) => [assignment.date, assignment]));
  const buckets = new Map<string, { block: number; condition: "A" | "B"; values: number[] }>();

  for (const observation of [...groupA, ...groupB]) {
    const assignment = blockByDate.get(assignmentDateForOutcome(design, observation.localDate));
    // Observations in the groups always sit on a condition day (washout
    // observations never reach them), but the assignment type allows null.
    if (!assignment || assignment.condition === null) continue;
    const key = `${assignment.block}:${assignment.condition}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.values.push(observation.value);
    else buckets.set(key, { block: assignment.block, condition: assignment.condition, values: [observation.value] });
  }

  return [...buckets.values()]
    .map((bucket) => ({ block: bucket.block, condition: bucket.condition, n: bucket.values.length, mean: mean(bucket.values) }))
    .sort((a, b) => a.block - b.block || a.condition.localeCompare(b.condition));
}

/** Splits in-window observations into their condition groups by assignment day. */
function splitByCondition(
  design: ExperimentDesign,
  inWindow: readonly MetricObservation[],
  effectiveAssignments: readonly Assignment[],
): { groupA: MetricObservation[]; groupB: MetricObservation[] } {
  const groupA: MetricObservation[] = [];
  const groupB: MetricObservation[] = [];
  for (const observation of inWindow) {
    const condition = conditionForDateFrom(effectiveAssignments, assignmentDateForOutcome(design, observation.localDate));
    if (condition === "A") groupA.push(observation);
    else if (condition === "B") groupB.push(observation);
  }
  return { groupA, groupB };
}

/**
 * A secondary outcome's plain-language reading: the direction it moved, its
 * raw and corrected p, and the standing reminder that it cannot decide the
 * experiment. An insufficient comparison says so instead of pretending.
 */
function secondaryNote(spec: ExperimentOutcome, comparison: ComparisonResult, adjustedP: number): string {
  if (comparison.insufficient) return `${comparison.insufficient} — not counted in the family.`;
  const movedInDirection =
    Math.sign(comparison.effect.value) === (spec.predictedDirection === "increase" ? 1 : -1);
  const correction = Number.isFinite(adjustedP) ? `, adjusted ${adjustedP.toFixed(3)}` : "";
  return (
    `Moved ${Math.abs(comparison.effect.value).toFixed(2)} SD ${movedInDirection ? "in" : "against"} the ` +
    `predicted direction (raw p ${comparison.pValue.toFixed(3)}${correction}) — reported, not decisive.`
  );
}

/**
 * Runs the primary comparison and its cross-check. A crossover with at least
 * four blocks pairs consecutive A and B block means; anything else compares
 * the raw sessions. A second method always accompanies the first, so a
 * verdict is never the artefact of one test's assumptions. Wilcoxon needs six
 * pairs; below that, an unpaired rank test on the raw sessions is the honest
 * cross-check available.
 */
function computeComparison(
  design: ExperimentDesign,
  groupA: readonly MetricObservation[],
  groupB: readonly MetricObservation[],
  blocks: ExperimentResult["blocks"],
): { comparison: ComparisonResult; secondary: ComparisonResult | null } {
  const paired = design.type === "crossover" && blocks.length >= 4;
  if (paired) {
    const { a, b } = pairBlocks(blocks);
    if (a.length >= 2) {
      const comparison = pairedTTest(b, a);
      const secondary =
        a.length >= 6
          ? wilcoxonSignedRank(b, a)
          : mannWhitneyU(groupA.map((o) => o.value), groupB.map((o) => o.value));
      return { comparison, secondary };
    }
    return {
      comparison: welchTTest(groupA.map((o) => o.value), groupB.map((o) => o.value)),
      secondary: mannWhitneyU(groupA.map((o) => o.value), groupB.map((o) => o.value)),
    };
  }
  const a = groupA.map((o) => o.value);
  const b = groupB.map((o) => o.value);
  return {
    comparison: welchTTest(a, b),
    secondary: mannWhitneyU(a, b),
  };
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
