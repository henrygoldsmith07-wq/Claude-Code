/**
 * Validation ledger.
 *
 * The synthetic benchmarks answer their question the day they run. The
 * claims that actually need months — do findings replicate, do directions
 * hold, does a high confidence grade survive an experiment, does acting on
 * a recommendation move the metric it named — only accumulate evidence at
 * the speed of real life.
 *
 * This ledger is where that evidence lands. It is append-only: entries are
 * facts about what happened later, never edits to what was claimed earlier.
 * Every entry kind maps to one of the standing validation questions:
 *
 *   false-positive-review    — a human reviewed a finding and judged it
 *   replication-outcome      — a signature came back (or reversed) in fresh data
 *   experiment-prediction    — predicted effect vs observed effect for one run
 *   confidence-check         — a graded finding met a settling outcome
 *   recommendation-outcome   — adherence, usefulness verdict, target movement
 *
 * `summary()` turns the entries into the rates reported in the product-trust
 * panel and the methodology review. It computes; it never upgrades a claim's
 * status by itself.
 */

import type { FeedbackVerdict } from "../recommendations/feedback.js";
import {
  calibrateGrades,
  comparePredictedToActual,
  gradesTrackOutcomes,
  type ConfidenceGrade,
  type GradeReliability,
  type PredictionAccuracy,
} from "./evaluate.js";

export interface FalsePositiveReviewEntry {
  kind: "false-positive-review";
  at: string;
  findingId: string;
  reviewerVerdict: "false-positive" | "correct" | "unclear";
  note?: string;
}

export interface ReplicationOutcomeEntry {
  kind: "replication-outcome";
  at: string;
  /** Replication-ledger signature: kind|outcome|exposure|direction. */
  signature: string;
  outcome: "replicated" | "reversed" | "neither";
}

export interface ExperimentPredictionEntry {
  kind: "experiment-prediction";
  at: string;
  designId: string;
  predictedEffect: number;
  observedEffect: number;
  verdict?: string;
}

export interface ConfidenceCheckEntry {
  kind: "confidence-check";
  at: string;
  findingId: string;
  grade: ConfidenceGrade;
  outcome: "supported" | "refuted" | "inconclusive";
}

export interface RecommendationOutcomeEntry {
  kind: "recommendation-outcome";
  at: string;
  recommendationId: string;
  /** Share of assigned days the behaviour was actually done; null when not tracked. */
  adherence: number | null;
  /** Explicit user feedback, when given. */
  usefulness: FeedbackVerdict | null;
  /** Whether the target metric moved in the recommended direction, measured after follow-through. */
  targetImproved: boolean | null;
}

export type ValidationEntry =
  | FalsePositiveReviewEntry
  | ReplicationOutcomeEntry
  | ExperimentPredictionEntry
  | ConfidenceCheckEntry
  | RecommendationOutcomeEntry;

export interface ValidationLedgerAdapter {
  load(): Promise<ValidationEntry[] | null>;
  save(entries: ValidationEntry[]): Promise<void>;
}

export interface ValidationSummary {
  falsePositives: {
    reviewed: number;
    judgedFalse: number;
    /** judgedFalse / (judgedFalse + correct); unclear reviews excluded from both. */
    rate: number;
  };
  replication: {
    tracked: number;
    replicated: number;
    reversed: number;
    rate: number;
    reversalRate: number;
  };
  predictions: PredictionAccuracy;
  confidence: { table: GradeReliability[]; tracksOutcomes: boolean | null };
  recommendations: {
    withOutcome: number;
    /** Mean adherence across entries where adherence was recorded. NaN when none. */
    meanAdherence: number;
    withFeedback: number;
    usefulShare: number;
    measuredImproved: number;
    improvedShare: number;
  };
  totalEntries: number;
  firstEntryAt: string | null;
  lastEntryAt: string | null;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? NaN : numerator / denominator;
}

export class ValidationLedger {
  private entries: ValidationEntry[] = [];
  private readonly adapter: ValidationLedgerAdapter | null;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(adapter?: ValidationLedgerAdapter) {
    this.adapter = adapter ?? null;
  }

  async load(): Promise<void> {
    if (!this.adapter) return;
    const loaded = await this.adapter.load();
    if (!loaded || !Array.isArray(loaded)) return;
    this.entries = [...loaded];
  }

  append(entry: ValidationEntry): ValidationEntry {
    this.entries.push(entry);
    this.persistSoon();
    return entry;
  }

  list(): ValidationEntry[] {
    return [...this.entries];
  }

