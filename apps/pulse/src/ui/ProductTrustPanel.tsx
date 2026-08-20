import { useMemo, useState } from "react";
import type { Pulse } from "../pulse.js";
import type { Finding } from "../discovery/finding.js";
import { ReplicationLedger } from "../discovery/replication.js";
import { buildReplicationSchedule } from "../discovery/replication-schedule.js";
import { detectInvalidExperimentDays, MISSING_DATA_REASONS, type MissingDataReason } from "../experiments/data-quality.js";
import type { InsightCollection } from "../history/insight-collections.js";
import { buildReliabilityProfiles, type ReliabilityProfile } from "../quality/profiles.js";
import type { SourceQuality } from "../quality/score.js";
import type { Recommendation } from "../recommendations/rank.js";
import type { RecommendationResponse } from "../recommendations/value.js";
import type { DiscoveryReport } from "../discovery/engine.js";
import type { DiscoveryInboxItem } from "../discovery/inbox.js";
import type { TodayBrief, TodayMatter } from "../reports/today.js";

export type FeedbackAction = "useful" | "not-useful" | "already-knew" | "bad-data" | "stop-investigating";

export interface ProductTrustPanelProps {
  pulse: Pulse;
  findings: Finding[];
  discovery: DiscoveryReport;
  quality: SourceQuality[];
  recommendations: Recommendation[];
  todayBrief: TodayBrief;
  discoveryInbox: DiscoveryInboxItem[];
  revision: number;
  onFeedback: (findingId: string, action: FeedbackAction) => void;
  onRecommendationResponse: (recommendationId: string, response: RecommendationResponse) => void;
  onRecommendationOutcome: (recommendationId: string, helped: boolean) => void;
  onDesignExperiment: (finding: Finding) => void;
  onOpenAsk: () => void;
  onChange: () => void;
}

