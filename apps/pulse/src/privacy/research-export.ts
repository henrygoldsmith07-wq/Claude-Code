/**
 * Research export.
 *
 * The full export answers "give me everything": events, free text, authored
 * beliefs — the user's own record. The research export answers a narrower
 * question: "give me the *science*" — the de-identified, statistics-first
 * form that can be shared with a researcher or dropped into a study without
 * carrying a year of personal data along with it.
 *
 * What crosses the line and what does not is deliberate:
 *
 *   - findings carry effect sizes, confidence intervals, corrected p-values,
 *     sample sizes and confounders — never titles, statements or narratives;
 *   - experiments carry verdicts, observed effects, power and adherence —
 *     never summaries or causality prose;
 *   - coverage is counts and grades, never events;
 *   - sensitive sources are excluded unless asked for by name, exactly as in
 *     the full export, and a per-source opt-out is honoured the same way.
 *
 * The redaction guard in `redaction.ts` is the enforcement: the whole payload
 * must survive `assertNoRawContent` before it is considered shippable.
 */

import type { SourceId } from "../events/schema.js";
import { CURRENT_SCHEMA_VERSION } from "../events/schema.js";
import type { MemoryEventStore } from "../events/store.js";
import type { ConsentRegistry } from "./consent.js";
import type { Finding, NextActionKind, ReplicationStatus } from "../discovery/finding.js";
import type { ConfidenceLevel, EvidenceClass } from "../statistics/confidence.js";
import type { EffectKind, Interval } from "../statistics/effects.js";
import type { ExperimentDesign, ExperimentType } from "../experiments/design.js";
import type { ExperimentResult, ExperimentVerdict } from "../experiments/analysis.js";
import type { SourceQuality } from "../quality/score.js";
import type { InsightChange, InsightHistoryEntry } from "../history/insight-history.js";
import type { Hypothesis } from "../hypotheses/tracker.js";

export const RESEARCH_EXPORT_VERSION = 1 as const;

/** One finding, stripped to the statistics that made it a finding. */
export interface ResearchFinding {
  id: string;
  outcomeMetricId: string;
  exposureMetricId: string | null;
  evidenceClass: EvidenceClass;
  replicationStatus: ReplicationStatus;
  direction: "increase" | "decrease";
  sampleSize: number;
  sampleDescription: string;
  effect: { kind: EffectKind; value: number; ci: Interval | null; magnitude: string };
  test: {
    name: string;
    statistic: number;
    pValue: number;
    adjustedP?: number;
    familySize?: number;
    correctionMethod?: string;
  } | null;
  confidence: { level: ConfidenceLevel; score: number };
  confounders: { name: string; status: string; detail: string }[];
  sources: SourceId[];
  tags: string[];
  firstSeenAt: string;
  causalityNote: string;
  nextActionKind: NextActionKind | null;
}

/** One experiment: the pre-registered design plus its verdict, if analysed. */
export interface ResearchExperiment {
  designId: string;
  type: ExperimentType;
  targetMetricId: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  minSamplePerCondition: number;
  predictedEffect: number | null;
  predictedDirection: Hypothesis["predictedDirection"] | null;
  result: {
    verdict: ExperimentVerdict;
    analysedAt: string;
    observedEffect: number;
    differenceCi: Interval | null;
    confidence: { level: ConfidenceLevel; score: number };
    achievedPower: number;
    adherence: { assignedDays: number; daysWithSessions: number; adherence: number };
    reasons: string[];
  } | null;
}

/** One insight's journey across scans, condensed to signatures and changes. */
export interface ResearchJourney {
  signature: string;
  outcomeMetricId: string;
  exposureMetricId: string;
  appearances: number;
  firstSeenAt: string;
  lastSeenAt: string;
  latestStatus: ReplicationStatus;
  changes: { at: string; change: InsightChange; effectValue: number | null }[];
}

export interface ResearchCoverageSource {
  source: string;
  events: number;
  quality: {
    score: number;
    grade: SourceQuality["grade"];
    daysWithData: number;
    coverageDays: number;
    firstEventDate: string | null;
    lastEventDate: string | null;
  } | null;
}

