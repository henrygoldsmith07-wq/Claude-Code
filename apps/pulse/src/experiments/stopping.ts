/**
 * Early stopping rules (P1 #5-8).
 *
 * Verdicts used to be computed once, at the end: a run that was already
 * doomed burned its full length and returned an answer mixing early and late
 * data. This module looks at a live run mid-run and decides *continue* or
 * *stop*, with the reason recorded on the experiment.
 *
 * Only rules pre-registered on the design may stop a run — a stopping rule
 * that appears after the run started is not a stopping rule, it is
 * rationalisation. Three rules ship here:
 *
 *  - futility  (P1 #6) — conditional power at the planned sample is below a
 *    pre-registered floor, so reaching significance is effectively
 *    impossible. A futility stop is *inconclusive*, never refuted.
 *  - adherence (P1 #7) — projected final adherence is below the floor with
 *    no realistic recovery, because even perfect future adherence cannot
 *    reach it. Stops as invalid, naming the missed days.
 *  - quality   (P1 #8) — the worst contributing source's score collapses
 *    mid-run (a connector that stopped syncing), so the tail of the run
 *    would rest on data that cannot be trusted. Stops as invalid.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { daysBetween, localDayStart } from "../events/time.js";
import { observationsFor, type MetricObservation } from "../metrics/compute.js";
import type { MetricRegistry } from "../metrics/registry.js";
import { sourcesOf } from "../metrics/registry.js";
import { scoreSource } from "../quality/score.js";
import { welchTTest } from "../statistics/comparisons.js";
import { twoSampleTPower } from "../statistics/power.js";
import { adaptiveEndDate } from "./calendar.js";
import {
  assignmentDateForOutcome,
  conditionForDateFrom,
  extendedAssignments,
  type Assignment,
  type ExperimentDesign,
} from "./design.js";

// ---------------------------------------------------------------------------
// Pre-registered rule configuration
// ---------------------------------------------------------------------------

export interface FutilityRuleConfig {
  /**
   * Conditional-power floor. Power below this at the *planned* sample means
   * the run cannot realistically reach significance; stop as inconclusive.
   */
  conditionalPowerFloor: number;
  /**
   * Only evaluate once at least this fraction of the planned sample has been
   * observed — a too-eager threshold stops on early noise.
   */
  minSampleFraction: number;
}

export interface AdherenceRuleConfig {
  /** Projected final adherence below this stops the run as invalid. */
  minAdherence: number;
  /** Only evaluate once at least this many assigned days have elapsed. */
  minAssignedDays: number;
}

export interface QualityRuleConfig {
  /** Worst contributing source score below this stops the run as invalid. */
  minQuality: number;
  /**
   * Only evaluate once at least this many days of the run have elapsed — a
   * connector is not "broken" on the second day.
   */
  minElapsedDays: number;
}

/**
 * The stopping rules pre-registered on a design. A rule present here may stop
 * the run; a rule absent here never will, whatever the data says.
 */
export interface StoppingConfig {
  futility?: FutilityRuleConfig;
  adherence?: AdherenceRuleConfig;
  quality?: QualityRuleConfig;
}

/**
 * The pre-registration surface: every field optional, with the defaults
 * resolved onto the design record at design time so the stored config shows
 * the actual thresholds a run can be stopped by.
 */
export type StoppingConfigInput = {
  futility?: Partial<FutilityRuleConfig>;
  adherence?: Partial<AdherenceRuleConfig>;
  quality?: Partial<QualityRuleConfig>;
};

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export interface FutilityDetails {
  /** Observed standardised effect (Hedges' g) at decision time. */
  observedEffect: number;
  /** Power of the planned final comparison given that effect. */
  conditionalPower: number;
  plannedNPerGroup: number;
  floor: number;
}

export interface AdherenceDetails {
  projectedAdherence: number;
  minAdherence: number;
  daysWithSessions: number;
  elapsedAssignedDays: number;
  totalAssignedDays: number;
}

export interface QualityDetails {
  score: number;
  floor: number;
  source: SourceId;
}

export interface StopDecision {
  rule: "futility" | "adherence" | "quality";
  /** The date the decision was evaluated on the live calendar. */
  decidedOn: string;
  /** Human-readable reason, recorded on the experiment. */
  reason: string;
  details: FutilityDetails | AdherenceDetails | QualityDetails;
}

