/**
 * Longitudinal benchmark.
 *
 * Pulse is only as good as its answer to one question: over months of noisy,
 * realistic data, does it find the things that are actually there and stay
 * silent about the things that are not? Synthetic users are the only way to
 * ask that question, because with a synthetic user the ground truth is known
 * by construction.
 *
 * The benchmark runs the full pipeline over a long horizon and reports, all
 * seeded and deterministic so it can gate CI:
 *
 *   sensitivity             — share of planted effects found (standard user)
 *   precision               — share of findings that correspond to a planted effect
 *   specificity             — 1 / (1 + findings on a null user); 1.0 means clean
 *   wearableSignalFound     — whether a cleanly-planted sleep effect is found
 *                              through the wearable source (the automatic-collection
 *                              path, checked in isolation so it cannot be confounded)
 *   recommendationAccuracy  — share of recommendations pointing at a true effect
 *   confoundedFlagged       — whether the planted confound was caught, not endorsed
 *   calibration             — how confidence is graded across true vs other findings
 */

import type { DiscoveryReport } from "../discovery/engine.js";
import type { Finding } from "../discovery/finding.js";
import { mean } from "../statistics/descriptive.js";
import { createSyntheticPulse } from "./harness.js";
import type { GroundTruthRelationship } from "./generator.js";

export interface LongitudinalBenchmarkOptions {
  seed?: string;
  days?: number;
}

export interface LongitudinalBenchmarkResult {
  seed: string;
  days: number;
  eventCount: number;
  discovery: DiscoveryReport;
  trueEffects: string[];
  foundTrueEffects: string[];
  missedTrueEffects: string[];
  confoundedFlagged: boolean;
  sensitivity: number;
  precision: number;
  /** Whether the wearable sleep effect was found when planted in isolation. */
  wearableSignalFound: boolean;
  /** Findings produced by a matched null user — a proxy for the false-positive rate. */
  nullUserFindings: number;
  /** 1 / (1 + nullUserFindings): 1.0 means the engine stayed silent where it should. */
  specificity: number;
  recommendationAccuracy: number;
  recommendationsFromFindings: number;
  alignedRecommendations: number;
  calibration: {
    meanConfidence: number;
    meanConfidenceTrue: number;
    highConfidenceCount: number;
  };
}

const SLEEP_SEED_SUFFIX = ":sleep";
/** Strong enough to be found in isolation without dominating the other signals. */
const SLEEP_BOOST = 0.05;