export interface ResearchExport {
  format: "pulse-research-export";
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  timezone: string;
  /** Why this format exists and what it deliberately leaves out. */
  description: string;
  dateRange: { from: string | null; to: string | null } | null;
  /** Sources deliberately left out, and why — same contract as the full export. */
  excludedSources: { source: SourceId; reason: string }[];
  coverage: { eventCount: number; daysWithData: number; sources: ResearchCoverageSource[] };
  findings: ResearchFinding[];
  experiments: ResearchExperiment[];
  insightJourneys: ResearchJourney[];
}

export interface ResearchExportOptions {
  /** Include sources marked sensitive. Off by default, on purpose. */
  includeSensitive?: boolean;
  timezone?: string;
  now?: () => number;
  findings?: readonly Finding[];
  qualities?: readonly SourceQuality[];
  experimentDesigns?: readonly ExperimentDesign[];
  experimentResults?: readonly ExperimentResult[];
  hypotheses?: readonly Hypothesis[];
  insightHistory?: readonly InsightHistoryEntry[];
}

export function buildResearchExport(
  store: MemoryEventStore,
  consent: ConsentRegistry,
  options: ResearchExportOptions = {},
): ResearchExport {
  const now = options.now ?? Date.now;
  const all = store.all();
  const excludedSources: ResearchExport["excludedSources"] = [];

  const allowedByConsent = new Set(consent.exportableSources());
  const events = all.filter((event) => {
    if (!options.includeSensitive && event.sensitivity === "sensitive") {
      addOnce(excludedSources, event.source, "Marked sensitive; re-run the export with sensitive data included to receive it");
      return false;
    }
    if (!allowedByConsent.has(event.source) && consent.get(event.source) !== null) {
      addOnce(excludedSources, event.source, "Excluded from exports in this source's privacy settings");
      return false;
    }
    return true;
  });

  const localDates = events.map((event) => event.localDate).sort();
  const bySource = new Map<string, number>();
  for (const event of events) bySource.set(String(event.source), (bySource.get(String(event.source)) ?? 0) + 1);

  const qualityBySource = new Map((options.qualities ?? []).map((entry) => [String(entry.source), entry]));
  const sources: ResearchCoverageSource[] = [...bySource.entries()]
    .map(([source, count]) => {
      const quality = qualityBySource.get(source);
      return {
        source,
        events: count,
        quality: quality
          ? {
              score: quality.score,
              grade: quality.grade,
              daysWithData: quality.daysWithData,
              coverageDays: quality.coverageDays,
              firstEventDate: quality.firstEventDate,
              lastEventDate: quality.lastEventDate,
            }
          : null,
      };
    })
    .sort((a, b) => a.source.localeCompare(b.source));

  const resultsByDesign = new Map((options.experimentResults ?? []).map((result) => [result.experimentId, result]));
  const hypothesisByDesign = new Map(
    (options.experimentDesigns ?? []).map((design) => [design.id, design.hypothesisId]),
  );
  const hypothesesById = new Map((options.hypotheses ?? []).map((hypothesis) => [hypothesis.id, hypothesis]));

  return {
    format: "pulse-research-export",
    formatVersion: RESEARCH_EXPORT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date(now()).toISOString(),
    timezone: options.timezone ?? "UTC",
    description: "A de-identified, statistics-first snapshot of the evidence Pulse holds. It carries no raw events, no free text and no authored beliefs; sensitive sources are excluded unless explicitly requested.",
    dateRange: localDates.length ? { from: localDates[0]!, to: localDates[localDates.length - 1]! } : null,
    excludedSources,
    coverage: {
      eventCount: events.length,
      daysWithData: new Set(localDates).size,
      sources,
    },
    findings: (options.findings ?? []).map(toResearchFinding).sort(compareFindings),
    experiments: (options.experimentDesigns ?? [])
      .map((design) => {
        const result = resultsByDesign.get(design.id);
        const hypothesis = hypothesesById.get(hypothesisByDesign.get(design.id) ?? "");
        return {
          designId: design.id,
          type: design.type,
          targetMetricId: design.targetMetricId,
          startDate: design.startDate,
          endDate: design.endDate,
          durationDays: design.durationDays,
          minSamplePerCondition: design.minSamplePerCondition,
          predictedEffect: result?.predictedEffect ?? null,
          predictedDirection: hypothesis?.predictedDirection ?? null,
          result: result ? toResearchResult(result) : null,
        } satisfies ResearchExperiment;
      })
      .sort((a, b) => a.designId.localeCompare(b.designId)),
    insightJourneys: (options.insightHistory ?? []).map(toResearchJourney).sort(compareJourneys),
  };
}

