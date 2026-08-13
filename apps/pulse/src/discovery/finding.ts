/**
 * The evidence contract.
 *
 * Nothing reaches the user except as a `Finding`, and a `Finding` cannot be
 * constructed without: what was found, which data supports it, sample size,
 * effect size, confidence, possible confounders, what class of evidence it is,
 * and what to do next (or an explicit null). The type is deliberately
 * awkward to build carelessly — that is the point.
 */

import type { SourceId } from "../events/schema.js";
import type { EffectSize } from "../statistics/effects.js";
import type { ConfidenceAssessment, EvidenceClass } from "../statistics/confidence.js";

export type ConfounderStatus =
  /** Held constant or adjusted for in the estimate reported. */
  | "controlled"
  /** Groups were matched on this before comparing. */
  | "matched"
  /** Checked, and the groups did not differ on it. */
  | "checked-balanced"
  /** Differs between groups and could not be adjusted away. */
  | "uncontrolled";

export interface Confounder {
  id: string;
  name: string;
  description: string;
  status: ConfounderStatus;
  /** Evidence for the status, e.g. "median 16:20 vs 16:05, p = 0.62". */
  detail: string;
}

export interface EvidenceRef {
  kind: "events" | "series" | "experiment";
  description: string;
  metricIds: string[];
  sources: SourceId[];
  eventCount: number;
  dateRange: { from: string; to: string } | null;
}

export type NextActionKind = "run-experiment" | "collect-more-data" | "observe" | "adjust-behaviour";

export interface NextAction {
  kind: NextActionKind;
  summary: string;
  rationale: string;
  /** Rough hours of effort, used by the recommendation ranker. */
  effortHours: number;
  /** Present when the action is "run this experiment". */
  experimentDesignId?: string;
}

export interface StatisticalTestRef {
  name: string;
  statistic: number;
  pValue: number;
  /** After multiple-testing correction, when part of a family. */
  adjustedP?: number;
  familySize?: number;
  correctionMethod?: string;
}

export interface Finding {
  id: string;
  createdAt: string;
  evidenceClass: EvidenceClass;
  /** Short headline, e.g. "Study accuracy is higher after exercise". */
  title: string;
  /** Full sentence with the numbers in it. Generated deterministically. */
  statement: string;
  metricIds: string[];
  sources: SourceId[];
  sampleSize: number;
  /** Human description of the sample, e.g. "42 revision sessions". */
  sampleDescription: string;
  effect: EffectSize;
  test?: StatisticalTestRef;
  confidence: ConfidenceAssessment;
  confounders: Confounder[];
  /** Mandatory. Never null — even an experiment gets a scope caveat. */
  causalityNote: string;
  nextAction: NextAction | null;
  evidence: EvidenceRef[];
  /** Free tags for grouping in the UI. */
  tags: string[];
}

export interface FindingDraft extends Omit<Finding, "id" | "createdAt"> {
  id?: string;
  createdAt?: string;
}

/**
 * Guard rails applied to every finding before it can be shown.
 * Returns the problems rather than throwing, so a scan can drop one bad
 * finding without losing the rest.
 */
export function validateFinding(finding: Finding): string[] {
  const problems: string[] = [];
  if (!finding.title.trim()) problems.push("Finding has no title");
  if (!finding.statement.trim()) problems.push("Finding has no statement");
  if (finding.sampleSize <= 0) problems.push("Finding has no sample");
  if (finding.metricIds.length === 0) problems.push("Finding names no metrics");
  if (finding.sources.length === 0) problems.push("Finding names no sources");
  if (!finding.causalityNote.trim()) problems.push("Finding is missing its causality note");
  if (finding.evidence.length === 0) problems.push("Finding cites no evidence");
  if (!Number.isFinite(finding.effect.value)) problems.push("Finding has no usable effect size");

  // The rule the whole product rests on.
  if (finding.evidenceClass !== "experiment" && /\b(causes?|caused|because of|leads to|makes you)\b/i.test(finding.statement)) {
    problems.push("Non-experimental finding uses causal language");
  }
  if (finding.evidenceClass === "correlation" && finding.confidence.level === "high") {
    problems.push("Correlational findings cannot be graded high confidence");
  }
  return problems;
}

/** Deterministic ordering: strongest evidence first, then largest effect. */
export function compareFindings(a: Finding, b: Finding): number {
  const classRank: Record<EvidenceClass, number> = { experiment: 0, correlation: 1, hypothesis: 2, observation: 3 };
  const byClass = classRank[a.evidenceClass] - classRank[b.evidenceClass];
  if (byClass !== 0) return byClass;
  const byConfidence = b.confidence.score - a.confidence.score;
  if (Math.abs(byConfidence) > 1e-9) return byConfidence;
  const byEffect = Math.abs(b.effect.value) - Math.abs(a.effect.value);
  if (Math.abs(byEffect) > 1e-9) return byEffect;
  return a.id.localeCompare(b.id);
}
