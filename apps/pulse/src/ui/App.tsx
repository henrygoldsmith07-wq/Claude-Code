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
import type { Pulse } from "../pulse.js";
import type { Finding, ReplicationStatus } from "../discovery/finding.js";
import { relationshipSubject } from "../discovery/relationship.js";
import { FindingCard } from "./FindingCard.js";
import { EvidencePanel } from "./EvidencePanel.js";
import { LibraryPanel } from "./LibraryPanel.js";
import { ProductTrustPanel, type FeedbackAction } from "./ProductTrustPanel.js";
import { StatisticalInspector } from "./StatisticalInspector.js";

export type TabId = "insights" | "evidence" | "inspector" | "timeline" | "experiments" | "ask" | "library" | "sources";

const TABS: { id: TabId; label: string }[] = [
  { id: "insights", label: "Insights" },
  { id: "evidence", label: "Evidence" },
  { id: "inspector", label: "Inspector" },
  { id: "timeline", label: "Timeline" },
  { id: "experiments", label: "Experiments" },
  { id: "ask", label: "Ask Pulse" },
  { id: "library", label: "Hypothesis library" },
  { id: "sources", label: "Sources & privacy" },
];

const REPLICATION_LABEL: Record<ReplicationStatus, string> = {
  new: "New",
  replicated: "Replicated",
  "failed-to-replicate": "Failed to replicate",
  "experimentally-supported": "Experimentally supported",
  contradicted: "Contradicted",
};

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
      pulse.designExperiment(hypothesis.id, {
        startDate: brief.weekEnd,
        sessionsPerWeek: 4,
      });
      refresh();
    },
    [brief.weekEnd, pulse, refresh],
  );

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
        {tab === "sources" ? <SourcesPanel pulse={pulse} quality={quality} onChange={refresh} /> : null}
      </main>
    </div>
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
          {calendar.active.some((entry) => entry.todayCondition) ? (
            <ul>
              {calendar.active
                .filter((entry) => entry.todayCondition)
                .map((entry) => (
                  <li key={entry.design.id}>
                    <strong>Today:</strong> {entry.design.title} —{" "}
                    {entry.todayCondition === "A" ? entry.design.conditionA.label : entry.design.conditionB.label}:{" "}
                    {entry.todayInstruction}
                  </li>
                ))}
            </ul>
          ) : null}
          {calendar.schedule.length > 0 ? (
            <details>
              <summary>Upcoming schedule ({calendar.schedule.length} assignments)</summary>
              <ul>
                {calendar.schedule.map((assignment) => (
                  <li key={`${assignment.date}-${assignment.experimentId}`}>
                    {assignment.date}: {assignment.title} — condition {assignment.condition}
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

function downloadResearchExport(pulse: Pulse): void {
  const payload = JSON.stringify(pulse.researchExport(), null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pulse-research-export-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
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
