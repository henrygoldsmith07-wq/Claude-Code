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

export interface ReplicationRecord {
  findingId: string;
  status: ReplicationStatus;
  updatedAt: string;
  /** Human-readable reason for the current status. */
  evidence: string;
}

export class ReplicationLedger {
  private records = new Map<string, ReplicationRecord>();
  /** Signature -> first finding id that claimed it, for cross-run matching. */
  private signatures = new Map<string, string>();

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

      if (!firstSeen) {
        this.signatures.set(signature, finding.id);
        // Record the first sighting so a later replication can mark it confirmed.
        if (!existing) {
          this.records.set(finding.id, {
            findingId: finding.id,
            status: "new",
            updatedAt: at,
            evidence: "First observed",
          });
        }
      } else if (firstSeen !== finding.id && status === "new") {
        // A later discovery with a different id claims the same relationship.
        status = "replicated";
        this.records.set(finding.id, {
          findingId: finding.id,
          status,
          updatedAt: at,
          evidence: `Independently matches the earlier finding ${firstSeen}`,
        });
        // The original is now confirmed too — until now it was unverified.
        const original = this.records.get(firstSeen);
        if (original && original.status === "new") {
          this.records.set(firstSeen, {
            ...original,
            status: "replicated",
            updatedAt: at,
            evidence: `Confirmed by the later finding ${finding.id}`,
          });
        }
      }

      annotated.push({ ...finding, replicationStatus: status });
    }

    return annotated;
  }

  statusOf(findingId: string): ReplicationStatus {
    return this.records.get(findingId)?.status ?? "new";
  }

  /** A completed experiment moves its origin finding to a terminal status. */
  recordExperimentResult(findingId: string, verdict: ExperimentVerdict): ReplicationStatus {
    const at = new Date(this.now()).toISOString();
    const status: ReplicationStatus =
      verdict === "supported"
        ? "experimentally-supported"
        : verdict === "refuted"
          ? "failed-to-replicate"
          : this.statusOf(findingId);
    const evidence =
      verdict === "supported"
        ? "A controlled experiment supported the claim"
        : verdict === "refuted"
          ? "A controlled experiment failed to reproduce the effect"
          : "An experiment was run but did not settle the claim";
    this.records.set(findingId, { findingId, status, updatedAt: at, evidence });
    return status;
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
