/**
 * Weekly intelligence brief.
 *
 * Answers "what changed this week?" without manufacturing drama. Two rules
 * keep it honest:
 *
 *  - a change is only reported when it is large relative to that metric's own
 *    week-to-week variability, not merely different from last week;
 *  - a quiet week is reported as a quiet week. A brief that always finds
 *    something is a brief nobody can trust when it does.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { addDays, eachLocalDate, isoWeekKey, localDate, startOfIsoWeek } from "../events/time.js";
import { dailySeries } from "../metrics/compute.js";
import type { MetricDefinition, MetricRegistry } from "../metrics/registry.js";
import { weekOverWeek, type WeekChange } from "../timeseries/trend.js";
import { detectAnomalies, type Anomaly } from "../timeseries/baseline.js";
import type { SourceQuality } from "../quality/score.js";
import type { Finding } from "../discovery/finding.js";
import type { Recommendation } from "../recommendations/rank.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { CausalLibraryEntry } from "../hypotheses/library.js";

export interface BriefChange {
  metricId: string;
  metricName: string;
  direction: "up" | "down";
  /** Sentence with the numbers already in it. */
  statement: string;
  change: WeekChange;
}

/** A causal belief the contradiction ledger withdrew this week. */
export interface WithdrawnBelief {
  statement: string;
  cause: string;
  effect: string;
  note: string;
}

export interface WeeklyBrief {
  weekKey: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  /** One-sentence summary. Used verbatim by "what changed this week?". */
  headline: string;
  changes: BriefChange[];
  anomalies: Anomaly[];
  newFindings: Finding[];
  experimentUpdates: ExperimentResult[];
  /** Beliefs the contradiction ledger withdrew this week, not every week they stay withdrawn. */
  withdrawnBeliefs: WithdrawnBelief[];
  topRecommendations: Recommendation[];
  dataHealth: { source: SourceId; grade: string; message: string }[];
  /** Things Pulse deliberately is not claiming this week. */
  notes: string[];
  activity: { events: number; activeDays: number; sources: number };
}

export interface BriefOptions {
  registry: MetricRegistry;
  /** Any date within the week to report on. */
  weekOf: string;
  events: readonly PulseEvent[];
  findings?: readonly Finding[];
  recommendations?: readonly Recommendation[];
  experiments?: readonly ExperimentResult[];
  /** The causal hypothesis library, so withdrawals are reported the week they happen. */
  causalEntries?: readonly CausalLibraryEntry[];
  /** Timezone for turning a withdrawal's instant into the local week it happened in. */
  timezone?: string;
  qualities?: readonly SourceQuality[];
  now?: () => number;
  /** Prior weeks used to judge whether a change is unusual. */
  comparisonWeeks?: number;
  maxChanges?: number;
}

