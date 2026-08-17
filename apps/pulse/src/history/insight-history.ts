/**
 * Persistent insight history.
 *
 * A discovery scan is a point-in-time photograph of what the engine believes:
 * it answers "what is true now?" but not "what changed?" — and the second
 * question is where personal analytics either earns or loses trust. This
 * ledger keeps every scan verbatim, matches findings across scans by
 * relationship signature (the same identity the replication ledger uses), and
 * derives each insight's journey: when it first appeared, whether it
 * strengthened or weakened as data accumulated, when it stopped meeting the
 * evidence bar, and why.
 *
 * Durable by design: scans are written through an optional adapter so the
 * history survives restarts, exactly like the event store. Without an adapter
 * the ledger still works — it just lives for the lifetime of the process.
 */

import type { SourceId } from "../events/schema.js";
import { hash128 } from "../events/hash.js";
import { ReplicationLedger } from "../discovery/replication.js";
import type { Finding, ReplicationStatus } from "../discovery/finding.js";

/** How an insight moved between consecutive scans. */
export type InsightChange =
  | "appeared"
  | "disappeared"
  | "strengthened"
  | "weakened"
  | "unchanged";

/** One moment in an insight's life. */
export interface InsightEpisode {
  at: string;
  scanId: string;
  /** Present in this scan, or absent from it. */
  present: boolean;
  change: InsightChange;
  /** The finding exactly as computed at that scan; null when the insight was absent. */
  finding: Finding | null;
  /** Why it disappeared, when the scan's own rejection log explains it. */
  note: string | null;
}

export interface InsightHistoryEntry {
  /** Precise identity of the question; unique per finding, stable across scans. */
  id: string;
  /** Coarse identity across scans: outcome | exposure | direction. */
  signature: string;
  title: string;
  metricIds: string[];
  sources: SourceId[];
  firstSeenAt: string;
  lastSeenAt: string;
  /** Scans in which this insight was present. */
  appearances: number;
  latestStatus: ReplicationStatus;
  episodes: InsightEpisode[];
}

export interface InsightScanRejection {
  /** The discovery question that was rejected. */
  candidateId: string;
  outcomeMetricId: string;
  exposureMetricId: string | null;
  reason: string;
}

export interface InsightScanTotals {
  findings: number;
  rejected: number;
  familySize: number;
  familyCount: number;
  expectedFalseDiscoveries: number;
}

/** One discovery scan, kept verbatim so the past can be re-rendered without re-running analysis. */
export interface InsightScanRecord {
  at: string;
  scanId: string;
  /** How many events the scan analysed — the context the findings sat in. */
  eventCount: number;
  findings: Finding[];
  rejected: InsightScanRejection[];
  totals: InsightScanTotals;
}

export interface InsightHistorySnapshot {
  version: 1;
  scans: InsightScanRecord[];
}

/** Pluggable persistence, mirroring the event store's adapter contract. */
export interface InsightHistoryAdapter {
  load(): Promise<InsightHistorySnapshot | null>;
  save(snapshot: InsightHistorySnapshot): Promise<void>;
}

export interface RecordScanInput {
  at: string;
  eventCount: number;
  findings: readonly Finding[];
  rejected: readonly InsightScanRejection[];
  totals: InsightScanTotals;
}

const HISTORY_VERSION = 1 as const;

/**
 * Below the effect floor itself (0.2) — a move smaller than this is noise,
 * not a story. The engine is deterministic, so identical scans are dropped
 * before this comparison ever runs.
 */
const EFFECT_CHANGE_EPSILON = 0.02;

export class InsightHistory {
  private scans: InsightScanRecord[] = [];
  private readonly adapter: InsightHistoryAdapter | null;

  constructor(adapter?: InsightHistoryAdapter) {
    this.adapter = adapter ?? null;
  }

  async load(): Promise<void> {
    if (!this.adapter) return;
    const snapshot = await this.adapter.load();
    if (snapshot && snapshot.version === HISTORY_VERSION && Array.isArray(snapshot.scans)) {
      this.scans = snapshot.scans;
    }
  }

  async persist(): Promise<void> {
    if (!this.adapter) return;
    await this.adapter.save(this.snapshot());
  }

  /**
   * Appends a scan. A scan identical to the previous one is ignored: the
   * engine is deterministic, so the same data is the same observation, and
   * recording it again would turn the history into churn — the UI rescans on
   * every render, and none of those re-scans are new evidence.
   */
  recordScan(input: RecordScanInput): void {
    const contentHash = contentHashOf(input.eventCount, input.findings);
    const last = this.scans[this.scans.length - 1];
    if (last && contentHashOf(last.eventCount, last.findings) === contentHash) return;

    this.scans.push({
      at: input.at,
      scanId: `scan-${hash128(`${input.at}:${contentHash}`).slice(0, 12)}`,
      eventCount: input.eventCount,
      findings: [...input.findings],
      rejected: [...input.rejected],
      totals: { ...input.totals },
    });
  }

