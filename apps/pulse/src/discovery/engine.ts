/**
 * Relationship discovery.
 *
 * The pipeline, in order, and every step is a filter:
 *   1. generate candidates    — only questions worth asking
 *   2. evaluate               — with minimum-sample gates
 *   3. correct for the family — Benjamini-Hochberg across everything tested
 *   4. require a real effect  — statistical significance alone is not a finding
 *   5. check confounders      — and re-estimate within strata
 *   6. replicate out of sample — split the period in half
 *   7. grade and compose      — deterministic sentence, never generated text
 *
 * Steps 3-6 exist because the failure mode of a tool like this is not missing
 * a real effect; it is confidently reporting a false one.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { hash128 } from "../events/hash.js";
import type { MetricDefinition, MetricRegistry } from "../metrics/registry.js";
import { benjaminiHochberg } from "../statistics/multiple.js";
import { gradeConfidence } from "../statistics/confidence.js";
import { causalityCaveat } from "../statistics/confidence.js";
import { magnitudeForD, type EffectSize } from "../statistics/effects.js";
import { mean } from "../statistics/descriptive.js";
import { isAdequatelyPowered } from "../statistics/power.js";
import { autocorrelationControl, effectStability, outlierSensitivity } from "../statistics/safeguards.js";
import type { SourceQuality } from "../quality/score.js";
import { qualityForSources } from "../quality/score.js";
import {
  applyAdjustment,
  assessConfounders,
  assessSeriesConfounders,
  countUncontrolled,
  stratifiedEffect,
} from "./confounders.js";
import { daysBetween } from "../events/time.js";
import { evaluateCandidate, generateCandidates, type Candidate, type CandidateContext, type EvaluatedCandidate } from "./candidates.js";
import { compareFindings, validateFinding, type Confounder, type Finding, type NextAction } from "./finding.js";

export interface DiscoveryOptions {
  registry: MetricRegistry;
  qualities?: readonly SourceQuality[];
  /** FDR level for the family. */
  fdrLevel?: number;
  /** Minimum |standardised effect| worth reporting. */
  minEffect?: number;
  exposureWindowsHours?: readonly number[];
  maxLagDays?: number;
  splitAttributes?: readonly string[];
  /** Deterministic clock. */
  now?: () => number;
  /** Cap on findings returned. */
  limit?: number;
}

export interface DiscoveryReport {
  findings: Finding[];
  /** Candidates that were evaluated but did not survive, with the reason. */
  rejected: { candidate: Candidate; reason: string }[];
  /** Total comparisons made across the whole scan. */
  familySize: number;
  /** Number of separate outcome families the scan was split into. */
  familyCount: number;
  /** Comparisons in the largest single family. */
  largestFamilySize: number;
  candidatesGenerated: number;
  candidatesEvaluated: number;
  fdrLevel: number;
  expectedFalseDiscoveries: number;
}

