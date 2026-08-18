/**
 * Pulse — the engine façade.
 *
 * Wires the core loop together:
 *   COLLECT -> NORMALISE -> VALIDATE -> ANALYSE -> DISCOVER -> HYPOTHESISE
 *   -> EXPERIMENT -> RECOMMEND -> MEASURE -> LEARN
 *
 * This is the only stateful object in the system. Everything it calls is a
 * pure function over events, which is why the whole analytic stack can be
 * tested without constructing one.
 */

import type { PulseEvent, SourceId } from "./events/schema.js";
import { MemoryEventStore, type PersistenceAdapter } from "./events/store.js";
import { localDate } from "./events/time.js";
import { SyncEngine, type SyncOptions, type SyncReport } from "./connectors/sync.js";
import type { Connector } from "./connectors/types.js";
import { buildConnectorDashboard, type ConnectorDashboard } from "./connectors/dashboard.js";
import { ConsentRegistry } from "./privacy/consent.js";
import { createDefaultRegistry } from "./metrics/catalogue.js";
import type { MetricRegistry } from "./metrics/registry.js";
import { scoreAll, type QualityContext, type SourceQuality } from "./quality/score.js";
import { discoverRelationships, type DiscoveryReport } from "./discovery/engine.js";
import { ReplicationLedger } from "./discovery/replication.js";
import { ContradictionLedger } from "./discovery/contradictions.js";
import { InsightHistory, type InsightHistoryAdapter } from "./history/insight-history.js";
import {
  CausalHypothesisLibrary,
  type CausalLibraryAdapter,
  type CausalLibraryEntry,
} from "./hypotheses/library.js";
import type { Finding } from "./discovery/finding.js";
import { HypothesisTracker, type Hypothesis } from "./hypotheses/tracker.js";
import { designExperiment, type DesignOptions, type ExperimentDesign } from "./experiments/design.js";
import { analyseExperiment, type ExperimentResult } from "./experiments/analysis.js";
import { buildCalendar, type ExperimentCalendar } from "./experiments/calendar.js";
import { rankRecommendations, type Recommendation } from "./recommendations/rank.js";
import { FeedbackStore } from "./recommendations/feedback.js";
import { RecommendationValueTracker } from "./recommendations/value.js";
import { buildTimeline, type Timeline, type TimelineOptions } from "./timeseries/timeline.js";
import { buildWeeklyBrief, type WeeklyBrief } from "./reports/brief.js";
import { buildKnowledgeGraph, type KnowledgeGraph } from "./knowledge/graph.js";
import { buildClaimNode, buildEvidenceGraph, type AuthoredClaimInput, type EvidenceGraph } from "./evidence-graph/graph.js";
import type { ClaimNode } from "./evidence-graph/types.js";
import { ask, type Answer, type AskContext } from "./ask/answer.js";
import { buildExport, deleteSource, type DeletionReport, type PulseExport } from "./privacy/export.js";
import { buildResearchExport, type ResearchExport } from "./privacy/research-export.js";

export interface PulseOptions {
  timezone?: string;
  adapter?: PersistenceAdapter;
  /** Persists the insight history; without one the history lives for the process. */
  historyAdapter?: InsightHistoryAdapter;
  /** Persists the causal hypothesis library; without one it lives for the process. */
  libraryAdapter?: CausalLibraryAdapter;
  registry?: MetricRegistry;
  now?: () => number;
  /** Expected weekly cadence per source, used by the quality scorer. */
  expectedCadence?: Record<string, number>;
}

export class Pulse {
  readonly store: MemoryEventStore;
  readonly consent: ConsentRegistry;
  readonly registry: MetricRegistry;
  readonly feedback: FeedbackStore;
  readonly hypotheses: HypothesisTracker;
  readonly replication: ReplicationLedger;
  readonly contradictions: ContradictionLedger;
  readonly value: RecommendationValueTracker;
  readonly insightHistory: InsightHistory;
  readonly causalLibrary: CausalHypothesisLibrary;
  readonly timezone: string;

