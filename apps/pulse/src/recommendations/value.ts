/**
 * Recommendation value and outcome ledger.
 *
 * A recommendation is only valuable if it changes something. This tracker
 * keeps the recommendation as it was shown, the user's response, whether the
 * action was followed, and the later outcome evidence. The ledger is separate
 * from ranking so an outcome can change what Pulse says next without changing
 * the underlying finding or experiment statistic.
 */

import type { SourceId } from "../events/schema.js";
import type { Recommendation } from "./rank.js";

export type RecommendationStage = "recommended" | "accepted" | "followed" | "measured";

export type RecommendationResponse =
  | "try-this"
  | "already-doing-this"
  | "not-today"
  | "not-useful"
  | "dont-suggest-again";

export interface RecommendationResponseRecord {
  response: RecommendationResponse;
  at: string;
  note: string | null;
}

export interface RecommendationOutcomeRecord {
  helped: boolean;
  at: string;
  note: string | null;
}

/** Later evidence can be attached without pretending it is a new finding. */
export interface RecommendationEvidenceUpdate {
  recordedAt: string;
  description: string;
  metricIds: string[];
  sources: SourceId[];
  eventCount: number;
  dateRange: { from: string; to: string } | null;
}

export interface RecommendationOutcomeRecord {
  helped: boolean;
  at: string;
  note: string | null;
  /** Optional evaluation window for this outcome observation. */
  window?: { from: string; to: string } | null;
  /** Uncertainty of the outcome (user-reported confidence or measurement noise). */
  uncertainty?: string | null;
}

export interface RecommendationValue {
  recommendationId: string;
  /** The exact recommendation snapshot first shown to the user. */
  recommendation: Recommendation | null;
  /** Finding ids that support this recommendation (for traceability). */
  discoveryIds: string[];
  /** Expected outcome at issue time, e.g. "increase accuracy by ~0.4 SD". */
  expectedOutcome: string | null;
  /** Confidence at issue time. */
  confidenceAtIssue: { level: string; score: number } | null;
  /** When issued. */
  issuedAt: string;
  /** Adherence 0..1 when measured. */
  adherence: number | null;
  /** Evaluation window for measuring outcome. */
  evaluationWindow: { from: string; to: string } | null;
  /** Observed outcome description. */
  observedOutcome: string | null;
  /** Outcome uncertainty label. */
  outcomeUncertainty: string | null;
  /** Whether later evidence strengthened/weakened the claim. */
  evidenceDelta: "strengthened" | "weakened" | "unchanged" | null;
  stage: RecommendationStage;
  /** Latest reported outcome, retained for compatibility and quick display. */
  outcome: "helped" | "did-not-help" | null;
  /** Latest response, retained alongside the full response history. */
  response: RecommendationResponse | null;
  recommendedAt: string;
  acceptedAt: string | null;
  followedAt: string | null;
  measuredAt: string | null;
  respondedAt: string | null;
  responseHistory: RecommendationResponseRecord[];
  outcomeHistory: RecommendationOutcomeRecord[];
  laterEvidence: RecommendationEvidenceUpdate[];
}

export interface RecommendationValueSnapshot {
  version: 1;
  values: RecommendationValue[];
}

export interface RecommendationValueAdapter {
  load(): Promise<RecommendationValueSnapshot | null>;
  save(snapshot: RecommendationValueSnapshot): Promise<void>;
}

export interface RecommendationLearning {
  /** Small, bounded adjustment to the relevance of future suggestions. */
  relevanceMultiplier: number;
  /** Mixed outcomes reduce confidence; consistent outcomes do not rewrite it. */
  confidenceMultiplier: number;
  contradictory: boolean;
}

const SNAPSHOT_VERSION = 1 as const;
const STAGE_ORDER: Record<RecommendationStage, number> = {
  recommended: 0,
  accepted: 1,
  followed: 2,
  measured: 3,
};

const RESPONSE_WEIGHT: Record<RecommendationResponse, number> = {
  "try-this": 0.04,
  "already-doing-this": 0.06,
  "not-today": 0,
  "not-useful": -0.18,
  "dont-suggest-again": -0.25,
};

