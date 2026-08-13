/**
 * Confounder detection and adjustment.
 *
 * The honest version of "possible confounders" is not a boilerplate list — it
 * is a set of specific checks with results attached. For every two-group
 * comparison Pulse tests whether the groups differ on the usual suspects, and
 * where they do, it re-estimates the effect within strata so the user can see
 * whether the finding survives.
 *
 * The four suspects, in the order they actually bite personal analytics:
 *   time of day    — you exercise in the evening and also study better then
 *   day of week    — weekend sessions differ in kind, not just timing
 *   secular trend  — you got better over the period, and exposure came later
 *   session mix    — the exposed group is disproportionately easy topics
 */

import { mean, median, stdDev } from "../statistics/descriptive.js";
import { mannWhitneyU, welchTTest, type ComparisonResult } from "../statistics/comparisons.js";
import { partialCorrelation, pearson } from "../statistics/correlation.js";
import { timeBucket, type MetricObservation } from "../metrics/compute.js";
import { daysBetween } from "../events/time.js";
import type { Confounder } from "./finding.js";

const BALANCE_ALPHA = 0.1; // Deliberately lax: we want to *catch* imbalance, not prove it.

export interface ConfounderCheckOptions {
  /** Attribute keys to test for compositional imbalance, e.g. `subject_id`. */
  compositionAttributes?: string[];
  /** Skip time-of-day checks when either group has assumed timestamps. */
  timesAreReliable?: boolean;
}

export function assessConfounders(
  exposed: readonly MetricObservation[],
  unexposed: readonly MetricObservation[],
  options: ConfounderCheckOptions = {},
): Confounder[] {
  const confounders: Confounder[] = [];
  if (exposed.length < 3 || unexposed.length < 3) return confounders;

  // --- time of day ------------------------------------------------------
  if (options.timesAreReliable !== false) {
    const timeTest = mannWhitneyU(
      exposed.map((o) => o.localMinutes),
      unexposed.map((o) => o.localMinutes),
    );
    const balanced = !Number.isFinite(timeTest.pValue) || timeTest.pValue > BALANCE_ALPHA;
    confounders.push({
      id: "time-of-day",
      name: "Time of day",
      description: "Sessions in the two groups happened at different clock times, and time of day affects performance on its own.",
      status: balanced ? "checked-balanced" : "uncontrolled",
      detail: `Median ${formatClock(median(exposed.map((o) => o.localMinutes)))} vs ${formatClock(
        median(unexposed.map((o) => o.localMinutes)),
      )}${Number.isFinite(timeTest.pValue) ? `, p = ${timeTest.pValue.toFixed(3)}` : ""}`,
    });
  }

  // --- day of week ------------------------------------------------------
  const weekendExposed = share(exposed, (o) => o.localDayOfWeek === 0 || o.localDayOfWeek === 6);
  const weekendUnexposed = share(unexposed, (o) => o.localDayOfWeek === 0 || o.localDayOfWeek === 6);
  const weekendGap = Math.abs(weekendExposed - weekendUnexposed);
  confounders.push({
    id: "day-of-week",
    name: "Day of week",
    description: "Weekday and weekend sessions differ in length, setting and energy.",
    status: weekendGap < 0.15 ? "checked-balanced" : "uncontrolled",
    detail: `${(weekendExposed * 100).toFixed(0)}% vs ${(weekendUnexposed * 100).toFixed(0)}% of sessions at the weekend`,
  });

  // --- secular trend ----------------------------------------------------
  const allDates = [...exposed, ...unexposed].map((o) => o.localDate).sort();
  const origin = allDates[0]!;
  const exposedAge = exposed.map((o) => daysBetween(origin, o.localDate));
  const unexposedAge = unexposed.map((o) => daysBetween(origin, o.localDate));
  const ageTest = welchTTest(exposedAge, unexposedAge);
  const ageBalanced = !Number.isFinite(ageTest.pValue) || ageTest.pValue > BALANCE_ALPHA;
  confounders.push({
    id: "secular-trend",
    name: "Improvement over time",
    description: "If one group is concentrated later in the period, general improvement can masquerade as the effect.",
    status: ageBalanced ? "checked-balanced" : "uncontrolled",
    detail: `Mean day ${mean(exposedAge).toFixed(0)} vs ${mean(unexposedAge).toFixed(0)} of the window${
      Number.isFinite(ageTest.pValue) ? `, p = ${ageTest.pValue.toFixed(3)}` : ""
    }`,
  });

  // --- composition ------------------------------------------------------
  for (const attribute of options.compositionAttributes ?? []) {
    const imbalance = compositionDistance(exposed, unexposed, attribute);
    if (imbalance === null) continue;
    confounders.push({
      id: `composition:${attribute}`,
      name: `Mix of ${attribute.replace(/_/g, " ")}`,
      description: `The two groups are made up of different ${attribute.replace(/_/g, " ")} values, which may be easier or harder in themselves.`,
      status: imbalance < 0.25 ? "checked-balanced" : "uncontrolled",
      detail: `Composition differs by ${(imbalance * 100).toFixed(0)}% (total variation distance)`,
    });
  }

  return confounders;
}

