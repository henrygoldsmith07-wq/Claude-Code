/**
 * Internal evidence health metrics.
 *
 * Tracks counts and rates without auto-interpreting them as proof of health
 * improvement. All rates are 0..1 and neutral when denominators are zero.
 */

import type { Finding } from "../discovery/finding.js";
import type { ReplicationRecord } from "../discovery/replication.js";
import type { ContradictionRecord } from "../discovery/contradictions.js";
import type { RecommendationValueTracker } from "../recommendations/value.js";
import type { ExperimentDesign } from "../experiments/design.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { SyncReport } from "../connectors/sync.js";

export interface EvidenceMetrics {
  discoveries: {
    total: number;
    perFamilyEstimatedFalse: number;
    familySize: number;
  };
  replication: {
    rate: number;
    replicatedCount: number;
    totalWithStatus: number;
  };
  contradiction: {
    rate: number;
    contradictedCount: number;
    total: number;
  };
  retirement: {
    rate: number;
    retiredCount: number;
    total: number;
  };
  recommendations: {
    acceptanceRate: number;
    completionRate: number;
    outcomeSuccessRate: number;
    accepted: number;
    followed: number;
    measured: number;
    helped: number;
  };
  experiments: {
    completionRate: number;
    inconclusiveRate: number;
    completed: number;
    designed: number;
    inconclusive: number;
  };
  connectors: {
    uptime: number;
    healthyCount: number;
    totalConnected: number;
    reports: number;
  };
  note: string;
}

function rate(n: number, d: number): number {
  return d === 0 ? 0 : n / d;
}

export function buildEvidenceMetrics(input: {
  findings: readonly Finding[];
  replication: readonly ReplicationRecord[];
  contradictions: readonly ContradictionRecord[];
  inboxTotal?: number;
  retiredCount?: number;
  value?: RecommendationValueTracker;
  designs?: readonly ExperimentDesign[];
  results?: readonly ExperimentResult[];
  syncReports?: readonly SyncReport[];
  connectedCount?: number;
  familySize?: number;
  expectedFalseDiscoveries?: number;
}): EvidenceMetrics {
  const findings = input.findings;
  const repMap = new Map(input.replication.map((r) => [r.findingId, r.status]));

  const replicatedCount = findings.filter((f) => (repMap.get(f.id) ?? f.replicationStatus) === "replicated" || (repMap.get(f.id) ?? f.replicationStatus) === "experimentally-supported").length;
  const contradictedCount = findings.filter((f) => (repMap.get(f.id) ?? f.replicationStatus) === "contradicted").length;
  // Retirement via feedback or value suppressed topics — approximation from inbox if supplied
  const total = findings.length;
  const retiredCount = input.retiredCount ?? 0;

  const funnel = input.value?.funnel();
  const acceptanceRate = funnel ? funnel.acceptanceRate : 0;
  const completionRate = funnel ? funnel.followThroughRate : 0;
  const outcomeSuccessRate = funnel ? funnel.helpRate : 0;

  const designed = input.designs?.length ?? 0;
  const completed = input.results?.length ?? 0;
  const inconclusive = input.results?.filter((r) => r.verdict === "inconclusive").length ?? 0;

  const healthy = input.syncReports?.filter((r) => r.health.status === "healthy").length ?? 0;
  const totalReports = input.syncReports?.length ?? 0;
  const uptime = rate(healthy, Math.max(1, totalReports));

  return {
    discoveries: {
      total,
      perFamilyEstimatedFalse: input.expectedFalseDiscoveries ?? 0,
      familySize: input.familySize ?? total,
    },
    replication: {
      rate: rate(replicatedCount, Math.max(1, total)),
      replicatedCount,
      totalWithStatus: total,
    },
    contradiction: {
      rate: rate(contradictedCount, Math.max(1, total)),
      contradictedCount,
      total,
    },
    retirement: {
      rate: rate(retiredCount, Math.max(1, input.inboxTotal ?? total)),
      retiredCount,
      total: input.inboxTotal ?? total,
    },
    recommendations: {
      acceptanceRate,
      completionRate,
      outcomeSuccessRate,
      accepted: funnel?.accepted ?? 0,
      followed: funnel?.followed ?? 0,
      measured: funnel?.measured ?? 0,
      helped: funnel?.helped ?? 0,
    },
    experiments: {
      completionRate: rate(completed, Math.max(1, designed)),
      inconclusiveRate: rate(inconclusive, Math.max(1, completed)),
      completed,
      designed,
      inconclusive,
    },
    connectors: {
      uptime,
      healthyCount: healthy,
      totalConnected: input.connectedCount ?? totalReports,
      reports: totalReports,
    },
    note: "Internal metrics only — not proof of health improvement. Use for operational monitoring.",
  };
}
