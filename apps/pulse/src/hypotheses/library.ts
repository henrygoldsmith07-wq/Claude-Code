/**
 * Personal causal hypothesis library.
 *
 * Pulse's findings answer "what is true?" and its experiments answer "what
 * is causal?" — but neither is the user's own record of what they believe.
 * This library is that record: beliefs the user holds (or has decided to
 * track) about what changes what, with the evidence — findings and
 * experiment verdicts — gathered underneath each one.
 *
 * An entry's standing is evidence-driven but user-overridable:
 *   untested → plausible (a supporting correlation) → strengthening (a
 *   replicated correlation) → confirmed / refuted (a controlled experiment).
 * `contested` is the ledger's word: a pair observed pointing both ways
 * withdraws the belief until a controlled experiment settles it. Only
 * `retired` is sticky: once the user shelves a belief, new evidence is
 * recorded but cannot resurrect it.
 *
 * Durable by design, exactly like the insight history and the event store:
 * entries are written through an optional adapter so the library survives
 * restarts. Without an adapter it still works — it just lives for the
 * lifetime of the process.
 */

import { hash128 } from "../events/hash.js";
import type { Finding, ReplicationStatus } from "../discovery/finding.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { Hypothesis } from "./tracker.js";

export type CausalStanding =
  | "untested"
  | "plausible"
  | "strengthening"
  | "confirmed"
  | "refuted"
  | "contested"
  | "retired";

export type CausalDirection = "increase" | "decrease";

export interface CausalLibraryEvidence {
  id: string;
  kind: "finding" | "experiment";
  at: string;
  title: string;
  /** true = supports the belief, false = contradicts it, null = inconclusive. */
  supports: boolean | null;
  /** |effect| in standard deviations. */
  strength: number;
  confidence: number;
  /** The finding's replication standing when it was recorded. */
  replicationStatus?: ReplicationStatus;
}

export interface CausalStandingChange {
  standing: CausalStanding;
  at: string;
  note: string;
}

export interface CausalLibraryEntry {
  id: string;
  /** The belief, in the user's words. Engine-derived wording is a starting point. */
  statement: string;
  /** Human label of the cause, e.g. "evening sessions". */
  cause: string;
  /** Human label of the effect, e.g. "recall grade". */
  effect: string;
  direction: CausalDirection;
  /** Metric identity, used to match experiment verdicts to the belief. */
  outcomeMetricId: string | null;
  exposureMetricId: string | null;
  /** Whether the user typed it or Pulse derived it from a finding. */
  origin: "user" | "engine";
  /** The engine hypothesis this belief is tracked against, when linked. */
  hypothesisId: string | null;
  createdAt: string;
  updatedAt: string;
  standing: CausalStanding;
  /** Why the entry sits at that standing — shown with the entry. */
  standingNote: string;
  standingHistory: CausalStandingChange[];
  evidence: CausalLibraryEvidence[];
  notes: string;
  tags: string[];
}

export interface CausalLibrarySnapshot {
  version: 1;
  entries: CausalLibraryEntry[];
}

/** Pluggable persistence, mirroring the event store and insight history. */
export interface CausalLibraryAdapter {
  load(): Promise<CausalLibrarySnapshot | null>;
  save(snapshot: CausalLibrarySnapshot): Promise<void>;
}

export interface AddBeliefInput {
  statement: string;
  cause: string;
  effect: string;
  direction: CausalDirection;
  notes?: string;
  tags?: readonly string[];
  origin?: "user" | "engine";
  outcomeMetricId?: string | null;
  exposureMetricId?: string | null;
}

const LIBRARY_VERSION = 1 as const;

export class CausalHypothesisLibrary {
  private entries = new Map<string, CausalLibraryEntry>();
  private readonly adapter: CausalLibraryAdapter | null;

  constructor(adapter?: CausalLibraryAdapter, private readonly now: () => number = Date.now) {
    this.adapter = adapter ?? null;
  }

