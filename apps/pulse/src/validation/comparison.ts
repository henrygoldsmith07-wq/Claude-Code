/**
 * Pulse versus the naive baselines, on the same data, scored by the same rules.
 *
 * The synthetic ground truth is the only place the comparison can be exact:
 * with planted effects we know precisely which pairs exist and which do not.
 * The same harness runs over a corrupted copy of each dataset — dropped
 * days, double exports, unit errors, jittered timestamps — because "how
 * much does mess inflate each method's false positives" is the number that
 * separates a dashboard from an analysis engine.
 *
 * Nothing here replaces the longitudinal benchmark (`synthetic/benchmark.ts`);
 * it answers a different question: not "is Pulse calibrated?" but "is Pulse
 * better than what a weekend of scripting would produce?"
 */

import { Pulse } from "../pulse.js";
import type { PulseEvent } from "../events/schema.js";
import type { Finding } from "../discovery/finding.js";
import { createSyntheticPulse, type Harness } from "../synthetic/harness.js";
import { matchesRelationship } from "../synthetic/benchmark.js";
import type { GroundTruthRelationship } from "../synthetic/generator.js";
import {
  runAllBaselines,
  seriesMapFromEvents,
  type BaselineMethod,
  type DiscoveryClaim,
  type SimpleSeries,
} from "./baselines.js";
import { corruptEvents, type CorruptionRecipe } from "./corrupt.js";
import type { ClaimScore } from "./evaluate.js";

export interface MethodScoreRow {
  method: string;
  /** Precision/recall against planted effects on the clean dataset. */
  clean: ClaimScore;
  /** Claims made on the matched null dataset — the raw false-positive proxy. */
  nullClaims: number;
  /** Same scores after corruption is applied to both datasets, when requested. */
  corrupted?: { clean: ClaimScore; nullClaims: number };
}

export interface DiscoveryComparisonOptions {
  seed?: string;
  days?: number;
  /** Apply this corruption to both datasets before re-scoring. */
  corruption?: CorruptionRecipe;
}

export interface DiscoveryComparisonResult {
  seed: string;
  days: number;
  rows: MethodScoreRow[];
  /** Planted true-effect relationships the scoring judged against. */
  truthPairs: GroundTruthRelationship[];
  corruptionSummary?: { originalEvents: number; corruptedEvents: number; droppedDays: number };
}

/** Pulse findings in the shared claim shape, so ledgers can score them alongside baselines. */
export function claimsFromFindings(findings: readonly Finding[]): DiscoveryClaim[] {
  const claims: DiscoveryClaim[] = [];
  for (const finding of findings) {
    const [outcomeMetricId, exposureMetricId] = finding.metricIds;
    if (!outcomeMetricId || !exposureMetricId) continue;
    claims.push({
      method: "pulse",
      exposureMetricId,
      outcomeMetricId,
      direction: Math.sign(finding.effect.value) as 1 | -1,
      pValue: finding.test?.adjustedP ?? finding.test?.pValue ?? 1,
    });
  }
  return claims;
}

/**
 * Pulse's findings are matched to truth with the same rule as the
 * longitudinal benchmark (`matchesRelationship`: outcome + exposure named),
 * so its row here is directly comparable with `runLongitudinalBenchmark`'s
 * precision figure. Baselines are scored pair-wise — they have no tags,
 * confounder flags or experiment proposals to match on.
 */
function scorePulse(findings: readonly Finding[], truth: readonly GroundTruthRelationship[]): ClaimScore {
  const targets = truth.filter((rel) => rel.kind === "true-effect");
  const truePositives = targets.filter((rel) => findings.some((finding) => matchesRelationship(finding, rel)));
  const falsePositives = findings.filter((finding) => !truth.some((rel) => matchesRelationship(finding, rel)));

  const tp = truePositives.length;
  const fp = falsePositives.length;
  const fn = targets.length - tp;
  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: targets.length === 0 ? 0 : tp / targets.length,
    f1: tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn),
    falsePositiveDetails: [],
  };
}

/** Baseline claims scored pair-wise against the same ground truth. */
function scoreMethod(claims: readonly DiscoveryClaim[], truth: readonly GroundTruthRelationship[]): ClaimScore {
  const targets = new Set(
    truth
      .filter((rel) => rel.kind === "true-effect" && rel.exposureMetricId)
      .map((rel) => `${rel.outcomeMetricId}|${rel.exposureMetricId}`),
  );

  const claimed = new Set<string>();
  let fp = 0;
  for (const claim of claims) {
    if (!claim.exposureMetricId) continue;
    const key = `${claim.outcomeMetricId}|${claim.exposureMetricId}`;
    if (targets.has(key)) claimed.add(key);
    else fp += 1;
  }
  const tp = claimed.size;
  const fn = targets.size - tp;
  return {
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: targets.size === 0 ? 0 : tp / targets.size,
    f1: tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn),
    falsePositiveDetails: [],
  };
}

