/**
 * Evidence search.
 *
 * Pulse's evidence is more than its findings. Every question the engine
 * asked and declined to publish is evidence too — the rejection trail is
 * what makes absence inspectable, so a user can see that a metric they
 * care about was checked and why it was not reported. Experiments and
 * hypotheses are evidence in the same way.
 *
 * Search is deliberately deterministic and keyword-based. It is the
 * complement to `ask`: Ask Pulse interprets a question; the evidence
 * search returns every document — published, pending or declined — that
 * mentions what you typed, ranked by how much of it they mention.
 *
 * Ranking is plain: the score is how many times the query's terms appear
 * across the document's searchable text (metric names included, since
 * users search "accuracy", not "study.accuracy"). Ties break by evidence
 * kind, then title, so the same query always returns the same order.
 */

import type { Finding } from "../discovery/finding.js";
import { ReplicationLedger } from "../discovery/replication.js";
import type { Hypothesis } from "../hypotheses/tracker.js";
import type { ExperimentDesign } from "../experiments/design.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { MetricRegistry } from "../metrics/registry.js";

export type EvidenceHitKind = "finding" | "rejection" | "experiment" | "hypothesis";

/** A question the engine asked and declined to publish, with the reason. */
export interface RejectedClaim {
  kind: string;
  /** The question as the engine phrased it, e.g. "Is accuracy different within 4h of training?" */
  question: string;
  outcomeMetricId: string;
  exposureMetricId: string | null;
  reason: string;
}

export interface EvidenceIndex {
  findings: readonly Finding[];
  rejected: readonly RejectedClaim[];
  hypotheses: readonly Hypothesis[];
  experiments: readonly ExperimentDesign[];
  experimentResults: readonly ExperimentResult[];
  registry: MetricRegistry;
}

export interface EvidenceHit {
  kind: EvidenceHitKind;
  /** Sum of query-term occurrences across the searchable text, capped per term. */
  score: number;
  title: string;
  summary: string;
  /** The query terms that matched, for the UI to show why this hit surfaced. */
  matchedTerms: string[];
  /** The replication signature when this hit is a finding — the identity the insight history is keyed by. */
  signature?: string;
  finding?: Finding;
  rejection?: RejectedClaim;
  experiment?: ExperimentDesign;
  experimentResult?: ExperimentResult;
  hypothesis?: Hypothesis;
}

export const EVIDENCE_HIT_LABEL: Record<EvidenceHitKind, string> = {
  finding: "Finding",
  rejection: "Checked, not published",
  experiment: "Experiment",
  hypothesis: "Hypothesis",
};

/** Tie-break order when scores are equal: published evidence first, rejection trail last. */
const KIND_RANK: Record<EvidenceHitKind, number> = { finding: 0, experiment: 1, hypothesis: 2, rejection: 3 };
/** Per-term occurrence cap, so a word repeated in boilerplate cannot dominate. */
const MAX_OCCURRENCES_PER_TERM = 3;
const DEFAULT_LIMIT = 20;

export function searchEvidence(
  query: string,
  index: EvidenceIndex,
  options: { limit?: number } = {},
): EvidenceHit[] {
  const terms = tokenise(query);
  if (terms.length === 0) return [];
  const limit = options.limit ?? DEFAULT_LIMIT;

  const resultById = new Map(index.experimentResults.map((result) => [result.experimentId, result]));

  const candidates: EvidenceHit[] = [];
  for (const finding of index.findings) pushHit(candidates, hitForFinding(finding, terms, index.registry));
  for (const rejected of index.rejected) pushHit(candidates, hitForRejection(rejected, terms, index.registry));
  for (const hypothesis of index.hypotheses) pushHit(candidates, hitForHypothesis(hypothesis, terms, index.registry));
  for (const design of index.experiments) {
    pushHit(candidates, hitForExperiment(design, resultById.get(design.id), terms, index.registry));
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score || KIND_RANK[a.kind] - KIND_RANK[b.kind] || a.title.localeCompare(b.title),
  );
  return candidates.slice(0, limit);
}

function pushHit(candidates: EvidenceHit[], hit: EvidenceHit | null): void {
  if (hit && hit.score > 0) candidates.push(hit);
}
/** Splits a query into lowercase terms, dropping punctuation and 1-letter noise. */
function tokenise(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1))];
}