export function ProductTrustPanel({
  pulse,
  findings,
  discovery,
  quality,
  recommendations,
  todayBrief,
  discoveryInbox,
  revision,
  onFeedback,
  onRecommendationResponse,
  onRecommendationOutcome,
  onDesignExperiment,
  onOpenAsk,
  onChange,
}: ProductTrustPanelProps): React.JSX.Element {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [lineageOpen, setLineageOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [classifiedDays, setClassifiedDays] = useState<Record<string, MissingDataReason>>({});
  const [newCollectionName, setNewCollectionName] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState(findings[0]?.id ?? "");

  /* The engine is mutable by design. revision tells this view when a user
     action changed a ledger or tracker and its derived rows should refresh. */
  /* eslint-disable react-hooks/exhaustive-deps */
  const dashboard = useMemo(() => pulse.connectorDashboard({ windowDays: 30 }), [pulse, revision]);
  const history = useMemo(() => pulse.insightHistory.history(), [pulse, revision]);
  const schedule = useMemo(
    () => buildReplicationSchedule(findings, pulse.replication.list(), { today: discovery.findings[0]?.createdAt.slice(0, 10) ?? "2025-07-01" }),
    [findings, pulse, revision, discovery.findings],
  );
  const profiles = useMemo(() => buildReliabilityProfiles(quality, pulse.events()), [quality, pulse, revision]);
  const designs = useMemo(() => pulse.listDesigns(), [pulse, revision]);
  const results = useMemo(() => pulse.experimentResultsList(), [pulse, revision]);
  const measurement = useMemo(() => pulse.events()[0], [pulse, revision]);
  const collections = useMemo(() => pulse.insightCollections.list(), [pulse, revision]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const primaryFinding = findings.find((finding) => finding.replicationStatus !== "contradicted") ?? findings[0];
  const primaryRecommendation = recommendations[0];
  const confidenceScore = findings.length
    ? findings.reduce((sum, finding) => sum + finding.confidence.score, 0) / findings.length
    : 0;
  const freshnessScore = quality.length
    ? quality.reduce((sum, source) => sum + (source.dimensions.find((dimension) => dimension.id === "freshness")?.score ?? 0), 0) / quality.length
    : 0;
  const funnel = pulse.recommendationFunnel();
  const invalidDays = designs.flatMap((design) => detectInvalidExperimentDays(design, pulse.events(), pulse.registry).map((day) => ({ ...day, title: design.title })));
  const experimentCompletion = designs.length ? results.length / designs.length : 0;
  const activeCollectionId = collections.some((collection) => collection.id === selectedCollectionId) ? selectedCollectionId : collections[0]?.id ?? "";
  const activeFindingId = findings.some((finding) => finding.id === selectedFindingId) ? selectedFindingId : findings[0]?.id ?? "";

  const createCollection = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const collection = pulse.createInsightCollection(newCollectionName);
    setNewCollectionName("");
    setSelectedCollectionId(collection.id);
    setNotice(`Collection “${collection.title}” created.`);
    onChange();
  };

  const addToCollection = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const finding = findings.find((candidate) => candidate.id === activeFindingId);
    if (!finding || !activeCollectionId) return;
    pulse.addFindingToInsightCollection(activeCollectionId, finding);
    setNotice(`Saved “${finding.title}” to the collection.`);
    onChange();
  };

  const removeFromCollection = (collection: InsightCollection, signature: string): void => {
    pulse.removeInsightFromCollection(collection.id, signature);
    onChange();
  };

  const deleteCollection = (collection: InsightCollection): void => {
    pulse.deleteInsightCollection(collection.id);
    setSelectedCollectionId(collections.find((candidate) => candidate.id !== collection.id)?.id ?? "");
    setNotice(`Collection “${collection.title}” deleted.`);
    onChange();
  };

  return (
    <section className="today-panel" aria-labelledby="today-title">
      <div className="today-panel__hero">
        <div>
          <p className="eyebrow">Today · evidence control room</p>
          <h2 id="today-title">Know what changed. Know what to do next.</h2>
          <p className="muted">A calm view of the signals, caveats and follow-ups that deserve your attention today.</p>
        </div>
        <button type="button" className="ask-launch" onClick={onOpenAsk}>
          <span className="ask-launch__key">⌘ K</span>
          Ask Pulse anything
        </button>
      </div>

      <TodayDecisionBrief brief={todayBrief} />

      <div className="metric-grid" aria-label="Today summary">
        <Metric label="Evidence confidence" value={`${Math.round(confidenceScore * 100)}%`} detail={`${findings.length} active finding${findings.length === 1 ? "" : "s"}`} tone="blue" />
        <Metric label="Data freshness" value={`${Math.round(freshnessScore * 100)}%`} detail={`${dashboard.summary.healthy} source${dashboard.summary.healthy === 1 ? "" : "s"} healthy`} tone="green" />
        <Metric label="Replication queue" value={String(schedule.length)} detail={schedule.filter((entry) => entry.priority === "urgent").length ? "Needs a closer look" : "Nothing urgent"} tone="amber" />
        <Metric label="Recommendation value" value={funnel.measured ? `${Math.round(funnel.helpRate * 100)}%` : "—"} detail={funnel.measured ? `${funnel.measured} outcome${funnel.measured === 1 ? "" : "s"} measured` : "Awaiting follow-up"} tone="ink" />
      </div>

      <FreshnessStrip dashboard={dashboard} />

      <DiscoveryInbox items={discoveryInbox} />

      <div className="today-grid">
        <article className="focus-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Plain-English evidence summary</p>
              <h3>{primaryFinding ? primaryFinding.title : "No claim needs your attention"}</h3>
            </div>
            {primaryFinding ? <span className={`pill pill--confidence-${primaryFinding.confidence.level}`}>{primaryFinding.confidence.level}</span> : null}
          </div>
          {primaryFinding ? (
            <>
              <p className="focus-card__statement">{primaryFinding.statement}</p>
              <p className="finding__caveat" role="note">{primaryFinding.causalityNote}</p>
              <div className="focus-card__meta">
                <span>{primaryFinding.sampleDescription}</span>
                <span>{primaryFinding.sources.join(" · ")}</span>
                <span>{primaryFinding.replicationStatus ?? "new"}</span>
              </div>
              <div className="actions">
                <button type="button" onClick={() => setExpandedFinding(expandedFinding === primaryFinding.id ? null : primaryFinding.id)}>
                  {expandedFinding === primaryFinding.id ? "Hide evidence" : "Show evidence"}
                </button>
                {primaryFinding.nextAction?.kind === "run-experiment" ? <button type="button" onClick={() => onDesignExperiment(primaryFinding)}>Design experiment</button> : null}
              </div>
              {expandedFinding === primaryFinding.id ? <EvidenceDisclosure finding={primaryFinding} onFeedback={onFeedback} /> : null}
            </>
          ) : (
            <p className="empty">Pulse is still collecting enough data to make a claim. That restraint is intentional.</p>
          )}
        </article>

        <article className="recommendation-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recommendation follow-up</p>
              <h3>{primaryRecommendation ? primaryRecommendation.title : "No new action today"}</h3>
            </div>
            <span className="status status--controlled">Outcome loop</span>
          </div>
          {primaryRecommendation ? (
            <>
              <p>{primaryRecommendation.statement}</p>
              <p className="muted">{primaryRecommendation.rationale}</p>
              <p className="muted recommendation-card__evidence">
                Evidence: {primaryRecommendation.evidenceClass} · {primaryRecommendation.confidence.level} confidence · {primaryRecommendation.causalStatus}
              </p>
              <fieldset className="recommendation-response">
                <legend>What is your response?</legend>
                <div className="actions actions--wrap">
                  <button type="button" onClick={() => { onRecommendationResponse(primaryRecommendation.id, "try-this"); setNotice("Recommendation accepted — Pulse will ask for a follow-up."); }}>Try this</button>
                  <button type="button" onClick={() => { onRecommendationResponse(primaryRecommendation.id, "already-doing-this"); setNotice("Already doing this recorded — Pulse will treat it as followed."); }}>Already doing this</button>
                  <button type="button" onClick={() => { onRecommendationResponse(primaryRecommendation.id, "not-today"); setNotice("Not today recorded — Pulse will leave this open without treating it as a failure."); }}>Not today</button>
                  <button type="button" onClick={() => { onRecommendationResponse(primaryRecommendation.id, "not-useful"); setNotice("Not useful recorded — future ranking will be more cautious."); }}>Not useful</button>
                  <button type="button" onClick={() => { onRecommendationResponse(primaryRecommendation.id, "dont-suggest-again"); setNotice("Pulse will not suggest this recommendation again."); }}>Don't suggest this again</button>
                </div>
              </fieldset>
              <fieldset className="recommendation-outcome">
                <legend>After trying it</legend>
                <div className="actions actions--wrap">
                  <button type="button" onClick={() => { onRecommendationOutcome(primaryRecommendation.id, true); setNotice("Outcome recorded — thank you for closing the loop."); }}>It helped</button>
                  <button type="button" onClick={() => { onRecommendationOutcome(primaryRecommendation.id, false); setNotice("Outcome recorded — Pulse will learn cautiously from it."); }}>It didn't help</button>
                </div>
              </fieldset>
            </>
          ) : <p className="empty">No recommendation is justified by the evidence available.</p>}
        </article>
      </div>

      {notice ? <p className="toast" role="status">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></p> : null}

      <TrustSection title="Insight Collections" kicker="Keep related evidence together">
        <div className="collection-toolbar">
          <form className="collection-form" onSubmit={createCollection}>
            <label htmlFor="new-collection-name">New collection</label>
            <div className="collection-form__controls">
              <input id="new-collection-name" value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder="e.g. Study habits" required />
              <button type="submit">Create</button>
            </div>
          </form>
          <form className="collection-form" onSubmit={addToCollection}>
            <label htmlFor="collection-insight">Save an insight</label>
            <div className="collection-form__controls">
              <select id="collection-insight" value={activeFindingId} onChange={(event) => setSelectedFindingId(event.target.value)} disabled={!findings.length}>
                {findings.length ? findings.map((finding) => <option key={finding.id} value={finding.id}>{finding.title}</option>) : <option value="">No active insights</option>}
              </select>
              <select aria-label="Collection to save insight to" value={activeCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)} disabled={!collections.length}>
                {collections.length ? collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>) : <option value="">Create a collection first</option>}
              </select>
              <button type="submit" disabled={!findings.length || !collections.length}>Save</button>
            </div>
          </form>
        </div>
        {collections.length ? <div className="collection-list">{collections.map((collection) => <article className="collection-row" key={collection.id}>
          <div className="collection-row__header"><div><h4>{collection.title}</h4><span className="muted">{collection.insightSignatures.length} insight{collection.insightSignatures.length === 1 ? "" : "s"}</span></div><button type="button" onClick={() => deleteCollection(collection)} aria-label={`Delete collection ${collection.title}`}>Delete</button></div>
          {collection.insightSignatures.length ? <ul className="collection-insights">{collection.insightSignatures.map((signature) => {
            const current = findings.find((finding) => ReplicationLedger.signature(finding) === signature);
            return <li key={signature}><span>{current?.title ?? "Insight not in the current scan"}</span><button type="button" onClick={() => removeFromCollection(collection, signature)} aria-label={`Remove ${current?.title ?? "insight"} from ${collection.title}`}>Remove</button></li>;
          })}</ul> : <p className="empty-inline">Save an insight here when you want to revisit it.</p>}
        </article>)}</div> : <p className="empty-inline">Create a collection for evidence you want to compare, revisit or share.</p>}
      </TrustSection>

      <div className="trust-grid">
        <TrustSection title="Confidence change history" kicker="Every scan leaves a trail">
          {history.length ? history.slice(-4).reverse().map((entry) => {
            const latest = entry.episodes[entry.episodes.length - 1];
            return <div className="history-row" key={entry.signature}><span className={`history-row__dot history-row__dot--${latest?.change ?? "unchanged"}`} /><div><strong>{entry.title}</strong><span className="muted">{latest?.change ?? "unchanged"} · {entry.appearances} appearance{entry.appearances === 1 ? "" : "s"}</span></div><span className="pill">{entry.latestStatus}</span></div>;
          }) : <p className="empty-inline">The first scan starts the confidence history.</p>}
        </TrustSection>

        <TrustSection title="Contradictory evidence" kicker="Opposing directions stay visible">
          {pulse.contradictions.list().length ? pulse.contradictions.list().slice(0, 3).map((record) => <div className="ledger-row" key={record.id}><span className="status status--uncontrolled">Contested</span><div><strong>{record.outcomeMetricId} × {record.exposureMetricId}</strong><span className="muted">{record.sightings.length} sightings · {record.evidence}</span></div></div>) : <p className="empty-inline">No opposing directions detected in the current evidence set.</p>}
        </TrustSection>

        <TrustSection title="Automatic replication tracking" kicker="The next check is scheduled, not forgotten">
          {schedule.length ? schedule.slice(0, 3).map((entry) => <div className="ledger-row" key={entry.findingId}><span className={`status status--${entry.priority === "urgent" ? "uncontrolled" : "controlled"}`}>{entry.priority}</span><div><strong>{entry.title}</strong><span className="muted">Due {entry.dueDate} · {entry.rationale}</span></div><button type="button" onClick={() => setNotice(`Replication check for “${entry.title}” is scheduled for ${entry.dueDate}.`)}>Schedule</button></div>) : <p className="empty-inline">New findings will appear here when there is enough evidence to revisit them.</p>}
        </TrustSection>

        <TrustSection title="Full measurement lineage" kicker="From source to insight">
          {measurement ? <>
            <button type="button" className="lineage-toggle" onClick={() => setLineageOpen(!lineageOpen)} aria-expanded={lineageOpen}>{lineageOpen ? "Hide lineage" : "Show one recent measurement"}</button>
            {lineageOpen ? <dl className="lineage"><div><dt>Source</dt><dd>{measurement.source}</dd></div><div><dt>Event</dt><dd>{measurement.type}</dd></div><div><dt>Recorded</dt><dd>{measurement.occurredAt}</dd></div><div><dt>Local day</dt><dd>{measurement.localDate}</dd></div><div><dt>Connector</dt><dd>{measurement.provenance.connectorId} v{measurement.provenance.connectorVersion}</dd></div><div><dt>Sync</dt><dd>{measurement.provenance.syncId}</dd></div><div><dt>Raw record</dt><dd><code>{measurement.provenance.rawHash}</code></dd></div></dl> : null}
          </> : <p className="empty-inline">No measurements have arrived yet.</p>}
        </TrustSection>
      </div>

      <div className="trust-grid trust-grid--wide">
        <TrustSection title="Experiment integrity" kicker="Adherence and invalid days are part of the result">
          {designs.length ? designs.slice(0, 2).map((design) => {
            const invalid = invalidDays.filter((day) => day.title === design.title);
            const result = results.find((candidate) => candidate.experimentId === design.id);
            return <div className="experiment-row" key={design.id}><div className="section-heading"><div><strong>{design.title}</strong><span className="muted">{result ? `${Math.round(result.adherence.adherence * 100)}% adherence` : "In progress"} · {invalid.length} invalid day{invalid.length === 1 ? "" : "s"}</span></div><span className="pill">{result?.verdict ?? "running"}</span></div>{invalid.slice(0, 2).map((day) => <div className="invalid-day" key={day.date}><span>{day.date} · condition {day.condition}</span><select aria-label={`Reason for missing data on ${day.date}`} value={classifiedDays[day.date] ?? day.defaultClassification} onChange={(event) => setClassifiedDays((current) => ({ ...current, [day.date]: event.target.value as MissingDataReason }))}>{MISSING_DATA_REASONS.map((reason) => <option key={reason.id} value={reason.id}>{reason.label}</option>)}</select></div>)}</div>;
          }) : <p className="empty-inline">Start an experiment to detect invalid days before analysis.</p>}
        </TrustSection>

        <TrustSection title="Reliability profiles" kicker="Quality is explained by source and device">
          <ReliabilityList label="Sources" profiles={profiles.sources.slice(0, 3)} />
          <ReliabilityList label="Devices" profiles={profiles.devices.slice(0, 3)} />
        </TrustSection>

        <TrustSection title="Research measurement loop" kicker="Instrumented now; live-user results stay honest">
          <div className="study-grid"><StudyMetric label="Longitudinal user study" value={`${pulse.events().length} events`} detail="Synthetic benchmark ready; no live-user claim" /><StudyMetric label="False-positive measurement" value={discovery.familySize ? `${discovery.expectedFalseDiscoveries.toFixed(1)} expected` : "Awaiting scan"} detail={`${discovery.familySize} comparisons in this scan`} /><StudyMetric label="Recommendation utility" value={funnel.measured ? `${Math.round(funnel.helpRate * 100)}% helped` : "Awaiting outcomes"} detail={`${funnel.measured} measured`} /><StudyMetric label="Experiment completion" value={designs.length ? `${Math.round(experimentCompletion * 100)}%` : "Not started"} detail={`${results.length} of ${designs.length} runs analysed`} /></div>
          <p className="muted study-note">These measures are deliberately visible so a real longitudinal study can report false positives, useful recommendations and completed experiments without turning synthetic data into product evidence.</p>
        </TrustSection>
      </div>
    </section>
  );
}