export class RecommendationValueTracker {
  private values = new Map<string, RecommendationValue>();
  private changeRevision = 0;
  private loaded = false;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly adapter: RecommendationValueAdapter | null = null,
  ) {}

  async load(): Promise<void> {
    if (this.loaded || !this.adapter) {
      this.loaded = true;
      return;
    }
    const snapshot = await this.adapter.load();
    if (snapshot?.version === SNAPSHOT_VERSION && Array.isArray(snapshot.values)) {
      this.values = new Map(snapshot.values.map((value) => [value.recommendationId, normaliseValue(value)]));
    }
    this.loaded = true;
  }

  async persist(): Promise<void> {
    if (this.adapter) await this.adapter.save(this.toSnapshot());
  }

  get revision(): number {
    return this.changeRevision;
  }

  recommended(id: string, recommendation?: Recommendation): RecommendationValue {
    const value = this.ensure(id, recommendation);
    if (recommendation && value.recommendation === null) {
      value.recommendation = cloneRecommendation(recommendation);
      this.changed();
    }
    return value;
  }

  accepted(id: string): RecommendationValue {
    return this.advance(id, "accepted");
  }

  followed(id: string): RecommendationValue {
    return this.advance(id, "followed");
  }

  respond(
    id: string,
    response: RecommendationResponse,
    recommendation?: Recommendation,
    note?: string,
  ): RecommendationValue {
    const value = this.ensure(id, recommendation);
    const at = new Date(this.now()).toISOString();
    value.response = response;
    value.respondedAt = at;
    value.responseHistory.push({ response, at, note: note ?? null });
    if (response === "try-this") this.advanceInPlace(value, "accepted", at);
    if (response === "already-doing-this") this.advanceInPlace(value, "followed", at);
    this.changed();
    return value;
  }

  recordOutcome(
    id: string,
    helped: boolean,
    note?: string,
    options: {
      window?: { from: string; to: string } | null;
      uncertainty?: string | null;
      adherence?: number | null;
      observedOutcome?: string | null;
    } = {},
  ): RecommendationValue {
    const value = this.ensure(id);
    const at = new Date(this.now()).toISOString();
    value.outcome = helped ? "helped" : "did-not-help";
    value.measuredAt = value.measuredAt ?? at;
    value.observedOutcome = options.observedOutcome ?? (helped ? "helped" : "did-not-help");
    value.outcomeUncertainty = options.uncertainty ?? null;
    if (options.window !== undefined) value.evaluationWindow = options.window;
    if (options.adherence !== undefined && options.adherence !== null) value.adherence = options.adherence;
    // Determine evidence delta based on history: helped strengthens, mixed weakens
    const helpedCount = value.outcomeHistory.filter((o) => o.helped).length + (helped ? 1 : 0);
    const notHelpedCount = value.outcomeHistory.filter((o) => !o.helped).length + (helped ? 0 : 1);
    if (helpedCount > 0 && notHelpedCount > 0) value.evidenceDelta = "weakened";
    else if (helpedCount > 1 || notHelpedCount > 1) value.evidenceDelta = helped ? "strengthened" : "weakened";
    else if (helped) value.evidenceDelta = "strengthened";
    else value.evidenceDelta = "weakened";
    value.outcomeHistory.push({ helped, at, note: note ?? null, window: options.window ?? null, uncertainty: options.uncertainty ?? null });
    this.advanceInPlace(value, "measured", at);
    this.changed();
    return value;
  }

  recordEvidence(
    id: string,
    evidence: Omit<RecommendationEvidenceUpdate, "recordedAt">,
  ): RecommendationValue {
    const value = this.ensure(id);
    value.laterEvidence.push({ ...evidence, recordedAt: new Date(this.now()).toISOString() });
    this.changed();
    return value;
  }

  valueOf(id: string): RecommendationValue | undefined {
    const value = this.values.get(id);
    return value ? cloneValue(value) : undefined;
  }

  list(): RecommendationValue[] {
    return [...this.values.values()]
      .sort((a, b) => a.recommendedAt.localeCompare(b.recommendedAt))
      .map(cloneValue);
  }

  isSuppressed(id: string): boolean {
    return this.values.get(id)?.response === "dont-suggest-again";
  }

  isDeferred(id: string, today: string): boolean {
    const value = this.values.get(id);
    return value?.response === "not-today" && value.respondedAt?.slice(0, 10) === today;
  }

  /**
   * Learns from outcomes with a four-observation neutral prior. A single
   * anecdote can move relevance a little, but repeated outcomes are needed
   * before the ranking meaningfully changes. Mixed outcomes lower confidence.
   */
  learningFor(id: string, metricIds: readonly string[]): RecommendationLearning | null {
    const relevant = [...this.values.values()].filter((value) => {
      if (value.recommendationId === id) return true;
      return value.recommendation?.metricIds.some((metricId) => metricIds.includes(metricId)) ?? false;
    });
    const outcomes = relevant.flatMap((value) => value.outcomeHistory);
    const responses = relevant.flatMap((value) => value.responseHistory);
    if (outcomes.length === 0 && responses.length === 0) return null;

    const helped = outcomes.filter((outcome) => outcome.helped).length;
    const didNotHelp = outcomes.length - helped;
    const outcomeDelta = (helped - didNotHelp) / (outcomes.length + 4);
    const responseDelta = responses.reduce((sum, entry) => sum + RESPONSE_WEIGHT[entry.response], 0) / (responses.length + 4);
    const contradictory = helped > 0 && didNotHelp > 0;

    return {
      relevanceMultiplier: clamp(1 + 0.65 * outcomeDelta + responseDelta, 0.55, 1.35),
      confidenceMultiplier: contradictory ? clamp(1 - 0.3 * Math.min(1, outcomes.length / 4), 0.7, 1) : 1,
      contradictory,
    };
  }

  funnel(): FunnelSummary {
    const all = [...this.values.values()];
    const recommended = all.length;
    const accepted = all.filter((value) => STAGE_ORDER[value.stage] >= STAGE_ORDER.accepted).length;
    const followed = all.filter((value) => STAGE_ORDER[value.stage] >= STAGE_ORDER.followed).length;
    const measured = all.filter((value) => value.stage === "measured").length;
    const helped = all.filter((value) => value.outcome === "helped").length;
    const didNotHelp = all.filter((value) => value.outcome === "did-not-help").length;
    const rate = (numerator: number, denominator: number): number => (denominator === 0 ? 0 : numerator / denominator);

    return {
      recommended,
      accepted,
      followed,
      measured,
      helped,
      didNotHelp,
      acceptanceRate: rate(accepted, recommended),
      followThroughRate: rate(followed, accepted),
      measuredRate: rate(measured, recommended),
      helpRate: rate(helped, measured),
      valueScore: measured === 0 ? 0 : (helped - didNotHelp) / measured,
    };
  }

  toSnapshot(): RecommendationValueSnapshot {
    return { version: SNAPSHOT_VERSION, values: this.list() };
  }

  /** Privacy primitive: drop recommendation records whose evidence used a source. */
  pruneBySource(source: SourceId): void {
    let changed = false;
    for (const [id, value] of this.values) {
      const referencesSource =
        value.recommendation?.evidence.some((evidence) => evidence.sources.includes(source)) ||
        value.laterEvidence.some((evidence) => evidence.sources.includes(source));
      if (referencesSource) {
        this.values.delete(id);
        changed = true;
      }
    }
    if (changed) this.changed();
  }

  static fromSnapshot(
    snapshot: RecommendationValueSnapshot,
    now: () => number = Date.now,
    adapter?: RecommendationValueAdapter,
  ): RecommendationValueTracker {
    const tracker = new RecommendationValueTracker(now, adapter ?? null);
    if (snapshot.version === SNAPSHOT_VERSION) {
      tracker.values = new Map(snapshot.values.map((value) => [value.recommendationId, normaliseValue(value)]));
    }
    tracker.loaded = true;
    return tracker;
  }

  private ensure(id: string, recommendation?: Recommendation): RecommendationValue {
    let value = this.values.get(id);
    if (!value) {
      const at = new Date(this.now()).toISOString();
      value = {
        recommendationId: id,
        recommendation: recommendation ? cloneRecommendation(recommendation) : null,
        discoveryIds: recommendation ? [...recommendation.metricIds] : [],
        expectedOutcome: recommendation ? `${recommendation.title} — ${recommendation.confidence.level} confidence` : null,
        confidenceAtIssue: recommendation ? { level: recommendation.confidence.level, score: recommendation.confidence.score } : null,
        issuedAt: at,
        adherence: null,
        evaluationWindow: null,
        observedOutcome: null,
        outcomeUncertainty: null,
        evidenceDelta: null,
        stage: "recommended",
        outcome: null,
        response: null,
        recommendedAt: at,
        acceptedAt: null,
        followedAt: null,
        measuredAt: null,
        respondedAt: null,
        responseHistory: [],
        outcomeHistory: [],
        laterEvidence: [],
      };
      this.values.set(id, value);
      this.changed();
    }
    if (recommendation && value.discoveryIds.length === 0) {
      value.discoveryIds = [...recommendation.metricIds];
      value.expectedOutcome = `${recommendation.title} — ${recommendation.confidence.level} confidence`;
      value.confidenceAtIssue = { level: recommendation.confidence.level, score: recommendation.confidence.score };
    }
    return value;
  }

  private advance(id: string, stage: RecommendationStage): RecommendationValue {
    const value = this.ensure(id);
    this.advanceInPlace(value, stage, new Date(this.now()).toISOString());
    return value;
  }

  private advanceInPlace(value: RecommendationValue, stage: RecommendationStage, at: string): void {
    if (STAGE_ORDER[stage] <= STAGE_ORDER[value.stage]) return;
    value.stage = stage;
    if (stage === "accepted") value.acceptedAt = at;
    if (stage === "followed") value.followedAt = at;
    if (stage === "measured") value.measuredAt = value.measuredAt ?? at;
  }

  private changed(): void {
    this.changeRevision += 1;
  }
}

