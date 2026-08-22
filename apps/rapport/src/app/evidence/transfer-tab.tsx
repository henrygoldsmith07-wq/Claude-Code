"use client";

import { Badge, Button, Card, EmptyState, Field, TextArea, TextInput } from "@/components/ui";
import type { ChallengeOutcome } from "@/domain/types";
import { transferReports, type HumanEvidenceState } from "@/domain/human-evidence";
import { CONTROL_CLASS, Metric, SkillSelect, percent, selectStyle, signedPercent } from "./shared";

export function TransferTab(props: TransferProps) {
  const { evidence, transfers, studyTitle, setStudyTitle, studySkillId, setStudySkillId, studyMeasure, setStudyMeasure, studyBaseline, setStudyBaseline, addStudy, outcomeStudyId, setOutcomeStudyId, outcomeSkillId, setOutcomeSkillId, outcomeTitle, setOutcomeTitle, outcomeValue, setOutcomeValue, outcomeComfort, setOutcomeComfort, outcomeScore, setOutcomeScore, outcomeEvidence, setOutcomeEvidence, addOutcome } = props;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Real-World Transfer Study</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>Plan a measurable bridge from practice to an actual challenge. The baseline is optional and stays labelled as a comparison, not a grade.</p>
          <div className="mt-4 space-y-3">
            <Field id="transfer-study-title" label="Study title"><TextInput id="transfer-study-title" value={studyTitle} onChange={(event) => setStudyTitle(event.target.value)} placeholder="Use one follow-up in a real conversation" /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><SkillSelect id="transfer-study-skill" label="Skill" value={studySkillId} onChange={setStudySkillId} /><Field id="transfer-study-baseline" label="Practice baseline" hint="Optional, 0 to 1"><TextInput id="transfer-study-baseline" inputMode="decimal" value={studyBaseline} onChange={(event) => setStudyBaseline(event.target.value)} /></Field></div>
            <Field id="transfer-study-measure" label="Target measure" hint="What will count as transfer?"><TextInput id="transfer-study-measure" value={studyMeasure} onChange={(event) => setStudyMeasure(event.target.value)} placeholder="Follow-up question used" /></Field>
            <Button type="button" onClick={() => void addStudy()}>Plan transfer study</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Real-World Challenge Outcome Tracking</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>Record what happened, how it felt and the exact evidence. “No” is a valid outcome and is never treated as a streak failure.</p>
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><Field id="transfer-outcome-study" label="Study"><select id="transfer-outcome-study" className={CONTROL_CLASS} style={selectStyle} value={outcomeStudyId} onChange={(event) => setOutcomeStudyId(event.target.value)}><option value="">No study link</option>{evidence.studies.map((study) => <option key={study.id} value={study.id}>{study.title}</option>)}</select></Field><SkillSelect id="transfer-outcome-skill" label="Skill" value={outcomeSkillId} onChange={setOutcomeSkillId} /></div>
            <Field id="transfer-outcome-title" label="Challenge"><TextInput id="transfer-outcome-title" value={outcomeTitle} onChange={(event) => setOutcomeTitle(event.target.value)} placeholder="Ask one follow-up" /></Field>
            <div className="grid gap-3 sm:grid-cols-3"><Field id="transfer-outcome-value" label="Outcome"><select id="transfer-outcome-value" className={CONTROL_CLASS} style={selectStyle} value={outcomeValue} onChange={(event) => setOutcomeValue(event.target.value as ChallengeOutcome)}><option value="yes">Yes</option><option value="partly">Partly</option><option value="no">No</option></select></Field><Field id="transfer-outcome-comfort" label="Comfort" hint="Optional, 1–5"><TextInput id="transfer-outcome-comfort" inputMode="numeric" value={outcomeComfort} onChange={(event) => setOutcomeComfort(event.target.value)} /></Field><Field id="transfer-outcome-score" label="Follow-up score" hint="Optional, 0 to 1"><TextInput id="transfer-outcome-score" inputMode="decimal" value={outcomeScore} onChange={(event) => setOutcomeScore(event.target.value)} /></Field></div>
            <Field id="transfer-outcome-evidence" label="Exact outcome evidence"><TextArea id="transfer-outcome-evidence" rows={3} value={outcomeEvidence} onChange={(event) => setOutcomeEvidence(event.target.value)} placeholder="I asked about the point they had just made." /></Field>
            <Button type="button" onClick={() => void addOutcome()}>Save real-world outcome</Button>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Transfer results</h2>
        {transfers.length === 0 ? <EmptyState title="No transfer studies yet" body="Plan a study before the next real-world challenge so the outcome has a clear target." /> : <div className="mt-3 space-y-3">{transfers.map((report) => <div key={report.studyId} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{report.title}</span><Badge tone={report.status === "complete" ? "accent" : "neutral"}>{report.status}</Badge></div><div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5"><Metric label="Outcomes" value={report.outcomeCount} /><Metric label="Completed" value={report.outcomeCount ? `${Math.round(report.completionRate * 100)}%` : "—"} /><Metric label="Comfort" value={report.meanComfort === null ? "—" : report.meanComfort.toFixed(1) + "/5"} /><Metric label="Follow-up" value={report.meanFollowUpScore === null ? "—" : percent(report.meanFollowUpScore)} /><Metric label="Evidence" value={report.evidenceCount} /></div>{report.scoreGain !== null ? <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>Practice-to-real-world change: {signedPercent(report.scoreGain)}.</p> : null}</div>)}</div>}
      </Card>
    </div>
  );
}

export interface TransferProps {
  evidence: HumanEvidenceState;
  transfers: ReturnType<typeof transferReports>;
  studyTitle: string;
  setStudyTitle: (value: string) => void;
  studySkillId: string;
  setStudySkillId: (value: string) => void;
  studyMeasure: string;
  setStudyMeasure: (value: string) => void;
  studyBaseline: string;
  setStudyBaseline: (value: string) => void;
  addStudy: () => Promise<void>;
  outcomeStudyId: string;
  setOutcomeStudyId: (value: string) => void;
  outcomeSkillId: string;
  setOutcomeSkillId: (value: string) => void;
  outcomeTitle: string;
  setOutcomeTitle: (value: string) => void;
  outcomeValue: ChallengeOutcome;
  setOutcomeValue: (value: ChallengeOutcome) => void;
  outcomeComfort: string;
  setOutcomeComfort: (value: string) => void;
  outcomeScore: string;
  setOutcomeScore: (value: string) => void;
  outcomeEvidence: string;
  setOutcomeEvidence: (value: string) => void;
  addOutcome: () => Promise<void>;
}