  async load(): Promise<void> {
    if (!this.adapter) return;
    const snapshot = await this.adapter.load();
    if (snapshot && snapshot.version === LIBRARY_VERSION && Array.isArray(snapshot.entries)) {
      this.entries = new Map(snapshot.entries.map((entry) => [entry.id, entry]));
    }
  }

  async persist(): Promise<void> {
    if (!this.adapter) return;
    await this.adapter.save(this.snapshot());
  }

  /** A belief the user holds, with no evidence yet. */
  add(input: AddBeliefInput): CausalLibraryEntry {
    const at = new Date(this.now()).toISOString();
    const id = `lib-${hash128(`${input.statement}\n${input.cause}\n${input.effect}\n${input.direction}`).slice(0, 12)}`;
    const entry: CausalLibraryEntry = {
      id,
      statement: input.statement,
      cause: input.cause,
      effect: input.effect,
      direction: input.direction,
      outcomeMetricId: input.outcomeMetricId ?? null,
      exposureMetricId: input.exposureMetricId ?? null,
      origin: input.origin ?? "user",
      hypothesisId: null,
      createdAt: at,
      updatedAt: at,
      standing: "untested",
      standingNote: "Added to the library",
      standingHistory: [{ standing: "untested", at, note: "Added to the library" }],
      evidence: [],
      notes: input.notes ?? "",
      tags: [...(input.tags ?? [])],
    };
    this.entries.set(id, entry);
    return entry;
  }

  /**
   * Lifts a finding into the library as the first evidence of a belief.
   * A finding already cited by some entry is a no-op, so re-scans and
   * reloads can never duplicate a promotion.
   */
  addFromFinding(finding: Finding): CausalLibraryEntry | null {
    if ([...this.entries.values()].some((entry) => entry.evidence.some((evidence) => evidence.id === finding.id))) {
      return null;
    }
    const parsed = parseFindingTitle(finding.title);
    const direction: CausalDirection = finding.effect.value >= 0 ? "increase" : "decrease";
    const standing: CausalStanding =
      finding.replicationStatus === "replicated" || finding.replicationStatus === "experimentally-supported"
        ? "strengthening"
        : "plausible";
    const at = finding.createdAt;
    const entry: CausalLibraryEntry = {
      id: `lib-${hash128(`${finding.id}:${finding.title}`).slice(0, 12)}`,
      statement: `${capitalise(parsed.cause)} ${direction === "increase" ? "raise" : "lower"} ${parsed.effect}.`,
      cause: parsed.cause,
      effect: parsed.effect,
      direction,
      outcomeMetricId: finding.metricIds[0] ?? null,
      exposureMetricId: finding.metricIds[1] ?? null,
      origin: "engine",
      hypothesisId: null,
      createdAt: at,
      updatedAt: at,
      standing,
      standingNote: standingNoteFor(standing),
      standingHistory: [{ standing, at, note: `Derived from finding "${finding.title}"` }],
      evidence: [
        {
          id: finding.id,
          kind: "finding",
          at,
          title: finding.title,
          supports: true,
          strength: Math.abs(finding.effect.value),
          confidence: finding.confidence.score,
          ...(finding.replicationStatus ? { replicationStatus: finding.replicationStatus } : {}),
        },
      ],
      notes: "",
      tags: [...finding.tags],
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  get(id: string): CausalLibraryEntry | undefined {
    return this.entries.get(id);
  }

  /** Most recently touched first — the library reads as a working record. */
  list(): CausalLibraryEntry[] {
    return [...this.entries.values()].sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    );
  }

  size(): number {
    return this.entries.size;
  }

  /** Edits the user-editable fields; the belief's identity and evidence stay put. */
  update(
    id: string,
    patch: Partial<Pick<CausalLibraryEntry, "statement" | "cause" | "effect" | "direction" | "notes" | "tags">>,
  ): CausalLibraryEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (patch.statement !== undefined) entry.statement = patch.statement;
    if (patch.cause !== undefined) entry.cause = patch.cause;
    if (patch.effect !== undefined) entry.effect = patch.effect;
    if (patch.direction !== undefined) entry.direction = patch.direction;
    if (patch.notes !== undefined) entry.notes = patch.notes;
    if (patch.tags !== undefined) entry.tags = [...patch.tags];
    entry.updatedAt = new Date(this.now()).toISOString();
    return entry;
  }

