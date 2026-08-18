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

import { useCallback, useMemo, useState } from "react";
import type { Pulse } from "../pulse.js";
import type { Finding } from "../discovery/finding.js";
import type { InsightChange } from "../history/insight-history.js";
import { FindingCard, REPLICATION_LABEL } from "./FindingCard.js";

export type TabId = "insights" | "history" | "timeline" | "experiments" | "ask" | "sources";

const TABS: { id: TabId; label: string }[] = [
  { id: "insights", label: "Insights" },
  { id: "history", label: "History" },
  { id: "timeline", label: "Timeline" },
  { id: "experiments", label: "Experiments" },
  { id: "ask", label: "Ask Pulse" },
  { id: "sources", label: "Sources & privacy" },
];

export interface AppProps {
  pulse: Pulse;
}

export function App({ pulse }: AppProps): React.JSX.Element {
  const [tab, setTab] = useState<TabId>("insights");
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
  /* eslint-enable react-hooks/exhaustive-deps */

  const onFeedback = useCallback(
    (findingId: string, verdict: "useful" | "not-useful" | "already-knew") => {
      const finding = discovery.findings.find((candidate) => candidate.id === findingId);
      pulse.feedback.record(findingId, verdict, finding?.metricIds ?? []);
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

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <img src="/logo.svg" alt="" width={28} height={28} className="app__logo" aria-hidden="true" />
          <h1>Pulse</h1>
        </div>
        <p className="app__tagline">Evidence about you, with its working shown.</p>
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
        {tab === "history" ? <HistoryPanel pulse={pulse} revision={revision} /> : null}
        {tab === "insights" ? (
          <section role="tabpanel" id="panel-insights" aria-labelledby="tab-insights" tabIndex={-1}>
            <h2>This week</h2>
            <p className="brief__headline">{brief.headline}</p>

            <h2>What Pulse believes</h2>
            <p className="muted">
              {discovery.findings.length} finding(s) survived correction across {discovery.familySize} comparisons, split
              into {discovery.familyCount} families of related questions (largest: {discovery.largestFamilySize}), at a{" "}
              {Math.round(discovery.fdrLevel * 100)}% false-discovery rate. Expect roughly{" "}
              {discovery.expectedFalseDiscoveries.toFixed(1)} of them to be false.
            </p>

            {discovery.findings.length === 0 ? (
              <p className="empty">
                Nothing in your data yet meets the evidence bar. That is a result, not a gap — Pulse would rather show
                you nothing than something it cannot stand behind.
              </p>
            ) : (
              discovery.findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onFeedback={onFeedback}
                  onDesignExperiment={onDesignExperiment}
                />
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

        {tab === "timeline" ? <TimelinePanel pulse={pulse} /> : null}
        {tab === "experiments" ? <ExperimentsPanel pulse={pulse} revision={revision} onChange={refresh} /> : null}
        {tab === "ask" ? <AskPanel pulse={pulse} /> : null}
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
function HistoryPanel({ pulse, revision }: { pulse: Pulse; revision: number }): React.JSX.Element {
  // As above: `revision` is how this view learns the engine changed.
  /* eslint-disable react-hooks/exhaustive-deps */
  const entries = useMemo(() => pulse.insightHistory.history(), [pulse, revision]);
  const scanCount = useMemo(() => pulse.insightHistory.size(), [pulse, revision]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <section role="tabpanel" id="panel-history" aria-labelledby="tab-history" tabIndex={-1}>
      <h2>How the insights have changed</h2>
      <p className="muted">
        {scanCount} discovery scan(s) recorded; {entries.length} insight(s) tracked across them. Identical re-scans of
        unchanged data are not recorded.
      </p>

      {entries.length === 0 ? (
        <p className="empty">
          Nothing to show yet. Pulse records every discovery scan, and this view will show how each insight appeared,
          strengthened, weakened or disappeared as your data grew.
        </p>
      ) : (
        entries.map((entry) => (
          <article key={entry.signature} className="card history-entry">
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
                    <span className="muted">
                      {episode.finding.effect.label} — {episode.finding.sampleDescription}
                    </span>
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
  onChange,
}: {
  pulse: Pulse;
  revision: number;
  onChange: () => void;
}): React.JSX.Element {
  // As above: `revision` is how this view learns the engine changed.
  /* eslint-disable react-hooks/exhaustive-deps */
  const designs = useMemo(() => pulse.listDesigns(), [pulse, revision]);
  const results = useMemo(() => pulse.experimentResultsList(), [pulse, revision]);
  const calendar = useMemo(() => pulse.calendar(), [pulse, revision]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const resultById = new Map(results.map((result) => [result.experimentId, result]));
  const conflictDates = new Set(calendar.conflicts.map((conflict) => conflict.date));

  return (
    <section role="tabpanel" id="panel-experiments" aria-labelledby="tab-experiments" tabIndex={-1}>
      <h2>Personal experiments</h2>
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
                  <li
                    key={`${assignment.date}-${assignment.experimentId}`}
                    className={conflictDates.has(assignment.date) ? "warn" : undefined}
                  >
                    {assignment.date}: {assignment.title} — condition {assignment.condition}
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

function AskPanel({ pulse }: { pulse: Pulse }): React.JSX.Element {
  const [question, setQuestion] = useState("");
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

  return (
    <section role="tabpanel" id="panel-sources" aria-labelledby="tab-sources" tabIndex={-1}>
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