export function discoverRelationships(
  events: readonly PulseEvent[],
  options: DiscoveryOptions,
): DiscoveryReport {
  const fdrLevel = options.fdrLevel ?? 0.05;
  const minEffect = options.minEffect ?? 0.2;
  const now = options.now ?? Date.now;

  const context: CandidateContext = {
    events,
    registry: options.registry,
    ...(options.exposureWindowsHours ? { exposureWindowsHours: options.exposureWindowsHours } : {}),
    ...(options.maxLagDays !== undefined ? { maxLagDays: options.maxLagDays } : {}),
    ...(options.splitAttributes ? { splitAttributes: options.splitAttributes } : {}),
  };

  const candidates = generateCandidates(context);
  const rejected: DiscoveryReport["rejected"] = [];
  const evaluated: EvaluatedCandidate[] = [];

  for (const candidate of candidates) {
    const result = evaluateCandidate(candidate, context);
    if (result.skipped) {
      rejected.push({ candidate, reason: result.skipped });
      continue;
    }
    if (!Number.isFinite(result.pValue)) {
      rejected.push({ candidate, reason: "Test could not be computed on this data" });
      continue;
    }
    evaluated.push(result);
  }

  // Benjamini-Hochberg controls the false discovery rate *within a family of
  // related hypotheses*. "What affects my study accuracy" and "what affects my
  // French pronunciation" are separate questions asked of separate data, and
  // pooling them into one family over-corrects: an effect on one outcome would
  // be penalised for every unrelated question asked about another. So the
  // family is one outcome metric, and both numbers — the family and the total
  // scan — are reported to the user.
  const byOutcome = new Map<string, EvaluatedCandidate[]>();
  for (const result of evaluated) {
    const key = result.candidate.outcomeMetricId;
    const bucket = byOutcome.get(key);
    if (bucket) bucket.push(result);
    else byOutcome.set(key, [result]);
  }

  const findings: Finding[] = [];
  let expectedFalseDiscoveries = 0;

  for (const family of byOutcome.values()) {
    const corrected = benjaminiHochberg(family, (item) => item.pValue, fdrLevel);
    expectedFalseDiscoveries += corrected.summary.expectedFalseDiscoveries;

    for (const entry of corrected.results) {
      const result = entry.item;
      if (!entry.significant) {
        rejected.push({
          candidate: result.candidate,
          reason: `Did not survive correction across the ${corrected.summary.familySize} comparisons made about ${result.candidate.outcomeMetricId} (p = ${result.pValue.toFixed(3)}, adjusted ${entry.adjustedP.toFixed(3)})`,
        });
        continue;
      }
      if (result.effectMagnitude < minEffect) {
        rejected.push({
          candidate: result.candidate,
          reason: `Statistically detectable but too small to matter (effect ${result.effectMagnitude.toFixed(2)} < ${minEffect})`,
        });
        continue;
      }

      const finding = composeFinding(result, entry.adjustedP, corrected.summary.familySize, events, options, now());
      if (!finding) continue;

      const problems = validateFinding(finding);
      if (problems.length) {
        rejected.push({ candidate: result.candidate, reason: `Failed evidence checks: ${problems.join("; ")}` });
        continue;
      }
      findings.push(finding);
    }
  }

  findings.sort(compareFindings);

  return {
    findings: options.limit ? findings.slice(0, options.limit) : findings,
    rejected,
    familySize: evaluated.length,
    familyCount: byOutcome.size,
    largestFamilySize: Math.max(0, ...[...byOutcome.values()].map((family) => family.length)),
    candidatesGenerated: candidates.length,
    candidatesEvaluated: evaluated.length,
    fdrLevel,
    expectedFalseDiscoveries,
  };
}

