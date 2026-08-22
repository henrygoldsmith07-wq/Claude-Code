import type { Correction } from "./corrections";
import type { Entry, LongitudinalReview } from "./types";
import {
  actionFollowThrough,
  calibrationFor,
  decisionImprovement,
  evidenceLinksFor,
  monthKey,
  predictionAccuracy,
  summaryInsights,
  unresolvedEntries,
  type ActionFollowThrough,
  type Calibration,
  type EvidenceLink,
  type PredictionAccuracy,
} from "./longitudinal";

export const LONGITUDINAL_EVIDENCE_REPORT_FORMAT = "reflect.longitudinal-evidence-report" as const;
export const LONGITUDINAL_EVIDENCE_REPORT_SCHEMA_VERSION = 1 as const;

export interface LongitudinalEvidenceReportOptions {
  from?: string | Date | null;
  to?: string | Date | null;
  generatedAt?: string | Date;
  corrections?: Correction[];
}

export interface EvidenceReportRange {
  from: string | null;
  to: string | null;
}

export interface EvidenceReportSummary {
  totalEntries: number;
  completedEntries: number;
  reviewedEntries: number;
  periodCount: number;
}

export interface EvidenceReportRecord {
  entryId: string;
  date: string;
  title: string;
  emotion: string;
  observations: string[];
  assumptions: string[];
  alternatives: string[];
  links: EvidenceLink[];
  review: {
    verdict: LongitudinalReview["assumptionVerdict"];
    reviewedAt: string | null;
    actionLogged: boolean;
  };
}

export interface EvidenceReportTotals {
  recordCount: number;
  observations: number;
  assumptions: number;
  alternatives: number;
  linkedObservations: number;
  linkedAssumptions: number;
  linkedAlternatives: number;
}

export interface EvidenceReportPeriod {
  period: string;
  entryIds: string[];
  completedEntries: number;
  reviewedEntries: number;
  observationCount: number;
  assumptionCount: number;
  alternativeCount: number;
  linkedObservations: number;
  actionLogged: number;
  unresolved: number;
  emotions: string[];
  calibration: Calibration;
}

export type EvidenceFindingKind = "pattern" | "contradiction" | "calibration" | "unresolved";

export interface EvidenceReportFinding {
  id: string;
  kind: EvidenceFindingKind;
  title: string;
  detail: string;
  entryIds: string[];
  evidenceCount: number;
}

export interface LongitudinalEvidenceReport {
  format: typeof LONGITUDINAL_EVIDENCE_REPORT_FORMAT;
  schemaVersion: typeof LONGITUDINAL_EVIDENCE_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  range: EvidenceReportRange;
  summary: EvidenceReportSummary;
  evidence: EvidenceReportTotals & { records: EvidenceReportRecord[] };
  calibration: Calibration;
  predictionAccuracy: PredictionAccuracy;
  actionFollowThrough: ActionFollowThrough;
  decisionImprovement: ReturnType<typeof decisionImprovement>;
  timeline: EvidenceReportPeriod[];
  findings: EvidenceReportFinding[];
  caveats: string[];
}