export interface StoppingEvaluationOptions {
  registry: MetricRegistry;
  /** The live calendar date the run is being evaluated on. */
  today: string;
  timezone?: string;
  /** Reference instant for freshness. Defaults to local midnight of `today`. */
  nowMs?: number;
}

/**
 * Evaluates the pre-registered stopping rules for a live run. Returns a stop
 * decision when a rule fires, null to continue. Rules are evaluated in order
 * — futility, adherence, quality — and the first stop wins, so an adherence
 * collapse is reported as what it is rather than as a quality failure.
 */
export function evaluateStopping(
  design: ExperimentDesign,
  events: readonly PulseEvent[],
  options: StoppingEvaluationOptions,
): StopDecision | null {
  const config = design.stopping;
  if (!config || (!config.futility && !config.adherence && !config.quality)) return null;

  const today = options.today;
  // Only a run that has started and has not yet ended is "live" — a finished
  // run is the final analysis's job, not a stopping rule's.
  if (today < design.startDate) return null;

  const definition = options.registry.require(design.targetMetricId);
  // Observations belong to the assignment day they reflect (P1 #11): an
  // outcome dated X counts as the observation of X - lag, so a next-morning
  // rating is not attributed to the day it happened to be recorded on.
  const observations = observationsFor(events, definition).filter(
    (observation) => {
      const assignedDate = assignmentDateForOutcome(design, observation.localDate);
      return assignedDate >= design.startDate && assignedDate <= today;
    },
  );
  // The run's window is the adaptive one (P1 #4): an extension changes how
  // many assigned days remain, which is exactly what the adherence projection
  // must account for.
  const effectiveEnd = adaptiveEndDate(
    design,
    observations.map((observation) => assignmentDateForOutcome(design, observation.localDate)),
    today,
  );
  if (today >= effectiveEnd) return null;

  const assignments = extendedAssignments(design, effectiveEnd);
  const groupA: MetricObservation[] = [];
  const groupB: MetricObservation[] = [];
  for (const observation of observations) {
    const condition = conditionForDateFrom(assignments, assignmentDateForOutcome(design, observation.localDate));
    if (condition === "A") groupA.push(observation);
    else if (condition === "B") groupB.push(observation);
  }

  if (config.futility) {
    const stop = evaluateFutility(design, config.futility, groupA, groupB, today);
    if (stop) return stop;
  }
  if (config.adherence) {
    const stop = evaluateAdherence(design, config.adherence, assignments, observations, today);
    if (stop) return stop;
  }
  if (config.quality) {
    const stop = evaluateQuality(design, config.quality, events, options, today);
    if (stop) return stop;
  }
  return null;
}

/**
 * Futility (P1 #6): conditional power at the planned sample. If the observed
 * effect is small enough that even the full planned sample would almost never
 * reach significance, the run cannot answer its question and should not burn
 * its remaining length collecting data that never could. The stop is
 * *inconclusive* — it is not evidence of no effect.
 */
function evaluateFutility(
  design: ExperimentDesign,
  rule: FutilityRuleConfig,
  groupA: readonly MetricObservation[],
  groupB: readonly MetricObservation[],
  today: string,
): StopDecision | null {
  const plannedN = design.minSamplePerCondition;
  const observed = groupA.length + groupB.length;
  if (observed < rule.minSampleFraction * plannedN * 2) return null;
  // The effect cannot be estimated honestly with fewer than two sessions per
  // condition — do not stop on a half-empty comparison.
  if (groupA.length < 2 || groupB.length < 2) return null;

  const comparison = welchTTest(
    groupA.map((observation) => observation.value),
    groupB.map((observation) => observation.value),
  );
  if (comparison.insufficient || !Number.isFinite(comparison.effect.value)) return null;

  const conditionalPower = twoSampleTPower(comparison.effect.value, plannedN, 0.05);
  if (conditionalPower >= rule.conditionalPowerFloor) return null;

  return {
    rule: "futility",
    decidedOn: today,
    reason:
      `Conditional power of ${(conditionalPower * 100).toFixed(0)}% at the planned sample of ${plannedN} ` +
      `sessions per condition — below the pre-registered floor of ${(rule.conditionalPowerFloor * 100).toFixed(0)}% — ` +
      `so reaching significance is effectively impossible. Stopping early on futility — inconclusive, not refuted.`,
    details: {
      observedEffect: comparison.effect.value,
      conditionalPower,
      plannedNPerGroup: plannedN,
      floor: rule.conditionalPowerFloor,
    },
  };
}

