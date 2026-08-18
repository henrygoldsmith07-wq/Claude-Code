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
import type { ContradictionRecord, ContradictionSighting } from "../discovery/contradictions.js";
import type { Finding } from "../discovery/finding.js";
import type { MetricRegistry } from "../metrics/registry.js";
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
  const records = useMemo(() => pulse.contradictions.list(), [pulse, revision]);
  const findingsById = useMemo(
    () => new Map(pulse.findings().map((finding) => [finding.id, finding])),
    [pulse, revision],
  );

  return (
    <section role="tabpanel" id="panel-evidence" aria-labelledby="tab-evidence" tabIndex={-1}>
      <h2>Personal evidence graph</h2>
      <p className="muted">
        {counts.supported} supported · {counts.refuted} refuted · {counts.contested} contested ·{" "}
        {counts.inconclusive} inconclusive · {counts.open} open. Every belief lists the evidence behind it, and none is
        stated more strongly than the evidence allows.
      </p>

      {records.length > 0 ? (
        <div className="card" role="alert">
          <h3>Contradictions to resolve</h3>
          <p className="muted">
            {records.length} relationship{records.length === 1 ? "" : "s"}{" "}
            {records.length === 1 ? "has" : "have"} been observed pointing both ways. Each side's sightings are listed
            with the evidence behind them.
          </p>
          {records.map((record) => (
            <ContradictionCard
              key={record.id}
              record={record}
              findingsById={findingsById}
              registry={pulse.registry}
            />
          ))}
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

/**
 * One ledger record, rendered as the relationship with its two sides side by
 * side. A sighting whose finding is no longer in the current scan is still
 * shown — the record keeps it — but only with what the record itself carries.
 */
function ContradictionCard({
  record,
  findingsById,
  registry,
}: {
  record: ContradictionRecord;
  findingsById: ReadonlyMap<string, Finding>;
  registry: MetricRegistry;
}): React.JSX.Element {
  const positive = record.sightings.filter((sighting) => sighting.direction > 0);
  const negative = record.sightings.filter((sighting) => sighting.direction < 0);
  const outcome = registry.get(record.outcomeMetricId)?.name ?? record.outcomeMetricId;
  const exposure = registry.get(record.exposureMetricId)?.name ?? record.exposureMetricId;

  return (
    <article className="contradiction">
      <header className="finding__header">
        <strong>
          {outcome} × {exposure}
        </strong>
        <span className="pill pill--replication-contradicted">Contested</span>
      </header>
      <p className="muted">{record.evidence}</p>
      <div className="contradiction__sides">
        <div className="contradiction__side">
          <h4>Observed positive ({positive.length})</h4>
          {positive.length === 0 ? (
            <p className="muted">No sightings point this way.</p>
          ) : (
            <ul>
              {positive.map((sighting) => (
                <SightingRow
                  key={sighting.findingId}
                  sighting={sighting}
                  finding={findingsById.get(sighting.findingId)}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="contradiction__side">
          <h4>Observed negative ({negative.length})</h4>
          {negative.length === 0 ? (
            <p className="muted">No sightings point this way.</p>
          ) : (
            <ul>
              {negative.map((sighting) => (
                <SightingRow
                  key={sighting.findingId}
                  sighting={sighting}
                  finding={findingsById.get(sighting.findingId)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

function SightingRow({ sighting, finding }: { sighting: ContradictionSighting; finding?: Finding }): React.JSX.Element {
  if (!finding) {
    return (
      <li>
        <code>{sighting.findingId}</code>
        <p className="muted">
          Sighted {sighting.createdAt.slice(0, 10)} · not in the current findings — the record keeps the sighting even
          after its finding is gone.
        </p>
      </li>
    );
  }
  return (
    <li>
      <p>
        <strong>{finding.title}</strong>
      </p>
      <p className="muted">{finding.statement}</p>
      <dl className="finding__stats">
        <div>
          <dt>Effect</dt>
          <dd>{finding.effect.label}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{finding.confidence.level}</dd>
        </div>
        <div>
          <dt>Sources</dt>
          <dd>{finding.sources.join(", ")}</dd>
        </div>
        <div>
          <dt>Sample</dt>
          <dd>{finding.sampleSize}</dd>
        </div>
        <div>
          <dt>Seen</dt>
          <dd>{sighting.createdAt.slice(0, 10)}</dd>
        </div>
      </dl>
      {finding.evidence[0] ? <p className="muted">— {finding.evidence[0].description}</p> : null}
    </li>
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