export function buildWeeklyBrief(options: BriefOptions): WeeklyBrief {
  const now = options.now ?? Date.now;
  const weekStart = startOfIsoWeek(options.weekOf);
  const weekEnd = addDays(weekStart, 6);
  const comparisonWeeks = options.comparisonWeeks ?? 6;

  const currentWeekDates = eachLocalDate(weekStart, weekEnd);
  const previousWeekDates = eachLocalDate(addDays(weekStart, -7), addDays(weekStart, -1));
  const priorWeeks: string[][] = [];
  for (let i = 1; i <= comparisonWeeks; i += 1) {
    const start = addDays(weekStart, -7 * i);
    priorWeeks.push(eachLocalDate(start, addDays(start, 6)));
  }

  const changes: BriefChange[] = [];
  const anomalies: Anomaly[] = [];

  for (const definition of options.registry.available(options.events)) {
    const series = dailySeries(options.events, definition, { fillGaps: true });
    const change = weekOverWeek(series, currentWeekDates, previousWeekDates, priorWeeks);
    if (change.notable) {
      changes.push({
        metricId: definition.id,
        metricName: definition.name,
        direction: change.absoluteChange >= 0 ? "up" : "down",
        statement: describeChange(definition, change),
        change,
      });
    }

    for (const anomaly of detectAnomalies(series, { windowDays: 42, threshold: 3.5 })) {
      if (anomaly.date >= weekStart && anomaly.date <= weekEnd) anomalies.push(anomaly);
    }
  }

  // Biggest movers first, measured in robust z rather than raw percentage —
  // a 40% swing on a metric that always swings 40% is not news.
  changes.sort((a, b) => Math.abs(b.change.robustZ) - Math.abs(a.change.robustZ));
  const topChanges = changes.slice(0, options.maxChanges ?? 5);

  const weekEvents = options.events.filter((event) => event.localDate >= weekStart && event.localDate <= weekEnd);
  const activity = {
    events: weekEvents.length,
    activeDays: new Set(weekEvents.map((event) => event.localDate)).size,
    sources: new Set(weekEvents.map((event) => event.source)).size,
  };

  const newFindings = (options.findings ?? []).filter(
    (finding) => finding.createdAt.slice(0, 10) >= weekStart && finding.createdAt.slice(0, 10) <= weekEnd,
  );
  const experimentUpdates = (options.experiments ?? []).filter(
    (experiment) => experiment.analysedAt.slice(0, 10) >= weekStart && experiment.analysedAt.slice(0, 10) <= weekEnd,
  );
  const withdrawnBeliefs = (options.causalEntries ?? [])
    .filter(
      (entry) => entry.standing === "contested" && wasWithdrawnThisWeek(entry, weekStart, weekEnd, options.timezone ?? "UTC"),
    )
    .map((entry) => ({
      statement: entry.statement,
      cause: entry.cause,
      effect: entry.effect,
      note: entry.standingNote,
    }));

  const dataHealth = (options.qualities ?? [])
    .filter((quality) => quality.grade === "fair" || quality.grade === "poor")
    .map((quality) => ({
      source: quality.source,
      grade: quality.grade,
      message: quality.issues[0]?.message ?? "Data quality is below par for this source",
    }));

  const notes: string[] = [];
  if (activity.events === 0) notes.push("No activity was recorded this week from any connected source.");
  if (topChanges.length === 0 && activity.events > 0) {
    notes.push("Nothing moved outside its normal range this week. That is a real result, not an empty one.");
  }
  if (newFindings.length === 0) {
    notes.push("No new relationships passed the evidence bar this week.");
  }
  if (withdrawnBeliefs.length > 0) {
    notes.push(
      `${withdrawnBeliefs.length} belief${withdrawnBeliefs.length === 1 ? "" : "s"} ${withdrawnBeliefs.length === 1 ? "was" : "were"} withdrawn this week because the evidence now points both ways.`,
    );
  }

  return {
    weekKey: isoWeekKey(weekStart),
    weekStart,
    weekEnd,
    generatedAt: new Date(now()).toISOString(),
    headline: buildHeadline(topChanges, anomalies, activity, newFindings.length, withdrawnBeliefs.length),
    changes: topChanges,
    anomalies,
    newFindings,
    experimentUpdates,
    withdrawnBeliefs,
    topRecommendations: (options.recommendations ?? []).slice(0, 3),
    dataHealth,
    notes,
    activity,
  };
}

/**
 * A belief is reported the week it was withdrawn, not every week it stays
 * withdrawn: the latest transition into `contested` is the event. The
 * transition's instant is converted to a local date in the brief's
 * timezone, so a withdrawal near midnight is filed in the right week.
 */
function wasWithdrawnThisWeek(entry: CausalLibraryEntry, weekStart: string, weekEnd: string, timezone: string): boolean {
  const transition = [...entry.standingHistory].reverse().find((change) => change.standing === "contested");
  if (!transition) return false;
  const date = localDate(Date.parse(transition.at), timezone);
  return date >= weekStart && date <= weekEnd;
}