function toResearchFinding(finding: Finding): ResearchFinding {
  return {
    id: finding.id,
    outcomeMetricId: finding.metricIds[0] ?? "",
    exposureMetricId: finding.metricIds[1] ?? null,
    evidenceClass: finding.evidenceClass,
    replicationStatus: finding.replicationStatus ?? "new",
    direction: finding.effect.value >= 0 ? "increase" : "decrease",
    sampleSize: finding.sampleSize,
    sampleDescription: finding.sampleDescription,
    effect: {
      kind: finding.effect.kind,
      value: finding.effect.value,
      ci: finding.effect.ci ?? null,
      magnitude: finding.effect.magnitude,
    },
    test: finding.test
      ? {
          name: finding.test.name,
          statistic: finding.test.statistic,
          pValue: finding.test.pValue,
          ...(finding.test.adjustedP !== undefined ? { adjustedP: finding.test.adjustedP } : {}),
          ...(finding.test.familySize !== undefined ? { familySize: finding.test.familySize } : {}),
          ...(finding.test.correctionMethod !== undefined ? { correctionMethod: finding.test.correctionMethod } : {}),
        }
      : null,
    confidence: { level: finding.confidence.level, score: finding.confidence.score },
    confounders: finding.confounders.map(({ name, status, detail }) => ({ name, status, detail })),
    sources: [...finding.sources],
    tags: [...finding.tags],
    firstSeenAt: finding.createdAt,
    causalityNote: finding.causalityNote,
    nextActionKind: finding.nextAction?.kind ?? null,
  };
}

function toResearchResult(result: ExperimentResult): NonNullable<ResearchExperiment["result"]> {
  return {
    verdict: result.verdict,
    analysedAt: result.analysedAt,
    observedEffect: result.observedEffect,
    differenceCi: result.differenceCi,
    confidence: { level: result.confidence.level, score: result.confidence.score },
    achievedPower: result.achievedPower,
    adherence: {
      assignedDays: result.adherence.assignedDays,
      daysWithSessions: result.adherence.daysWithSessions,
      adherence: result.adherence.adherence,
    },
    reasons: [...result.reasons],
  };
}

function toResearchJourney(entry: InsightHistoryEntry): ResearchJourney {
  const [outcome = "", exposure = ""] = entry.signature.split("|");
  return {
    signature: entry.signature,
    outcomeMetricId: outcome,
    exposureMetricId: exposure,
    appearances: entry.appearances,
    firstSeenAt: entry.firstSeenAt,
    lastSeenAt: entry.lastSeenAt,
    latestStatus: entry.latestStatus,
    changes: entry.episodes.map((episode) => ({
      at: episode.at,
      change: episode.change,
      effectValue: episode.finding ? episode.finding.effect.value : null,
    })),
  };
}

function compareFindings(a: ResearchFinding, b: ResearchFinding): number {
  return (
    a.outcomeMetricId.localeCompare(b.outcomeMetricId) ||
    (a.exposureMetricId ?? "").localeCompare(b.exposureMetricId ?? "") ||
    a.id.localeCompare(b.id)
  );
}

function compareJourneys(a: ResearchJourney, b: ResearchJourney): number {
  return a.firstSeenAt.localeCompare(b.firstSeenAt) || a.signature.localeCompare(b.signature);
}

function addOnce(list: { source: SourceId; reason: string }[], source: SourceId, reason: string): void {
  if (!list.some((entry) => entry.source === source)) list.push({ source, reason });
}