function TodayDecisionBrief({ brief }: { brief: TodayBrief }): React.JSX.Element {
  const emptyRecent = brief.dataState.status === "missing" ? "Unavailable: no recent measurements arrived." : "None cleared the evidence bar in this window.";
  return (
    <article className={`decision-brief decision-brief--${brief.dataState.status}`} aria-labelledby="today-brief-title">
      <div className="decision-brief__header">
        <div>
          <p className="eyebrow">Decision brief · {brief.date}</p>
          <h3 id="today-brief-title">{brief.headline}</h3>
          <p className="muted">{brief.dataState.message}</p>
        </div>
        <span className={`pill pill--${brief.dataState.status}`}>{brief.dataState.status === "ready" ? "Enough recent data" : brief.dataState.status === "partial" ? "Partial coverage" : "Waiting for data"}</span>
      </div>

      <div className="decision-brief__grid">
        <BriefColumn title="What changed">
          {brief.whatChanged.length ? brief.whatChanged.map((entry) => <li key={entry.definition.id}>{entry.statement}</li>) : <li className="muted">{emptyRecent}</li>}
        </BriefColumn>
        <BriefColumn title="What looks normal">
          {brief.normal.length ? brief.normal.map((entry) => <li key={entry.metricId}>{entry.statement}</li>) : <li className="muted">{emptyRecent}</li>}
        </BriefColumn>
        <BriefColumn title="What is unusual">
          {brief.unusual.length ? brief.unusual.map((entry) => <li key={`${entry.metricId}-${entry.date}`}>{entry.date}: {entry.metricId} was {entry.direction} its usual level.</li>) : <li className="muted">{emptyRecent}</li>}
        </BriefColumn>
        <BriefColumn title="What matters">
          {brief.matters.length ? brief.matters.map((matter) => <MatterRow key={matter.id} matter={matter} />) : <li className="muted">No finding or data-quality issue needs attention.</li>}
        </BriefColumn>
      </div>

      <div className="decision-brief__footer">
        <div><span className="eyebrow">Reasonable action</span><strong>{brief.action?.title ?? "Keep observing; no action is justified yet."}</strong></div>
        <div><span className="eyebrow">Evidence strength</span><strong>{brief.evidence.level === "none" ? "No published evidence" : `${brief.evidence.level} · ${Math.round(brief.evidence.score * 100)}%`}</strong><small>{brief.evidence.basis.join(" · ") || "Pulse is still collecting comparable measurements."}</small></div>
      </div>
      {brief.evidence.caveats.length ? <p className="decision-brief__caveat"><strong>Keep in mind:</strong> {brief.evidence.caveats.join(" ")}</p> : null}
    </article>
  );
}

