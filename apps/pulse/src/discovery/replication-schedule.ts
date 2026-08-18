import { addDays } from "../events/time.js";
import type { Finding, ReplicationStatus } from "./finding.js";
import type { ReplicationRecord } from "./replication.js";

export type ReplicationPriority = "urgent" | "next" | "watch";

export interface ReplicationScheduleEntry {
  findingId: string;
  title: string;
  status: ReplicationStatus;
  priority: ReplicationPriority;
  dueDate: string;
  intervalDays: number;
  rationale: string;
}

export interface ReplicationScheduleOptions {
  today: string;
  defaultIntervalDays?: number;
}

const INTERVAL_BY_STATUS: Record<ReplicationStatus, number> = {
  new: 14,
  replicated: 30,
  "failed-to-replicate": 14,
  "experimentally-supported": 45,
  contradicted: 7,
};

/**
 * Turns the replication ledger into an explicit queue. Replication is not a
 * passive label: uncertain or conflicted claims get a shorter re-check window
 * and an auditable reason for why they are next.
 */
export function buildReplicationSchedule(
  findings: readonly Finding[],
  records: readonly ReplicationRecord[],
  options: ReplicationScheduleOptions,
): ReplicationScheduleEntry[] {
  const recordByFinding = new Map(records.map((record) => [record.findingId, record]));
  const defaultInterval = options.defaultIntervalDays ?? 14;

  return findings
    .map((finding) => {
      const record = recordByFinding.get(finding.id);
      const status = record?.status ?? finding.replicationStatus ?? "new";
      const intervalDays = INTERVAL_BY_STATUS[status] ?? defaultInterval;
      const lastUpdated = record?.updatedAt.slice(0, 10) ?? options.today;
      const dueDate = addDays(lastUpdated, intervalDays);
      const priority: ReplicationPriority =
        status === "contradicted" || status === "failed-to-replicate" ? "urgent" : status === "new" ? "next" : "watch";

      return {
        findingId: finding.id,
        title: finding.title,
        status,
        priority,
        dueDate,
        intervalDays,
        rationale: rationaleFor(status),
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || priorityRank(a.priority) - priorityRank(b.priority));
}

function priorityRank(priority: ReplicationPriority): number {
  return priority === "urgent" ? 0 : priority === "next" ? 1 : 2;
}

function rationaleFor(status: ReplicationStatus): string {
  switch (status) {
    case "contradicted":
      return "Opposing evidence needs a fresh check before this claim can guide an action.";
    case "failed-to-replicate":
      return "A controlled run did not reproduce the effect; check whether the null holds.";
    case "new":
      return "This is a first sighting. An independent window separates signal from chance.";
    case "experimentally-supported":
      return "The controlled result is strong; a later check protects against drift.";
    case "replicated":
      return "The relationship has reappeared. Keep it on a lower-frequency watch list.";
  }
}