/** Counts how many query terms occur in `text` as whole words, and which ones. */
function matchTerms(text: string, terms: readonly string[]): { score: number; matched: string[] } {
  const haystack = text.toLowerCase();
  let score = 0;
  const matched: string[] = [];
  for (const term of terms) {
    const occurrences = haystack.split(new RegExp(`\\b${escapeRegex(term)}\\b`)).length - 1;
    if (occurrences > 0) {
      matched.push(term);
      score += Math.min(occurrences, MAX_OCCURRENCES_PER_TERM);
    }
  }
  return { score, matched };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function metricName(registry: MetricRegistry, metricId: string): string {
  return registry.get(metricId)?.name ?? metricId.replace(/\./g, " ");
}

function hitForFinding(finding: Finding, terms: readonly string[], registry: MetricRegistry): EvidenceHit | null {
  const text = [
    finding.title,
    finding.statement,
    finding.sampleDescription,
    finding.causalityNote,
    finding.effect.label,
    finding.replicationStatus ?? "",
    finding.contradictionNote ?? "",
    finding.counterfactual?.statement ?? "",
    finding.nextAction?.summary ?? "",
    finding.tags.join(" "),
    finding.metricIds.map((id) => `${metricName(registry, id)} ${id.replace(/\./g, " ")}`).join(" "),
  ].join(" ");

  const { score, matched } = matchTerms(text, terms);
  if (score === 0) return null;
  return {
    kind: "finding",
    score,
    title: finding.title,
    summary: finding.statement,
    matchedTerms: matched,
    signature: ReplicationLedger.signature(finding),
    finding,
  };
}

function hitForRejection(
  rejected: RejectedClaim,
  terms: readonly string[],
  registry: MetricRegistry,
): EvidenceHit | null {
  const outcome = metricName(registry, rejected.outcomeMetricId);
  const exposure = rejected.exposureMetricId ? metricName(registry, rejected.exposureMetricId) : "";
  const text = [
    rejected.question,
    rejected.reason,
    rejected.kind.replace(/-/g, " "),
    outcome,
    exposure,
  ].join(" ");

  const { score, matched } = matchTerms(text, terms);
  if (score === 0) return null;
  const versus = exposure ? ` against ${exposure.toLowerCase()}` : "";
  return {
    kind: "rejection",
    score,
    title: rejected.question,
    summary: `Checked ${outcome.toLowerCase()}${versus} and not published. ${rejected.reason}`,
    matchedTerms: matched,
    rejection: rejected,
  };
}

function hitForHypothesis(
  hypothesis: Hypothesis,
  terms: readonly string[],
  registry: MetricRegistry,
): EvidenceHit | null {
  const outcome = metricName(registry, hypothesis.outcomeMetricId);
  const exposure = hypothesis.exposureMetricId ? metricName(registry, hypothesis.exposureMetricId) : "";
  const text = [
    hypothesis.statement,
    hypothesis.status,
    hypothesis.predictedDirection,
    outcome,
    exposure,
    hypothesis.knownConfounders.join(" "),
  ].join(" ");

  const { score, matched } = matchTerms(text, terms);
  if (score === 0) return null;
  return {
    kind: "hypothesis",
    score,
    title: hypothesis.statement,
    summary: `${hypothesis.status.replace(/-/g, " ")} hypothesis about ${outcome.toLowerCase()}${exposure ? ` and ${exposure.toLowerCase()}` : ""}.`,
    matchedTerms: matched,
    hypothesis,
  };
}

function hitForExperiment(
  design: ExperimentDesign,
  result: ExperimentResult | undefined,
  terms: readonly string[],
  registry: MetricRegistry,
): EvidenceHit | null {
  const target = metricName(registry, design.targetMetricId);
  const text = [
    design.title,
    design.hypothesis,
    design.type,
    design.analysisMethod,
    design.successCriteria,
    design.conditionA.label,
    design.conditionA.instruction,
    design.conditionB.label,
    design.conditionB.instruction,
    target,
    result?.verdict ?? "",
    result?.summary ?? "",
    ...(result?.reasons ?? []),
  ].join(" ");

  const { score, matched } = matchTerms(text, terms);
  if (score === 0) return null;
  const verdict = result ? ` — ${result.verdict.replace(/-/g, " ")}` : " — awaiting analysis";
  return {
    kind: "experiment",
    score,
    title: design.title,
    summary: `${result?.summary ?? design.hypothesis}${verdict}.`,
    matchedTerms: matched,
    experiment: design,
    experimentResult: result,
  };
}