function share<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  if (items.length === 0) return 0;
  return items.filter(predicate).length / items.length;
}

function formatClock(minutes: number): string {
  if (!Number.isFinite(minutes)) return "n/a";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Total variation distance between the attribute distributions of two groups. */
export function compositionDistance(
  a: readonly MetricObservation[],
  b: readonly MetricObservation[],
  attribute: string,
): number | null {
  const distA = distribution(a, attribute);
  const distB = distribution(b, attribute);
  if (distA.size === 0 || distB.size === 0) return null;
  const keys = new Set([...distA.keys(), ...distB.keys()]);
  let total = 0;
  for (const key of keys) total += Math.abs((distA.get(key) ?? 0) - (distB.get(key) ?? 0));
  return total / 2;
}

function distribution(items: readonly MetricObservation[], attribute: string): Map<string, number> {
  const counts = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    const raw = item.attributes[attribute];
    if (raw === undefined) continue;
    const key = String(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return new Map();
  for (const [key, count] of counts) counts.set(key, count / total);
  return counts;
}

export interface StratifiedEffect {
  /** Pooled within-stratum difference in means (exposed - unexposed). */
  adjustedDifference: number;
  /** Same quantity before adjustment, for comparison. */
  rawDifference: number;
  /** Standardised, so it is comparable with the headline effect size. */
  adjustedStandardised: number;
  strata: {
    key: string;
    exposedN: number;
    unexposedN: number;
    difference: number;
    weight: number;
  }[];
  usableStrata: number;
  /** True when adjustment left the effect in the same direction and ≥50% of its size. */
  survivesAdjustment: boolean;
}

/**
 * Recomputes the effect within strata and pools it, weighting each stratum by
 * its harmonic sample size (the precision-optimal weight for a difference in
 * means when variances are similar).
 *
 * This is the check that distinguishes "you study better after exercise" from
 * "you exercise in the afternoon, and you study better in the afternoon".
 */
/**
 * Two-hour bands, the default stratifier for time-of-day adjustment.
 *
 * The named buckets (`morning`, `afternoon`, ...) span four to six hours,
 * which is wide enough that a genuine within-bucket time gradient survives
 * adjustment and gets mis-reported as controlled. Two-hour bands cost some
 * cell size and buy a much cleaner comparison; cells that end up too thin are
 * dropped by `minPerCell` rather than silently trusted.
 */
export function hourBand(observation: MetricObservation): string {
  const band = Math.floor(observation.localMinutes / 120);
  return `${String(band * 2).padStart(2, "0")}:00-${String(band * 2 + 2).padStart(2, "0")}:00`;
}

/** The coarse named buckets, kept for display and for question phrasing. */
export function namedTimeBucket(observation: MetricObservation): string {
  return timeBucket(observation.localMinutes);
}

export function stratifiedEffect(
  exposed: readonly MetricObservation[],
  unexposed: readonly MetricObservation[],
  stratifyBy: (observation: MetricObservation) => string = hourBand,
  minPerCell = 3,
): StratifiedEffect {
  const rawDifference = mean(exposed.map((o) => o.value)) - mean(unexposed.map((o) => o.value));
  const keys = new Set([...exposed, ...unexposed].map(stratifyBy));

  const strata: StratifiedEffect["strata"] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of [...keys].sort()) {
    const e = exposed.filter((o) => stratifyBy(o) === key).map((o) => o.value);
    const u = unexposed.filter((o) => stratifyBy(o) === key).map((o) => o.value);
    if (e.length < minPerCell || u.length < minPerCell) continue;
    const difference = mean(e) - mean(u);
    const weight = (e.length * u.length) / (e.length + u.length);
    strata.push({ key, exposedN: e.length, unexposedN: u.length, difference, weight });
    weightedSum += difference * weight;
    totalWeight += weight;
  }

  const adjustedDifference = totalWeight > 0 ? weightedSum / totalWeight : NaN;
  const pooledSd = stdDev([...exposed, ...unexposed].map((o) => o.value));
  const adjustedStandardised = pooledSd > 0 ? adjustedDifference / pooledSd : NaN;

  // Retention threshold. An effect that loses more than a third of its size
  // once the confounder is held constant is one the confounder substantially
  // explains, whatever is left over — treating that as "controlled" is how a
  // tool ends up recommending a fortnight of experiment on an artefact.
  const survives =
    Number.isFinite(adjustedDifference) &&
    Math.sign(adjustedDifference) === Math.sign(rawDifference) &&
    Math.abs(adjustedDifference) >= Math.abs(rawDifference) * 0.67;

  return {
    adjustedDifference,
    rawDifference,
    adjustedStandardised,
    strata,
    usableStrata: strata.length,
    survivesAdjustment: survives,
  };
}

/**
 * Folds a stratified adjustment back into the confounder list, upgrading
 * "uncontrolled" to "controlled" only when the adjustment actually held.
 */
export function applyAdjustment(
  confounders: readonly Confounder[],
  confounderId: string,
  adjustment: StratifiedEffect,
): Confounder[] {
  return confounders.map((confounder) => {
    if (confounder.id !== confounderId) return confounder;
    if (adjustment.usableStrata < 2) {
      return {
        ...confounder,
        detail: `${confounder.detail}. Too few comparable strata to adjust (${adjustment.usableStrata}).`,
      };
    }
    return {
      ...confounder,
      status: adjustment.survivesAdjustment ? "controlled" : "uncontrolled",
      detail: adjustment.survivesAdjustment
        ? `${confounder.detail}. Adjusting within ${adjustment.usableStrata} strata leaves a difference of ${adjustment.adjustedDifference.toFixed(3)} (raw ${adjustment.rawDifference.toFixed(3)}).`
        : `${confounder.detail}. Adjusting within ${adjustment.usableStrata} strata shrinks the difference from ${adjustment.rawDifference.toFixed(3)} to ${adjustment.adjustedDifference.toFixed(3)}, so this likely explains much of the effect.`,
    };
  });
}

export function countUncontrolled(confounders: readonly Confounder[]): number {
  return confounders.filter((confounder) => confounder.status === "uncontrolled").length;
}

/**
 * Confounder assessment for a daily lagged correlation.
 *
 * A correlation between two daily series has no groups to balance, but it has
 * the same two structural threats: a shared time trend (both metrics drifting
 * together over the period) and a shared weekly rhythm (both dipping at
 * weekends). Partial correlation controlling for those tells us whether the
 * association is anything more than that, and the result is reported with the
 * same vocabulary as the group-comparison checks.
 */
export function assessSeriesConfounders(
  driver: readonly number[],
  outcome: readonly number[],
  dayIndex: readonly number[],
  isWeekend: readonly number[],
): { confounders: Confounder[]; survivesAdjustment: boolean } {
  const raw = pearson(driver, outcome);
  if (!Number.isFinite(raw.r) || driver.length < 12) {
    return {
      confounders: [
        {
          id: "series-adjustment",
          name: "Shared time trend and weekly rhythm",
          description: "Two metrics can move together simply because both drift over the period or both dip at weekends.",
          status: "uncontrolled",
          detail: "Too few paired days to adjust for either.",
        },
      ],
      survivesAdjustment: false,
    };
  }

  const trendAdjusted = partialCorrelation(driver, outcome, [dayIndex]);
  const fullyAdjusted = partialCorrelation(driver, outcome, [dayIndex, isWeekend]);
  const retained = Math.abs(raw.r) > 0 ? Math.abs(fullyAdjusted.r) / Math.abs(raw.r) : 0;
  const survives = Math.sign(fullyAdjusted.r) === Math.sign(raw.r) && retained >= 0.67;

  return {
    survivesAdjustment: survives,
    confounders: [
      {
        id: "secular-trend",
        name: "Improvement over time",
        description: "Both metrics may simply be drifting in the same direction over the period.",
        status: Math.abs(trendAdjusted.r) >= Math.abs(raw.r) * 0.67 ? "controlled" : "uncontrolled",
        detail: `rho ${raw.r.toFixed(2)} raw, ${trendAdjusted.r.toFixed(2)} after removing the time trend`,
      },
      {
        id: "day-of-week",
        name: "Weekly rhythm",
        description: "Both metrics may dip at weekends, producing an association with no direct link.",
        status: survives ? "controlled" : "uncontrolled",
        detail: `rho ${raw.r.toFixed(2)} raw, ${fullyAdjusted.r.toFixed(2)} after removing both the trend and the weekday/weekend pattern`,
      },
    ],
  };
}

/** Convenience re-export used by the engine when picking a comparison test. */
export function chooseComparison(a: readonly number[], b: readonly number[]): ComparisonResult {
  return a.length >= 15 && b.length >= 15 ? welchTTest(a, b) : mannWhitneyU(a, b);
}
