/**
 * Answer-first decision brief for the Today surface.
 *
 * This is deliberately narrower than the weekly report. It uses a trailing
 * local-calendar window, names the missing-data state, and only calls a
 * metric normal when there is enough recent and historical data to support
 * that word.
 */

import type { PulseEvent, SourceId } from "../events/schema.js";
import { addDays, eachLocalDate } from "../events/time.js";
import { dailySeries } from "../metrics/compute.js";
import type { MetricDefinition, MetricRegistry } from "../metrics/registry.js";
import { detectAnomalies, type Anomaly } from "../timeseries/baseline.js";
import { weekOverWeek, type WeekChange } from "../timeseries/trend.js";
import type { SourceQuality } from "../quality/score.js";
import type { Finding } from "../discovery/finding.js";
import type { Recommendation } from "../recommendations/rank.js";
import type { ConfidenceLevel, EvidenceClass } from "../statistics/confidence.js";

export interface TodayNormal {
  metricId: string;
  metricName: string;
  statement: string;
  observedDays: number;
  robustZ: number;
}

export interface TodayMatter {
  id: string;
  kind: "recommendation" | "finding" | "data-quality";
  title: string;
  statement: string;
  evidenceClass: EvidenceClass | null;
  evidenceLevel: ConfidenceLevel | "not-a-claim";
  caveat: string | null;
}

export interface TodayDataState {
  status: "ready" | "partial" | "missing";
  recentDays: number;
  windowDays: number;
  message: string;
  affectedSources: SourceId[];
}

export interface TodayEvidence {
  level: ConfidenceLevel | "none";
  score: number;
  basis: string[];
  caveats: string[];
}

export interface TodayBrief {
  date: string;
  windowStart: string;
  windowEnd: string;
  generatedAt: string;
  headline: string;
  whatChanged: { definition: MetricDefinition; change: WeekChange; statement: string }[];
  normal: TodayNormal[];
  unusual: Anomaly[];
  matters: TodayMatter[];
  action: Recommendation | null;
  evidence: TodayEvidence;
  dataState: TodayDataState;
}

export interface TodayBriefOptions {
  registry: MetricRegistry;
  today: string;
  events: readonly PulseEvent[];
  findings?: readonly Finding[];
  recommendations?: readonly Recommendation[];
  qualities?: readonly SourceQuality[];
  now?: () => number;
  timezone?: string;
  windowDays?: number;
  maxChanged?: number;
  maxNormal?: number;
  maxUnusual?: number;
  maxMatters?: number;
}

export function buildTodayBrief(options: TodayBriefOptions): TodayBrief {
  const now = options.now ?? Date.now;
  const timezone = options.timezone ?? "UTC";
  const windowDays = Math.max(3, options.windowDays ?? 7);
  const windowStart = addDays(options.today, -(windowDays - 1));
  const previousStart = addDays(windowStart, -windowDays);
  const previousEnd = addDays(windowStart, -1);
  const scopedEvents = options.events.filter((event) => event.localDate <= options.today);
  const currentDates = eachLocalDate(windowStart, options.today);
  const previousDates = eachLocalDate(previousStart, previousEnd);
  const priorWindows = Array.from({ length: 6 }, (_, index) => {
    const start = addDays(windowStart, -windowDays * (index + 2));
    return eachLocalDate(start, addDays(start, windowDays - 1));
  });

  const changes: TodayBrief["whatChanged"] = [];
  const normal: TodayNormal[] = [];
  const unusual: Anomaly[] = [];
  const available = options.registry.available(scopedEvents);
  const earliestEvent = scopedEvents.map((event) => event.localDate).sort()[0] ?? windowStart;

  for (const definition of available) {
    const series = dailySeries(scopedEvents, definition, {
      fillGaps: true,
      from: earliestEvent,
      to: options.today,
    });
    const change = weekOverWeek(series, currentDates, previousDates, priorWindows);
    if (change.notable) {
      changes.push({ definition, change, statement: describeChange(definition, change) });
    } else if (change.currentN >= 2 && Number.isFinite(change.robustZ)) {
      normal.push({
        metricId: definition.id,
        metricName: definition.name,
        statement: `${definition.name} stayed within its usual range across ${change.currentN} recent days.`,
        observedDays: change.currentN,
        robustZ: change.robustZ,
      });
    }

    unusual.push(
      ...detectAnomalies(series, { windowDays: 42, threshold: 3.5, timezone }).filter(
        (anomaly) => anomaly.date >= windowStart && anomaly.date <= options.today,
      ),
    );
  }

  changes.sort((a, b) => Math.abs(b.change.robustZ) - Math.abs(a.change.robustZ));
  normal.sort((a, b) => Math.abs(a.robustZ) - Math.abs(b.robustZ));
  unusual.sort((a, b) => Math.abs(b.robustZ) - Math.abs(a.robustZ));

  const recentEvents = scopedEvents.filter((event) => event.localDate >= windowStart && event.localDate <= options.today);
  const recentDays = new Set(recentEvents.map((event) => event.localDate)).size;
  const affectedSources = (options.qualities ?? [])
    .filter((quality) => quality.grade === "fair" || quality.grade === "poor")
    .map((quality) => quality.source)
    .sort((a, b) => String(a).localeCompare(String(b)));
  const dataState = buildDataState(recentDays, windowDays, affectedSources);
  const matters = buildMatters(options.findings ?? [], options.recommendations ?? [], options.qualities ?? [], options.maxMatters ?? 3);
  const action = options.recommendations?.[0] ?? null;
  const evidence = buildEvidence(options.findings ?? [], options.recommendations ?? [], dataState, affectedSources);

  return {
    date: options.today,
    windowStart,
    windowEnd: options.today,
    generatedAt: new Date(now()).toISOString(),
    headline: buildHeadline(changes, unusual, normal, dataState),
    whatChanged: changes.slice(0, options.maxChanged ?? 3),
    normal: normal.slice(0, options.maxNormal ?? 4),
    unusual: unusual.slice(0, options.maxUnusual ?? 4),
    matters,
    action,
    evidence,
    dataState,
  };
}

