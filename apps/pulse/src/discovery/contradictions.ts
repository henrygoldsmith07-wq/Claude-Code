/**
 * Contradiction ledger.
 *
 * The replication ledger answers "has this claim been seen again?"; this
 * ledger answers the harder question: "has the same claim been seen pointing
 * *both* ways?".
 *
 * The replication signature deliberately includes direction, which means a
 * later discovery with the opposite sign is not a failed replication — it is
 * a *contradiction*, a more serious event. A replicated claim is stronger; a
 * contradicted claim is suspect, whichever side it was on. This ledger owns
 * that event so the two claims are never presented to the user as if they
 * were independent.
 *
 * When the same outcome-exposure pair is observed in opposing directions:
 *   - every finding on either side is marked `contradicted`, overriding any
 *     replication status it had;
 *   - the pair is recorded in one auditable record carrying every sighting;
 *   - each affected finding carries a note naming the conflicting sighting.
 */

import { hash128 } from "../events/hash.js";
import type { Finding, ReplicationStatus } from "./finding.js";

export interface ContradictionSighting {
  findingId: string;
  /** Sign of the claimed standardised effect: +1, -1 or 0. */
  direction: number;
  createdAt: string;
}

export interface ContradictionRecord {
  id: string;
  outcomeMetricId: string;
  exposureMetricId: string;
  /** Chronological sightings of this pair, including the first. */
  sightings: ContradictionSighting[];
  /** When the conflict was first detected. */
  detectedAt: string;
  /** Human-readable account of the conflict. */
  evidence: string;
}

export class ContradictionLedger {
  private sightingsBySubject = new Map<string, ContradictionSighting[]>();
  private findingSubjects = new Map<string, string>();
  private records = new Map<string, ContradictionRecord>();

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * The identity of "the same relationship" for contradiction purposes:
   * outcome and exposure, with direction deliberately absent. The replication
   * signature includes direction; this one must not, or an opposing sighting
   * would look like a different claim.
   */
  static subject(finding: Finding): string {
    return [finding.metricIds[0] ?? "", finding.metricIds[1] ?? ""].join("|");
  }

  /**
   * Annotates findings with their contradiction status and maintains the
   * per-pair records. Returns a new array; never mutates its input.
   */
  annotate(findings: readonly Finding[]): Finding[] {
    const at = new Date(this.now()).toISOString();

    // Pass 1 — register every sighting in the order the claims were made, so
    // the first sighting establishes the pair's direction. Registration is
    // idempotent per finding, so re-annotating the same batch is safe.
    const ordered = [...findings].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    for (const finding of ordered) {
      const direction = Math.sign(finding.effect.value);
      if (!Number.isFinite(finding.effect.value) || direction === 0) continue;

      const subject = ContradictionLedger.subject(finding);
      const sightings = this.sightingsBySubject.get(subject) ?? [];
      if (!sightings.some((s) => s.findingId === finding.id)) {
        sightings.push({ findingId: finding.id, direction, createdAt: finding.createdAt });
        this.sightingsBySubject.set(subject, sightings);
        this.findingSubjects.set(finding.id, subject);
      }
      if (hasConflict(sightings)) this.refreshRecord(subject, sightings, at);
    }

    // Pass 2 — a finding is contradicted exactly when the same pair has been
    // observed pointing the other way, whether the opposing sighting came
    // before it or after it.
    return findings.map((finding) => {
      const direction = Math.sign(finding.effect.value);
      if (!Number.isFinite(finding.effect.value) || direction === 0) return finding;
      const subject = ContradictionLedger.subject(finding);
      const sightings = this.sightingsBySubject.get(subject) ?? [];
      const opponent = sightings.find((s) => s.findingId !== finding.id && s.direction === -direction);
      if (!opponent) return finding;
      return {
        ...finding,
        replicationStatus: "contradicted" as const,
        contradictionNote: `The same relationship has also been observed pointing the opposite direction (${opponent.findingId}).`,
      };
    });
  }

  statusOf(findingId: string): ReplicationStatus {
    const subject = this.findingSubjects.get(findingId);
    if (!subject) return "new";
    const sightings = this.sightingsBySubject.get(subject) ?? [];
    const mine = sightings.find((s) => s.findingId === findingId);
    if (!mine || mine.direction === 0) return "new";
    return sightings.some((s) => s.direction === -mine.direction) ? "contradicted" : "new";
  }

  list(): ContradictionRecord[] {
    return [...this.records.values()].sort(
      (a, b) => a.detectedAt.localeCompare(b.detectedAt) || a.id.localeCompare(b.id),
    );
  }

  size(): number {
    return this.records.size;
  }

  /** Drops every record whose findings no longer exist (e.g. after forgetSource). */
  prune(keepFindingIds: ReadonlySet<string>): void {
    for (const [subject, sightings] of [...this.sightingsBySubject]) {
      const kept = sightings.filter((s) => keepFindingIds.has(s.findingId));
      if (kept.length === 0) this.sightingsBySubject.delete(subject);
      else this.sightingsBySubject.set(subject, kept);
    }
    for (const findingId of [...this.findingSubjects.keys()]) {
      if (!keepFindingIds.has(findingId)) this.findingSubjects.delete(findingId);
    }
    for (const [id, record] of [...this.records]) {
      const kept = record.sightings.filter((s) => keepFindingIds.has(s.findingId));
      // With one side gone the conflict may no longer exist.
      if (kept.length === 0 || !hasConflict(kept)) this.records.delete(id);
      else this.records.set(id, { ...record, sightings: kept });
    }
  }

  private refreshRecord(subject: string, sightings: ContradictionSighting[], at: string): void {
    const id = `contradiction-${hash128(subject).slice(0, 16)}`;
    const existing = this.records.get(id);
    const [outcome, exposure] = subject.split("|");
    this.records.set(id, {
      id,
      outcomeMetricId: outcome ?? "",
      exposureMetricId: exposure ?? "",
      sightings: [...sightings],
      detectedAt: existing?.detectedAt ?? at,
      evidence: describeConflict(sightings),
    });
  }
}

function hasConflict(sightings: readonly ContradictionSighting[]): boolean {
  return new Set(sightings.map((s) => s.direction)).size >= 2;
}

function describeConflict(sightings: readonly ContradictionSighting[]): string {
  const first = sightings[0]!;
  const reads = sightings.map((s) => `${s.findingId} (${s.direction > 0 ? "positive" : "negative"})`);
  return `First seen ${first.direction > 0 ? "positive" : "negative"} (${first.findingId}); the same outcome-exposure pair has since been observed pointing both ways across ${sightings.length} sightings: ${reads.join(", ")}.`;
}
