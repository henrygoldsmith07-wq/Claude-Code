/**
 * The Pulse UI.
 *
 * Deliberately thin. Every number rendered here was computed by the engine;
 * this layer chooses what to show and in what order, and nothing else. That
 * separation is what lets the entire analytic stack be tested without a DOM.
 *
 * The evidence view leads, not a dashboard: the first thing on screen is what
 * Pulse believes and why, with the caveats attached rather than buried.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Connector, SourceConsentStatus } from "../connectors/types.js";
import type { Pulse } from "../pulse.js";
import type { Finding } from "../discovery/finding.js";
import type { InsightChange, InsightScanRecord } from "../history/insight-history.js";
import type { MetricRegistry } from "../metrics/registry.js";
import type { RejectedClaim } from "../search/evidence-search.js";
import { relationshipSubject } from "../discovery/relationship.js";
import { derivePeriods } from "../experiments/design.js";
import { FindingCard, REPLICATION_LABEL } from "./FindingCard.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { LibraryPanel } from "./LibraryPanel.js";
import { ProductTrustPanel, type FeedbackAction } from "./ProductTrustPanel.js";
import { StatisticalInspector } from "./StatisticalInspector.js";
import { EVIDENCE_HIT_LABEL } from "../search/evidence-search.js";

// "evidence" is the evidence graph; the searchable trail of findings and
// declined questions is its own tab so neither view has to give way.
export type TabId =
  | "insights"
  | "history"
  | "evidence"
  | "search"
  | "inspector"
  | "timeline"
  | "experiments"
  | "ask"
  | "library"
  | "sources";

const TABS: { id: TabId; label: string }[] = [
  { id: "insights", label: "Insights" },
  { id: "history", label: "History" },
  { id: "evidence", label: "Evidence" },
  { id: "search", label: "Evidence search" },
  { id: "inspector", label: "Inspector" },
  { id: "timeline", label: "Timeline" },
  { id: "experiments", label: "Experiments" },
  { id: "ask", label: "Ask Pulse" },
  { id: "library", label: "Hypothesis library" },
  { id: "sources", label: "Sources & privacy" },
];

export interface AppProps {
  pulse: Pulse;
}

export function App({ pulse }: AppProps): React.JSX.Element {
  const [tab, setTab] = useState<TabId>("insights");
  const [askPrefill, setAskPrefill] = useState("");
  const [suppressedFindingIds, setSuppressedFindingIds] = useState<string[]>([]);
  // A ledger record the reader just asked to see; scrolled to once the
  // evidence view has rendered it.
  const [pendingContradiction, setPendingContradiction] = useState<string | null>(null);
  // Bumped whenever the engine's derived state changes, so memoised views
  // recompute without the component owning any analytic state itself.
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  // Why the last experiment proposal was refused, shown where the user asked.
  const [experimentError, setExperimentError] = useState<string | null>(null);
  // A search hit asked to open a finding's card or its history journey: where
  // to go and when, so a repeat click on the same destination still
  // re-scrolls and re-highlights.
  const [focusRequest, setFocusRequest] = useState<
    | { destination: "insights"; findingId: string; at: number }
    | { destination: "history"; signature: string; at: number }
    | { destination: "scan"; scanId: string; reason: string; at: number }
    | null
  >(null);

  // The scan card opened from a rejection is a journey: it survives leaving
  // the History tab so a drill-in to a finding can return via the
  // back-to-scan pill — only the flash is transient.
  const [openScan, setOpenScan] = useState<{ scanId: string; reason: string } | null>(null);

  const onOpenFinding = useCallback((findingId: string) => {
    // The drill-in keeps the scan journey open: the back-to-scan pill is the
    // way back from the finding card to the scan that contained it.
    setFocusRequest({ destination: "insights", findingId, at: Date.now() });
    setTab("insights");
  }, []);

  const onOpenHistory = useCallback((signature: string) => {
    // Opening a journey replaces the scan context — one destination at a time.
    setOpenScan(null);
    setFocusRequest({ destination: "history", signature, at: Date.now() });
    setTab("history");
  }, []);

  const onOpenScan = useCallback((scanId: string, reason: string) => {
    setOpenScan({ scanId, reason });
    setFocusRequest({ destination: "scan", scanId, reason, at: Date.now() });
    setTab("history");
  }, []);

  // The evidence search is lifted so it survives tab switches: a deep link
  // from a result can return to the exact query that started the journey.
  const [searchInput, setSearchInput] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState("");
  const submitSearch = useCallback((value: string) => {
    setSearchInput(value);
    setSearchSubmitted(value);
    // A new query starts a new journey: the previous scan is no longer the
    // destination a back-to-scan pill should return to.
    setOpenScan(null);
  }, []);

  // The tab switch above happened; now bring the target into view and let the
  // highlight fade instead of sticking.
  useEffect(() => {
    if (!focusRequest) return;
    const elementId =
      focusRequest.destination === "insights"
        ? `finding-${focusRequest.findingId}`
        : focusRequest.destination === "history"
          ? `history-${focusRequest.signature}`
          : `scan-${focusRequest.scanId}`;
    const element = document.getElementById(elementId);
    if (element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const timer = window.setTimeout(() => setFocusRequest(null), 2200);
    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  // `revision` is a deliberate dependency, not a redundant one: the engine is
  // external mutable state that React cannot observe, so bumping the counter
  // is what tells these memos to recompute after feedback or a revocation.
  /* eslint-disable react-hooks/exhaustive-deps */
  const discovery = useMemo(() => pulse.discover(), [pulse, revision]);
  const brief = useMemo(() => pulse.weeklyBrief(), [pulse, revision]);
  const recommendations = useMemo(() => pulse.recommendations(5), [pulse, revision]);
  const funnel = useMemo(() => pulse.recommendationFunnel(), [pulse, revision]);
  const quality = useMemo(() => pulse.quality(), [pulse, revision]);
  const insightHistory = useMemo(() => pulse.insightHistory.history(), [pulse, revision]);
  const recordBySubject = useMemo(
    () =>
      new Map(
        pulse.contradictions
          .list()
          .map((record) => [relationshipSubject(record.outcomeMetricId, record.exposureMetricId), record]),
      ),
    [pulse, revision],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const onFeedback = useCallback(
    (findingId: string, verdict: FeedbackAction) => {
      const finding = discovery.findings.find((candidate) => candidate.id === findingId);
      const metricIds = finding?.metricIds ?? [];
      if (verdict === "bad-data") {
        pulse.feedback.record(findingId, "wrong", metricIds, "User marked the supporting measurement as bad data");
      } else if (verdict === "stop-investigating") {
        pulse.feedback.dismiss(findingId);
        for (const metricId of metricIds) pulse.feedback.muteTopic(metricId);
        setSuppressedFindingIds((current) => (current.includes(findingId) ? current : [...current, findingId]));
      } else {
        pulse.feedback.record(findingId, verdict, metricIds);
      }
      refresh();
    },
    [discovery.findings, pulse, refresh],
  );

  const onRecommendationOutcome = useCallback(
    (recommendationId: string, helped: boolean) => {
      pulse.recordRecommendationOutcome(recommendationId, helped);
      refresh();
    },
    [pulse, refresh],
  );

  const onDesignExperiment = useCallback(
    (finding: Finding) => {
      const hypothesis = pulse.hypotheses.proposeFromFinding(finding);
      if (!hypothesis) return;
      try {
        pulse.designExperiment(hypothesis.id, {
          startDate: brief.weekEnd,
          sessionsPerWeek: 4,
        });
        setExperimentError(null);
      } catch (error) {
        // The engine refuses same-metric overlaps at proposal time (P1 #9);
        // surface the refusal instead of letting the click vanish silently.
        setExperimentError(
          error instanceof Error ? error.message : "Could not start the experiment — please try again.",
        );
      }
      refresh();
    },
    [brief.weekEnd, pulse, refresh],
  );

  // The destination pills mirror each other: whichever journey is active and
  // you are not currently on shows its way back. Both can be active at once
  // (search "sleep" → scan → finding), so they share a sticky bar.
  const backToSearchVisible = searchSubmitted !== "" && tab !== "search";
  const backToScanVisible = openScan !== null && tab !== "history";
  const openAsk = useCallback((question = "") => {
    setAskPrefill(question);
    setTab("ask");
  }, []);

  const openContradiction = useCallback((recordId: string) => {
    setPendingContradiction(recordId);
    setTab("evidence");
  }, []);

  // Once the evidence view has rendered the targeted record, bring it into
  // view. The effect runs after commit, when the anchor exists in the DOM.
  useEffect(() => {
    if (tab !== "evidence" || !pendingContradiction) return;
    const target = document.getElementById(`contradiction-${pendingContradiction}`);
    if (target?.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingContradiction(null);
  }, [tab, pendingContradiction]);

  const visibleFindings = discovery.findings.filter((finding) => !suppressedFindingIds.includes(finding.id));

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <img src="/logo.svg" alt="" width={28} height={28} className="app__logo" aria-hidden="true" />
          <h1>Pulse</h1>
        </div>
        <p className="app__tagline">Evidence about you, with its working shown.</p>
        <form
          className="universal-ask"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("question");
            openAsk(typeof value === "string" ? value : "");
          }}
        >
          <label htmlFor="universal-ask-input">Ask Pulse</label>
          <input id="universal-ask-input" name="question" placeholder="Ask about your own data…" />
          <button type="submit" aria-label="Open Ask Pulse">Open</button>
        </form>
      </header>

      <nav aria-label="Sections">
        <ul className="tabs" role="tablist">
          {TABS.map((entry) => (
            <li key={entry.id} role="none">
              <button
                type="button"
                role="tab"
                id={`tab-${entry.id}`}
                aria-selected={tab === entry.id}
                aria-controls={`panel-${entry.id}`}
                className={tab === entry.id ? "tab tab--active" : "tab"}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main>
        {backToSearchVisible || backToScanVisible ? (
          <div className="destination-bar">
            {backToSearchVisible ? (
              <button
                type="button"
                className="back-to-search"
                onClick={() => {
                  setSearchInput(searchSubmitted);
                  setTab("search");
                }}
              >
                ← Back to search: “{searchSubmitted}”
              </button>
            ) : null}
            {backToScanVisible ? (
              <button
                type="button"
                className="back-to-scan"
                onClick={() => onOpenScan(openScan!.scanId, openScan!.reason)}
              >
                ← Back to scan: {openScan!.scanId}
              </button>
            ) : null}
          </div>
        ) : null}
        {tab === "history" ? (
          <HistoryPanel
            pulse={pulse}
            revision={revision}
            highlightSignature={focusRequest?.destination === "history" ? focusRequest.signature : null}
            openScan={openScan}
            highlightScan={focusRequest?.destination === "scan"}
            onOpenFinding={onOpenFinding}
          />
        ) : null}
        {tab === "insights" ? (
          <section role="tabpanel" id="panel-insights" aria-labelledby="tab-insights" tabIndex={-1}>
            <ProductTrustPanel
              pulse={pulse}
              findings={visibleFindings}
              discovery={discovery}
              quality={quality}
              recommendations={recommendations}
              revision={revision}
              onFeedback={onFeedback}
              onRecommendationOutcome={onRecommendationOutcome}
              onDesignExperiment={onDesignExperiment}
              onOpenAsk={() => openAsk()}
              onChange={refresh}
            />
            <h2>This week</h2>
            <p className="brief__headline">{brief.headline}</p>

            {brief.withdrawnBeliefs.length > 0 ? (
              <div className="card" role="alert">
                <h3>Withdrawn beliefs</h3>
                <p className="muted">
                  {brief.withdrawnBeliefs.length === 1
                    ? "A belief was withdrawn this week: its evidence now points both ways, so Pulse no longer stands behind it."
                    : `${brief.withdrawnBeliefs.length} beliefs were withdrawn this week: their evidence now points both ways, so Pulse no longer stands behind them.`}
                </p>
                <ul>
                  {brief.withdrawnBeliefs.map((belief) => {
                    const record = recordBySubject.get(
                      relationshipSubject(belief.outcomeMetricId, belief.exposureMetricId),
                    );
                    return (
                      <li key={`${belief.statement}-${belief.cause}`} className="warn">
                        <strong>{belief.statement}</strong> <span className="muted">{belief.note}</span>
                        {record ? (
                          <button type="button" onClick={() => openContradiction(record.id)}>
                            View the contradictory evidence
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <h2>What Pulse believes</h2>
            <p className="muted">
              {discovery.findings.length} finding(s) survived correction across {discovery.familySize} comparisons, split
              into {discovery.familyCount} families of related questions (largest: {discovery.largestFamilySize}), at a{" "}
              {Math.round(discovery.fdrLevel * 100)}% false-discovery rate. Expect roughly{" "}
              {discovery.expectedFalseDiscoveries.toFixed(1)} of them to be false.
            </p>

            {experimentError ? (
              <div className="calendar__conflict" role="alert">
                <p>
                  <strong>Experiment not started:</strong> {experimentError}
                </p>
              </div>
            ) : null}

            {visibleFindings.length === 0 ? (
              <p className="empty">
                Nothing in your data yet meets the evidence bar. That is a result, not a gap — Pulse would rather show
                you nothing than something it cannot stand behind.
              </p>
            ) : (
              visibleFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onFeedback={onFeedback}
                  onDesignExperiment={onDesignExperiment}
                  highlight={
                    focusRequest !== null && focusRequest.destination === "insights" && focusRequest.findingId === finding.id
                  }
                />
              ))
            )}

            <h2>Insight history</h2>
            <p className="muted">
              {insightHistory.length} insight(s) tracked across {pulse.insightHistory.size()} scan(s). Each scan is a
              point-in-time photograph of the evidence; insights are matched across scans by the relationship they
              describe, so this shows how each one grew or faded as your data accumulated.
            </p>
            {insightHistory.length === 0 ? (
              <p className="empty">
                No insight has been seen across more than one scan yet — history builds as Pulse rescans your data.
              </p>
            ) : (
              insightHistory.map((entry) => (
                <article key={entry.signature} className="card history-entry">
                  <h3>{entry.title}</h3>
                  <p className="muted">
                    First seen {entry.firstSeenAt.slice(0, 10)} · last seen {entry.lastSeenAt.slice(0, 10)} · present
                    in {entry.appearances} of {entry.episodes.length} scan(s) · {REPLICATION_LABEL[entry.latestStatus]}
                  </p>
                  <ul className="history-episodes">
                    {entry.episodes.map((episode, index) => (
                      <li key={`${episode.scanId}-${index}`}>
                        <time>{episode.at.slice(0, 10)}</time>
                        <span className={`history-change history-change--${episode.change}`}>{episode.change}</span>
                        {episode.finding ? (
                          <span className="muted">
                            {episode.change === "reversed" && episode.previousEffectLabel
                              ? `${episode.previousEffectLabel} → ${episode.finding.effect.label}`
                              : `effect ${episode.finding.effect.label}`}{" "}
                            · {episode.finding.confidence.level} confidence · n={episode.finding.sampleSize}
                          </span>
                        ) : (
                          <span className="muted">{episode.note ?? "No longer meets the evidence bar"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}

            <h2>Worth doing next</h2>
            <p className="muted">
              Recommendation value: {funnel.recommended} shown · {funnel.accepted} accepted · {funnel.followed} followed ·{" "}
              {funnel.measured} measured ({funnel.helped} helped, {funnel.didNotHelp} did not)
            </p>
            {recommendations.length === 0 ? (
              <p className="empty">No recommendation is justified by the evidence available.</p>
            ) : (
              <ol className="recommendations">
                {recommendations.map((recommendation) => (
                  <li key={recommendation.id} className="card">
                    <h3>{recommendation.title}</h3>
                    <p>{recommendation.statement}</p>
                    <p className="muted">{recommendation.rationale}</p>
                    <dl className="factors">
                      <div>
                        <dt>Expected benefit</dt>
                        <dd>{recommendation.factors.expectedBenefit.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Evidence confidence</dt>
                        <dd>{recommendation.factors.evidenceConfidence.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Relevance</dt>
                        <dd>{recommendation.factors.relevance.toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt>Effort</dt>
                        <dd>{recommendation.factors.effortHours} h</dd>
                      </div>
                    </dl>
                    {recommendation.caveats.length > 0 ? (
                      <details>
                        <summary>Caveats</summary>
                        <ul>
                          {recommendation.caveats.map((caveat) => (
                            <li key={caveat}>{caveat}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    <div className="actions">
                      <button type="button" onClick={() => onRecommendationOutcome(recommendation.id, true)}>
                        It helped
                      </button>
                      <button type="button" onClick={() => onRecommendationOutcome(recommendation.id, false)}>
                        It didn't help
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        {tab === "evidence" ? <EvidencePanel pulse={pulse} revision={revision} /> : null}
        {tab === "inspector" ? <StatisticalInspector pulse={pulse} revision={revision} /> : null}
        {tab === "timeline" ? <TimelinePanel pulse={pulse} /> : null}
        {tab === "experiments" ? <ExperimentsPanel pulse={pulse} revision={revision} startDate={brief.weekEnd} onChange={refresh} /> : null}
        {tab === "ask" ? <AskPanel key={askPrefill} pulse={pulse} initialQuestion={askPrefill} /> : null}
        {tab === "library" ? (
          <LibraryPanel pulse={pulse} findings={discovery.findings} revision={revision} onChange={refresh} />
        ) : null}
        {tab === "search" ? (
          <EvidenceSearchPanel
            pulse={pulse}
            revision={revision}
            searchInput={searchInput}
            searchSubmitted={searchSubmitted}
            onSearchInputChange={setSearchInput}
            onSearchSubmit={submitSearch}
            onOpenFinding={onOpenFinding}
            onOpenHistory={onOpenHistory}
            onOpenScan={onOpenScan}
          />
        ) : null}
        {tab === "sources" ? <SourcesPanel pulse={pulse} quality={quality} onChange={refresh} /> : null}
      </main>
    </div>
  );
}

const CHANGE_LABEL: Record<InsightChange, string> = {
  appeared: "Appeared",
  disappeared: "Disappeared",
  strengthened: "Strengthened",
  weakened: "Weakened",
  reversed: "Reversed",
  unchanged: "Unchanged",
};

function formatDay(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * The insight history: each finding's journey across discovery scans — when
 * it appeared, whether it strengthened or weakened as data accumulated, and
 * when it stopped meeting the evidence bar.
 */
function HistoryPanel({
  pulse,
  revision,
  highlightSignature,
  openScan,
  highlightScan,
  onOpenFinding,
}: {
  pulse: Pulse;
  revision: number;
  /** A search hit asked to open this insight's journey — flash its entry. */
  highlightSignature: string | null;
  /** A rejection hit asked to open the scan that produced it — render it here, persistently. */
  openScan: { scanId: string; reason: string } | null;
  /** Transient: the scan card was just opened, so flash it. */
  highlightScan: boolean;
  onOpenFinding: (findingId: string) => void;
}): React.JSX.Element {
  // As above: `revision` is how this view learns the engine changed.
  /* eslint-disable react-hooks/exhaustive-deps */
  const entries = useMemo(() => pulse.insightHistory.history(), [pulse, revision]);
  const scanCount = useMemo(() => pulse.insightHistory.size(), [pulse, revision]);
  const scans = useMemo(() => pulse.insightHistory.listScans(), [pulse, revision]);
  const currentFindingIds = useMemo(
    () => new Set(pulse.findings().map((finding) => finding.id)),
    [pulse, revision],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  const focusedScan = openScan ? scans.find((scan) => scan.scanId === openScan.scanId) ?? null : null;

  return (
    <section role="tabpanel" id="panel-history" aria-labelledby="tab-history" tabIndex={-1}>
      <h2>How the insights have changed</h2>
      <p className="muted">
        {scanCount} discovery scan(s) recorded; {entries.length} insight(s) tracked across them. Identical re-scans of
        unchanged data are not recorded.
      </p>

      {focusedScan ? (
        <ScanDetail
          scan={focusedScan}
          focusRejectionReason={openScan!.reason}
          highlight={highlightScan}
          currentFindingIds={currentFindingIds}
          onOpenFinding={onOpenFinding}
          registry={pulse.registry}
        />
      ) : null}

      {entries.length === 0 ? (
        <p className="empty">
          Nothing to show yet. Pulse records every discovery scan, and this view will show how each insight appeared,
          strengthened, weakened or disappeared as your data grew.
        </p>
      ) : (
        entries.map((entry) => (
          <article
            key={entry.signature}
            id={`history-${entry.signature}`}
            className={`card history-entry${highlightSignature === entry.signature ? " history-entry--highlight" : ""}`}
          >
            <header className="history-entry__header">
              <h3>{entry.title}</h3>
              <span className={`pill pill--replication-${entry.latestStatus}`}>
                {REPLICATION_LABEL[entry.latestStatus]}
              </span>
            </header>
            <p className="muted">
              First seen {formatDay(entry.firstSeenAt)} · last seen {formatDay(entry.lastSeenAt)} · {entry.appearances}{" "}
              appearance(s) across {scanCount} scan(s)
            </p>
            <ol className="history-entry__episodes">
              {entry.episodes.map((episode) => (
                <li key={episode.scanId} className={`history-episode history-episode--${episode.change}`}>
                  <span className="history-episode__change">{CHANGE_LABEL[episode.change]}</span>
                  <span className="history-episode__at">{formatDay(episode.at)}</span>
                  {episode.present && episode.finding ? (
                    currentFindingIds.has(episode.finding.id) ? (
                      <button
                        type="button"
                        className="history-episode__finding-button"
                        onClick={() => onOpenFinding(episode.finding!.id)}
                      >
                        {episode.finding.effect.label} — {episode.finding.sampleDescription}
                      </button>
                    ) : (
                      <span className="muted">
                        {episode.finding.effect.label} — {episode.finding.sampleDescription}
                      </span>
                    )
                  ) : null}
                  {!episode.present && episode.note ? <span className="muted">{episode.note}</span> : null}
                </li>
              ))}
            </ol>
          </article>
        ))
      )}
    </section>
  );
}

function TimelinePanel({ pulse }: { pulse: Pulse }): React.JSX.Element {
  const timeline = useMemo(() => pulse.timeline(), [pulse]);
  const recent = timeline.days.slice(-14).reverse();

  return (
    <section role="tabpanel" id="panel-timeline" aria-labelledby="tab-timeline" tabIndex={-1}>
      <h2>Cross-app timeline</h2>
      <p className="muted">
        {timeline.totalEvents} events from {timeline.sources.length} sources. Showing the last {recent.length} days with
        data.
      </p>
      <table>
        <caption className="visually-hidden">Recent daily activity across all connected sources</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Events</th>
            <th scope="col">Sources</th>
            <th scope="col">Active minutes</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((day) => (
            <tr key={day.date}>
              <th scope="row">{day.date}</th>
              <td>{day.totalEvents}</td>
              <td>{day.sources.join(", ") || "—"}</td>
              <td>{Math.round(day.activeMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ExperimentsPanel({
  pulse,
  revision,
  startDate,
  onChange,
}: {
  pulse: Pulse;
  revision: number;
  startDate: string;
  onChange: () => void;
}): React.JSX.Element {
  // As above: `revision` is how this view learns the engine changed.
  /* eslint-disable react-hooks/exhaustive-deps */
  const designs = useMemo(() => pulse.listDesigns(), [pulse, revision]);
  const results = useMemo(() => pulse.experimentResultsList(), [pulse, revision]);
  const calendar = useMemo(() => pulse.calendar(), [pulse, revision]);
  const templates = useMemo(() => pulse.listExperimentTemplates(), [pulse, revision]);
  const hypotheses = useMemo(
    () => pulse.hypotheses.list().filter((hypothesis) => hypothesis.status !== "abandoned"),
    [pulse, revision],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  const [selectedHypothesisId, setSelectedHypothesisId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const selectedHypothesis = hypotheses.find((hypothesis) => hypothesis.id === (selectedHypothesisId || hypotheses[0]?.id));
  const selectedTemplate = templates.find((template) => template.id === (selectedTemplateId || templates[0]?.id));
  const resultById = new Map(results.map((result) => [result.experimentId, result]));
  const conflictDates = new Set(calendar.conflicts.map((conflict) => conflict.date));

  return (
    <section role="tabpanel" id="panel-experiments" aria-labelledby="tab-experiments" tabIndex={-1}>
      <h2>Personal experiments</h2>
      <section className="card" aria-labelledby="experiment-templates-heading">
        <h3 id="experiment-templates-heading">Experiment templates</h3>
        <p>
          Choose a tested structure for a hypothesis. Pulse records the template and version on the design so the run
          stays reproducible and auditable.
        </p>
        <div className="actions">
          <label htmlFor="experiment-template-hypothesis">Hypothesis</label>
          <select
            id="experiment-template-hypothesis"
            value={selectedHypothesis?.id ?? ""}
            onChange={(event) => setSelectedHypothesisId(event.currentTarget.value)}
            disabled={hypotheses.length === 0}
          >
            {hypotheses.length === 0 ? <option value="">No testable hypotheses yet</option> : null}
            {hypotheses.map((hypothesis) => (
              <option key={hypothesis.id} value={hypothesis.id}>
                {hypothesis.outcomeMetricId} · {hypothesis.status}
              </option>
            ))}
          </select>
          <label htmlFor="experiment-template-select">Template</label>
          <select
            id="experiment-template-select"
            value={selectedTemplate?.id ?? ""}
            onChange={(event) => setSelectedTemplateId(event.currentTarget.value)}
            disabled={templates.length === 0}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · v{template.version}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedHypothesis || !selectedTemplate}
            onClick={() => {
              if (!selectedHypothesis || !selectedTemplate) return;
              pulse.designExperimentFromTemplate(selectedHypothesis.id, selectedTemplate.id, { startDate });
              onChange();
            }}
          >
            Create experiment from template
          </button>
        </div>
        <ul>
          {templates.map((template) => (
            <li key={template.id}>
              <strong>{template.name} · v{template.version}</strong> — {template.description}
              <ul>
                {template.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        {hypotheses.length === 0 ? <p className="muted">Templates become selectable after Pulse proposes a testable hypothesis.</p> : null}
      </section>
      {calendar.entries.length > 0 ? (
        <div className="card">
          <p>
            <strong>{calendar.summary.active}</strong> active · <strong>{calendar.summary.upcoming}</strong> upcoming ·{" "}
            <strong>{calendar.summary.completed}</strong> awaiting analysis · <strong>{calendar.summary.analysed}</strong>{" "}
            analysed
            {calendar.nextAnalysisDate ? <> — next analysis {calendar.nextAnalysisDate}</> : null}
          </p>
          {calendar.conflicts.length > 0 ? (
            <div className="calendar__conflict" role="alert">
              <p>
                <strong>{calendar.conflicts.length === 1 ? "Scheduling conflict" : "Scheduling conflicts"}:</strong>{" "}
                {calendar.conflicts.length === 1
                  ? "one day has"
                  : `${calendar.conflicts.length} days have`}{" "}
                more than one experiment assigned — you would be asked to run both.
              </p>
              <ul>
                {calendar.conflicts.map((conflict) => (
                  <li key={conflict.date}>
                    {conflict.date}: {conflict.titles.join(" and ")}
                    {conflict.sameMetric ? <> — both target {conflict.metricIds.join(", ")}</> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {calendar.active.some((entry) => entry.todayCondition) ? (
            <ul>
              {calendar.active
                .filter((entry) => entry.todayCondition)
                .map((entry) => (
                  <li key={entry.design.id}>
                    <strong>Today:</strong> {entry.design.title} —{" "}
                    {entry.todayCondition === "A" ? entry.design.conditionA.label : entry.design.conditionB.label}
                    {entry.todayPeriod
                      ? ` · Day ${entry.todayPeriod.dayInPeriod}/${entry.todayPeriod.period.dayCount}`
                      : null}
                    : {entry.todayInstruction}
                  </li>
                ))}
            </ul>
          ) : null}
          {calendar.schedule.length > 0 ? (
            <details>
              <summary>Upcoming schedule ({calendar.schedule.length} assignments)</summary>
              <ul>
                {calendar.schedule.map((assignment) => (
                  <li
                    key={`${assignment.date}-${assignment.experimentId}`}
                    className={conflictDates.has(assignment.date) ? "warn" : undefined}
                  >
                    {assignment.date}: {assignment.title} — {assignment.period}
                    {conflictDates.has(assignment.date) ? " — conflicts with another experiment" : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      {designs.length === 0 ? (
        <p className="empty">
          No experiments yet. Pulse proposes one when an association is strong enough and the behaviour is something you
          control.
        </p>
      ) : (
        designs.map((design) => {
          const result = resultById.get(design.id);
          return (
            <article key={design.id} className="card">
              <h3>{design.title}</h3>
              <p>{design.hypothesis}</p>
              <dl className="finding__stats">
                <div>
                  <dt>Design</dt>
                  <dd>{design.type}</dd>
                </div>
                {design.templateId ? (
                  <div>
                    <dt>Template</dt>
                    <dd>
                      {design.templateId} · v{design.templateVersion ?? 1}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Condition A</dt>
                  <dd>{design.conditionA.instruction}</dd>
                </div>
                <div>
                  <dt>Condition B</dt>
                  <dd>{design.conditionB.instruction}</dd>
                </div>
                <div>
                  <dt>Target metric</dt>
                  <dd>{design.targetMetricId}</dd>
                </div>
                <div>
                  <dt>Minimum sample</dt>
                  <dd>{design.minSamplePerCondition} sessions per condition</dd>
                </div>
                <div>
                  <dt>Runs</dt>
                  <dd>
                    {design.startDate} to {design.endDate} ({design.durationDays} days)
                  </dd>
                </div>
                <div>
                  <dt>Periods</dt>
                  <dd>
                    <ul>
                      {derivePeriods(design).map((period) => (
                        <li key={period.index}>
                          Period {period.index}: {period.label} — {period.startDate} to {period.endDate} (
                          {period.dayCount} {period.dayCount === 1 ? "day" : "days"})
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt>Analysis</dt>
                  <dd>{design.analysisMethod}</dd>
                </div>
              </dl>
              <details>
                <summary>Likely confounders and success criteria</summary>
                <ul>
                  {design.likelyConfounders.map((confounder) => (
                    <li key={confounder}>{confounder}</li>
                  ))}
                </ul>
                <p>{design.successCriteria}</p>
              </details>

              {result ? (
                <div className={`verdict verdict--${result.verdict}`}>
                  <h4>Result: {result.verdict}</h4>
                  <p>{result.summary}</p>
                  <p className="muted">{result.causalityNote}</p>
                  <ul>
                    {result.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    pulse.analyseExperiment(design.id);
                    onChange();
                  }}
                >
                  Analyse this run
                </button>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}

const SUGGESTED_QUESTIONS = [
  "When do I revise most effectively?",
  "Does exercise affect study accuracy?",
  "Which method produces the best retention?",
  "What changed this week?",
  "What should I test next?",
];

function AskPanel({ pulse, initialQuestion = "" }: { pulse: Pulse; initialQuestion?: string }): React.JSX.Element {
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState<ReturnType<Pulse["ask"]> | null>(null);

  const submit = (value: string): void => {
    setQuestion(value);
    setAnswer(pulse.ask(value));
  };

  return (
    <section role="tabpanel" id="panel-ask" aria-labelledby="tab-ask" tabIndex={-1}>
      <h2>Ask Pulse</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(question);
        }}
      >
        <label htmlFor="ask-input">Ask a question about your own data</label>
        <input
          id="ask-input"
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="When do I revise most effectively?"
        />
        <button type="submit">Ask</button>
      </form>

      <ul className="suggestions">
        {SUGGESTED_QUESTIONS.map((suggestion) => (
          <li key={suggestion}>
            <button type="button" onClick={() => submit(suggestion)}>
              {suggestion}
            </button>
          </li>
        ))}
      </ul>

      {answer ? (
        <div className="card" aria-live="polite">
          <h3>{answer.question}</h3>
          <p>{answer.statement}</p>
          {answer.evidence.length > 0 ? (
            <>
              <h4>Based on</h4>
              <ul>
                {answer.evidence.map((evidence) => (
                  <li key={evidence.description}>{evidence.description}</li>
                ))}
              </ul>
            </>
          ) : null}
          {answer.caveats.length > 0 ? (
            <>
              <h4>Caveats</h4>
              <ul>
                {answer.caveats.map((caveat) => (
                  <li key={caveat} className="warn">
                    {caveat}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const SUGGESTED_SEARCHES = ["accuracy", "evening", "sleep", "method", "pronunciation"];

/**
 * Evidence search: findings, the rejection trail, experiments and
 * hypotheses, ranked by how much of the query each mentions. Absence is
 * inspectable here — search is how a user sees that a metric was checked
 * and why it was not published.
 */
function EvidenceSearchPanel({
  pulse,
  revision,
  searchInput,
  searchSubmitted,
  onSearchInputChange,
  onSearchSubmit,
  onOpenFinding,
  onOpenHistory,
  onOpenScan,
}: {
  pulse: Pulse;
  revision: number;
  /** Lifted so a deep link can return to the exact query — see App. */
  searchInput: string;
  searchSubmitted: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  onOpenFinding: (findingId: string) => void;
  onOpenHistory: (signature: string) => void;
  onOpenScan: (scanId: string, reason: string) => void;
}): React.JSX.Element {
  // Which rejection hit has its context expanded, keyed by `${kind}:${title}`.
  const [expanded, setExpanded] = useState<string | null>(null);

  // As above: `revision` is how this view learns the engine changed.
  /* eslint-disable react-hooks/exhaustive-deps */
  const hits = useMemo(() => pulse.search(searchSubmitted), [pulse, revision, searchSubmitted]);
  const rejected = useMemo(() => pulse.export().rejected, [pulse, revision]);
  // Only offer a journey link when the insight actually has one — a search
  // hit that is newer than every recorded scan cannot be opened in History.
  const historySignatures = useMemo(
    () => new Set(pulse.insightHistory.history().map((entry) => entry.signature)),
    [pulse, revision],
  );
  const scans = useMemo(() => pulse.insightHistory.listScans(), [pulse, revision]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <section role="tabpanel" id="panel-search" aria-labelledby="tab-search" tabIndex={-1}>
      <h2>Evidence search</h2>
      <p className="muted">
        Everything Pulse knows is searchable: published findings, the {rejected.length} question(s) the last scan checked
        and declined to publish, experiments and hypotheses. Absence is inspectable — search is how you see that a
        metric was checked and why it was not reported.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit(searchInput);
        }}
      >
        <label htmlFor="evidence-input">Search the evidence</label>
        <input
          id="evidence-input"
          type="search"
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder="e.g. accuracy, evening, sleep"
        />
        <button type="submit">Search</button>
      </form>

      <ul className="suggestions">
        {SUGGESTED_SEARCHES.map((suggestion) => (
          <li key={suggestion}>
            <button type="button" onClick={() => onSearchSubmit(suggestion)}>
              {suggestion}
            </button>
          </li>
        ))}
      </ul>

      {searchSubmitted === "" ? (
        <p className="empty">
          Try a metric you care about, a behaviour, or a time of day. A finding that failed the evidence bar still
          shows up here, with the reason it was not published.
        </p>
      ) : hits.length === 0 ? (
        <p className="empty">Nothing in the evidence matches “{searchSubmitted}”.</p>
      ) : (
        <ol className="evidence-results">
          {hits.map((hit, index) => {
            const hitKey = `${hit.kind}:${hit.title}`;
            const contextId = `rejection-context-${index}`;
            const isExpanded = expanded === hitKey;
            return (
              <li key={hitKey} className="card evidence-hit">
                <header className="history-entry__header">
                  <h3>
                    {hit.finding ? (
                      <button
                        type="button"
                        className="evidence-hit__title-button"
                        onClick={() => onOpenFinding(hit.finding!.id)}
                      >
                        {hit.title}
                      </button>
                    ) : (
                      hit.title
                    )}
                  </h3>
                  <span className={`pill pill--kind-${hit.kind}`}>{EVIDENCE_HIT_LABEL[hit.kind]}</span>
                </header>
                <p>{hit.summary}</p>
                {hit.finding ? (
                  <p className="muted">
                    {hit.finding.replicationStatus ? (
                      <>
                        <span className={`pill pill--replication-${hit.finding.replicationStatus}`}>
                          {REPLICATION_LABEL[hit.finding.replicationStatus]}
                        </span>{" "}
                      </>
                    ) : null}
                    {hit.finding.effect.label} · {hit.finding.sampleDescription}
                  </p>
                ) : null}
                {hit.finding && hit.signature && historySignatures.has(hit.signature) ? (
                  <p>
                    <button
                      type="button"
                      className="evidence-hit__history-button"
                      onClick={() => onOpenHistory(hit.signature!)}
                    >
                      See how this changed over time
                    </button>
                  </p>
                ) : null}
                {hit.rejection ? (
                  <>
                    <p className="muted">Why it was not published: {hit.rejection.reason}</p>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={contextId}
                      onClick={() => setExpanded(isExpanded ? null : hitKey)}
                    >
                      {isExpanded ? "Hide context" : "Show context"}
                    </button>
                    {isExpanded ? (
                      <RejectionContext
                        id={contextId}
                        rejection={hit.rejection}
                        family={rejected.filter((entry) => entry.outcomeMetricId === hit.rejection!.outcomeMetricId)}
                        registry={pulse.registry}
                      />
                    ) : null}
                    {scanForRejection(hit.rejection, scans) ? (
                      <p>
                        <button
                          type="button"
                          className="evidence-hit__history-button"
                          onClick={() =>
                            onOpenScan(scanForRejection(hit.rejection!, scans)!.scanId, hit.rejection!.reason)
                          }
                        >
                          View the scan that checked this
                        </button>
                      </p>
                    ) : null}
                  </>
                ) : null}
                {hit.hypothesis ? <p className="muted">{hit.hypothesis.status.replace(/-/g, " ")} hypothesis</p> : null}
                {hit.experimentResult ? (
                  <p className={`muted verdict verdict--${hit.experimentResult.verdict}`}>
                    {hit.experimentResult.verdict.replace(/-/g, " ")} experiment
                  </p>
                ) : null}
                {hit.matchedTerms.length > 0 ? (
                  <p className="muted evidence-hit__terms">matched: {hit.matchedTerms.join(", ")}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * The context of a rejected claim: which outcome and exposure it compared,
 * and the rest of the family of questions asked about that outcome in the
 * same scan. A rejection is only meaningful next to its siblings.
 */
function RejectionContext({
  id,
  rejection,
  family,
  registry,
}: {
  id: string;
  rejection: RejectedClaim;
  family: readonly RejectedClaim[];
  registry: MetricRegistry;
}): React.JSX.Element {
  const outcome = registry.get(rejection.outcomeMetricId)?.name ?? rejection.outcomeMetricId;
  const exposure = rejection.exposureMetricId
    ? (registry.get(rejection.exposureMetricId)?.name ?? rejection.exposureMetricId)
    : null;

  return (
    <div className="evidence-hit__context" id={id}>
      <dl className="finding__stats">
        <div>
          <dt>Outcome checked</dt>
          <dd>{outcome}</dd>
        </div>
        {exposure ? (
          <div>
            <dt>Exposure compared</dt>
            <dd>{exposure}</dd>
          </div>
        ) : null}
        <div>
          <dt>Question</dt>
          <dd>{rejection.question}</dd>
        </div>
        <div>
          <dt>Failed because</dt>
          <dd>{rejection.reason}</dd>
        </div>
      </dl>
      <p className="muted">
        One of {family.length} question(s) asked about {outcome} in this scan — none of them were published.
      </p>
      <ul>
        {family.map((sibling) => (
          <li key={sibling.question}>{sibling.question}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Finds the discovery scan that produced a rejected claim. Scans are keyed
 * by outcome, exposure and reason — the question text is not persisted in the
 * scan record — which is unambiguous because the reason carries the p-value.
 */
function scanForRejection(
  rejection: RejectedClaim,
  scans: readonly InsightScanRecord[],
): InsightScanRecord | null {
  return (
    scans.find((scan) =>
      scan.rejected.some(
        (entry) =>
          entry.outcomeMetricId === rejection.outcomeMetricId &&
          (entry.exposureMetricId ?? "") === (rejection.exposureMetricId ?? "") &&
          entry.reason === rejection.reason,
      ),
    ) ?? null
  );
}

/**
 * A discovery scan as a destination: what it analysed, what it published,
 * and every question it asked and declined — the rejection's context is the
 * scan that produced it.
 */
function ScanDetail({
  scan,
  focusRejectionReason,
  highlight,
  currentFindingIds,
  onOpenFinding,
  registry,
}: {
  scan: InsightScanRecord;
  /** The rejection the user came from, marked inside the declined list. */
  focusRejectionReason: string | null;
  /** Transient: flash the card on arrival. */
  highlight: boolean;
  /** Findings still published today — only those can be opened as cards. */
  currentFindingIds: ReadonlySet<string>;
  onOpenFinding: (findingId: string) => void;
  registry: MetricRegistry;
}): React.JSX.Element {
  return (
    <article
      id={`scan-${scan.scanId}`}
      className={`card scan-detail${highlight ? " scan--highlight" : ""}`}
    >
      <header className="history-entry__header">
        <h3>Discovery scan {scan.scanId}</h3>
        <span className="pill pill--kind-rejection">Scan record</span>
      </header>
      <p className="muted">
        {formatDay(scan.at)} · {scan.eventCount} event(s) analysed
      </p>
      <dl className="finding__stats">
        <div>
          <dt>Findings published</dt>
          <dd>{scan.totals.findings}</dd>
        </div>
        <div>
          <dt>Questions checked, declined</dt>
          <dd>{scan.totals.rejected}</dd>
        </div>
        <div>
          <dt>Family size</dt>
          <dd>{scan.totals.familySize}</dd>
        </div>
        <div>
          <dt>Families</dt>
          <dd>{scan.totals.familyCount}</dd>
        </div>
        <div>
          <dt>Expected false discoveries</dt>
          <dd>{scan.totals.expectedFalseDiscoveries.toFixed(1)}</dd>
        </div>
      </dl>
      <h4>Findings published in this scan</h4>
      {scan.findings.length === 0 ? (
        <p className="muted">None — nothing met the evidence bar.</p>
      ) : (
        <ul>
          {scan.findings.map((finding) =>
            currentFindingIds.has(finding.id) ? (
              <li key={finding.id}>
                <button
                  type="button"
                  className="scan-detail__finding-button"
                  onClick={() => onOpenFinding(finding.id)}
                >
                  {finding.title}
                </button>{" "}
                <span className="muted">({finding.effect.label})</span>
              </li>
            ) : (
              <li key={finding.id}>
                {finding.title} <span className="muted">({finding.effect.label})</span>
              </li>
            ),
          )}
        </ul>
      )}
      <h4>Questions checked and declined</h4>
      {scan.rejected.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <ul>
          {scan.rejected.map((entry, index) => {
            const focused = focusRejectionReason === entry.reason;
            const outcome = registry.get(entry.outcomeMetricId)?.name ?? entry.outcomeMetricId;
            const exposure = entry.exposureMetricId
              ? (registry.get(entry.exposureMetricId)?.name ?? entry.exposureMetricId)
              : null;
            return (
              <li
                key={`${entry.outcomeMetricId}-${index}`}
                className={focused ? "scan-detail__rejected--focused" : undefined}
              >
                {focused ? (
                  <p>
                    <strong>You came from this rejection</strong>
                  </p>
                ) : null}
                {entry.question ?? `Checked ${outcome}${exposure ? ` against ${exposure}` : ""} and not published.`}
                <span className="muted"> — {entry.reason}</span>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function downloadResearchExport(pulse: Pulse): void {
  const payload = JSON.stringify(pulse.researchExport(), null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pulse-research-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * The source app's own Pulse gate, read live from its storage. A revoked flag
 * is shown as "paused at source" so a source the user switched off in its own
 * app is visibly stopped here, not silently quiet. Sources without an app-side
 * gate (Forq, French Practice) say so rather than pretending to be consented.
 */
function AppSideConsent({ connector }: { connector: Connector }): React.JSX.Element {
  const status: SourceConsentStatus | null | undefined = connector.consentStatus?.();
  if (!status) {
    return (
      <p className="muted">
        App-side opt-in: <strong>none</strong> — this source shares whenever it has data.
      </p>
    );
  }
  if (status.kind === "server") {
    return (
      <p className="muted">
        App-side opt-in: <strong>gated server-side</strong> — {status.message}
      </p>
    );
  }
  if (status.granted) {
    return (
      <p className="muted">
        App-side opt-in: <strong>granted</strong> — {status.message}
      </p>
    );
  }
  return (
    <p className="warn">
      App-side opt-in: <strong>paused at source</strong> — {status.message}
    </p>
  );
}

function SourcesPanel({
  pulse,
  quality,
  onChange,
}: {
  pulse: Pulse;
  quality: ReturnType<Pulse["quality"]>;
  onChange: () => void;
}): React.JSX.Element {
  const connectors = pulse.listConnectors();
  const qualityBySource = new Map(quality.map((entry) => [String(entry.source), entry]));
  const dashboard = pulse.connectorDashboard({ windowDays: 30 });

  return (
    <section role="tabpanel" id="panel-sources" aria-labelledby="tab-sources" tabIndex={-1}>
      <section className="connector-dashboard" aria-labelledby="connector-dashboard-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Connector health dashboard</p>
            <h2 id="connector-dashboard-title">Are the inputs still telling the truth?</h2>
          </div>
          <span className="status status--controlled">{dashboard.summary.healthy}/{dashboard.summary.connected} healthy</span>
        </div>
        <div className="connector-health-grid">
          {dashboard.cards.map((card) => (
            <article className="connector-health-card" key={String(card.source)}>
              <div className="section-heading"><strong>{card.name}</strong><span className={`status status--${card.freshness === "fresh" ? "controlled" : card.freshness === "unknown" ? "checked-balanced" : "uncontrolled"}`}>{card.freshness}</span></div>
              <p className="muted">{card.eventCount} events · {card.daysWithData}/{card.coverageDays} days covered</p>
              {card.attention.length ? <details><summary>Recovery guidance ({card.attention.length})</summary><ul>{card.attention.map((item) => <li key={item.message} className={item.severity === "critical" ? "warn" : "muted"}>{item.message}{item.remedy ? ` — ${item.remedy}` : ""}</li>)}</ul></details> : <p className="muted">No recovery action needed.</p>}
            </article>
          ))}
        </div>
        {dashboard.blackoutDays.length ? <p className="muted">Shared quiet days are treated as a possible blackout, not five separate connector faults: {dashboard.blackoutDays.length} day(s) in the window.</p> : null}
      </section>

      <section className="card" aria-labelledby="research-export-title">
        <h2 id="research-export-title">Research export</h2>
        <p className="muted">
          A de-identified, statistics-first snapshot for sharing with a researcher or a study: findings with effect
          sizes, confidence intervals and corrected p-values, experiment verdicts, and data coverage. No raw events, no
          free text, no authored beliefs, and no sensitive sources.
        </p>
        <div className="actions">
          <button type="button" onClick={() => downloadResearchExport(pulse)}>
            Download research export
          </button>
        </div>
      </section>

      <h2>Connected sources</h2>
      <p className="muted">
        Pulse processes everything on this device. Each source is connected separately, can be revoked at any time, and
        its data can be deleted on its own.
      </p>

      {connectors.map((connector) => {
        const grant = pulse.consent.get(connector.id);
        const health = qualityBySource.get(String(connector.id));
        return (
          <article key={String(connector.id)} className="card">
            <h3>{connector.name}</h3>
            <p>{connector.description}</p>
            {connector.requiresExplicitPermission ? (
              <p className="warn">This source holds sensitive personal data and must be granted on its own.</p>
            ) : null}

            <h4>What Pulse would read</h4>
            <ul>
              {connector.scopes.map((scope) => (
                <li key={scope.id}>
                  {scope.description}
                  {scope.readsContent ? <span className="warn"> (derived from what you wrote)</span> : null}
                </li>
              ))}
            </ul>

            <p>
              Status: <strong>{grant?.granted ? "connected" : "not connected"}</strong>
              {health ? (
                <>
                  {" "}
                  — data quality <strong>{health.grade}</strong> ({health.eventCount} events)
                </>
              ) : null}
            </p>
            <AppSideConsent connector={connector} />

            {health && health.issues.length > 0 ? (
              <ul>
                {health.issues.map((issue) => (
                  <li key={issue.message} className={issue.severity === "info" ? "muted" : "warn"}>
                    {issue.message}
                    {issue.remedy ? <span className="muted"> — {issue.remedy}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="actions">
              {grant?.granted ? (
                <button
                  type="button"
                  onClick={() => {
                    void pulse.forgetSource(connector.id).then(onChange);
                  }}
                >
                  Revoke and delete all {connector.name} data
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    pulse.connect(connector.id);
                    onChange();
                  }}
                >
                  Connect {connector.name}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