/**
 * Low adherence (P1 #7): projects the final adherence. If even recording
 * every remaining assigned day cannot bring the run back above the floor,
 * there is no realistic recovery — stop as invalid and name the missed days.
 * The projection uses the adaptive end date, so a run that will extend is
 * given the room to recover that the extension actually provides.
 */
function evaluateAdherence(
  design: ExperimentDesign,
  rule: AdherenceRuleConfig,
  assignments: readonly Assignment[],
  observations: readonly MetricObservation[],
  today: string,
): StopDecision | null {
  const assignedDates = assignments
    .filter((assignment) => assignment.condition !== null && assignment.date >= design.startDate)
    .map((assignment) => assignment.date);
  const total = assignedDates.length;
  const elapsed = assignedDates.filter((date) => date <= today).length;
  if (elapsed < rule.minAssignedDays) return null;

  const sessionDates = new Set(observations.map((observation) => assignmentDateForOutcome(design, observation.localDate)));
  const daysWithSessions = assignedDates.filter((date) => date <= today && sessionDates.has(date)).length;
  const remaining = Math.max(0, total - elapsed);
  const projected = total > 0 ? (daysWithSessions + remaining) / total : 0;
  if (projected >= rule.minAdherence) return null;

  const missed = elapsed - daysWithSessions;
  return {
    rule: "adherence",
    decidedOn: today,
    reason:
      `Projected adherence of ${(projected * 100).toFixed(0)}% — even recording every remaining assigned day, ` +
      `the run would finish below the pre-registered ${(rule.minAdherence * 100).toFixed(0)}% floor. ` +
      `${missed} of ${elapsed} elapsed assigned days have no session. Stopping as invalid.`,
    details: {
      projectedAdherence: projected,
      minAdherence: rule.minAdherence,
      daysWithSessions,
      elapsedAssignedDays: elapsed,
      totalAssignedDays: total,
    },
  };
}

/**
 * Data quality (P1 #8): gates the run on the worst contributing source's
 * score over the run window. A connector that stops syncing poisons the tail
 * of an experiment — the freshness dimension collapses, and the run is
 * stopped as invalid with the quality readout attached rather than analysing
 * a broken tail. "Missing because the condition says don't do it" stays an
 * adherence matter (handled above); this fires on data that has gone stale.
 */
function evaluateQuality(
  design: ExperimentDesign,
  rule: QualityRuleConfig,
  events: readonly PulseEvent[],
  options: StoppingEvaluationOptions,
  today: string,
): StopDecision | null {
  const elapsedDays = daysBetween(design.startDate, today) + 1;
  if (elapsedDays < rule.minElapsedDays) return null;

  const definition = options.registry.require(design.targetMetricId);
  // Score only the run's own window: a healthy history before the run must
  // not mask a source that died the day the experiment started.
  const windowEvents = events.filter(
    (event) => event.localDate >= design.startDate && event.localDate <= today,
  );
  const nowMs = options.nowMs ?? localDayStart(today, options.timezone ?? "UTC");
  const scored = sourcesOf(definition).map((source) => ({
    source,
    score: scoreSource(source, windowEvents, {
      nowMs,
      timezone: options.timezone ?? "UTC",
      definitions: [definition],
      expectedEventsPerWeek: design.assumedSessionsPerWeek ?? 4,
    }).score,
  }));
  const worst = scored.reduce((acc, current) => (current.score < acc.score ? current : acc));
  if (worst.score >= rule.minQuality) return null;

  return {
    rule: "quality",
    decidedOn: today,
    reason:
      `The worst contributing source for ${design.targetMetricId} scores ${worst.score.toFixed(2)} against the ` +
      `pre-registered quality floor of ${rule.minQuality.toFixed(2)} — the run's tail rests on stale data and ` +
      `cannot be trusted. Stopping as invalid.`,
    details: { score: worst.score, floor: rule.minQuality, source: worst.source },
  };
}