  private readonly connectors = new Map<SourceId, Connector>();
  private readonly syncEngine: SyncEngine;
  private readonly syncReports = new Map<SourceId, SyncReport>();
  private readonly designs = new Map<string, ExperimentDesign>();
  private readonly experimentResults = new Map<string, ExperimentResult>();
  private readonly now: () => number;
  private readonly expectedCadence: Record<string, number>;
  private readonly authoredClaims = new Map<string, ClaimNode>();
  private cachedFindings: Finding[] = [];
  private historyPersistQueue: Promise<void> = Promise.resolve();
  private libraryPersistQueue: Promise<void> = Promise.resolve();

  constructor(options: PulseOptions = {}) {
    this.timezone = options.timezone ?? "UTC";
    this.now = options.now ?? Date.now;
    this.store = new MemoryEventStore(options.adapter);
    this.consent = new ConsentRegistry(this.now);
    this.registry = options.registry ?? createDefaultRegistry();
    this.feedback = new FeedbackStore(this.now);
    this.hypotheses = new HypothesisTracker(this.now);
    this.replication = new ReplicationLedger(this.now);
    this.contradictions = new ContradictionLedger(this.now);
    this.value = new RecommendationValueTracker(this.now);
    this.insightHistory = new InsightHistory(options.historyAdapter);
    this.causalLibrary = new CausalHypothesisLibrary(options.libraryAdapter);
    this.syncEngine = new SyncEngine(this.store, this.consent);
    this.expectedCadence = options.expectedCadence ?? {};
  }

  async load(): Promise<void> {
    await this.store.load();
    await this.insightHistory.load();
    await this.causalLibrary.load();
  }

  // --- COLLECT ----------------------------------------------------------

  registerConnector(connector: Connector): this {
    this.connectors.set(connector.id, connector);
    return this;
  }