/**
 * Runs discovery on Pulse and all four baselines over a planted dataset and
 * its matched null twin; optionally repeats everything over corrupted copies.
 */
export async function runDiscoveryComparison(options: DiscoveryComparisonOptions = {}): Promise<DiscoveryComparisonResult> {
  const seed = options.seed ?? "pulse-validation";
  const days = options.days ?? 180;

  // --- clean datasets -------------------------------------------------------
  const standard: Harness = await createSyntheticPulse({ days, seed });
  const nullUser: Harness = await createSyntheticPulse({
    days,
    seed: "null-user-strict",
    exerciseAccuracyBoost: 0,
    afternoonAccuracyBoost: 0,
    sleepAccuracyBoost: 0,
    includeConfounded: false,
  });

  const standardFindings = standard.pulse.discover().findings;
  const nullFindings = nullUser.pulse.discover().findings;

  const truth = standard.user.groundTruth;

  const rows: MethodScoreRow[] = [
    { method: "pulse", clean: scorePulse(standardFindings, truth), nullClaims: nullFindings.length },
  ];

  const standardSeries: Map<string, SimpleSeries> = seriesMapFromEvents(
    standard.pulse.events({ includeSensitive: true }),
    standard.pulse.registry,
  );
  const nullSeries: Map<string, SimpleSeries> = seriesMapFromEvents(
    nullUser.pulse.events({ includeSensitive: true }),
    nullUser.pulse.registry,
  );
  const baselineClaims = runAllBaselines(standardSeries);
  const baselineNullClaims = runAllBaselines(nullSeries);

  for (const method of Object.keys(baselineClaims) as BaselineMethod[]) {
    rows.push({
      method,
      clean: scoreMethod(baselineClaims[method]!, truth),
      nullClaims: baselineNullClaims[method]!.length,
    });
  }

  // --- corrupted datasets ----------------------------------------------------
  let corruptionSummary: DiscoveryComparisonResult["corruptionSummary"];
  if (options.corruption) {
    const recipe = options.corruption;
    const corruptedStandard = corruptEvents(standard.pulse.events({ includeSensitive: true }), recipe);
    const corruptedNull = corruptEvents(nullUser.pulse.events({ includeSensitive: true }), {
      ...recipe,
      seed: `${recipe.seed ?? "corrupt"}:null`,
    });

    const rebuiltStandard = await rebuildPulse(standard, corruptedStandard.events);
    const rebuiltNull = await rebuildPulse(nullUser, corruptedNull.events);

    const corruptedFindings = rebuiltStandard.discover().findings;
    const corruptedNullFindings = rebuiltNull.discover().findings;

    const corruptedStandardSeries = seriesMapFromEvents(corruptedStandard.events, rebuiltStandard.registry);
    const corruptedNullSeries = seriesMapFromEvents(corruptedNull.events, rebuiltNull.registry);
    const corruptedBaseline = runAllBaselines(corruptedStandardSeries);
    const corruptedBaselineNull = runAllBaselines(corruptedNullSeries);

    for (const row of rows) {
      if (row.method === "pulse") {
        row.corrupted = {
          clean: scorePulse(corruptedFindings, truth),
          nullClaims: corruptedNullFindings.length,
        };
      } else {
        row.corrupted = {
          clean: scoreMethod(corruptedBaseline[row.method as BaselineMethod]!, truth),
          nullClaims: corruptedBaselineNull[row.method as BaselineMethod]!.length,
        };
      }
    }

    corruptionSummary = {
      originalEvents: corruptedStandard.report.originalCount,
      corruptedEvents: corruptedStandard.events.length,
      droppedDays: corruptedStandard.report.droppedDays.length,
    };
  }

  return { seed, days, rows, truthPairs: truth, corruptionSummary };
}

/**
 * A fresh Pulse holding exactly the supplied events. Discovery reads the
 * store through the metric registry, so no connector has to be registered
 * to analyse a fixed event set — which is what makes it possible to analyse
 * a corrupted copy without touching the connectors at all.
 */
async function rebuildPulse(source: Harness, events: readonly PulseEvent[]): Promise<Pulse> {
  const lastAt = events.length ? Date.parse(events[events.length - 1]!.occurredAt) : source.nowMs;
  const clone = new Pulse({ timezone: source.user.timezone, now: () => lastAt + 3_600_000 });
  await clone.store.put([...events]);
  return clone;
}