function parsedTime(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function dateKey(value: string | Date | null | undefined): string | null {
  const time = parsedTime(value);
  return time === null ? null : new Date(time).toISOString().slice(0, 10);
}

function boundTime(value: string | Date | null | undefined, endOfDay = false): number | null {
  const time = parsedTime(value);
  if (time === null) return null;
  if (!endOfDay || value instanceof Date || typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return time;
  return time + 86_399_999;
}

function generatedDate(value: string | Date | undefined): Date {
  const time = parsedTime(value);
  return new Date(time ?? Date.now());
}

// monthKey is shared with longitudinal.ts so weekly/monthly groupings and the
// evidence report bucket entries into identical periods.

function sortEntries(entries: Entry[]): Entry[] {
  return entries.slice().sort((a, b) => {
    const dateDiff = (parsedTime(a.createdAt) ?? 0) - (parsedTime(b.createdAt) ?? 0);
    return dateDiff || a.id.localeCompare(b.id);
  });
}

function inWindow(entries: Entry[], options: LongitudinalEvidenceReportOptions): Entry[] {
  const from = boundTime(options.from);
  const to = boundTime(options.to, true);
  return entries.filter((entry) => {
    const createdAt = parsedTime(entry.createdAt);
    if (createdAt === null) return from === null && to === null;
    return (from === null || createdAt >= from) && (to === null || createdAt <= to);
  });
}

function reportRange(entries: Entry[], options: LongitudinalEvidenceReportOptions): EvidenceReportRange {
  const dated = sortEntries(entries).map((entry) => dateKey(entry.createdAt)).filter((date): date is string => Boolean(date));
  return {
    from: dateKey(options.from) ?? dated[0] ?? null,
    to: dateKey(options.to) ?? dated[dated.length - 1] ?? null,
  };
}

function reportRecord(entry: Entry): EvidenceReportRecord {
  const summary = entry.summary!;
  const links = evidenceLinksFor(entry);
  return {
    entryId: entry.id,
    date: entry.createdAt,
    title: entry.title,
    emotion: summary.coreEmotion || summary.trace.namedEmotion,
    observations: summary.trace.observations.slice(),
    assumptions: summary.trace.assumptions.slice(),
    alternatives: summary.trace.alternativeInterpretations.slice(),
    links,
    review: {
      verdict: entry.longitudinalReview?.assumptionVerdict ?? null,
      reviewedAt: entry.longitudinalReview?.reviewedAt ?? null,
      actionLogged: Boolean(entry.longitudinalReview?.actualActionTaken?.trim()),
    },
  };
}

function evidenceTotals(records: EvidenceReportRecord[]): EvidenceReportTotals {
  return records.reduce<EvidenceReportTotals>((totals, record) => {
    for (const link of record.links) {
      totals.linkedAssumptions += link.linkedAssumptions.length;
      totals.linkedAlternatives += link.linkedAlternatives.length;
      if (link.linkedAssumptions.length > 0 || link.linkedAlternatives.length > 0) totals.linkedObservations++;
    }
    return {
      recordCount: totals.recordCount + 1,
      observations: totals.observations + record.observations.length,
      assumptions: totals.assumptions + record.assumptions.length,
      alternatives: totals.alternatives + record.alternatives.length,
      linkedObservations: totals.linkedObservations,
      linkedAssumptions: totals.linkedAssumptions,
      linkedAlternatives: totals.linkedAlternatives,
    };
  }, {
    recordCount: 0,
    observations: 0,
    assumptions: 0,
    alternatives: 0,
    linkedObservations: 0,
    linkedAssumptions: 0,
    linkedAlternatives: 0,
  });
}

function buildTimeline(entries: Entry[], now: Date): EvidenceReportPeriod[] {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const period = monthKey(entry.createdAt);
    const group = groups.get(period) ?? [];
    group.push(entry);
    groups.set(period, group);
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => {
    const records = group.map(reportRecord);
    const reviewedEntries = group.filter((entry) => entry.longitudinalReview?.assumptionVerdict).length;
    return {
      period,
      entryIds: sortEntries(group).map((entry) => entry.id),
      completedEntries: group.length,
      reviewedEntries,
      observationCount: records.reduce((count, record) => count + record.observations.length, 0),
      assumptionCount: records.reduce((count, record) => count + record.assumptions.length, 0),
      alternativeCount: records.reduce((count, record) => count + record.alternatives.length, 0),
      linkedObservations: records.reduce((count, record) => count + record.links.filter((link) => link.linkedAssumptions.length > 0 || link.linkedAlternatives.length > 0).length, 0),
      actionLogged: group.filter((entry) => Boolean(entry.longitudinalReview?.actualActionTaken?.trim())).length,
      unresolved: unresolvedEntries(group, now).length,
      emotions: [...new Set(group.map((entry) => entry.summary!.coreEmotion || entry.summary!.trace.namedEmotion).filter(Boolean))],
      calibration: calibrationFor(group),
    };
  });
}

function buildFindings(entries: Entry[], corrections: Correction[], now: Date): EvidenceReportFinding[] {
  return summaryInsights(entries, corrections, now).map((insight) => ({
    id: insight.key,
    kind: insight.kind,
    title: insight.title,
    detail: insight.detail,
    entryIds: [...new Set(insight.entryIds)],
    evidenceCount: new Set(insight.entryIds).size,
  }));
}

export function buildLongitudinalEvidenceReport(
  entries: Entry[],
  options: LongitudinalEvidenceReportOptions = {},
): LongitudinalEvidenceReport {
  const scoped = inWindow(entries, options);
  const completed = sortEntries(scoped.filter((entry) => entry.summary));
  const records = completed.map(reportRecord);
  const generated = generatedDate(options.generatedAt);
  const calibration = calibrationFor(completed);
  const evidence = { ...evidenceTotals(records), records };
  const caveats = [
    "This is a descriptive evidence summary, not a diagnosis or clinical assessment.",
    "Conversation messages are intentionally excluded; findings cite structured summaries and local entry IDs.",
  ];
  if (completed.length < 4) caveats.push("Decision-improvement comparisons need at least four reviewed reflections.");
  if (calibration.totalReviewed === 0) caveats.push("No reviewed predictions fall in this window yet.");

  const timeline = buildTimeline(completed, generated);

  return {
    format: LONGITUDINAL_EVIDENCE_REPORT_FORMAT,
    schemaVersion: LONGITUDINAL_EVIDENCE_REPORT_SCHEMA_VERSION,
    generatedAt: generated.toISOString(),
    range: reportRange(scoped, options),
    summary: {
      totalEntries: scoped.length,
      completedEntries: completed.length,
      reviewedEntries: calibration.totalReviewed,
      periodCount: timeline.length,
    },
    evidence,
    calibration,
    predictionAccuracy: predictionAccuracy(completed),
    actionFollowThrough: actionFollowThrough(completed),
    decisionImprovement: decisionImprovement(completed),
    timeline,
    findings: buildFindings(completed, options.corrections ?? [], generated),
    caveats,
  };
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\|/g, "\\|").trim();
}

