/**
 * Replication ledger.
 *
 * A finding is an observation; its replication status is how far that
 * observation has travelled towards being *established knowledge about this
 * person*. The ledger owns that progression so the status is a single
 * auditable state, not a free-form label scattered across the UI:
 *
 *   new                     — noticed once, not yet confirmed
 *   replicated              — the same association surfaced again in fresh data
 *   failed-to-replicate     — a controlled experiment did not reproduce it
 *   experimentally-supported — a controlled experiment you ran supported it
 *   contradicted            — the same relationship has since been observed pointing the other way
 *
 * Two things advance the status: a later discovery with the same "signature"
 * (same outcome, same driver, same direction) as an earlier one, and the
 * verdict of an experiment whose hypothesis was derived from the finding.
 * Nothing here changes a statistic — only the claim's standing.
 *
 * A later discovery that points the *opposite* way is not a failed
 * replication — it is contradictory evidence, owned by the contradiction
 * ledger (`contradictions.ts`), which moves every side of the pair to
 * `contradicted`.
 */

import type { ExperimentVerdict } from "../experiments/analysis.js";
import type { Finding, ReplicationStatus } from "./finding.js";

export const ANALYSIS_VERSION = "1.0.0";

export interface ReplicationRecord {
  findingId: string;
  status: ReplicationStatus;
  updatedAt: string;
  /** Human-readable reason for the current status. */
  evidence: string;
  /** First time this signature was seen. */
  firstDetected?: string;
  /** Latest time this signature was seen. */
  latestDetected?: string;
  /** Sample size at first and latest detection. */
  sampleSize?: number;
  /** Effect size at latest detection. */
  effectSize?: number;
  /** Uncertainty (CI half-width or p) at latest. */
  uncertainty?: { adjustedP?: number; ciLow?: number; ciHigh?: number };
  /** Supporting vs contradictory period counts, derived with contradiction ledger at query time. */
  replicationCount?: number;
  contradictionCount?: number;
  /** Sources contributing to the latest sighting. */
  dataSources?: string[];
  /** Analysis version that produced this record. */
  analysisVersion?: string;
  /** Lifecycle state mirror (same as replicationStatus but extended for inbox use). */
  lifecycleState?: string;
}

export class ReplicationLedger {
  private records = new Map<string, ReplicationRecord>();
  /** Signature -> first finding id that claimed it, for cross-run matching. */
  private signatures = new Map<string, string>();
  /** Signature -> all sightings' metadata for counts. */
  private sightings = new Map<string, { findingId: string; at: string; sampleSize: number; effectSize: number; sources: string[] }[]>();
  private firstDetectedAt = new Map<string, string>();

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * The signature that identifies "the same claim" regardless of how many
   * times discovery recomputes its id: the candidate kind, outcome, driver and
   * direction. Effect magnitude is deliberately absent — a replication that
   * comes back at half the size is still a replication, just a weaker one.
   *
   * The kind is part of the identity because it is what the engine actually
   * asked: "accuracy is higher in the evening" and "accuracy is higher with
   * method = practice" are different claims about the same outcome, and
   * collapsing them would let one replicate or contradict the other.
   */
  static signature(finding: Finding): string {
    const outcome = finding.metricIds[0] ?? "";
    const exposure = finding.metricIds[1] ?? "";
    const direction = Math.sign(finding.effect.value);
    // The engine always tags findings with their candidate kind first.
    const kind = finding.tags[0] ?? "unknown";
    return [kind, outcome, exposure, direction].join("|");
  }

