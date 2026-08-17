/**
 * The personal evidence graph view.
 *
 * Deliberately thin, like every other panel: it renders what the graph
 * computed, and nothing else. Each belief is a claim card showing its status,
 * its confidence, the evidence for and against it, and — where the wording
 * overreaches the evidence — the problem that stopped it being endorsed.
 *
 * The summary counts and the contradiction call-out lead, because a belief
 * with strong evidence on both sides is the thing a person most needs to see.
 */

import { useMemo } from "react";
import type { Pulse } from "../pulse.js";
import type { ClaimAssessment, ClaimStatus, EvidenceNode } from "../evidence-graph/types.js";
import { uncertaintySummary } from "../statistics/confidence.js";

const STATUS_LABEL: Record<ClaimStatus, string> = {
  open: "Open",
  supported: "Supported",
  refuted: "Refuted",
  inconclusive: "Inconclusive",
  contested: "Contested",
};

export interface EvidencePanelProps {
  pulse: Pulse;
  revision: number;
}

export function EvidencePanel({ pulse, revision }: EvidencePanelProps): React.JSX.Element {
  /* eslint-disable react-hooks/exhaustive-deps */
  const graph = useMemo(() => pulse.evidenceGraph(), [pulse, revision]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const assessments = graph.assessAll();
  const counts = assessments.reduce<Record<ClaimStatus, number>>(
    (acc, assessment) => {
      acc[assessment.status] += 1;
      return acc;
    },
    { open: 0, supported: 0, refuted: 0, inconclusive: 0, contested: 0 },
  );
  const contested = assessments.filter((assessment) => assessment.status === "contested");

  return (
    <section role="tabpanel" id="panel-evidence" aria-labelledby="tab-evidence" tabIndex={-1}>
      <h2>Personal evidence graph</h2>
      <p className="muted">
        {counts.supported} supported · {counts.refuted} refuted · {counts.contested} contested ·{" "}
        {counts.inconclusive} inconclusive · {counts.open} open. Every belief lists the evidence behind it, and none is
        stated more strongly than the evidence allows.
      </p>

      {contested.length > 0 ? (
        <div className="card" role="alert">
          <h3>Contradictions to resolve</h3>
          <ul>
            {contested.map((assessment) => (
              <li key={assessment.claim.id}>{assessment.claim.statement}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {assessments.length === 0 ? (
        <p className="empty">No beliefs recorded yet.</p>
      ) : (
        assessments.map((assessment) => <ClaimCard key={assessment.claim.id} assessment={assessment} />)
      )}
    </section>
  );
}

function ClaimCard({ assessment }: { assessment: ClaimAssessment }): React.JSX.Element {
  const { claim, status, confidence, supports, against, unresolved, problems } = assessment;
  const uncertainty = uncertaintySummary(confidence);
  const evidenceCount = supports.length + against.length + unresolved.length;

  return (
    <article className="card">
      <header className="finding__header">
        <span className={`pill pill--status-${status}`}>{STATUS_LABEL[status]}</span>
        <span className={`pill pill--confidence-${confidence.level}`}>Confidence: {confidence.level}</span>
        {claim.derivedFrom ? <span className="pill">Derived</span> : <span className="pill">Authored</span>}
      </header>

      <p className="finding__statement">{claim.statement}</p>

      <p className={`finding__uncertainty finding__uncertainty--${uncertainty.tone}`}>
        <strong>{uncertainty.label}.</strong> {uncertainty.sentence}
      </p>

      {problems.length > 0 ? (
        <ul>
          {problems.map((problem) => (
            <li key={problem} className="warn">
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      {evidenceCount > 0 ? (
        <details className="finding__detail" open>
          <summary>
            Evidence ({supports.length} for · {against.length} against · {unresolved.length} unresolved)
          </summary>
          <ul className="evidence__list">
            {supports.map((node) => (
              <EvidenceRow key={node.id} node={node} verdict="supports" />
            ))}
            {against.map((node) => (
              <EvidenceRow key={node.id} node={node} verdict="refutes" />
            ))}
            {unresolved.map((node) => (
              <EvidenceRow key={node.id} node={node} verdict="unresolved" />
            ))}
          </ul>
        </details>
      ) : (
        <p className="muted">No evidence is attached yet — this is a belief, not a finding.</p>
      )}

      <details className="finding__detail">
        <summary>How this confidence was reached</summary>
        <ul>
          {confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        {confidence.limitations.length > 0 ? (
          <ul>
            {confidence.limitations.map((limitation) => (
              <li key={limitation} className="warn">
                {limitation}
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </article>
  );
}

function EvidenceRow({ node, verdict }: { node: EvidenceNode; verdict: "supports" | "refutes" | "unresolved" }): React.JSX.Element {
  return (
    <li>
      <span className={`pill pill--${node.evidenceClass}`}>{node.evidenceClass}</span>{" "}
      <span className={`pill pill--confidence-${node.confidence.level}`}>{node.confidence.level}</span>{" "}
      <strong>{verdict}</strong>
      <p className="muted">{node.statement}</p>
      <p className="muted">
        — {node.kind} <code>{node.refId}</code>
      </p>
    </li>
  );
}