  listConnectors(): Connector[] {
    return [...this.connectors.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  requireConnector(id: SourceId): Connector {
    const connector = this.connectors.get(id);
    if (!connector) throw new Error(`No connector registered for "${id}"`);
    return connector;
  }

  /** Grants consent for a single source. */
  connect(id: SourceId, options: { scopes?: string[]; allowAiProcessing?: boolean } = {}): void {
    this.consent.grant(this.requireConnector(id), options);
  }

  /** Bulk connect. Sources requiring explicit permission are returned, not enabled. */
  connectAll(): { granted: SourceId[]; skipped: SourceId[] } {
    return this.consent.grantAll(this.listConnectors());
  }

  async sync(id: SourceId, options: Partial<SyncOptions> = {}): Promise<SyncReport> {
    const report = await this.syncEngine.sync(this.requireConnector(id), {
      timezone: this.timezone,
      now: this.now,
      ...options,
    });
    this.syncReports.set(id, report);
    return report;
  }

  async syncAll(options: Partial<SyncOptions> = {}): Promise<SyncReport[]> {
    const reports: SyncReport[] = [];
    for (const connector of this.listConnectors()) {
      if (!this.consent.isGranted(connector.id)) continue;
      reports.push(await this.sync(connector.id, options));
    }
    return reports;
  }

  async backfill(id: SourceId, fromDate: string): Promise<SyncReport> {
    const report = await this.syncEngine.backfill(this.requireConnector(id), fromDate, {
      timezone: this.timezone,
      now: this.now,
    });
    this.syncReports.set(id, report);
    return report;
  }

  events(options: { includeSensitive?: boolean } = {}): PulseEvent[] {
    return this.store.query({ includeSensitive: options.includeSensitive ?? false });
  }

  // --- VALIDATE ---------------------------------------------------------

  quality(): SourceQuality[] {
    const context: QualityContext = {
      nowMs: this.now(),
      timezone: this.timezone,
      definitions: this.registry.list(),
    };
    const perSource = new Map<SourceId, Partial<QualityContext>>();
    for (const [source, report] of this.syncReports) {
      perSource.set(source, {
        syncReport: report,
        ...(this.expectedCadence[String(source)] !== undefined
          ? { expectedEventsPerWeek: this.expectedCadence[String(source)] }
          : {}),
      });
    }
    return scoreAll(this.store.all(), context, perSource);
  }

  /**
   * Returns connector state in the same shape as the health dashboard.
   * Keeping this on the facade means the UI cannot accidentally calculate
   * freshness from a different clock or a different event set.
   */
  connectorDashboard(options: { windowDays?: number } = {}): ConnectorDashboard {
    return buildConnectorDashboard(this.listConnectors(), this.store.all(), {
      timezone: this.timezone,
      now: this.now,
      ...(options.windowDays !== undefined ? { windowDays: options.windowDays } : {}),
      syncReports: [...this.syncReports.values()],
      connectedSources: this.listConnectors()
        .filter((connector) => this.consent.isGranted(connector.id))
        .map((connector) => connector.id),
    });
  }

  // --- ANALYSE / DISCOVER -----------------------------------------------

  timeline(options: TimelineOptions = {}): Timeline {
    return buildTimeline(this.store.all(), options);
  }

  discover(
    options: { includeSensitive?: boolean; limit?: number; fdrLevel?: number; through?: string } = {},
  ): DiscoveryReport {
    const events = this.events({ includeSensitive: options.includeSensitive ?? false });
    // A `through` cut-off re-renders the past: what did the engine believe
    // given only the data available up to that moment?
    const through = options.through;
    const scanEvents = through ? events.filter((event) => event.occurredAt <= through) : events;
    const report = discoverRelationships(scanEvents, {
      registry: this.registry,
      qualities: this.quality(),
      now: this.now,
      ...(options.limit !== undefined ? { limit: options.limit } : {}),
      ...(options.fdrLevel !== undefined ? { fdrLevel: options.fdrLevel } : {}),
    });
    report.findings = this.replication.annotate(report.findings);
    // Contradictions override replication status: a claim seen pointing both
    // ways is suspect, however often one side of it has been replicated.
    report.findings = this.contradictions.annotate(report.findings);
    this.cachedFindings = report.findings;
    this.pauseContradictedHypotheses();
    this.insightHistory.recordScan({
      at: new Date(this.now()).toISOString(),
      eventCount: scanEvents.length,
      findings: report.findings,
      rejected: report.rejected.map(({ candidate, reason }) => ({
        outcomeMetricId: candidate.outcomeMetricId,
        exposureMetricId: candidate.exposureMetricId ?? null,
        reason,
      })),
      totals: {
        findings: report.findings.length,
        rejected: report.rejected.length,
        familySize: report.familySize,
        familyCount: report.familyCount,
        expectedFalseDiscoveries: report.expectedFalseDiscoveries,
      },
    });
    this.persistInsightHistory();
    return report;
  }

  /**
   * Writes the insight history through a serial queue. Every scan triggers a
   * persist and encryption is genuinely async, so without the queue two writes
   * could complete out of order and leave an older snapshot on disk.
   */
  private persistInsightHistory(): void {
    this.historyPersistQueue = this.historyPersistQueue
      .then(() => this.insightHistory.persist())
      .catch((error: unknown) => {
        console.error("Pulse: failed to persist insight history", error);
      });
  }

  /**
   * Lifts a finding into the personal causal hypothesis library. A finding
   * already cited there is a no-op, so rescans and reloads never duplicate.
   */
  promoteFindingToLibrary(finding: Finding): CausalLibraryEntry | null {
    const entry = this.causalLibrary.addFromFinding(finding);
    if (entry) this.persistCausalLibrary();
    return entry;
  }

  /** Serialised like the history, so racing encrypts cannot leave a stale blob. */
  private persistCausalLibrary(): void {
    this.libraryPersistQueue = this.libraryPersistQueue
      .then(() => this.causalLibrary.persist())
      .catch((error: unknown) => {
        console.error("Pulse: failed to persist causal hypothesis library", error);
      });
  }

  findings(): Finding[] {
    return this.cachedFindings;
  }

  /**
   * A finding that has been seen pointing both ways withdraws the hypotheses
   * derived from it: acting on conflicted evidence is how a personal tool does
   * harm. The withdrawal is reversible — a contradicted hypothesis may still
   * be tested, and a completed experiment moves it out of that state.
   */
  private pauseContradictedHypotheses(): void {
    const contradictedFindingIds = new Set(
      this.cachedFindings
        .filter((finding) => finding.replicationStatus === "contradicted")
        .map((finding) => finding.id),
    );
    for (const hypothesis of this.hypotheses.list()) {
      if (!hypothesis.originFindingId || !contradictedFindingIds.has(hypothesis.originFindingId)) continue;
      if (hypothesis.status === "contradicted" || hypothesis.status === "abandoned") continue;
      this.hypotheses.transition(
        hypothesis.id,
        "contradicted",
        `The originating finding (${hypothesis.originFindingId}) has been observed pointing both ways; the claim is withdrawn until an experiment settles it`,
      );
    }
  }

  // --- HYPOTHESISE / EXPERIMENT -----------------------------------------

  /** Turns every experiment-worthy finding into a tracked hypothesis. */
  proposeHypotheses(): Hypothesis[] {
    const proposed: Hypothesis[] = [];
    for (const finding of this.cachedFindings) {
      const hypothesis = this.hypotheses.proposeFromFinding(finding);
      if (hypothesis) proposed.push(hypothesis);
    }
    return proposed;
  }

  designExperiment(hypothesisId: string, options: Omit<DesignOptions, "now">): ExperimentDesign {
    const hypothesis = this.hypotheses.get(hypothesisId);
    if (!hypothesis) throw new Error(`Unknown hypothesis: ${hypothesisId}`);
    const design = designExperiment(hypothesis, { ...options, now: this.now });
    this.designs.set(design.id, design);
    this.hypotheses.linkExperiment(hypothesisId, design.id);
    if (hypothesis.status === "proposed") {
      this.hypotheses.transition(hypothesisId, "testing", `Experiment ${design.id} designed`);
    }
    return design;
  }

  getDesign(id: string): ExperimentDesign | undefined {
    return this.designs.get(id);
  }

  listDesigns(): ExperimentDesign[] {
    return [...this.designs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** MEASURE: analyses a run and moves its hypothesis to a terminal state. */
  analyseExperiment(designId: string): ExperimentResult {
    const design = this.designs.get(designId);
    if (!design) throw new Error(`Unknown experiment: ${designId}`);
    const hypothesis = this.hypotheses.get(design.hypothesisId);

    const qualities = this.quality();
    const result = analyseExperiment(design, this.store.all(), {
      registry: this.registry,
      predictedEffect: hypothesis?.predictedEffect ?? 0.4,
      dataQuality: qualities.length ? Math.min(...qualities.map((quality) => quality.score)) : 0.8,
      now: this.now,
    });
    this.experimentResults.set(designId, result);

    // A contradicted hypothesis is still allowed to run its experiment: a
    // controlled test is exactly what settles a conflicted observational claim.
    if (hypothesis && (hypothesis.status === "testing" || hypothesis.status === "contradicted")) {
      const next =
        result.verdict === "supported" ? "supported" : result.verdict === "refuted" ? "refuted" : "inconclusive";
      this.hypotheses.transition(hypothesis.id, next, result.summary);
    }
    // The experiment's verdict advances the origin finding's replication status.
    if (hypothesis?.originFindingId) {
      this.replication.recordExperimentResult(hypothesis.originFindingId, result.verdict);
    }
    // And it lands in the causal library under the belief it tested, moving
    // that belief's standing when the verdict is decisive.
    this.causalLibrary.recordExperimentResult(result, hypothesis ?? null);
    this.persistCausalLibrary();
    return result;
  }

  experimentResultsList(): ExperimentResult[] {
    return [...this.experimentResults.values()].sort((a, b) => a.analysedAt.localeCompare(b.analysedAt));
  }

  // --- RECOMMEND --------------------------------------------------------

  recommendations(limit?: number): Recommendation[] {
    const ranked = rankRecommendations(this.cachedFindings, this.experimentResultsList(), {
      registry: this.registry,
      feedback: this.feedback,
      now: this.now,
      today: localDate(this.now(), this.timezone),
      ...(limit !== undefined ? { limit } : {}),
    });
    for (const recommendation of ranked) this.value.recommended(recommendation.id);
    return ranked;
  }

  // --- RECOMMENDATION VALUE ----------------------------------------------

  recommendationFunnel() {
    return this.value.funnel();
  }

  acceptRecommendation(id: string): void {
    this.value.accepted(id);
  }

  followRecommendation(id: string): void {
    this.value.followed(id);
  }

  recordRecommendationOutcome(id: string, helped: boolean): void {
    this.value.recordOutcome(id, helped);
  }

  // --- EXPERIMENT CALENDAR -------------------------------------------------

  calendar(): ExperimentCalendar {
    return buildCalendar(this.listDesigns(), this.experimentResultsList(), localDate(this.now(), this.timezone));
  }

  // --- LEARN ------------------------------------------------------------

  knowledgeGraph(): KnowledgeGraph {
    return buildKnowledgeGraph({
      definitions: this.registry.list(),
      findings: this.cachedFindings,
      hypotheses: this.hypotheses.list(),
      experiments: this.experimentResultsList(),
    });
  }

  // --- LEARN (personal evidence graph) ----------------------------------

  /** Records a belief the person holds, optionally linked to engine evidence. */
  recordClaim(input: AuthoredClaimInput): ClaimNode {
    const claim = buildClaimNode(input, this.now);
    this.authoredClaims.set(claim.id, claim);
    return claim;
  }

  /** "What do I believe, and what is the evidence?" */
  evidenceGraph(): EvidenceGraph {
    return buildEvidenceGraph({
      findings: this.cachedFindings,
      hypotheses: this.hypotheses.list(),
      experiments: this.experimentResultsList(),
      authored: [...this.authoredClaims.values()],
      contradictions: this.contradictions.list(),
      now: this.now,
    });
  }

  weeklyBrief(weekOf?: string): WeeklyBrief {
    return buildWeeklyBrief({
      registry: this.registry,
      weekOf: weekOf ?? localDate(this.now(), this.timezone),
      events: this.store.all(),
      findings: this.cachedFindings,
      recommendations: this.recommendations(),
      experiments: this.experimentResultsList(),
      qualities: this.quality(),
      now: this.now,
    });
  }

  ask(question: string): Answer {
    const context: AskContext = {
      events: this.events(),
      registry: this.registry,
      findings: this.cachedFindings,
      recommendations: this.recommendations(),
      hypotheses: this.hypotheses.list(),
      today: localDate(this.now(), this.timezone),
      weeklyBriefHeadline: this.weeklyBrief().headline,
    };
    return ask(question, context);
  }

  // --- PRIVACY ----------------------------------------------------------

  /**
   * The shareable form of the data: de-identified, statistics-first, with no
   * raw events or free text. Same consent rules as the full export — sensitive
   * sources are excluded unless asked for by name.
   */
  researchExport(options: { includeSensitive?: boolean } = {}): ResearchExport {
    return buildResearchExport(this.store, this.consent, {
      ...options,
      now: this.now,
      timezone: this.timezone,
      findings: this.cachedFindings,
      qualities: this.quality(),
      experimentDesigns: this.listDesigns(),
      experimentResults: this.experimentResultsList(),
      hypotheses: this.hypotheses.list(),
      insightHistory: this.insightHistory.history(),
    });
  }

  export(options: { includeSensitive?: boolean } = {}): PulseExport {
    return buildExport(this.store, this.consent, {
      ...options,
      now: this.now,
      findings: this.cachedFindings,
      hypotheses: this.hypotheses.list(),
      experimentDesigns: this.listDesigns(),
      experimentResults: this.experimentResultsList(),
      feedback: this.feedback.list(),
      replication: this.replication.list(),
      contradictions: this.contradictions.list(),
      recommendationValue: this.value.list(),
      insightHistory: this.insightHistory.snapshot(),
      causalLibrary: this.causalLibrary.snapshot(),
    });
  }

  /** Revokes consent, deletes the data, and drops any findings that relied on it. */
  async forgetSource(source: SourceId): Promise<DeletionReport> {
    const report = await deleteSource(this.store, this.consent, source, {
      findings: this.cachedFindings,
      hypotheses: this.hypotheses.list(),
    }, this.now);
    const invalidated = new Set(report.invalidatedFindings);
    this.cachedFindings = this.cachedFindings.filter((finding) => !invalidated.has(finding.id));
    const keepFindingIds = new Set(this.cachedFindings.map((finding) => finding.id));
    this.replication.prune(keepFindingIds);
    this.contradictions.prune(keepFindingIds);
    // A finding built on deleted data is unverifiable; so is its history, and
    // so is the library evidence it supplied. Drain the queues first so no
    // in-flight write lands after the prune.
    await this.historyPersistQueue;
    this.insightHistory.pruneBySources([source]);
    await this.insightHistory.persist();
    await this.libraryPersistQueue;
    this.causalLibrary.pruneEvidence(new Set(report.invalidatedFindings), new Set(report.invalidatedHypotheses));
    await this.causalLibrary.persist();
    this.syncReports.delete(source);
    return report;
  }
}