function buildDataState(recentDays: number, windowDays: number, affectedSources: SourceId[]): TodayDataState {
  if (recentDays === 0) {
    return {
      status: "missing",
      recentDays,
      windowDays,
      message: `No measurements arrived in the last ${windowDays} days, so Pulse is holding the decision brief rather than calling the period quiet.`,
      affectedSources,
    };
  }
  if (recentDays < 3 || affectedSources.length > 0) {
    return {
      status: "partial",
      recentDays,
      windowDays,
      message: `${recentDays} of ${windowDays} recent days have data. Treat changes as provisional${affectedSources.length ? " while a source is degraded" : ""}.`,
      affectedSources,
    };
  }
  return {
    status: "ready",
    recentDays,
    windowDays,
    message: `${recentDays} of ${windowDays} recent days have data. Missing days remain visible rather than silently filled for measurement metrics.`,
    affectedSources,
  };
}

function buildMatters(
  findings: readonly Finding[],
  recommendations: readonly Recommendation[],
  qualities: readonly SourceQuality[],
  limit: number,
): TodayMatter[] {
  const matters: TodayMatter[] = [];
  for (const quality of qualities.filter((entry) => entry.grade === "fair" || entry.grade === "poor")) {
    matters.push({
      id: `quality-${String(quality.source)}`,
      kind: "data-quality",
      title: `${String(quality.source)} data needs attention`,
      statement: quality.issues[0]?.message ?? "This source is below the quality bar for confident interpretation.",
      evidenceClass: null,
      evidenceLevel: "not-a-claim",
      caveat: quality.issues[0]?.remedy ?? null,
    });
  }
  for (const recommendation of recommendations) {
    matters.push({
      id: recommendation.id,
      kind: "recommendation",
      title: recommendation.title,
      statement: recommendation.statement,
      evidenceClass: recommendation.evidenceClass,
      evidenceLevel: recommendation.confidence.level,
      caveat: recommendation.caveats[0] ?? null,
    });
  }
  if (matters.length === 0) {
    for (const finding of findings.slice(0, limit)) {
      matters.push({
        id: finding.id,
        kind: "finding",
        title: finding.title,
        statement: finding.statement,
        evidenceClass: finding.evidenceClass,
        evidenceLevel: finding.confidence.level,
        caveat: finding.causalityNote,
      });
    }
  }
  return matters.slice(0, limit);
}

function buildEvidence(
  findings: readonly Finding[],
  recommendations: readonly Recommendation[],
  dataState: TodayDataState,
  affectedSources: readonly SourceId[],
): TodayEvidence {
  const primary = recommendations[0] ?? findings[0];
  const basis: string[] = [];
  const caveats: string[] = [];
  if (primary) {
    basis.push(`${primary.evidenceClass} evidence`, `${primary.confidence.level} confidence`);
    if ("evidence" in primary) {
      const eventCount = primary.evidence.reduce((sum, evidence) => sum + evidence.eventCount, 0);
      if (eventCount > 0) basis.push(`${eventCount} supporting events`);
    }
    if ("caveats" in primary) caveats.push(...primary.caveats.slice(0, 2));
    else caveats.push(primary.causalityNote, ...primary.confidence.limitations.slice(0, 1));
  } else {
    caveats.push("No finding has crossed the evidence bar yet.");
  }
  if (dataState.status !== "ready") caveats.push(dataState.message);
  if (affectedSources.length) caveats.push(`Quality is reduced for ${affectedSources.map(String).join(", ")}.`);

  return {
    level: primary?.confidence.level ?? "none",
    score: primary?.confidence.score ?? 0,
    basis,
    caveats: [...new Set(caveats.filter(Boolean))],
  };
}

function buildHeadline(
  changes: TodayBrief["whatChanged"],
  unusual: readonly Anomaly[],
  normal: readonly TodayNormal[],
  dataState: TodayDataState,
): string {
  if (dataState.status === "missing") return "No recent evidence supports a decision today.";
  if (changes.length) return `The clearest recent change is ${changes[0]!.statement}`;
  if (unusual.length) return `${unusual.length} unusual day${unusual.length === 1 ? "" : "s"} need context; no broad shift cleared the change bar.`;
  if (normal.length) return "Recent measurements are within their usual range; no action is justified by movement alone.";
  return "There is not yet enough comparable recent data to call the period normal or unusual.";
}

function describeChange(definition: MetricDefinition, change: WeekChange): string {
  const direction = change.absoluteChange >= 0 ? "up" : "down";
  const relative = Number.isFinite(change.relativeChange)
    ? `${Math.abs(change.relativeChange * 100).toFixed(0)}%`
    : `${Math.abs(change.absoluteChange).toFixed(2)}`;
  const directionNote =
    definition.direction === "neutral"
      ? ""
      : (direction === "up") === (definition.direction === "higher-better")
        ? " That is the direction you want."
        : " That is the wrong direction for this one.";
  return `${definition.name} is ${direction} ${relative} against its recent typical level (${formatShort(change.currentMean)} vs ${formatShort(change.typicalMean)} across ${change.currentN} days).${directionNote}`;
}

function formatShort(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2);
}