  /** The journey of every insight Pulse has ever reported, oldest first. */
  history(): InsightHistoryEntry[] {
    const entries = new Map<string, InsightHistoryEntry>();
    // signature -> index of the most recent scan where it was present
    const lastPresent = new Map<string, number>();

    for (let scanIndex = 0; scanIndex < this.scans.length; scanIndex += 1) {
      const scan = this.scans[scanIndex]!;
      const present = new Set<string>();

      for (const finding of scan.findings) {
        const identity = identityOf(finding);
        present.add(identity);

        const previousIndex = lastPresent.get(identity);
        const change: InsightChange =
          previousIndex === undefined || previousIndex !== scanIndex - 1
            ? "appeared"
            : changeBetween(this.findingAt(previousIndex, identity), finding);

        let entry = entries.get(identity);
        if (!entry) {
          entry = {
            id: identity,
            signature: ReplicationLedger.signature(finding),
            title: finding.title,
            metricIds: [...finding.metricIds],
            sources: [...finding.sources],
            firstSeenAt: scan.at,
            lastSeenAt: scan.at,
            appearances: 0,
            latestStatus: finding.replicationStatus ?? "new",
            episodes: [],
          };
          entries.set(identity, entry);
        }
        entry.title = finding.title;
        entry.lastSeenAt = scan.at;
        entry.appearances += 1;
        entry.latestStatus = finding.replicationStatus ?? entry.latestStatus;
        entry.episodes.push({
          at: scan.at,
          scanId: scan.scanId,
          present: true,
          change,
          finding,
          note: null,
        });
        lastPresent.set(identity, scanIndex);
      }

      for (const [identity, seenAt] of lastPresent) {
        if (present.has(identity) || seenAt === scanIndex) continue;
        const entry = entries.get(identity);
        if (!entry) continue;
        const previous = this.findingAt(seenAt, identity);
        entry.episodes.push({
          at: scan.at,
          scanId: scan.scanId,
          present: false,
          change: "disappeared",
          finding: null,
          note: noteForDisappearance(scan, previous),
        });
      }
    }

    return [...entries.values()].sort(
      (a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt) || a.signature.localeCompare(b.signature),
    );
  }

  /** Defensive copies, so callers cannot mutate the ledger. */
  listScans(): InsightScanRecord[] {
    return this.scans.map((scan) => ({
      ...scan,
      findings: [...scan.findings],
      rejected: [...scan.rejected],
      totals: { ...scan.totals },
    }));
  }

  snapshot(): InsightHistorySnapshot {
    return { version: HISTORY_VERSION, scans: this.listScans() };
  }

  size(): number {
    return this.scans.length;
  }

  /**
   * Privacy primitive: drops every snapshot that drew on a deleted source.
   * Scans left without a single surviving finding are dropped entirely —
   * keeping them would present totals the findings no longer support.
   */
  pruneBySources(sources: readonly SourceId[]): number {
    const removed = new Set(sources);
    const before = this.scans.length;
    const surviving: InsightScanRecord[] = [];

    for (const scan of this.scans) {
      const findings = scan.findings.filter(
        (finding) => !finding.sources.some((source) => removed.has(source)),
      );
      if (findings.length === 0) continue;
      surviving.push({
        ...scan,
        findings,
        totals: { ...scan.totals, findings: findings.length },
      });
    }

    this.scans = surviving;
    return before - this.scans.length;
  }

  private findingAt(scanIndex: number, identity: string): Finding {
    const finding = this.scans[scanIndex]!.findings.find((candidate) => identityOf(candidate) === identity);
    if (!finding) throw new Error(`InsightHistory invariant broken: ${identity} not present in scan ${scanIndex}`);
    return finding;
  }
}

/**
 * Content identity of a scan, used to ignore re-scans of unchanged data.
 * Includes the finding ids (which encode the sample) and effect values, so a
 * scan is only ever dropped when it is genuinely the same observation.
 */
function contentHashOf(eventCount: number, findings: readonly Finding[]): string {
  const parts = findings
    .map((finding) => `${identityOf(finding)}|${finding.id}|${finding.effect.value}`)
    .sort()
    .join("\n");
  return hash128(`${eventCount}\n${parts}`);
}

/**
 * Identity of "the same insight" across scans. The relationship signature is
 * the replication ledger's identity, but it is deliberately coarse — a
 * time-of-day finding and an attribute-split finding about the same outcome
 * share it, and they are different questions. The candidate id is exact, so
 * it wins when present; the candidate kind disambiguates hand-built findings.
 */
function identityOf(finding: Finding): string {
  return finding.candidateId ?? `${ReplicationLedger.signature(finding)}|${finding.tags[0] ?? ""}`;
}

function changeBetween(previous: Finding, current: Finding): InsightChange {
  const before = Math.abs(previous.effect.value);
  const after = Math.abs(current.effect.value);
  if (after - before > EFFECT_CHANGE_EPSILON) return "strengthened";
  if (before - after > EFFECT_CHANGE_EPSILON) return "weakened";
  return "unchanged";
}

function noteForDisappearance(scan: InsightScanRecord, previous: Finding): string | null {
  if (previous.candidateId) {
    const byCandidate = scan.rejected.find((rejection) => rejection.candidateId === previous.candidateId);
    if (byCandidate) return byCandidate.reason;
  }
  // Hand-built findings may lack a candidate id; fall back to the relationship.
  const [outcome, exposure = ""] = ReplicationLedger.signature(previous).split("|");
  const match = scan.rejected.find(
    (rejection) =>
      rejection.outcomeMetricId === outcome && (rejection.exposureMetricId ?? "") === exposure,
  );
  return match?.reason ?? null;
}

/** In-memory adapter, used by tests — mirrors `createMemoryAdapter` for events. */
export function createMemoryInsightHistoryAdapter(): InsightHistoryAdapter {
  let snapshot: InsightHistorySnapshot | null = null;
  return {
    async load() {
      return snapshot;
    },
    async save(next) {
      snapshot = next;
    },
  };
}