function describeChange(definition: MetricDefinition, change: WeekChange): string {
  const direction = change.absoluteChange >= 0 ? "up" : "down";
  const relative = Number.isFinite(change.relativeChange)
    ? `${Math.abs(change.relativeChange * 100).toFixed(0)}%`
    : `${Math.abs(change.absoluteChange).toFixed(2)}`;
  const better =
    definition.direction === "neutral"
      ? ""
      : (direction === "up") === (definition.direction === "higher-better")
        ? " That is the direction you want."
        : " That is the wrong direction for this one.";

  return `${definition.name} is ${direction} ${relative} on your typical week (${formatShort(change.currentMean)} against a usual ${formatShort(change.typicalMean)}, across ${change.currentN} days).${better}`;
}

function buildHeadline(
  changes: readonly BriefChange[],
  anomalies: readonly Anomaly[],
  activity: { events: number; activeDays: number; sources: number },
  newFindingCount: number,
  withdrawnCount: number,
): string {
  const parts: string[] = [];
  if (activity.events === 0) {
    parts.push("Nothing was logged this week, so there is nothing to report.");
  } else if (changes.length === 0) {
    parts.push(`A steady week: ${activity.events} events across ${activity.activeDays} days, with nothing outside its usual range.`);
  } else {
    const top = changes[0]!;
    parts.push(`The biggest move this week: ${top.statement}`);
    if (changes.length > 1) parts.push(`${changes.length - 1} other metric(s) also moved unusually.`);
  }
  if (anomalies.length) parts.push(`${anomalies.length} individual day(s) stood out sharply.`);
  if (withdrawnCount) {
    parts.push(`${withdrawnCount} belief${withdrawnCount === 1 ? "" : "s"} ${withdrawnCount === 1 ? "was" : "were"} withdrawn on conflicting evidence.`);
  }
  if (newFindingCount) parts.push(`${newFindingCount} new finding(s) passed the evidence bar.`);
  return parts.join(" ");
}

function formatShort(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
}

/** Plain-text rendering, for export or an email digest. */
export function renderBriefText(brief: WeeklyBrief): string {
  const lines: string[] = [
    `Pulse weekly brief — ${brief.weekKey} (${brief.weekStart} to ${brief.weekEnd})`,
    "",
    brief.headline,
    "",
    `Activity: ${brief.activity.events} events, ${brief.activity.activeDays} active days, ${brief.activity.sources} sources.`,
  ];

  if (brief.changes.length) {
    lines.push("", "What changed:");
    for (const change of brief.changes) lines.push(`  - ${change.statement}`);
  }
  if (brief.anomalies.length) {
    lines.push("", "Unusual days:");
    for (const anomaly of brief.anomalies) {
      lines.push(`  - ${anomaly.date}: ${anomaly.metricId} was ${anomaly.direction} its usual level (${anomaly.value.toFixed(2)} vs ${anomaly.expected.toFixed(2)}).`);
    }
  }
  if (brief.withdrawnBeliefs.length) {
    lines.push("", "Withdrawn beliefs:");
    for (const belief of brief.withdrawnBeliefs) {
      lines.push(`  - ${belief.statement} ${belief.note}`);
    }
  }
  if (brief.newFindings.length) {
    lines.push("", "New findings:");
    for (const finding of brief.newFindings) {
      lines.push(`  - ${finding.statement} Confidence: ${finding.confidence.level}. ${finding.causalityNote}`);
    }
  }
  if (brief.experimentUpdates.length) {
    lines.push("", "Experiments:");
    for (const experiment of brief.experimentUpdates) lines.push(`  - ${experiment.verdict}: ${experiment.summary}`);
  }
  if (brief.topRecommendations.length) {
    lines.push("", "Worth doing next:");
    for (const recommendation of brief.topRecommendations) lines.push(`  - ${recommendation.title} — ${recommendation.rationale}`);
  }
  if (brief.dataHealth.length) {
    lines.push("", "Data health:");
    for (const health of brief.dataHealth) lines.push(`  - ${health.source} (${health.grade}): ${health.message}`);
  }
  if (brief.notes.length) {
    lines.push("", "Notes:");
    for (const note of brief.notes) lines.push(`  - ${note}`);
  }

  return lines.join("\n");
}
