/**
 * A stable, answerable view of the discovery lifecycle.
 *
 * The statistical scan is allowed to change its mind as new data arrives;
 * the inbox gives that movement a name so a finding does not simply appear
 * and vanish between scans. State is derived from the existing ledgers and
 * user corrections, keeping one lifecycle rather than another competing
 * store of truth.
 */

import type { Finding } from "./finding.js";
import { findingSubject } from "./relationship.js";
import type { InsightHistoryEntry } from "../history/insight-history.js";
import type { FeedbackStore } from "../recommendations/feedback.js";
import type { Recommendation } from "../recommendations/rank.js";
import type { RecommendationValueTracker } from "../recommendations/value.js";
import type { Hypothesis } from "../hypotheses/tracker.js";
import type { ConfidenceLevel, EvidenceClass } from "../statistics/confidence.js";

export type DiscoveryLifecycleState =
  | "emerging"
  | "needs-more-data"
  | "replicated"
  | "contradicted"
  | "experiment-candidate"
  | "acted-upon"
  | "dormant"
  | "retired";

export interface DiscoveryInboxItem {
  id: string;
  finding: Finding;
  recommendationId: string | null;
  state: DiscoveryLifecycleState;
  stateReason: string;
  evidenceClass: EvidenceClass;
  confidence: { level: ConfidenceLevel; score: number };
  updatedAt: string;
}

export interface DiscoveryInboxOptions {
  findings: readonly Finding[];
  recommendations?: readonly Recommendation[];
  feedback?: FeedbackStore;
  value?: RecommendationValueTracker;
  hypotheses?: readonly Hypothesis[];
  history?: readonly InsightHistoryEntry[];
  limit?: number;
}

const STATE_ORDER: Record<DiscoveryLifecycleState, number> = {
  contradicted: 0,
  "experiment-candidate": 1,
  "needs-more-data": 2,
  emerging: 3,
  replicated: 4,
  "acted-upon": 5,
  dormant: 6,
  retired: 7,
};

export function buildDiscoveryInbox(options: DiscoveryInboxOptions): DiscoveryInboxItem[] {
  const recommendationsByFinding = new Map(
    (options.recommendations ?? [])
      .filter((recommendation) => recommendation.sourceKind === "finding")
      .map((recommendation) => [recommendation.sourceId, recommendation]),
  );
  const hypothesesByFinding = new Map(
    (options.hypotheses ?? [])
      .filter((hypothesis) => hypothesis.originFindingId)
      .map((hypothesis) => [hypothesis.originFindingId!, hypothesis]),
  );
  const currentBySubject = new Map(options.findings.map((finding) => [findingSubject(finding), finding]));
  const historical = (options.history ?? [])
    .map((entry) => ({ entry, finding: [...entry.episodes].reverse().find((episode) => episode.finding)?.finding ?? null }))
    .filter((item): item is { entry: InsightHistoryEntry; finding: Finding } => item.finding !== null)
    .filter((item) => !currentBySubject.has(item.entry.signature));
  const candidates = [
    ...options.findings.map((finding) => ({ finding, history: undefined as InsightHistoryEntry | undefined })),
    ...historical.map(({ entry, finding }) => ({ finding, history: entry })),
  ];

  const items = candidates.map(({ finding, history }): DiscoveryInboxItem => {
    const recommendation = recommendationsByFinding.get(finding.id);
    const value = recommendation && options.value ? options.value.valueOf(recommendation.id) : undefined;
    const hypothesis = hypothesesByFinding.get(finding.id);
    const lifecycle = stateFor(finding, recommendation, value, hypothesis, options.feedback, history);
    return {
      id: finding.id,
      finding,
      recommendationId: recommendation?.id ?? null,
      state: lifecycle.state,
      stateReason: lifecycle.reason,
      evidenceClass: finding.evidenceClass,
      confidence: { level: finding.confidence.level, score: finding.confidence.score },
      updatedAt: latestDate(finding.createdAt, history?.lastSeenAt, hypothesis?.updatedAt, value?.respondedAt, value?.measuredAt),
    };
  });

  items.sort(
    (a, b) =>
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      b.confidence.score - a.confidence.score ||
      b.updatedAt.localeCompare(a.updatedAt) ||
      a.id.localeCompare(b.id),
  );
  return options.limit ? items.slice(0, options.limit) : items;
}

function stateFor(
  finding: Finding,
  recommendation: Recommendation | undefined,
  value: ReturnType<RecommendationValueTracker["valueOf"]>,
  hypothesis: Hypothesis | undefined,
  feedback: FeedbackStore | undefined,
  history: InsightHistoryEntry | undefined,
): { state: DiscoveryLifecycleState; reason: string } {
  if (finding.replicationStatus === "contradicted") {
    return { state: "contradicted", reason: finding.contradictionNote ?? "The same relationship has since appeared pointing both ways." };
  }
  if (feedback?.isDismissed(finding.id) || finding.metricIds.some((metricId) => feedback?.isTopicMuted(metricId))) {
    return { state: "retired", reason: "You asked Pulse to stop surfacing this insight or its topic." };
  }
  if (value?.response === "dont-suggest-again" || value?.response === "not-useful") {
    return { state: "retired", reason: "Your recommendation response retired this action from the active queue." };
  }
  if (value && (value.stage === "accepted" || value.stage === "followed" || value.stage === "measured" || value.response === "already-doing-this")) {
    return { state: "acted-upon", reason: value.outcome ? `You reported that it ${value.outcome}.` : "You marked this recommendation as tried or already in progress." };
  }
  if (finding.replicationStatus === "replicated" || finding.replicationStatus === "experimentally-supported") {
    return { state: "replicated", reason: finding.replicationStatus === "experimentally-supported" ? "A controlled personal experiment supported the direction." : "The same relationship appeared again in fresh data." };
  }
  if (hypothesis && (hypothesis.status === "proposed" || hypothesis.status === "testing")) {
    return { state: "experiment-candidate", reason: hypothesis.status === "testing" ? "A pre-registered experiment is in progress." : "This finding has a testable intervention ready." };
  }
  if (recommendation?.nextStep && recommendation.sourceKind === "finding" && finding.nextAction?.kind === "run-experiment") {
    return { state: "experiment-candidate", reason: "The evidence is interesting enough to test, not strong enough to treat as a fact." };
  }
  if (finding.nextAction?.kind === "collect-more-data" || finding.confidence.level === "very-low" || finding.confidence.level === "low") {
    return { state: "needs-more-data", reason: finding.nextAction?.rationale ?? "The current sample or confidence is not yet enough for a useful decision." };
  }
  const latestEpisode = history?.episodes.at(-1);
  if (latestEpisode && !latestEpisode.present) {
    const disappearedCount = history?.episodes.filter((e) => !e.present).length ?? 1;
    const appearances = history?.appearances ?? 1;
    if (disappearedCount >= 2 && appearances >= 2) {
      return { state: "dormant", reason: "This relationship has not appeared in the last scans; it is dormant until fresh supporting data returns. No action is implied." };
    }
    return { state: "needs-more-data", reason: latestEpisode.note ?? "This relationship no longer crossed the evidence bar in the latest scan; collect more data before calling it gone." };
  }
  return { state: "emerging", reason: "First seen; waiting for a later scan to establish whether it persists." };
}

function latestDate(...dates: (string | null | undefined)[]): string {
  return dates.filter((date): date is string => Boolean(date)).sort().at(-1) ?? "";
}