export async function runLongitudinalBenchmark(
  options: LongitudinalBenchmarkOptions = {},
): Promise<LongitudinalBenchmarkResult> {
  const seed = options.seed ?? "pulse-longitudinal";
  const days = options.days ?? 180;

  // --- standard user: exercise + afternoon + the confounded French pair -----
  const harness = await createSyntheticPulse({ days, seed });
  const pulse = harness.pulse;
  const truths = harness.user.groundTruth;

  const discovery = pulse.discover();
  const findings = discovery.findings;

  const trueEffects = truths.filter((rel) => rel.kind === "true-effect" && rel.plantedEffect > 0);
  const foundTrueEffects = trueEffects.filter((rel) => findings.some((finding) => matchesRelationship(finding, rel)));

  const confounded = truths.find((rel) => rel.kind === "confounded");
  const confoundedFlagged = confounded ? confoundFlagged(findings, confounded) : true;

  const alignedFindings = findings.filter(
    (finding) =>
      trueEffects.some((rel) => matchesRelationship(finding, rel)) ||
      (confounded ? matchesRelationship(finding, confounded) : false),
  );
  const precision = findings.length === 0 ? 1 : alignedFindings.length / findings.length;

  // Recommendation alignment: every finding-derived recommendation should point
  // at a planted true effect if the engine is honest.
  const findingById = new Map(findings.map((finding) => [finding.id, finding]));
  const recommendations = pulse.recommendations();
  const fromFindings = recommendations.filter((recommendation) => recommendation.sourceKind === "finding");
  const alignedRecommendations = fromFindings.filter((recommendation) => {
    const source = findingById.get(recommendation.sourceId);
    return source ? trueEffects.some((rel) => matchesRelationship(source, rel)) : false;
  });
  const recommendationAccuracy = fromFindings.length === 0 ? 1 : alignedRecommendations.length / fromFindings.length;

  const trueFindings = findings.filter((finding) => trueEffects.some((rel) => matchesRelationship(finding, rel)));
  const meanConfidence = findings.length ? mean(findings.map((finding) => finding.confidence.score)) : 0;
  const meanConfidenceTrue = trueFindings.length ? mean(trueFindings.map((finding) => finding.confidence.score)) : 0;

  // --- wearable signal, in isolation so nothing else can explain it ---------
  const sleepHarness = await createSyntheticPulse({
    days,
    seed: `${seed}${SLEEP_SEED_SUFFIX}`,
    includeWearable: true,
    sleepAccuracyBoost: SLEEP_BOOST,
    exerciseAccuracyBoost: 0,
    afternoonAccuracyBoost: 0,
    includeConfounded: false,
  });
  const sleepFindings = sleepHarness.pulse.discover().findings;
  const wearableSignalFound = sleepFindings.some(
    (finding) =>
      finding.tags.includes("lagged-correlation") &&
      finding.metricIds.includes("wellbeing.sleep_duration") &&
      finding.metricIds.includes("study.accuracy"),
  );

  // --- specificity against a null user ---------------------------------------
  // A fixed seed so the false-positive count is deterministic and CI-gatable;
  // this is the same null fixture the discovery suite asserts stays silent.
  const nullHarness = await createSyntheticPulse({
    days,
    seed: "null-user-strict",
    exerciseAccuracyBoost: 0,
    afternoonAccuracyBoost: 0,
    sleepAccuracyBoost: 0,
    includeConfounded: false,
  });
  const nullUserFindings = nullHarness.pulse.discover().findings.length;

  return {
    seed,
    days,
    eventCount: pulse.store.size,
    discovery,
    trueEffects: trueEffects.map((rel) => rel.id),
    foundTrueEffects: foundTrueEffects.map((rel) => rel.id),
    missedTrueEffects: trueEffects.filter((rel) => !foundTrueEffects.includes(rel)).map((rel) => rel.id),
    confoundedFlagged,
    sensitivity: trueEffects.length === 0 ? 1 : foundTrueEffects.length / trueEffects.length,
    precision,
    wearableSignalFound,
    nullUserFindings,
    specificity: 1 / (1 + nullUserFindings),
    recommendationAccuracy,
    recommendationsFromFindings: fromFindings.length,
    alignedRecommendations: alignedRecommendations.length,
    calibration: {
      meanConfidence,
      meanConfidenceTrue,
      highConfidenceCount: findings.filter((finding) => finding.confidence.level === "high").length,
    },
  };
}

/** A finding matches a ground-truth relationship when it names the same metrics and question shape. */
export function matchesRelationship(finding: Finding, rel: GroundTruthRelationship): boolean {
  if (!finding.metricIds.includes(rel.outcomeMetricId)) return false;
  if (rel.exposureMetricId && !finding.metricIds.includes(rel.exposureMetricId)) return false;
  if (rel.matchTag && !finding.tags.includes(rel.matchTag)) return false;
  return true;
}

/**
 * A confounded relationship is "flagged" when Pulse either says nothing about
 * it, or says something that does not endorse acting on it. Reporting the
 * association *with* an uncontrolled time-of-day confounder is correct
 * behaviour; proposing a two-week experiment off it is the failure this
 * benchmark exists to catch.
 */
function confoundFlagged(findings: readonly Finding[], rel: GroundTruthRelationship): boolean {
  const matches = findings.filter((finding) => matchesRelationship(finding, rel));
  if (matches.length === 0) return true;
  return matches.every((finding) => {
    const timeOfDay = finding.confounders.find((confounder) => confounder.id === "time-of-day");
    if (timeOfDay?.status === "uncontrolled") return true;
    return finding.nextAction?.kind !== "run-experiment";
  });
}