function listOrDash(values: string[]): string {
  return values.length ? values.map((value) => `- ${value}`).join("\n") : "- —";
}

export function renderLongitudinalEvidenceReportMarkdown(report: LongitudinalEvidenceReport): string {
  const lines = [
    "# Longitudinal evidence report",
    "",
    `Generated: ${report.generatedAt}`,
    `Window: ${report.range.from ?? "all time"} → ${report.range.to ?? "now"}`,
    "",
    "## Coverage",
    "",
    `- Reflections in window: ${report.summary.totalEntries}`,
    `- Completed summaries: ${report.summary.completedEntries}`,
    `- Reviewed predictions: ${report.summary.reviewedEntries}`,
    `- Structured observations: ${report.evidence.observations}`,
    `- Observation links: ${report.evidence.linkedObservations}`,
    `- Action follow-through: ${report.actionFollowThrough.actionLoggedPct ?? "—"}%`,
    "",
    "## Evidence timeline",
    "",
    "| Month | Reflections | Reviewed | Observations | Linked observations | Open follow-ups |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];

  if (report.timeline.length === 0) {
    lines.push("| — | No completed reflections in this window | — | — | — | — |");
  } else {
    for (const period of report.timeline) {
      lines.push(`| ${period.period} | ${period.completedEntries} | ${period.reviewedEntries} | ${period.observationCount} | ${period.linkedObservations} | ${period.unresolved} |`);
    }
  }

  lines.push("", "## Findings", "");
  if (report.findings.length === 0) {
    lines.push("No cross-entry findings in this window.");
  } else {
    for (const finding of report.findings) {
      lines.push(`### ${oneLine(finding.title)}`, "", oneLine(finding.detail), `Evidence: ${finding.entryIds.map((id) => `\`${oneLine(id)}\``).join(", ")}`, "");
    }
  }

  lines.push("## Evidence records", "");
  if (report.evidence.records.length === 0) {
    lines.push("No completed reflections in this window.");
  } else {
    for (const record of report.evidence.records) {
      lines.push(`### ${oneLine(record.title)} · ${record.date.slice(0, 10)}`, "", `Evidence: \`${oneLine(record.entryId)}\``, `Emotion: ${oneLine(record.emotion || "—")}`, "", "Observations:", listOrDash(record.observations), "", "Assumptions:", listOrDash(record.assumptions), "", "Alternatives:", listOrDash(record.alternatives), "", `Review: ${record.review.verdict ?? "not reviewed"}`, "");
    }
  }

  lines.push("## Caveats", "", ...report.caveats.map((caveat) => `- ${oneLine(caveat)}`), "");
  return lines.join("\n");
}