  /**
   * Findings can be deleted (forgetSource); their review entries stop
   * counting the moment the finding is gone. Entries are filtered, never
   * rewritten — the ledger stays append-only even when it prunes.
   */
  pruneByFindingIds(keepFindingIds: ReadonlySet<string>): void {
    this.entries = this.entries.filter((entry) => {
      if (entry.kind === "false-positive-review") return keepFindingIds.has(entry.findingId);
      if (entry.kind === "confidence-check") return keepFindingIds.has(entry.findingId);
      return true;
    });
    this.persistSoon();
  }

  summary(): ValidationSummary {
    const reviews = this.entries.filter((entry): entry is FalsePositiveReviewEntry => entry.kind === "false-positive-review");
    const settledReviews = reviews.filter((entry) => entry.reviewerVerdict !== "unclear");
    const judgedFalse = settledReviews.filter((entry) => entry.reviewerVerdict === "false-positive").length;

    const replications = this.entries.filter((entry): entry is ReplicationOutcomeEntry => entry.kind === "replication-outcome");
    const replicated = replications.filter((entry) => entry.outcome === "replicated").length;
    const reversed = replications.filter((entry) => entry.outcome === "reversed").length;

    const predictions = comparePredictedToActual(
      this.entries
        .filter((entry): entry is ExperimentPredictionEntry => entry.kind === "experiment-prediction")
        .map((entry) => ({ predictedEffect: entry.predictedEffect, observedEffect: entry.observedEffect })),
    );

    const confidenceChecks = this.entries.filter((entry): entry is ConfidenceCheckEntry => entry.kind === "confidence-check");
    const table = calibrateGrades(confidenceChecks);
    const anySettled = table.some((row) => !Number.isNaN(row.supportRate));

    const recommendationOutcomes = this.entries.filter(
      (entry): entry is RecommendationOutcomeEntry => entry.kind === "recommendation-outcome",
    );
    const adherenceValues = recommendationOutcomes
      .map((entry) => entry.adherence)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const withFeedback = recommendationOutcomes.filter((entry) => entry.usefulness !== null);
    const useful = withFeedback.filter((entry) => entry.usefulness === "useful" || entry.usefulness === "acted-on");
    const measured = recommendationOutcomes.filter((entry) => entry.targetImproved !== null);
    const improved = measured.filter((entry) => entry.targetImproved === true);

    const timestamps = this.entries.map((entry) => entry.at).sort();

    return {
      falsePositives: {
        reviewed: reviews.length,
        judgedFalse,
        rate: rate(judgedFalse, settledReviews.length),
      },
      replication: {
        tracked: replications.length,
        replicated,
        reversed,
        rate: rate(replicated, replications.length),
        reversalRate: rate(reversed, replications.length),
      },
      predictions,
      confidence: { table, tracksOutcomes: anySettled ? gradesTrackOutcomes(table) : null },
      recommendations: {
        withOutcome: recommendationOutcomes.length,
        meanAdherence: adherenceValues.length
          ? adherenceValues.reduce((acc, value) => acc + value, 0) / adherenceValues.length
          : NaN,
        withFeedback: withFeedback.length,
        usefulShare: rate(useful.length, withFeedback.length),
        measuredImproved: measured.length,
        improvedShare: rate(improved.length, measured.length),
      },
      totalEntries: this.entries.length,
      firstEntryAt: timestamps[0] ?? null,
      lastEntryAt: timestamps[timestamps.length - 1] ?? null,
    };
  }

  toSnapshot(): ValidationEntry[] {
    return this.list();
  }

  static fromSnapshot(snapshot: readonly ValidationEntry[], adapter?: ValidationLedgerAdapter): ValidationLedger {
    const ledger = new ValidationLedger(adapter);
    ledger.entries = [...snapshot];
    return ledger;
  }

  private persistSoon(): void {
    if (!this.adapter) return;
    this.persistQueue = this.persistQueue
      .then(() => this.adapter!.save(this.toSnapshot()))
      .catch((error: unknown) => {
        console.error("Pulse: failed to persist validation ledger", error);
      });
  }
}

export function createMemoryValidationAdapter(): ValidationLedgerAdapter {
  let snapshot: ValidationEntry[] | null = null;
  return {
    async load(): Promise<ValidationEntry[] | null> {
      return snapshot ? [...snapshot] : null;
    },
    async save(entries: ValidationEntry[]): Promise<void> {
      snapshot = [...entries];
    },
  };
}