export interface FunnelSummary {
  recommended: number;
  accepted: number;
  followed: number;
  measured: number;
  helped: number;
  didNotHelp: number;
  acceptanceRate: number;
  followThroughRate: number;
  measuredRate: number;
  helpRate: number;
  valueScore: number;
}

function normaliseValue(value: RecommendationValue): RecommendationValue {
  const outcomeHistory = value.outcomeHistory ?? (value.outcome ? [{ helped: value.outcome === "helped", at: value.measuredAt ?? value.recommendedAt, note: null }] : []);
  const responseHistory = value.responseHistory ?? (value.response ? [{ response: value.response, at: value.respondedAt ?? value.recommendedAt, note: null }] : []);
  return {
    ...value,
    discoveryIds: value.discoveryIds ?? (value.recommendation ? [...value.recommendation.metricIds] : []),
    expectedOutcome: value.expectedOutcome ?? null,
    confidenceAtIssue: value.confidenceAtIssue ?? null,
    issuedAt: value.issuedAt ?? value.recommendedAt,
    adherence: value.adherence ?? null,
    evaluationWindow: value.evaluationWindow ?? null,
    observedOutcome: value.observedOutcome ?? null,
    outcomeUncertainty: value.outcomeUncertainty ?? null,
    evidenceDelta: value.evidenceDelta ?? null,
    recommendation: value.recommendation ?? null,
    response: value.response ?? null,
    respondedAt: value.respondedAt ?? null,
    responseHistory: [...responseHistory],
    outcomeHistory: [...outcomeHistory],
    laterEvidence: [...(value.laterEvidence ?? [])],
  };
}

