/**
 * Recommendation ranking.
 *
 *   score = expected benefit x evidence confidence x relevance / effort
 *
 * Each factor is normalised to 0..1 (effort in hours, floored so the division
 * cannot explode) and every one of them is reported alongside the score, so a
 * ranking can always be argued with.
 *
 * The single most important rule here is the direction check: a metric
 * declared `lower-better` can only produce a recommendation that lowers it.
 * Without that, an engine that maximises effect size will cheerfully suggest
 * increasing your stress because the effect was large.
 */

import { hash128 } from "../events/hash.js";
import { clamp } from "../statistics/descriptive.js";
import { confidenceWeight } from "../statistics/confidence.js";
import type { MetricRegistry } from "../metrics/registry.js";
import type { EvidenceRef, Finding } from "../discovery/finding.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { FeedbackStore } from "./feedback.js";
import { daysBetween } from "../events/time.js";

export type RecommendationSource = "finding" | "experiment" | "data-quality";

export interface RecommendationFactors {
  /** 0..1 — how much better things could plausibly get. */
  expectedBenefit: number;
  /** 0..1 — how much the evidence can be trusted. */
  evidenceConfidence: number;
  /** 0..1 — how much this matters to the user right now. */
  relevance: number;
  /** Hours. Floored at 0.25 so trivial actions do not dominate. */
  effortHours: number;
}

export interface Recommendation {
  id: string;
  createdAt: string;
  title: string;
  /** The full, specific, evidence-carrying sentence the user reads. */
  statement: string;
  rationale: string;
  sourceKind: RecommendationSource;
  sourceId: string;
  metricIds: string[];
  factors: RecommendationFactors;
  score: number;
  evidence: EvidenceRef[];
  caveats: string[];
  /** What to actually do, phrased as an instruction. */
  nextStep: string;
}

export interface RankOptions {
  registry: MetricRegistry;
  now?: () => number;
  feedback?: FeedbackStore;
  /** Today's date, for recency scoring. */
  today?: string;
  limit?: number;
}

export function scoreOf(factors: RecommendationFactors): number {
  const effort = Math.max(0.25, factors.effortHours);
  return (factors.expectedBenefit * factors.evidenceConfidence * factors.relevance) / effort;
}

