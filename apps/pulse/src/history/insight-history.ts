/**
 * Persistent insight history.
 *
 * A discovery scan is a point-in-time photograph of what the engine believes:
 * it answers "what is true now?" but not "what changed?" — and the second
 * question is where personal analytics either earns or loses trust. This
 * ledger keeps every scan verbatim, matches findings across scans by
 * relationship subject (outcome × exposure, direction-free — the same key the
 * contradiction ledger and causal hypothesis library share), and derives each
 * insight's journey: when it first appeared, whether it strengthened, weakened
 * or reversed as data accumulated, when it stopped meeting the evidence bar,
 * and why.
 *
 * Durable by design: scans are written through an optional adapter so the
 * history survives restarts, exactly like the event store. Without an adapter
 * the ledger still works — it just lives for the lifetime of the process.
 */

import type { SourceId } from "../events/schema.js";
import { hash128 } from "../events/hash.js";
import { ReplicationLedger } from "../discovery/replication.js";
import { findingSubject } from "../discovery/relationship.js";
import type { Finding, ReplicationStatus } from "../discovery/finding.js";

/** How an insight moved between consecutive scans. */
export type InsightChange =
  | "appeared"
  | "disappeared"
  | "strengthened"
  | "weakened"
  | "reversed"
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
  /** The previous scan's effect label when this episode reversed direction; null otherwise. */
  previousEffectLabel: string | null;
}

export interface InsightHistoryEntry {
  /** Stable identity across scans: outcome | exposure, direction-free so a flip is a reversal, not a new insight. */
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
  outcomeMetricId: string;
  exposureMetricId: string | null;
  reason: string;
  /** The question as the engine asked it, when the scan recorded it — so a scan view can show what was actually checked. */
  question?: string;
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
  /** Content hashes of every recorded scan, lazily rebuilt; drives reload-proof dedupe. */
  private seenHashes: Set<string> | null = null;
  private readonly adapter: InsightHistoryAdapter | null;

  constructor(adapter?: InsightHistoryAdapter) {
    this.adapter = adapter ?? null;
  }

  async load(): Promise<void> {
    if (!this.adapter) return;
    const snapshot = await this.adapter.load();
    if (snapshot && snapshot.version === HISTORY_VERSION && Array.isArray(snapshot.scans)) {
      this.scans = snapshot.scans;
      // Restored scans count as already seen, so a reload that replays the
      // whole boot cannot grow the history.
      this.seenHashes = null;
    }
  }

  async persist(): Promise<void> {
    if (!this.adapter) return;
    await this.adapter.save(this.snapshot());
  }

  /**
   * Appends a scan. A scan identical to any earlier one is ignored: the
   * engine is deterministic, so the same data is the same observation, and
   * recording it again would turn the history into churn — the UI rescans on
   * every render, and a reload that replays the whole boot is re-recording
   * observations the ledger already holds.
   */
  recordScan(input: RecordScanInput): void {
    const contentHash = contentHashOf(input.eventCount, input.findings);
    if (this.hashes().has(contentHash)) return;

    this.scans.push({
      at: input.at,
      scanId: `scan-${hash128(`${input.at}:${contentHash}`).slice(0, 12)}`,
      eventCount: input.eventCount,
      findings: [...input.findings],
      rejected: [...input.rejected],
      totals: { ...input.totals },
    });
    this.hashes().add(contentHash);
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
        const signature = findingSubject(finding);
        present.add(signature);

        const previousIndex = lastPresent.get(signature);
        const previousFinding =
          previousIndex !== undefined && previousIndex === scanIndex - 1
            ? this.findingAt(previousIndex, signature)
            : null;
        const change: InsightChange = previousFinding ? changeBetween(previousFinding, finding) : "appeared";

        let entry = entries.get(signature);
        if (!entry) {
          entry = {
            signature,
            title: finding.title,
            metricIds: [...finding.metricIds],
            sources: [...finding.sources],
            firstSeenAt: scan.at,
            lastSeenAt: scan.at,
            appearances: 0,
            latestStatus: finding.replicationStatus ?? "new",
            episodes: [],
          };
          entries.set(signature, entry);
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
          previousEffectLabel: change === "reversed" && previousFinding ? previousFinding.effect.label : null,
        });
        lastPresent.set(signature, scanIndex);
      }

      for (const [signature, seenAt] of lastPresent) {
        if (present.has(signature) || seenAt === scanIndex) continue;
        const entry = entries.get(signature);
        if (!entry) continue;
        entry.episodes.push({
          at: scan.at,
          scanId: scan.scanId,
          present: false,
          change: "disappeared",
          finding: null,
          note: noteForDisappearance(scan, signature),
          previousEffectLabel: null,
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
    this.seenHashes = null;
    return before - this.scans.length;
  }

  private hashes(): Set<string> {
    if (!this.seenHashes) {
      this.seenHashes = new Set(this.scans.map((scan) => contentHashOf(scan.eventCount, scan.findings)));
    }
    return this.seenHashes;
  }

  private findingAt(scanIndex: number, signature: string): Finding {
    const finding = this.scans[scanIndex]!.findings.find(
      (candidate) => findingSubject(candidate) === signature,
    );
    if (!finding) throw new Error(`InsightHistory invariant broken: ${signature} not present in scan ${scanIndex}`);
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
    .map((finding) => `${ReplicationLedger.signature(finding)}|${finding.id}|${finding.effect.value}`)
    .sort()
    .join("\n");
  return hash128(`${eventCount}\n${parts}`);
}

function changeBetween(previous: Finding, current: Finding): InsightChange {
  if (Math.sign(previous.effect.value) !== Math.sign(current.effect.value)) return "reversed";
  const before = Math.abs(previous.effect.value);
  const after = Math.abs(current.effect.value);
  if (after - before > EFFECT_CHANGE_EPSILON) return "strengthened";
  if (before - after > EFFECT_CHANGE_EPSILON) return "weakened";
  return "unchanged";
}

function noteForDisappearance(scan: InsightScanRecord, signature: string): string | null {
  // The signature is kind|outcome|exposure|direction; the kind is irrelevant
  // when matching a rejection, which is keyed by outcome and exposure.
  const [, outcome = "", exposure = ""] = signature.split("|");
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
