/**
 * The finding card.
 *
 * This component is the product's contract with the user made visible. It
 * renders every field the evidence spec requires — what was found, the data
 * behind it, sample size, effect size, confidence, confounders, what class of
 * evidence it is, and the recommended next step — and it renders the causality
 * note unconditionally.
 *
 * If a field is missing the card says so rather than hiding it: a silently
 * absent confounder list is indistinguishable from "we checked and found
 * none", and those mean very different things.
 */

import type { Finding, ReplicationStatus } from "../discovery/finding.js";
import { uncertaintySummary, type ConfidenceLevel } from "../statistics/confidence.js";

const EVIDENCE_LABEL: Record<Finding["evidenceClass"], string> = {
  observation: "Observation",
  correlation: "Correlation",
  hypothesis: "Hypothesis",
  experiment: "Experiment result",
};

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  "very-low": "Very low",
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

export const REPLICATION_LABEL: Record<ReplicationStatus, string> = {
  new: "New",
  replicated: "Replicated",
  "failed-to-replicate": "Failed to replicate",
  "experimentally-supported": "Experimentally supported",
  contradicted: "Contradicted",
};

export interface FindingCardProps {
  finding: Finding;
  onFeedback?: (
    findingId: string,
    verdict: "useful" | "not-useful" | "already-knew" | "bad-data" | "stop-investigating",
  ) => void;
  onDesignExperiment?: (finding: Finding) => void;
  /** When true the card flashes briefly — used when a search hit jumps here. */
  highlight?: boolean;
}