export function rankRecommendations(
  findings: readonly Finding[],
  experiments: readonly ExperimentResult[],
  options: RankOptions,
): Recommendation[] {
  const now = options.now ?? Date.now;
  const today = options.today ?? new Date(now()).toISOString().slice(0, 10);
  const recommendations: Recommendation[] = [];

  for (const finding of findings) {
    const recommendation = fromFinding(finding, options, today, now());
    if (recommendation) recommendations.push(recommendation);
  }
  for (const experiment of experiments) {
    const recommendation = fromExperiment(experiment, now());
    if (recommendation) recommendations.push(recommendation);
  }

  const ranked = recommendations
    .map((recommendation) => ({ ...recommendation, score: scoreOf(recommendation.factors) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return options.limit ? ranked.slice(0, options.limit) : ranked;
}

function fromFinding(
  finding: Finding,
  options: RankOptions,
  today: string,
  nowMs: number,
): Recommendation | null {
  // A claim seen pointing both ways is withdrawn: recommending an action on
  // it would be acting on conflicted evidence.
  if (finding.replicationStatus === "contradicted") return null;

  const action = finding.nextAction;
  if (!action || action.kind === "observe") return null;

  const outcome = options.registry.get(finding.metricIds[0] ?? "");
  if (!outcome) return null;

  // Direction gate. A neutral metric has no "better", so it cannot ground a
  // recommendation to change behaviour — only to investigate.
  const effectSign = Math.sign(finding.effect.value);
  if (outcome.direction === "neutral" && action.kind === "adjust-behaviour") return null;
  const improves =
    outcome.direction === "higher-better" ? effectSign > 0 : outcome.direction === "lower-better" ? effectSign < 0 : true;
  if (!improves && action.kind !== "collect-more-data") return null;

  const expectedBenefit = clamp(Math.abs(finding.effect.value) / 0.8, 0, 1);
  const evidenceConfidence = confidenceWeight(finding.confidence.level);
  const relevance = relevanceOf(finding, options, today);
  if (relevance <= 0) return null; // The user dismissed this topic.

  const factors: RecommendationFactors = {
    expectedBenefit,
    evidenceConfidence,
    relevance,
    effortHours: Math.max(0.25, action.effortHours),
  };

  const caveats = [
    finding.causalityNote,
    ...finding.confidence.limitations,
    ...finding.confounders.filter((c) => c.status === "uncontrolled").map((c) => `Not controlled: ${c.name.toLowerCase()} — ${c.detail}`),
  ].filter(Boolean);

  return {
    id: `rec-${hash128(`${finding.id}:${action.kind}`).slice(0, 16)}`,
    createdAt: new Date(nowMs).toISOString(),
    title: action.summary,
    statement: `${finding.statement} ${action.summary}.`,
    rationale: action.rationale,
    sourceKind: "finding",
    sourceId: finding.id,
    metricIds: finding.metricIds,
    factors,
    score: scoreOf(factors),
    evidence: finding.evidence,
    caveats,
    nextStep: nextStepFor(finding),
  };
}

function fromExperiment(experiment: ExperimentResult, nowMs: number): Recommendation | null {
  const now = new Date(nowMs).toISOString();

  if (experiment.verdict === "supported") {
    const factors: RecommendationFactors = {
      expectedBenefit: clamp(Math.abs(experiment.observedEffect) / 0.8, 0, 1),
      evidenceConfidence: confidenceWeight(experiment.confidence.level),
      relevance: 1,
      // Adopting something you already proved works is the cheapest action there is.
      effortHours: 0.5,
    };
    return {
      id: `rec-${hash128(`${experiment.experimentId}:adopt`).slice(0, 16)}`,
      createdAt: now,
      title: "Adopt the condition that won your experiment",
      statement: `${experiment.summary} Make it your default.`,
      rationale: "You tested this yourself under controlled conditions, which is the strongest evidence Pulse can offer.",
      sourceKind: "experiment",
      sourceId: experiment.experimentId,
      metricIds: [],
      factors,
      score: scoreOf(factors),
      evidence: [
        {
          kind: "experiment",
          description: `${experiment.adherence.conditionASessions} vs ${experiment.adherence.conditionBSessions} sessions across the run`,
          metricIds: [],
          sources: [],
          eventCount: experiment.adherence.conditionASessions + experiment.adherence.conditionBSessions,
          dateRange: null,
        },
      ],
      caveats: [experiment.causalityNote, ...experiment.confidence.limitations],
      nextStep: "Keep the winning condition and re-check in a month in case the effect fades.",
    };
  }

  if (experiment.verdict === "inconclusive" && experiment.achievedPower < 0.6) {
    const factors: RecommendationFactors = {
      expectedBenefit: 0.4,
      evidenceConfidence: 0.5,
      relevance: 0.8,
      effortHours: 2,
    };
    return {
      id: `rec-${hash128(`${experiment.experimentId}:extend`).slice(0, 16)}`,
      createdAt: now,
      title: "Extend the experiment rather than abandoning it",
      statement: `${experiment.summary} It stopped short of the sample it needed, so the result is not evidence of no effect.`,
      rationale: `The run reached only ${Math.round(experiment.achievedPower * 100)}% power, so a real effect of the predicted size would probably have been missed.`,
      sourceKind: "experiment",
      sourceId: experiment.experimentId,
      metricIds: [],
      factors,
      score: scoreOf(factors),
      evidence: [],
      caveats: ["Extending a run mid-flight risks stopping when the numbers look good — decide the new end date now, not later."],
      nextStep: "Set a new end date up front and run to it regardless of what the interim numbers show.",
    };
  }

  return null;
}

/**
 * Relevance blends recency of the evidence with user feedback. Dismissing a
 * topic zeroes it out rather than merely demoting it — a suggestion someone
 * has actively rejected should disappear, not creep back next week.
 */
function relevanceOf(finding: Finding, options: RankOptions, today: string): number {
  const dateRange = finding.evidence[0]?.dateRange;
  let recency = 0.7;
  if (dateRange) {
    const age = Math.max(0, daysBetween(dateRange.to, today));
    recency = clamp(2 ** (-age / 45), 0.15, 1);
  }

  const feedback = options.feedback;
  if (!feedback) return recency;
  if (feedback.isDismissed(finding.id)) return 0;
  for (const metricId of finding.metricIds) {
    if (feedback.isTopicMuted(metricId)) return 0;
  }
  return clamp(recency * feedback.relevanceMultiplier(finding.metricIds), 0, 1);
}

function nextStepFor(finding: Finding): string {
  const action = finding.nextAction;
  if (!action) return "No action recommended yet.";
  switch (action.kind) {
    case "run-experiment":
      return "Open the experiment designer — Pulse will propose conditions, a target sample and an end date.";
    case "collect-more-data":
      return "Keep logging as normal; Pulse will re-check once there are enough sessions.";
    case "adjust-behaviour":
      return action.summary;
    default:
      return "No action needed.";
  }
}