function composeFinding(
  result: EvaluatedCandidate,
  adjustedP: number,
  familySize: number,
  events: readonly PulseEvent[],
  options: DiscoveryOptions,
  nowMs: number,
): Finding | null {
  const registry = options.registry;
  const outcome = registry.require(result.candidate.outcomeMetricId);
  const driver = result.candidate.exposureMetricId ? registry.get(result.candidate.exposureMetricId) : undefined;

  const metricIds = [outcome.id, ...(driver ? [driver.id] : [])];
  const sources = [...new Set([outcome.source, ...(driver ? [driver.source] : [])])] as SourceId[];

  let confounders: Confounder[] = [];
  let adjustmentSurvived = true;

  if (result.candidate.kind === "lagged-correlation" && result.alignedDates) {
    // A daily correlation has no groups to balance, but it has the same two
    // structural threats: a shared trend and a shared weekly rhythm.
    const origin = result.alignedDates[0]!;
    const dayIndex = result.alignedDates.map((date) => daysBetween(origin, date));
    const isWeekend = result.alignedDates.map((date) => {
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
      return dow === 0 || dow === 6 ? 1 : 0;
    });
    const assessment = assessSeriesConfounders(result.alignedDriver!, result.alignedOutcome!, dayIndex, isWeekend);
    confounders = assessment.confounders;
    adjustmentSurvived = assessment.survivesAdjustment;
  } else if (result.groupA.length && result.groupB.length) {
    confounders = assessConfounders(result.groupA, result.groupB, {
      compositionAttributes: ["subject_id", "method", "skill"],
      timesAreReliable: result.candidate.kind !== "time-of-day",
    });
    // Time of day is the confounder worth actually adjusting for; for the
    // time-of-day question itself that would be circular, so it is skipped.
    if (result.candidate.kind !== "time-of-day") {
      const adjustment = stratifiedEffect(result.groupA, result.groupB);
      confounders = applyAdjustment(confounders, "time-of-day", adjustment);
      if (adjustment.usableStrata >= 2) adjustmentSurvived = adjustment.survivesAdjustment;
    }
  }

  const replicated = checkReplication(result);
  const uncontrolled = countUncontrolled(confounders);
  const dataQuality = qualityForSources(options.qualities ?? [], sources);

  const effect: EffectSize = result.comparison
    ? result.comparison.effect
    : result.correlation
      ? result.correlation.effect
      : { kind: "mean_difference", value: NaN, magnitude: "negligible", label: "not estimable" };

  const powered = result.comparison
    ? isAdequatelyPowered(result.comparison.nA, result.comparison.nB, 0.4)
    : result.sampleSize >= 20;

  const groupAValues = result.groupA.map((observation) => observation.value);
  const groupBValues = result.groupB.map((observation) => observation.value);
  const stability =
    groupAValues.length >= 6 && groupBValues.length >= 6
      ? effectStability(groupAValues, groupBValues)
      : undefined;
  const outlierCheck =
    groupAValues.length >= 3 && groupBValues.length >= 3
      ? outlierSensitivity(groupAValues, groupBValues)
      : undefined;
  const autocorrelation = result.alignedOutcome ? autocorrelationControl(result.alignedOutcome) : undefined;
  const timestampUncertain = [...result.groupA, ...result.groupB].some(
    (observation) => observation.attributes.time_estimated === true || Number(observation.attributes.timestamp_uncertainty_minutes ?? 0) > 0,
  );

  const confidence = gradeConfidence({
    evidenceClass: "correlation",
    sampleSize: result.sampleSize,
    effectMagnitude: result.effectMagnitude,
    adjustedP,
    dataQuality,
    familySize,
    uncontrolledConfounders: uncontrolled + (adjustmentSurvived ? 0 : 1),
    replicatedOutOfSample: replicated,
    reverseCausationPlausible: result.candidate.kind === "lagged-correlation" && !result.forwardDominant,
    ...(autocorrelation ? { effectiveSampleSize: autocorrelation.effectiveSampleSize } : {}),
    ...(stability ? { effectStable: stability.stable } : {}),
    ...(outlierCheck ? { outlierStable: outlierCheck.stable } : {}),
    ...(options.qualities?.length ? { reliability: dataQuality } : {}),
    timestampUncertain,
  });

  if (!powered) {
    confidence.limitations.push("The comparison is underpowered; treat the size of the effect as provisional");
  }
  if (!adjustmentSurvived) {
    confidence.limitations.push("Most of the difference disappears once time of day is held constant");
  }

  const { title, statement, sampleDescription } = phrase(result, outcome.name, driver?.name);
  const dateRange = rangeOf([...result.groupA, ...result.groupB]);

  return {
    id: `finding-${hash128(`${result.candidate.id}:${result.sampleSize}`).slice(0, 16)}`,
    createdAt: new Date(nowMs).toISOString(),
    evidenceClass: "correlation",
    title,
    statement,
    metricIds,
    sources,
    sampleSize: result.sampleSize,
    sampleDescription,
    effect,
    test: {
      name: result.comparison?.test ?? result.correlation?.method ?? "unknown",
      statistic: result.comparison?.statistic ?? result.correlation?.r ?? NaN,
      pValue: result.pValue,
      adjustedP,
      familySize,
      correctionMethod: "benjamini_hochberg",
    },
    confidence,
    confounders,
    causalityNote: causalityCaveat("correlation") ?? "",
    nextAction: proposeNextAction(result, confidence.level, adjustmentSurvived, outcome),
    evidence: [
      {
        kind: "events",
        description: `${result.sampleSize} observations of ${outcome.name}${driver ? ` paired with ${driver.name}` : ""}`,
        metricIds,
        sources,
        eventCount: countEvents(events, sources),
        dateRange,
      },
    ],
    tags: [result.candidate.kind, outcome.category, ...(driver ? [driver.category] : [])],
  };
}