  /**
   * Annotates findings with their status and detects replications across
   * discovery runs. Returns a new array; never mutates its input.
   */
  annotate(findings: readonly Finding[]): Finding[] {
    const at = new Date(this.now()).toISOString();
    const annotated: Finding[] = [];

    for (const finding of findings) {
      const signature = ReplicationLedger.signature(finding);
      const firstSeen = this.signatures.get(signature);
      const existing = this.records.get(finding.id);
      let status: ReplicationStatus = existing?.status ?? "new";

      // Track per-signature sightings for replication counts and diagnostics
      if (!this.firstDetectedAt.has(signature)) this.firstDetectedAt.set(signature, finding.createdAt);
      const list = this.sightings.get(signature) ?? [];
      if (!list.some((s) => s.findingId === finding.id)) {
        list.push({ findingId: finding.id, at: finding.createdAt, sampleSize: finding.sampleSize, effectSize: finding.effect.value, sources: [...finding.sources] });
        this.sightings.set(signature, list);
      }

      if (!firstSeen) {
        this.signatures.set(signature, finding.id);
        // Record the first sighting so a later replication can mark it confirmed.
        if (!existing) {
          this.records.set(finding.id, {
            findingId: finding.id,
            status: "new",
            updatedAt: at,
            evidence: "First observed",
            firstDetected: this.firstDetectedAt.get(signature),
            latestDetected: finding.createdAt,
            sampleSize: finding.sampleSize,
            effectSize: finding.effect.value,
            uncertainty: { adjustedP: finding.test?.adjustedP, ciLow: finding.effect.ci?.low, ciHigh: finding.effect.ci?.high },
            replicationCount: 0,
            contradictionCount: 0,
            dataSources: [...finding.sources],
            analysisVersion: ANALYSIS_VERSION,
            lifecycleState: "emerging",
          });
        }
      } else if (firstSeen !== finding.id && status === "new") {
        // A later discovery with a different id claims the same relationship.
        status = "replicated";
        const count = (this.sightings.get(signature)?.length ?? 1) - 1;
        this.records.set(finding.id, {
          findingId: finding.id,
          status,
          updatedAt: at,
          evidence: `Independently matches the earlier finding ${firstSeen}`,
          firstDetected: this.firstDetectedAt.get(signature),
          latestDetected: finding.createdAt,
          sampleSize: finding.sampleSize,
          effectSize: finding.effect.value,
          uncertainty: { adjustedP: finding.test?.adjustedP, ciLow: finding.effect.ci?.low, ciHigh: finding.effect.ci?.high },
          replicationCount: count,
          contradictionCount: 0,
          dataSources: [...finding.sources],
          analysisVersion: ANALYSIS_VERSION,
          lifecycleState: "replicated",
        });
        // The original is now confirmed too — until now it was unverified.
        const original = this.records.get(firstSeen);
        if (original && original.status === "new") {
          this.records.set(firstSeen, {
            ...original,
            status: "replicated",
            updatedAt: at,
            evidence: `Confirmed by the later finding ${finding.id}`,
            latestDetected: at,
            replicationCount: count,
            lifecycleState: "replicated",
          });
        }
      } else if (existing) {
        // Update latestDetected and counts even for already-tracked findings
        this.records.set(finding.id, {
          ...existing,
          latestDetected: finding.createdAt,
          sampleSize: finding.sampleSize,
          effectSize: finding.effect.value,
          uncertainty: { adjustedP: finding.test?.adjustedP, ciLow: finding.effect.ci?.low, ciHigh: finding.effect.ci?.high },
          replicationCount: Math.max(0, (this.sightings.get(signature)?.length ?? 1) - 1),
          dataSources: [...finding.sources],
        });
      }

      annotated.push({ ...finding, replicationStatus: status });
    }

    return annotated;
  }

  statusOf(findingId: string): ReplicationStatus {
    return this.records.get(findingId)?.status ?? "new";
  }

  /**
   * A completed experiment moves its origin finding to a terminal status.
   * `note` carries the retested path's paper trail (P1 #13): when the
   * experiment was a replication, the record names the original run.
   */
  recordExperimentResult(findingId: string, verdict: ExperimentVerdict, note?: string): ReplicationStatus {
    const at = new Date(this.now()).toISOString();
    const existing = this.records.get(findingId);
    const status: ReplicationStatus =
      verdict === "supported"
        ? "experimentally-supported"
        : verdict === "refuted"
          ? "failed-to-replicate"
          : this.statusOf(findingId);
    const base =
      verdict === "supported"
        ? "A controlled experiment supported the claim"
        : verdict === "refuted"
          ? "A controlled experiment failed to reproduce the effect"
          : "An experiment was run but did not settle the claim";
    const evidence = note ? `${base} (${note})` : base;
    this.records.set(findingId, {
      findingId,
      status,
      updatedAt: at,
      evidence,
      firstDetected: existing?.firstDetected ?? at,
      latestDetected: at,
      sampleSize: existing?.sampleSize,
      effectSize: existing?.effectSize,
      uncertainty: existing?.uncertainty,
      replicationCount: existing?.replicationCount ?? 0,
      contradictionCount: existing?.contradictionCount ?? 0,
      dataSources: existing?.dataSources ?? [],
      analysisVersion: ANALYSIS_VERSION,
      lifecycleState: status === "experimentally-supported" ? "experiment-candidate" : status,
    });
    return status;
  }

  /** Rich detail for a single finding — combines replication counts and timing. */
  detailFor(findingId: string): ReplicationRecord | undefined {
    return this.records.get(findingId);
  }

  /** All sightings for a signature, for supporting/contradictory period counts. */
  sightingsForSignature(signature: string): readonly { findingId: string; at: string; sampleSize: number; effectSize: number; sources: string[] }[] {
    return this.sightings.get(signature) ?? [];
  }

  list(): ReplicationRecord[] {
    return [...this.records.values()].sort(
      (a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.findingId.localeCompare(b.findingId),
    );
  }

  /** Drops every record whose finding no longer exists (e.g. after forgetSource). */
  prune(keepFindingIds: ReadonlySet<string>): void {
    for (const key of [...this.records.keys()]) {
      if (!keepFindingIds.has(key)) this.records.delete(key);
    }
    for (const [signature, findingId] of [...this.signatures]) {
      if (!keepFindingIds.has(findingId)) this.signatures.delete(signature);
    }
  }

  size(): number {
    return this.records.size;
  }
}
