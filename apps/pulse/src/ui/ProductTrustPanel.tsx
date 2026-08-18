import { useMemo, useState } from "react";
import type { Pulse } from "../pulse.js";
import type { Finding } from "../discovery/finding.js";
import { buildReplicationSchedule } from "../discovery/replication-schedule.js";
import { detectInvalidExperimentDays, MISSING_DATA_REASONS, type MissingDataReason } from "../experiments/data-quality.js";
import { buildReliabilityProfiles, type ReliabilityProfile } from "../quality/profiles.js";
import type { SourceQuality } from "../quality/score.js";
import type { Recommendation } from "../recommendations/rank.js";
import type { DiscoveryReport } from "../discovery/engine.js";

export type FeedbackAction = "useful" | "not-useful" | "already-knew" | "bad-data" | "stop-investigating";

export interface ProductTrustPanelProps {
  pulse: Pulse;
  findings: Finding[];
  discovery: DiscoveryReport;
  quality: SourceQuality[];
  recommendations: Recommendation[];
  revision: number;
  onFeedback: (findingId: string, action: FeedbackAction) => void;
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
  revision,
  onFeedback,
  onRecommendationOutcome,
  onDesignExperiment,
  onOpenAsk,
  onChange,
}: ProductTrustPanelProps): React.JSX.Element {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [lineageOpen, setLineageOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [classifiedDays, setClassifiedDays] = useState<Record<string, MissingDataReason>>({});

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

      <div className="metric-grid" aria-label="Today summary">
        <Metric label="Evidence confidence" value={`${Math.round(confidenceScore * 100)}%`} detail={`${findings.length} active finding${findings.length === 1 ? "" : "s"}`} tone="blue" />
        <Metric label="Data freshness" value={`${Math.round(freshnessScore * 100)}%`} detail={`${dashboard.summary.healthy} source${dashboard.summary.healthy === 1 ? "" : "s"} healthy`} tone="green" />
        <Metric label="Replication queue" value={String(schedule.length)} detail={schedule.filter((entry) => entry.priority === "urgent").length ? "Needs a closer look" : "Nothing urgent"} tone="amber" />
        <Metric label="Recommendation value" value={funnel.measured ? `${Math.round(funnel.helpRate * 100)}%` : "—"} detail={funnel.measured ? `${funnel.measured} outcome${funnel.measured === 1 ? "" : "s"} measured` : "Awaiting follow-up"} tone="ink" />
      </div>

      <FreshnessStrip dashboard={dashboard} />

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
              <div className="actions actions--wrap">
                <button type="button" onClick={() => { pulse.acceptRecommendation(primaryRecommendation.id); onChange(); setNotice("Recommendation accepted — Pulse will ask for a follow-up."); }}>Accept</button>
                <button type="button" onClick={() => { pulse.followRecommendation(primaryRecommendation.id); onChange(); setNotice("Follow-up recorded — measure the outcome when you can."); }}>I followed this</button>
                <button type="button" onClick={() => onRecommendationOutcome(primaryRecommendation.id, true)}>It helped</button>
                <button type="button" onClick={() => onRecommendationOutcome(primaryRecommendation.id, false)}>Not useful</button>
              </div>
            </>
          ) : <p className="empty">No recommendation is justified by the evidence available.</p>}
        </article>
      </div>

      {notice ? <p className="toast" role="status">{notice}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></p> : null}

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
