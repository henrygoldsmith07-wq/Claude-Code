/**
 * "Why am I seeing this?" — user-inspectable provenance.
 *
 * Every insight is traceable to its inputs without re-running analysis.
 */

import type { PulseEvent } from "../events/schema.js";
import type { Finding } from "../discovery/finding.js";
import type { Recommendation } from "../recommendations/rank.js";
import type { MetricRegistry } from "../metrics/registry.js";
import type { SourceQuality } from "../quality/score.js";
import type { ConnectorDashboard } from "../connectors/dashboard.js";
import { ANALYSIS_VERSION } from "../discovery/replication.js";

export interface ProvenanceStep {
  label: string;
  detail: string;
}

export interface ProvenanceExplanation {
  subject: string;
  kind: "finding" | "recommendation";
  steps: ProvenanceStep[];
  freshness: string;
  confidence: string;
}

export function explainFinding(
  finding: Finding,
  context: {
    events: readonly PulseEvent[];
    registry: MetricRegistry;
    qualities?: readonly SourceQuality[];
    dashboard?: ConnectorDashboard;
  },
): ProvenanceExplanation {
  const steps: ProvenanceStep[] = [];
  const registry = context.registry;

  const metricDefs = finding.metricIds.map((id) => registry.get(id)).filter(Boolean);
  steps.push({
    label: "Metric",
    detail: metricDefs.map((d) => `${d!.name} (${d!.id} — ${d!.unit ?? "unitless"} from ${d!.source})`).join(" + ") || finding.metricIds.join(", "),
  });

  steps.push({
    label: "Source",
    detail: finding.sources.join(", ") || "unknown source",
  });

  // Connector + version via events that contributed
  const relevant = context.events.filter((e) => finding.sources.includes(e.source));
  const connectors = [...new Set(relevant.map((e) => `${e.provenance.connectorId} v${e.provenance.connectorVersion}`))];
  steps.push({
    label: "Connector",
    detail: connectors.length ? connectors.join(", ") : "no events matched — provenance unavailable",
  });

  if (relevant.length) {
    const sample = relevant.slice(0, 3);
    steps.push({
      label: "Source records",
      detail: sample.map((e) => `${e.sourceEventId} @ ${e.occurredAt} (ingested ${e.provenance.ingestedAt} via ${e.provenance.syncId})`).join(" | ") + (relevant.length > 3 ? ` + ${relevant.length - 3} more` : ""),
    });
    const times = relevant.map((e) => e.occurredAt).sort();
    steps.push({
      label: "Measurement time",
      detail: `${times[0]} → ${times[times.length - 1]} (local dates ${finding.evidence[0]?.dateRange ? `${finding.evidence[0]!.dateRange!.from} to ${finding.evidence[0]!.dateRange!.to}` : "no range"})`,
    });
    steps.push({
      label: "Import time",
      detail: relevant.map((e) => e.provenance.ingestedAt).sort()[0]! + ` (mode ${relevant[0]!.provenance.ingestMode})`,
    });
    const units = metricDefs.map((d) => d?.unit ?? "unknown").join(", ");
    steps.push({ label: "Units", detail: units });
    const transforms = metricDefs.map((d) => `metric ${d?.id} aggregated as ${d?.aggregation} per day; time bucket via localMinutes`).join("; ");
    steps.push({ label: "Transformations", detail: transforms || "raw metric values per sitting" });
  }

  steps.push({
    label: "Reconciliation",
    detail: "Cross-source duplicates de-duplicated by event overlap and first_hand attribution; superseded counts are in the reconciliation report",
  });

  if (finding.evidence[0]?.dateRange) {
    steps.push({ label: "Analysis window", detail: `${finding.evidence[0].dateRange.from} to ${finding.evidence[0].dateRange.to} (${finding.sampleSize} sittings)` });
  }

  steps.push({
    label: "Algorithm / version",
    detail: `discovery engine v${ANALYSIS_VERSION} — Welch/Mann-Whitney with Benjamini-Hochberg within family ${finding.test?.familySize ?? 1}, ${finding.test?.correctionMethod ?? "benjamini_hochberg"}`,
  });

  if (context.qualities) {
    const qs = context.qualities.filter((q) => finding.sources.includes(q.source));
    steps.push({
      label: "Freshness",
      detail: qs.length ? qs.map((q) => `${q.source} ${q.grade} (${Math.round(q.score * 100)}%) — last ${q.lastEventDate}` ).join("; ") : "no quality record",
    });
  }

  steps.push({
    label: "Confidence",
    detail: `${finding.confidence.level} (${Math.round(finding.confidence.score * 100)}%) — ${finding.confidence.reasons.join("; ")}`,
  });

  steps.push({
    label: "Caveats",
    detail: finding.causalityNote + (finding.confidence.limitations.length ? ` · ${finding.confidence.limitations.join("; ")}` : ""),
  });

  return {
    subject: finding.title,
    kind: "finding",
    steps,
    freshness: context.qualities?.map((q) => `${q.source}:${q.grade}`).join(", ") ?? "unknown",
    confidence: finding.confidence.level,
  };
}

export function explainRecommendation(
  recommendation: Recommendation,
  findingExplanation: ProvenanceExplanation | null,
): ProvenanceExplanation {
  const steps: ProvenanceStep[] = [
    { label: "Recommendation", detail: `${recommendation.title} — ${recommendation.statement}` },
    { label: "Source kind", detail: `${recommendation.sourceKind} ${recommendation.sourceId}` },
    { label: "Expected outcome", detail: `Benefit ${recommendation.factors.expectedBenefit.toFixed(2)} × confidence ${recommendation.factors.evidenceConfidence.toFixed(2)} / effort ${recommendation.factors.effortHours}h = score ${recommendation.score.toFixed(3)}` },
    { label: "Confidence", detail: `${recommendation.confidence.level} (${Math.round(recommendation.confidence.score * 100)}%) — ${recommendation.causalStatus}` },
    { label: "Evidence", detail: recommendation.evidence.map((e) => e.description).join("; ") || "no direct evidence block" },
  ];
  if (findingExplanation) steps.push({ label: "Underlying insight", detail: findingExplanation.subject + " — see finding provenance" });
  steps.push({ label: "Why now", detail: recommendation.rationale });
  return {
    subject: recommendation.title,
    kind: "recommendation",
    steps,
    freshness: "derived from current quality scores",
    confidence: recommendation.confidence.level,
  };
}