/**
 * Out-of-sample check: does the effect point the same way in both halves of
 * the period? Cheap, and it catches the most common artefact — an effect that
 * exists only in one burst of unusual weeks.
 */
function checkReplication(result: EvaluatedCandidate): boolean {
  if (result.groupA.length < 16 || result.groupB.length < 16) return false;
  const all = [...result.groupA, ...result.groupB].sort((a, b) => a.localDate.localeCompare(b.localDate));
  const midpoint = all[Math.floor(all.length / 2)]!.localDate;

  const direction = (aValues: number[], bValues: number[]): number =>
    aValues.length >= 4 && bValues.length >= 4 ? Math.sign(mean(aValues) - mean(bValues)) : 0;

  const early = direction(
    result.groupA.filter((o) => o.localDate < midpoint).map((o) => o.value),
    result.groupB.filter((o) => o.localDate < midpoint).map((o) => o.value),
  );
  const late = direction(
    result.groupA.filter((o) => o.localDate >= midpoint).map((o) => o.value),
    result.groupB.filter((o) => o.localDate >= midpoint).map((o) => o.value),
  );
  return early !== 0 && early === late;
}

interface Phrasing {
  title: string;
  statement: string;
  sampleDescription: string;
}

/**
 * Deterministic phrasing.
 *
 * Every sentence a user reads about numbers is assembled here from the
 * computed values. The AI layer may later restate a finding, but it is given
 * these numbers and forbidden from producing new ones.
 */
function phrase(result: EvaluatedCandidate, outcomeName: string, driverName?: string): Phrasing {
  if (result.candidate.kind === "lagged-correlation" && result.correlation) {
    const lag = result.lagDays ?? 0;
    const when = lag === 0 ? "on the same day" : `${lag} day${lag === 1 ? "" : "s"} later`;
    const direction = result.correlation.r > 0 ? "higher" : "lower";
    return {
      title: `${driverName} tracks with ${outcomeName.toLowerCase()} ${when}`,
      statement: `Across ${result.sampleSize} days, days with more ${driverName?.toLowerCase()} were associated with ${direction} ${outcomeName.toLowerCase()} ${when} (${result.correlation.effect.label}).`,
      sampleDescription: `${result.sampleSize} days with data for both`,
    };
  }

  const comparison = result.comparison;
  const higher = (comparison?.difference ?? 0) > 0;
  const observations = result.observationCount ?? result.sampleSize;
  // Counts quoted to the user are independent sittings, matching the n the
  // statistics were computed on. Quoting raw item counts next to a p-value
  // computed on sittings would overstate the evidence.
  const countA = result.clusterCountA ?? result.groupA.length;
  const countB = result.clusterCountB ?? result.groupB.length;
  const relative = Number.isFinite(result.relativeDifference)
    ? `${Math.abs(result.relativeDifference * 100).toFixed(1)}% ${higher ? "higher" : "lower"}`
    : `${higher ? "higher" : "lower"}`;

  const groupPhrase = result.groupALabel || "one group";
  const versusPhrase = result.groupBLabel || "the rest";

  return {
    title: `${outcomeName} is ${higher ? "higher" : "lower"} ${groupPhrase}`,
    statement: `Across ${result.sampleSize} separate sittings (${observations} recorded items), ${outcomeName.toLowerCase()} ${groupPhrase} was ${relative} than ${versusPhrase} (${comparison?.effect.label ?? "effect not estimable"}, ${countA} vs ${countB} sittings).`,
    sampleDescription: `${countA} sittings ${groupPhrase} vs ${countB} ${versusPhrase}`,
  };
}

