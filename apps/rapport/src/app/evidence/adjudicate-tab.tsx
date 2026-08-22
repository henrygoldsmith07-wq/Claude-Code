"use client";

import { Badge, Button, Card, EmptyState, Evidence, Field, Hedged, TextArea, TextInput } from "@/components/ui";
import {
  detectRaterDisagreements,
  humanVsSystemAgreement,
  interRaterReliability,
  raterConfidenceSummary,
  scoreCalibration,
  type HumanDecision,
  type HumanEvidenceItem,
  type HumanEvidenceState,
} from "@/domain/human-evidence";
import {
  CONTROL_CLASS,
  Metric,
  defaultDraft,
  percent,
  raterNameFor,
  selectStyle,
  signedPercent,
  type AdjudicationDraft,
} from "./shared";

export function AdjudicateTab({ evidence, items, agreement, confidence, systemAgreement, calibration, drafts, updateDraft, adjudicate }: AdjudicateProps) {
  const disagreements = detectRaterDisagreements(evidence, 0.25);
  const open = disagreements.filter((item) => item.status === "open");
  const falsePositives = systemAgreement?.comparisons.filter((item) => item.classification === "false-positive") ?? [];
  const falseNegatives = systemAgreement?.comparisons.filter((item) => item.classification === "false-negative") ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Open disagreements" value={open.length} />
        <Metric label="Mean confidence" value={confidence?.labels ? `${confidence.mean.toFixed(1)}/5` : "—"} />
        <Metric label="Inter-rater score gap" value={agreement?.meanAbsScoreDisagreement === null || agreement?.meanAbsScoreDisagreement === undefined ? "—" : `${Math.round(agreement.meanAbsScoreDisagreement * 100)}pp`} />
        <Metric label="System comparisons" value={systemAgreement?.compared ?? 0} />
      </div>

      <Card>
        <h2 className="text-base font-semibold">Adjudication Workflow</h2>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          A disagreement is stored when independent scores differ by more than 25 percentage points. Adjudication records the final call without overwriting either human label.
        </p>
        <div className="mt-4 space-y-4">
          {open.length === 0 ? <EmptyState title="No open disagreements" body="Double-mark an item to surface a disagreement here. Agreement is not assumed from a single label." /> : open.map((disagreement) => {
            const draft = drafts[disagreement.id] ?? defaultDraft(disagreement.meanScore);
            const item = items.find((candidate) => candidate.id === disagreement.itemId);
            const ratings = evidence.ratings.filter((rating) => disagreement.ratingIds.includes(rating.id));
            return (
              <div key={disagreement.id} className="rounded-[10px] border p-4" style={{ borderColor: "var(--border-strong)", background: "var(--bg)" }}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{item?.title ?? disagreement.itemId} · {disagreement.behaviourKey}</h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{disagreement.raterIds.length} raters · {Math.round(disagreement.spread * 100)}pp spread · stored {formatDate(disagreement.openedAt)}</p>
                  </div>
                  <Badge tone="warn">needs adjudication</Badge>
                </div>
                <Evidence items={ratings.flatMap((rating) => rating.labels.filter((label) => label.key === disagreement.behaviourKey).flatMap((label) => label.evidence.map((line) => `${raterNameFor(evidence, rating.raterId)}: ${line}`)))} />
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Field id={`adjudication-decision-${disagreement.id}`} label="Adjudicated decision">
                    <select id={`adjudication-decision-${disagreement.id}`} className={CONTROL_CLASS} style={selectStyle} value={draft.decision} onChange={(event) => updateDraft(disagreement.id, { decision: event.target.value as HumanDecision })}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="uncertain">Uncertain</option>
                    </select>
                  </Field>
                  <Field id={`adjudication-score-${disagreement.id}`} label="Selected score" hint="0 to 1">
                    <TextInput id={`adjudication-score-${disagreement.id}`} inputMode="decimal" value={draft.score} onChange={(event) => updateDraft(disagreement.id, { score: event.target.value })} />
                  </Field>
                  <Field id={`adjudication-rationale-${disagreement.id}`} label="Rationale">
                    <TextInput id={`adjudication-rationale-${disagreement.id}`} value={draft.rationale} onChange={(event) => updateDraft(disagreement.id, { rationale: event.target.value })} />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field id={`adjudication-evidence-${disagreement.id}`} label="Evidence considered" hint="Keep the final evidence exact and observable.">
                    <TextArea id={`adjudication-evidence-${disagreement.id}`} rows={2} value={draft.evidence} onChange={(event) => updateDraft(disagreement.id, { evidence: event.target.value })} />
                  </Field>
                </div>
                <Button type="button" size="sm" className="mt-3" onClick={() => void adjudicate(disagreement.id)}>Store adjudication</Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Inter-Rater Reliability</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{agreement?.verdict ?? "No ratings collected yet."}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Cohen κ" value={metricNumber(agreement?.cohenKappa)} />
          <Metric label="Fleiss κ" value={metricNumber(agreement?.fleissKappa)} />
          <Metric label="Krippendorff α" value={metricNumber(agreement?.krippendorffAlpha)} />
          <Metric label="Within 10pp" value={agreement?.scoreAgreementRate === null || agreement?.scoreAgreementRate === undefined ? "—" : `${Math.round(agreement.scoreAgreementRate * 100)}%`} />
        </div>
        <Hedged label="Rater confidence">Mean confidence is recorded with every label. High confidence is not treated as correctness; it tells a reviewer where an apparently clear disagreement still needs attention.</Hedged>
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Human-vs-System Agreement</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Compared" value={systemAgreement?.compared ?? 0} />
          <Metric label="Aligned" value={systemAgreement?.aligned ?? 0} />
          <Metric label="False positives" value={systemAgreement?.falsePositiveCount ?? 0} />
          <Metric label="False negatives" value={systemAgreement?.falseNegativeCount ?? 0} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ComparisonList title="False-Positive Behaviour Analysis" items={falsePositives} />
          <ComparisonList title="False-Negative Behaviour Analysis" items={falseNegatives} />
        </div>
        {systemAgreement?.comparisons.length ? (
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold">Exact Behaviour Evidence</h3>
            <div className="mt-3 space-y-3">
              {systemAgreement.comparisons.slice(0, 12).map((comparison) => (
                <div key={`${comparison.itemId}:${comparison.behaviourKey}`} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{comparison.itemTitle} · {comparison.behaviourKey}</span><Badge tone={comparison.classification === "aligned" ? "accent" : comparison.classification === "uncertain" ? "warn" : "danger"}>{comparison.classification}</Badge></div>
                  <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>System {Math.round(comparison.systemScore * 100)}% · human {Math.round(comparison.humanScore * 100)}% · {comparison.reference}</p>
                  <Evidence items={[`System: ${comparison.systemEvidence}`, ...comparison.humanEvidence.map((line) => `Human: ${line}`)]} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-base font-semibold">Score Calibration</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>System scores are grouped by their predicted band and compared with the stored human reference.</p>
        <div className="mt-4 space-y-3">
          {calibration.map((bucket) => <div key={bucket.label} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}><span className="text-sm font-medium">{bucket.label}</span><span className="text-xs" style={{ color: "var(--text-muted)" }}>{bucket.count} comparisons · system {percent(bucket.meanSystemScore)} · human {percent(bucket.meanHumanScore)} · bias {signedPercent(bucket.bias)}</span></div>)}
        </div>
      </Card>
    </div>
  );
}

function ComparisonList({ title, items }: { title: string; items: NonNullable<ReturnType<typeof humanVsSystemAgreement>>["comparisons"] }) {
  return <div><h3 className="text-sm font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-2 text-sm" style={{ color: "var(--text-faint)" }}>None recorded.</p> : <div className="mt-2 space-y-2">{items.slice(0, 6).map((item) => <div key={`${item.itemId}:${item.behaviourKey}`} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}><p className="text-sm font-medium">{item.itemTitle} · {item.behaviourKey}</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>System {percent(item.systemScore)} · human {percent(item.humanScore)}</p><Evidence items={item.humanEvidence} /></div>)}</div>}</div>;
}

function metricNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

export interface AdjudicateProps {
  evidence: HumanEvidenceState;
  items: HumanEvidenceItem[];
  agreement: ReturnType<typeof interRaterReliability> | null;
  confidence: ReturnType<typeof raterConfidenceSummary> | null;
  systemAgreement: ReturnType<typeof humanVsSystemAgreement> | null;
  calibration: ReturnType<typeof scoreCalibration>;
  drafts: Record<string, AdjudicationDraft>;
  updateDraft: (id: string, patch: Partial<AdjudicationDraft>) => void;
  adjudicate: (id: string) => Promise<void>;
}