export function FindingCard({
  finding,
  onFeedback,
  onDesignExperiment,
  highlight = false,
}: FindingCardProps): React.JSX.Element {
  const uncontrolled = finding.confounders.filter((confounder) => confounder.status === "uncontrolled");
  const headingId = `finding-title-${finding.id}`;
  const replicationStatus = finding.replicationStatus ?? "new";
  const uncertainty = uncertaintySummary(finding.confidence);

  return (
    <article
      id={`finding-${finding.id}`}
      className={`card finding${highlight ? " finding--highlight" : ""}`}
      aria-labelledby={headingId}
    >
      <header className="finding__header">
        <span className={`pill pill--${finding.evidenceClass}`}>{EVIDENCE_LABEL[finding.evidenceClass]}</span>
        <span className={`pill pill--confidence-${finding.confidence.level}`}>
          Confidence: {CONFIDENCE_LABEL[finding.confidence.level]}
        </span>
        <span className={`pill pill--replication-${replicationStatus}`}>{REPLICATION_LABEL[replicationStatus]}</span>
        {finding.tags.includes("confirmatory") ? <span className="pill pill--confirmatory">Confirmatory</span> : finding.tags.includes("exploratory") ? <span className="pill pill--exploratory" title="Exploratory — needs a holdout to confirm">Exploratory</span> : null}
      </header>

      <h3 id={headingId} className="finding__title">
        {finding.title}
      </h3>
      <p className="finding__statement">{finding.statement}</p>

      {finding.contradictionNote ? (
        <p className="finding__contradiction" role="alert">
          <strong>Contradicted.</strong> {finding.contradictionNote}
        </p>
      ) : null}

      <p className={`finding__uncertainty finding__uncertainty--${uncertainty.tone}`}>
        <strong>{uncertainty.label}.</strong> {uncertainty.sentence}
      </p>

      {finding.counterfactual ? (
        <p className={`finding__counterfactual finding__counterfactual--${finding.counterfactual.verdict}`}>
          <strong>How fragile is this?</strong> {finding.counterfactual.statement}
        </p>
      ) : null}

      <p className="finding__caveat" role="note">
        {finding.causalityNote}
      </p>

      <dl className="finding__stats">
        <div>
          <dt>Sample</dt>
          <dd>{finding.sampleDescription}</dd>
        </div>
        <div>
          <dt>Effect size</dt>
          <dd>
            {finding.effect.label}
            <span className="muted"> ({finding.effect.magnitude})</span>
          </dd>
        </div>
        {finding.effect.ci ? (
          <div>
            <dt>Interval</dt>
            <dd>
              {finding.effect.ci.low.toFixed(2)} to {finding.effect.ci.high.toFixed(2)} (
              {Math.round(finding.effect.ci.level * 100)}%)
            </dd>
          </div>
        ) : null}
        {finding.test ? (
          <div>
            <dt>Test</dt>
            <dd>
              {finding.test.name.replace(/_/g, " ")}, p = {formatP(finding.test.pValue)}
              {finding.test.adjustedP !== undefined ? (
                <>
                  {" "}
                  (adjusted {formatP(finding.test.adjustedP)} across {finding.test.familySize} comparisons)
                </>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>

      <details className="finding__detail">
        <summary>Which data supports this</summary>
        <ul>
          {finding.evidence.map((reference) => (
            <li key={`${reference.kind}-${reference.description}`}>
              {reference.description}
              {reference.dateRange ? (
                <span className="muted">
                  {" "}
                  ({reference.dateRange.from} to {reference.dateRange.to})
                </span>
              ) : null}
              <span className="muted"> — from {reference.sources.join(", ") || "unknown source"}</span>
            </li>
          ))}
        </ul>
      </details>

      <details className="finding__detail" open={uncontrolled.length > 0}>
        <summary>
          Possible confounders
          {uncontrolled.length > 0 ? <span className="warn"> — {uncontrolled.length} not ruled out</span> : null}
        </summary>
        {finding.confounders.length === 0 ? (
          <p className="muted">No confounder checks were possible for this comparison.</p>
        ) : (
          <ul>
            {finding.confounders.map((confounder) => (
              <li key={confounder.id}>
                <strong>{confounder.name}</strong>{" "}
                <span className={`status status--${confounder.status}`}>{confounder.status.replace(/-/g, " ")}</span>
                <br />
                <span className="muted">{confounder.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="finding__detail">
        <summary>How this confidence was reached</summary>
        <ul>
          {finding.confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {finding.confidence.limitations.length > 0 ? (
          <>
            <p className="finding__limitations-heading">Limitations</p>
            <ul>
              {finding.confidence.limitations.map((limitation) => (
                <li key={limitation} className="warn">
                  {limitation}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </details>

      <details className="finding__detail">
        <summary>Why am I seeing this?</summary>
        <p className="muted">
          Samples: {finding.sampleDescription} · Effect magnitude: {finding.effect.magnitude} · Consistency:{" "}
          {finding.counterfactual ? finding.counterfactual.verdict : "unknown"} · Evidence: {finding.evidenceClass} · Confidence {finding.confidence.level}
          {finding.replicationStatus ? ` · ${finding.replicationStatus}` : ""} · Sources {finding.sources.join(", ") || "unknown"}
        </p>
        <p className="muted">
          Samples are distinct sittings (2-hour bands), not raw rows. Missing days are not counted as zero. Proprietary vendor scores (Readiness, Body Battery) are never pooled.
        </p>
      </details>

      {finding.nextAction ? (
        <div className="finding__action">
          <p>
            <strong>Recommended next step:</strong> {finding.nextAction.summary}
          </p>
          <p className="muted">{finding.nextAction.rationale}</p>
          {finding.nextAction.kind === "run-experiment" && onDesignExperiment ? (
            <button type="button" onClick={() => onDesignExperiment(finding)}>
              Design this experiment
            </button>
          ) : null}
        </div>
      ) : (
        <p className="finding__action muted">No action is justified by this evidence yet.</p>
      )}

      {onFeedback ? (
        <fieldset className="finding__feedback">
          <legend>Was this useful?</legend>
          <button type="button" onClick={() => onFeedback(finding.id, "useful")}>
            Useful
          </button>
          <button type="button" onClick={() => onFeedback(finding.id, "already-knew")}>
            Already knew
          </button>
          <button type="button" onClick={() => onFeedback(finding.id, "not-useful")}>
            Not useful
          </button>
          <button type="button" onClick={() => onFeedback(finding.id, "bad-data")}>
            Bad data
          </button>
          <button type="button" onClick={() => onFeedback(finding.id, "stop-investigating")}>
            Stop investigating
          </button>
        </fieldset>
      ) : null}
    </article>
  );
}

function formatP(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value < 0.001 ? "<0.001" : value.toFixed(3);
}