function proposeNextAction(
  result: EvaluatedCandidate,
  confidenceLevel: string,
  adjustmentSurvived: boolean,
  outcome: MetricDefinition,
): NextAction | null {
  // Direction gate. `groupA` is the higher-scoring side by construction, so on
  // a lower-is-better metric (calibration error, stress) it is the side to
  // *avoid*. Without this check the engine cheerfully recommends doing more of
  // whatever makes things worse.
  const groupAIsBetter =
    outcome.direction === "higher-better" ? true : outcome.direction === "lower-better" ? false : null;

  if (groupAIsBetter === false) {
    return {
      kind: "observe",
      summary: `Treat ${result.groupALabel} as the condition to avoid for ${outcome.name.toLowerCase()}`,
      rationale: `${outcome.name} is better when lower, and it is higher ${result.groupALabel}. Acting on this means doing less of it, not more — worth confirming before you change anything.`,
      effortHours: 0,
    };
  }

  // An effect that vanishes under adjustment is not worth a fortnight of the
  // user's life; more data will not fix a confound.
  if (!adjustmentSurvived) {
    return {
      kind: "observe",
      summary: "Keep watching this one rather than acting on it",
      rationale: "The difference largely disappears once time of day is held constant, so it may not be a real effect of the behaviour itself.",
      effortHours: 0,
    };
  }

  if (confidenceLevel === "very-low") {
    return {
      kind: "collect-more-data",
      summary: "Collect more sessions before drawing a conclusion",
      rationale: `The pattern is suggestive but the evidence is thin at ${result.sampleSize} observations.`,
      effortHours: 0,
    };
  }

  if (result.candidate.kind === "exposure-window" && result.candidate.exposureMetricId) {
    return {
      kind: "run-experiment",
      summary: `Run a crossover experiment to test whether ${result.groupALabel} genuinely changes the outcome`,
      rationale: "The association is strong enough and the behaviour is something you control, which is exactly when an experiment is worth the effort.",
      effortHours: 2,
      experimentDesignId: `crossover:${result.candidate.id}`,
    };
  }

  if (groupAIsBetter === null) {
    return {
      kind: "observe",
      summary: "Watch this pattern as more data arrives",
      rationale: `${outcome.name} has no inherently better direction, so there is nothing here to optimise towards.`,
      effortHours: 0,
    };
  }

  if (result.candidate.kind === "time-of-day" || result.candidate.kind === "attribute-split") {
    return {
      kind: "run-experiment",
      summary: `Deliberately schedule sessions ${result.groupALabel} for two weeks and measure the difference`,
      rationale: "You choose when and how you study, so this can be tested directly rather than only observed.",
      effortHours: 1,
      experimentDesignId: `before-after:${result.candidate.id}`,
    };
  }

  return {
    kind: "observe",
    summary: "Watch this pattern as more data arrives",
    rationale: "Not something you directly control, so there is no clean experiment to run.",
    effortHours: 0,
  };
}

function rangeOf(observations: readonly { localDate: string }[]): { from: string; to: string } | null {
  if (observations.length === 0) return null;
  const dates = observations.map((o) => o.localDate).sort();
  return { from: dates[0]!, to: dates[dates.length - 1]! };
}

function countEvents(events: readonly PulseEvent[], sources: readonly SourceId[]): number {
  return events.filter((event) => sources.includes(event.source)).length;
}

/** Re-exported so callers can label an effect without importing the stats module. */
export { magnitudeForD };