  /** The user's verdict on their own belief, recorded with its reason. */
  setStanding(id: string, standing: CausalStanding, note: string): CausalLibraryEntry {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`Unknown library entry: ${id}`);
    this.applyStanding(entry, standing, note);
    return entry;
  }

  /**
   * Records one piece of evidence under a belief and re-derives the standing.
   * Evidence with the same id is recorded once, however many scans mention it.
   */
  addEvidence(id: string, evidence: CausalLibraryEvidence): CausalLibraryEntry | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    if (!entry.evidence.some((existing) => existing.id === evidence.id)) {
      entry.evidence.push({ ...evidence });
      entry.updatedAt = evidence.at;
    }
    this.recomputeStanding(entry);
    return entry;
  }

  /**
   * Files an analysed experiment against the belief it tested. Matching is
   * by the linked hypothesis first, then by the (outcome, exposure,
   * direction) triple — which is how a promoted finding's belief finds the
   * experiment its hypothesis later ran. Verdicts that mean something move
   * the standing; an inconclusive or invalid run is recorded but changes
   * nothing.
   */
  recordExperimentResult(result: ExperimentResult, hypothesis: Hypothesis | null): void {
    const entry = this.matchEntry(result, hypothesis);
    if (!entry) return;
    const supports: boolean | null =
      result.verdict === "supported" ? true : result.verdict === "refuted" ? false : null;
    const evidence: CausalLibraryEvidence = {
      id: result.experimentId,
      kind: "experiment",
      at: result.analysedAt,
      title: result.summary,
      supports,
      strength: Math.abs(result.observedEffect),
      confidence: result.confidence.score,
    };
    if (!entry.evidence.some((existing) => existing.id === evidence.id)) {
      entry.evidence.push(evidence);
      entry.updatedAt = evidence.at;
    }
    if (hypothesis && !entry.hypothesisId) entry.hypothesisId = hypothesis.id;
    this.recomputeStanding(entry);
  }

  /** Removes a belief from the library entirely. */
  remove(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Re-bases standings against the contradiction ledger — the single source
   * of "this outcome-exposure pair has been seen pointing both ways".
   *
   * A pair in the ledger withdraws the belief: its standing becomes
   * `contested` and stays there for as long as the conflict persists. A
   * decisive experiment overrides the withdrawal (a controlled test is the
   * one tool that settles a conflicted pair, exactly as with hypotheses),
   * and a retired belief stays retired. When the conflict leaves the
   * ledger, the standing is re-derived from the recorded evidence.
   */
  reconcileContradictions(contradictedSubjects: ReadonlySet<string>): void {
    for (const entry of this.entries.values()) {
      if (entry.standing === "retired") continue;
      const subject = `${entry.outcomeMetricId ?? ""}|${entry.exposureMetricId ?? ""}`;
      const inConflict = contradictedSubjects.has(subject);
      const decisive = entry.evidence.some(
        (evidence) => evidence.kind === "experiment" && evidence.supports !== null,
      );
      if (inConflict && !decisive) {
        this.applyStanding(
          entry,
          "contested",
          "Withdrawn: this outcome-exposure pair has been observed pointing both ways (contradiction ledger)",
        );
      } else if (!inConflict && entry.standing === "contested" && !decisive) {
        this.recomputeStanding(entry);
      }
    }
  }

  /**
   * Privacy primitive. Drops finding evidence invalidated by a source
   * deletion, unlinks a hypothesis invalidated with it, and re-bases an
   * entry whose evidence was all deleted back to `untested` — a belief
   * without evidence is a belief, not a claim.
   */
  pruneEvidence(findingIds: Set<string>, hypothesisIds: Set<string>): number {
    let pruned = 0;
    for (const entry of this.entries.values()) {
      const before = entry.evidence.length;
      entry.evidence = entry.evidence.filter((evidence) => !(evidence.kind === "finding" && findingIds.has(evidence.id)));
      pruned += before - entry.evidence.length;
      if (entry.hypothesisId && hypothesisIds.has(entry.hypothesisId)) entry.hypothesisId = null;
      if (entry.evidence.length === 0 && (entry.standing === "plausible" || entry.standing === "strengthening")) {
        this.applyStanding(entry, "untested", "All evidence was deleted with its source.");
      }
    }
    return pruned;
  }

  snapshot(): CausalLibrarySnapshot {
    return {
      version: LIBRARY_VERSION,
      entries: this.list().map((entry) => ({
        ...entry,
        evidence: [...entry.evidence],
        standingHistory: [...entry.standingHistory],
        tags: [...entry.tags],
      })),
    };
  }

  private matchEntry(result: ExperimentResult, hypothesis: Hypothesis | null): CausalLibraryEntry | undefined {
    if (hypothesis) {
      const linked = [...this.entries.values()].find((entry) => entry.hypothesisId === result.hypothesisId);
      if (linked) return linked;
    }
    if (!hypothesis) return undefined;
    return [...this.entries.values()].find(
      (entry) =>
        entry.outcomeMetricId === hypothesis.outcomeMetricId &&
        (entry.exposureMetricId ?? null) === (hypothesis.exposureMetricId ?? null) &&
        entry.direction === hypothesis.predictedDirection,
    );
  }

  /**
   * The standing machine. A decisive experiment verdict always wins; short
   * of that, findings can only move a belief up from untested or plausible,
   * never down from confirmed or refuted; and a retired belief stays retired
   * however much new evidence arrives.
   */
  private recomputeStanding(entry: CausalLibraryEntry): void {
    if (entry.standing === "retired") return;

    const decisive = entry.evidence
      .filter((evidence) => evidence.kind === "experiment" && evidence.supports !== null)
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1);
    if (decisive) {
      this.applyStanding(
        entry,
        decisive.supports ? "confirmed" : "refuted",
        decisive.supports
          ? "Supported by a controlled experiment"
          : "Contradicted by a controlled experiment",
      );
      return;
    }
    if (entry.standing === "confirmed" || entry.standing === "refuted") return;

    const replicated = entry.evidence.some(
      (evidence) =>
        evidence.kind === "finding" &&
        evidence.supports === true &&
        (evidence.replicationStatus === "replicated" || evidence.replicationStatus === "experimentally-supported"),
    );
    if (replicated) {
      this.applyStanding(entry, "strengthening", "A replicated finding supports this belief");
      return;
    }
    if (entry.evidence.some((evidence) => evidence.kind === "finding")) {
      this.applyStanding(entry, "plausible", "Correlational evidence bears on this belief");
      return;
    }
    if (entry.standing === "untested") return;
    this.applyStanding(entry, "untested", "No evidence bears on this belief yet");
  }

  private applyStanding(entry: CausalLibraryEntry, standing: CausalStanding, note: string): void {
    if (entry.standing === standing) return;
    const at = new Date(this.now()).toISOString();
    entry.standingHistory.push({ standing, at, note });
    entry.standing = standing;
    entry.standingNote = note;
    entry.updatedAt = at;
  }
}

/** "Question accuracy is higher within 4h of training" → cause + effect. */
function parseFindingTitle(title: string): { cause: string; effect: string } {
  const match = /^(.+?) is (higher|lower) (.+)$/.exec(title);
  if (match) return { effect: match[1]!.toLowerCase(), cause: match[3]!.toLowerCase() };
  return { cause: "a change in your behaviour", effect: title.toLowerCase() };
}

function capitalise(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function standingNoteFor(standing: CausalStanding): string {
  switch (standing) {
    case "plausible":
      return "A correlational finding bears on this belief";
    case "strengthening":
      return "Replicated correlational evidence supports this belief";
    default:
      return "Added to the library";
  }
}

/** In-memory adapter, used by tests — mirrors the other stores' adapters. */
export function createMemoryCausalLibraryAdapter(): CausalLibraryAdapter {
  let snapshot: CausalLibrarySnapshot | null = null;
  return {
    async load() {
      return snapshot;
    },
    async save(next) {
      snapshot = next;
    },
  };
}