function cloneRecommendation(recommendation: Recommendation): Recommendation {
  return {
    ...recommendation,
    metricIds: [...recommendation.metricIds],
    factors: { ...recommendation.factors },
    evidence: recommendation.evidence.map((evidence) => ({ ...evidence, metricIds: [...evidence.metricIds], sources: [...evidence.sources] })),
    caveats: [...recommendation.caveats],
    confidence: { ...recommendation.confidence },
  };
}

function cloneValue(value: RecommendationValue): RecommendationValue {
  return {
    ...value,
    discoveryIds: [...(value.discoveryIds ?? [])],
    confidenceAtIssue: value.confidenceAtIssue ? { ...value.confidenceAtIssue } : null,
    evaluationWindow: value.evaluationWindow ? { ...value.evaluationWindow } : null,
    recommendation: value.recommendation ? cloneRecommendation(value.recommendation) : null,
    responseHistory: value.responseHistory.map((entry) => ({ ...entry })),
    outcomeHistory: value.outcomeHistory.map((entry) => ({ ...entry })),
    laterEvidence: value.laterEvidence.map((entry) => ({ ...entry, metricIds: [...entry.metricIds], sources: [...entry.sources] })),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createMemoryRecommendationValueAdapter(): RecommendationValueAdapter {
  let snapshot: RecommendationValueSnapshot | null = null;
  return {
    async load() {
      return snapshot ? { version: snapshot.version, values: snapshot.values.map(cloneValue) } : null;
    },
    async save(next) {
      snapshot = { version: next.version, values: next.values.map(cloneValue) };
    },
  };
}