function BriefColumn({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return <section className="decision-brief__column"><h4>{title}</h4><ul>{children}</ul></section>;
}

function MatterRow({ matter }: { matter: TodayMatter }): React.JSX.Element {
  return <li><strong>{matter.title}</strong><span className="decision-brief__matter-meta">{matter.evidenceLevel === "not-a-claim" ? "Data quality" : `${matter.evidenceClass} · ${matter.evidenceLevel}`}</span><span className="muted">{matter.caveat ?? matter.statement}</span></li>;
}

function DiscoveryInbox({ items }: { items: DiscoveryInboxItem[] }): React.JSX.Element {
  const counts = items.reduce<Record<string, number>>((result, item) => {
    result[item.state] = (result[item.state] ?? 0) + 1;
    return result;
  }, {});
  return (
    <section className="trust-section discovery-inbox" aria-labelledby="discovery-inbox-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Discovery inbox · lifecycle view</p>
          <h3 id="discovery-inbox-title">Insights with a next state</h3>
        </div>
          <span className="status status--controlled">{items.length} shown</span>
      </div>
      {items.length ? (
        <>
          <div className="discovery-inbox__counts" aria-label="Discovery lifecycle counts">
            {Object.entries(counts).map(([state, count]) => <span key={state}><strong>{count}</strong> {lifecycleLabel(state)}</span>)}
          </div>
          <ol className="discovery-inbox__list">
            {items.map((item) => <li key={item.id} className={`discovery-inbox__item discovery-inbox__item--${item.state}`}>
              <div><strong>{item.finding.title}</strong><span className="muted">{item.finding.statement}</span><small>{item.stateReason}</small></div>
              <span className="pill">{lifecycleLabel(item.state)} · {item.confidence.level}</span>
            </li>)}
          </ol>
        </>
      ) : <p className="empty-inline">The inbox is empty because no discovery has crossed the evidence bar yet.</p>}
    </section>
  );
}

function lifecycleLabel(state: string): string {
  return state.replaceAll("-", " ");
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }): React.JSX.Element {
  return <div className={`metric metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function FreshnessStrip({ dashboard }: { dashboard: ReturnType<Pulse["connectorDashboard"]> }): React.JSX.Element {
  return <div className="freshness-strip" aria-label="Connector freshness"><span className="freshness-strip__label">Inputs</span>{dashboard.cards.slice(0, 5).map((card) => <span className={`freshness-chip freshness-chip--${card.freshness}`} key={String(card.source)}><i aria-hidden="true" />{card.name}<small>{card.freshness}</small></span>)}{dashboard.summary.needingAttention ? <span className="freshness-strip__warning">{dashboard.summary.needingAttention} needs attention</span> : <span className="freshness-strip__good">All connected inputs look healthy</span>}</div>;
}

function EvidenceDisclosure({ finding, onFeedback }: { finding: Finding; onFeedback: ProductTrustPanelProps["onFeedback"] }): React.JSX.Element {
  return <div className="evidence-disclosure"><p><strong>What supports it:</strong> {finding.evidence.map((reference) => reference.description).join("; ")}</p><p><strong>Confidence changed because:</strong> {finding.confidence.reasons[0] ?? "The engine has not recorded a change yet."}</p>{finding.confidence.limitations.length ? <p className="warn"><strong>Still limiting it:</strong> {finding.confidence.limitations.join("; ")}</p> : null}<fieldset className="finding__feedback"><legend>Help Pulse tune what it shows you</legend><button type="button" onClick={() => onFeedback(finding.id, "already-knew")}>Already knew this</button><button type="button" onClick={() => onFeedback(finding.id, "bad-data")}>Bad data</button><button type="button" onClick={() => onFeedback(finding.id, "stop-investigating")}>Stop investigating this</button></fieldset></div>;
}

function TrustSection({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }): React.JSX.Element {
  return <section className="trust-section"><div className="section-heading"><div><p className="eyebrow">{kicker}</p><h3>{title}</h3></div></div>{children}</section>;
}

function ReliabilityList({ label, profiles }: { label: string; profiles: ReliabilityProfile[] }): React.JSX.Element {
  return <div className="reliability-list"><h4>{label}</h4>{profiles.length ? profiles.map((profile) => <div className="reliability-row" key={`${profile.kind}-${profile.id}`}><div><strong>{profile.name}</strong><span className="muted">{profile.eventCount} events · {profile.status}</span></div>{profile.score === null ? <span className="pill">Unrated</span> : <span className="reliability-score">{Math.round(profile.score * 100)}%</span>}</div>) : <p className="empty-inline">No profiles available yet.</p>}</div>;
}

function StudyMetric({ label, value, detail }: { label: string; value: string; detail: string }): React.JSX.Element {
  return <div className="study-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}
