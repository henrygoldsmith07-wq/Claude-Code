"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Evidence, Field, Hedged, Meter, PageHeader, Skeleton, TextArea, TextInput } from "@/components/ui";
import { SKILLS } from "@/domain/skills";
import type { DomainEvent } from "@/domain/events";
import { BEHAVIOUR_KEYS } from "@/domain/types";
import type { BehaviourKey, ChallengeOutcome } from "@/domain/types";
import { buildEvidenceLedger } from "@/domain/evidence";
import {
  clampEvidenceScore,
  detectRaterDisagreements,
  emptyHumanEvidence,
  humanVsSystemAgreement,
  interRaterReliability,
  itemFromEvaluation,
  raterConfidenceSummary,
  reconcileDisagreements,
  resolveAdjudication,
  scoreCalibration,
  transferReports,
  type CorpusItemKind,
  type HumanDecision,
  type HumanEvidenceItem,
  type HumanEvidenceState,
  type HumanRating,
  type RaterConfidence,
  type RealWorldChallengeOutcome,
} from "@/domain/human-evidence";
import { buildRapportPulseHistory, readRapportPulseOptIn } from "@/data/pulse-history";
import * as repo from "@/data/repository";
import { useStore } from "@/state/store";
import { EvidenceLedger } from "@/components/evidence-ledger";

const TABS = ["Ledger", "Corpus", "Adjudicate", "Transfer", "Event history"] as const;
type Tab = (typeof TABS)[number];

const selectStyle = {
  background: "var(--surface)",
  borderColor: "var(--border-strong)",
  color: "var(--text)",
};

const CONTROL_CLASS = "w-full rounded-[10px] border px-3 py-2 text-[15px] outline-none";

export default function EvidencePage() {
  const store = useStore();
  const [evidence, setEvidence] = useState<HumanEvidenceState>(emptyHumanEvidence());
  const [tab, setTab] = useState<Tab>("Corpus");
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedRaterId, setSelectedRaterId] = useState("");

  const [itemTitle, setItemTitle] = useState("");
  const [itemKind, setItemKind] = useState<CorpusItemKind>("simulation-evaluation");
  const [itemSkillId, setItemSkillId] = useState(SKILLS[0]?.id ?? "");
  const [itemBehaviour, setItemBehaviour] = useState<BehaviourKey>("listening");
  const [itemSystemScore, setItemSystemScore] = useState("0.5");
  const [itemSystemEvidence, setItemSystemEvidence] = useState("");

  const [raterName, setRaterName] = useState("");
  const [ratingBehaviour, setRatingBehaviour] = useState<BehaviourKey>("listening");
  const [ratingDecision, setRatingDecision] = useState<HumanDecision>("uncertain");
  const [ratingScore, setRatingScore] = useState("0.5");
  const [ratingConfidence, setRatingConfidence] = useState<RaterConfidence>(3);
  const [ratingEvidence, setRatingEvidence] = useState("");
  const [ratingNotes, setRatingNotes] = useState("");

  const [adjudicationDrafts, setAdjudicationDrafts] = useState<Record<string, AdjudicationDraft>>({});

  const [studyTitle, setStudyTitle] = useState("");
  const [studySkillId, setStudySkillId] = useState(SKILLS[0]?.id ?? "");
  const [studyMeasure, setStudyMeasure] = useState("");
  const [studyBaseline, setStudyBaseline] = useState("");
  const [outcomeStudyId, setOutcomeStudyId] = useState("");
  const [outcomeSkillId, setOutcomeSkillId] = useState(SKILLS[0]?.id ?? "");
  const [outcomeTitle, setOutcomeTitle] = useState("");
  const [outcomeValue, setOutcomeValue] = useState<ChallengeOutcome>("yes");
  const [outcomeComfort, setOutcomeComfort] = useState("");
  const [outcomeScore, setOutcomeScore] = useState("");
  const [outcomeEvidence, setOutcomeEvidence] = useState("");

  useEffect(() => {
    if (!store.ready) return;
    let cancelled = false;
    void repo.getHumanEvidence().then((loaded) => {
      if (!cancelled) setEvidence(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [store.ready]);

  const candidateItems = useMemo(() => {
    const persistedIds = new Set(evidence.items.map((item) => item.id));
    return store.evaluations.map(itemFromEvaluation).filter((item) => !persistedIds.has(item.id));
  }, [evidence.items, store.evaluations]);

  const items = useMemo(() => [...evidence.items, ...candidateItems], [candidateItems, evidence.items]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];
  const activeRaters = evidence?.raters.filter((rater) => rater.active) ?? [];

  const workingEvidence = useMemo(() => {
    return { ...evidence, disagreements: detectRaterDisagreements(evidence, 0.25) };
  }, [evidence]);

  const agreement = useMemo(() => interRaterReliability(evidence), [evidence]);
  const confidence = useMemo(() => raterConfidenceSummary(evidence), [evidence]);
  const systemAgreement = useMemo(() => humanVsSystemAgreement({ ...evidence, items }), [evidence, items]);
  const calibration = useMemo(() => scoreCalibration({ ...evidence, items }), [evidence, items]);
  const transfers = useMemo(() => transferReports(evidence), [evidence]);
  const ledger = useMemo(() => buildEvidenceLedger({
    evaluations: store.evaluations,
    simulations: store.simulations,
    attempts: store.attempts,
    states: store.states,
    humanEvidence: evidence,
  }), [evidence, store.attempts, store.evaluations, store.simulations, store.states]);
  const pulseHistory = useMemo(() => buildRapportPulseHistory(store.events, store.simulations), [store.events, store.simulations]);

  if (!store.ready) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  async function persist(next: HumanEvidenceState): Promise<void> {
    setEvidence(next);
    await repo.saveHumanEvidence(next);
  }

  async function addRater(): Promise<void> {
    const name = raterName.trim();
    if (!name) {
      setNotice("Give this rater a short display name or pseudonym first.");
      return;
    }
    const at = new Date().toISOString();
    const id = `rater:${slug(name)}:${Date.now()}`;
    const nextRater = { id, displayName: name, role: "rater" as const, createdAt: at, active: true };
    await persist({ ...evidence, raters: [...evidence.raters, nextRater] });
    setSelectedRaterId(id);
    setRaterName("");
    setNotice("Rater added. Independent labels stay separate until adjudication.");
  }

  async function addItem(): Promise<void> {
    const title = itemTitle.trim();
    if (!title) {
      setNotice("Give the corpus item a title that a reviewer can recognise.");
      return;
    }
    const at = new Date().toISOString();
    const item: HumanEvidenceItem = {
      id: `item:${Date.now()}`,
      title,
      kind: itemKind,
      source: "researcher-entered",
      occurredAt: at,
      skillIds: itemSkillId ? [itemSkillId] : [],
      systemScores: [{
        key: itemBehaviour,
        score: clampEvidenceScore(Number(itemSystemScore)),
        evidence: itemSystemEvidence.trim() || "No system evidence supplied.",
        reliable: true,
      }],
    };
    await persist({ ...evidence, items: [...evidence.items, item] });
    setSelectedItemId(item.id);
    setItemTitle("");
    setItemSystemEvidence("");
    setNotice("Corpus item added. Add two independent labels when a comparison is ready.");
  }

  async function saveRating(): Promise<void> {
    const itemId = selectedItem?.id;
    if (!itemId || !selectedRaterId) {
      setNotice("Choose a corpus item and an independent rater first.");
      return;
    }
    const evidenceLines = ratingEvidence.split("\n").map((line) => line.trim()).filter(Boolean);
    if (evidenceLines.length === 0) {
      setNotice("Add the exact observable evidence supporting this label.");
      return;
    }
    const at = new Date().toISOString();
    const rating: HumanRating = {
      id: `rating:${Date.now()}`,
      itemId,
      raterId: selectedRaterId,
      ratedAt: at,
      status: "independent",
      labels: [{
        key: ratingBehaviour,
        decision: ratingDecision,
        score: clampEvidenceScore(Number(ratingScore)),
        confidence: ratingConfidence,
        evidence: evidenceLines,
      }],
      ...(ratingNotes.trim() ? { notes: ratingNotes.trim() } : {}),
    };
    const next = reconcileDisagreements({ ...evidence, ratings: [...evidence.ratings, rating] }, 0.25, at);
    await persist(next);
    await store.recordEvidenceEvent({
      kind: "human-rating-recorded",
      at,
      ratingId: rating.id,
      itemId,
      raterId: selectedRaterId,
      behaviourKeys: [ratingBehaviour],
      meanConfidence: ratingConfidence,
    });
    setRatingEvidence("");
    setRatingNotes("");
    setNotice(next.disagreements.some((item) => item.status === "open") ? "Saved. A disagreement is ready for adjudication." : "Independent rating saved.");
  }

  async function adjudicate(disagreementId: string): Promise<void> {
    const disagreement = workingEvidence?.disagreements.find((item) => item.id === disagreementId);
    if (!disagreement) return;
    const draft = adjudicationDrafts[disagreementId] ?? defaultDraft(disagreement.meanScore);
    const at = new Date().toISOString();
    const exactEvidence = draft.evidence.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!draft.rationale.trim() || exactEvidence.length === 0) {
      setNotice("Adjudication needs a rationale and the evidence considered.");
      return;
    }
    const next = resolveAdjudication(
      { ...evidence, disagreements: workingEvidence.disagreements },
      {
        disagreementId,
        itemId: disagreement.itemId,
        behaviourKey: disagreement.behaviourKey,
        selectedDecision: draft.decision,
        selectedScore: clampEvidenceScore(Number(draft.score)),
        adjudicatorId: selectedRaterId || "local-adjudicator",
        exactEvidence,
        rationale: draft.rationale.trim(),
        createdAt: at,
      },
    );
    await persist(next);
    await store.recordEvidenceEvent({
      kind: "human-adjudication-completed",
      at,
      adjudicationId: next.adjudications[next.adjudications.length - 1]?.id ?? `adjudication:${disagreementId}`,
      disagreementId,
      itemId: disagreement.itemId,
      behaviourKey: disagreement.behaviourKey,
      selectedDecision: draft.decision,
      selectedScore: clampEvidenceScore(Number(draft.score)),
    });
    setNotice("Adjudication stored. The independent ratings remain visible beside it.");
  }

  async function addStudy(): Promise<void> {
    if (!studyTitle.trim() || !studyMeasure.trim() || !studySkillId) {
      setNotice("A transfer study needs a title, skill and target measure.");
      return;
    }
    const at = new Date().toISOString();
    const study = {
      id: `study:${Date.now()}`,
      title: studyTitle.trim(),
      skillId: studySkillId,
      targetMeasure: studyMeasure.trim(),
      ...(studyBaseline.trim() ? { baselinePracticeScore: clampEvidenceScore(Number(studyBaseline)) } : {}),
      status: "planned" as const,
      plannedAt: at,
    };
    await persist({ ...evidence, studies: [...evidence.studies, study] });
    setOutcomeStudyId(study.id);
    setStudyTitle("");
    setStudyMeasure("");
    setStudyBaseline("");
    setNotice("Transfer study planned. Record the next real-world challenge outcome when it happens.");
  }

  async function addOutcome(): Promise<void> {
    if (!outcomeTitle.trim() || !outcomeSkillId || !outcomeEvidence.trim()) {
      setNotice("Record the challenge, skill and exact real-world evidence first.");
      return;
    }
    const at = new Date().toISOString();
    const outcome: RealWorldChallengeOutcome = {
      id: `outcome:${Date.now()}`,
      ...(outcomeStudyId ? { studyId: outcomeStudyId } : {}),
      skillId: outcomeSkillId,
      challengeTitle: outcomeTitle.trim(),
      outcome: outcomeValue,
      completed: outcomeValue !== "no",
      ...(outcomeComfort.trim() ? { comfort: boundedWholeNumber(outcomeComfort, 1, 5) } : {}),
      ...(outcomeScore.trim() ? { followUpScore: clampEvidenceScore(Number(outcomeScore)) } : {}),
      exactEvidence: outcomeEvidence.split("\n").map((line) => line.trim()).filter(Boolean),
      occurredAt: at,
      createdAt: at,
    };
    const studies = evidence.studies.map((study) =>
      study.id === outcomeStudyId && study.status === "planned" ? { ...study, status: "active" as const, startedAt: at } : study,
    );
    await persist({ ...evidence, studies, outcomes: [...evidence.outcomes, outcome] });
    await store.recordEvidenceEvent({
      kind: "real-world-outcome-recorded",
      at,
      outcomeId: outcome.id,
      ...(outcome.studyId ? { studyId: outcome.studyId } : {}),
      skillId: outcome.skillId,
      outcome: outcome.outcome,
      completed: outcome.completed,
      ...(outcome.comfort === undefined ? {} : { comfort: outcome.comfort }),
      ...(outcome.followUpScore === undefined ? {} : { followUpScore: outcome.followUpScore }),
    });
    setOutcomeTitle("");
    setOutcomeEvidence("");
    setOutcomeComfort("");
    setOutcomeScore("");
    setNotice("Real-world outcome stored in the transfer history.");
  }

  function updateDraft(id: string, patch: Partial<AdjudicationDraft>): void {
    setAdjudicationDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? defaultDraft(0.5)), ...patch } }));
  }

  return (
    <>
      <PageHeader
        title="Evidence lab"
        subtitle="Human labels, system comparisons and real-world transfer — kept as inspectable evidence rather than folded into one score."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="accent">Local-only workspace</Badge>
        <Badge>{evidence.items.length} corpus items</Badge>
        <Badge>{evidence.ratings.length} independent ratings</Badge>
        <Badge>{workingEvidence.disagreements.filter((item) => item.status === "open").length} open disagreements</Badge>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto" role="tablist" aria-label="Evidence sections">
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{ background: tab === item ? "var(--accent-soft)" : "transparent", color: tab === item ? "var(--accent)" : "var(--text-muted)" }}
          >
            {item}
          </button>
        ))}
      </div>

      {notice ? <p className="mb-4 text-sm" role="status" style={{ color: "var(--text-muted)" }}>{notice}</p> : null}

      {tab === "Ledger" ? <EvidenceLedger profiles={ledger} title="Source-separated evidence ledger" /> : null}

      {tab === "Corpus" ? (
        <CorpusTab
          evidence={evidence}
          items={items}
          selectedItem={selectedItem}
          activeRaters={activeRaters}
          selectedRaterId={selectedRaterId}
          setSelectedRaterId={setSelectedRaterId}
          itemTitle={itemTitle}
          setItemTitle={setItemTitle}
          itemKind={itemKind}
          setItemKind={setItemKind}
          itemSkillId={itemSkillId}
          setItemSkillId={setItemSkillId}
          itemBehaviour={itemBehaviour}
          setItemBehaviour={setItemBehaviour}
          itemSystemScore={itemSystemScore}
          setItemSystemScore={setItemSystemScore}
          itemSystemEvidence={itemSystemEvidence}
          setItemSystemEvidence={setItemSystemEvidence}
          addItem={addItem}
          raterName={raterName}
          setRaterName={setRaterName}
          addRater={addRater}
          ratingBehaviour={ratingBehaviour}
          setRatingBehaviour={setRatingBehaviour}
          ratingDecision={ratingDecision}
          setRatingDecision={setRatingDecision}
          ratingScore={ratingScore}
          setRatingScore={setRatingScore}
          ratingConfidence={ratingConfidence}
          setRatingConfidence={setRatingConfidence}
          ratingEvidence={ratingEvidence}
          setRatingEvidence={setRatingEvidence}
          ratingNotes={ratingNotes}
          setRatingNotes={setRatingNotes}
          saveRating={saveRating}
          setSelectedItemId={setSelectedItemId}
        />
      ) : null}

      {tab === "Adjudicate" ? (
        <AdjudicateTab
          evidence={evidence}
          items={items}
          agreement={agreement}
          confidence={confidence}
          systemAgreement={systemAgreement}
          calibration={calibration}
          drafts={adjudicationDrafts}
          updateDraft={updateDraft}
          adjudicate={adjudicate}
        />
      ) : null}

      {tab === "Transfer" ? (
        <TransferTab
          evidence={evidence}
          transfers={transfers}
          studyTitle={studyTitle}
          setStudyTitle={setStudyTitle}
          studySkillId={studySkillId}
          setStudySkillId={setStudySkillId}
          studyMeasure={studyMeasure}
          setStudyMeasure={setStudyMeasure}
          studyBaseline={studyBaseline}
          setStudyBaseline={setStudyBaseline}
          addStudy={addStudy}
          outcomeStudyId={outcomeStudyId}
          setOutcomeStudyId={setOutcomeStudyId}
          outcomeSkillId={outcomeSkillId}
          setOutcomeSkillId={setOutcomeSkillId}
          outcomeTitle={outcomeTitle}
          setOutcomeTitle={setOutcomeTitle}
          outcomeValue={outcomeValue}
          setOutcomeValue={setOutcomeValue}
          outcomeComfort={outcomeComfort}
          setOutcomeComfort={setOutcomeComfort}
          outcomeScore={outcomeScore}
          setOutcomeScore={setOutcomeScore}
          outcomeEvidence={outcomeEvidence}
          setOutcomeEvidence={setOutcomeEvidence}
          addOutcome={addOutcome}
        />
      ) : null}

      {tab === "Event history" ? <EventHistoryTab events={store.events} pulseHistory={pulseHistory} /> : null}
    </>
  );
}

function CorpusTab(props: CorpusProps) {
  const {
    evidence, items, selectedItem, activeRaters, selectedRaterId, setSelectedRaterId,
    itemTitle, setItemTitle, itemKind, setItemKind, itemSkillId, setItemSkillId,
    itemBehaviour, setItemBehaviour, itemSystemScore, setItemSystemScore, itemSystemEvidence,
    setItemSystemEvidence, addItem, raterName, setRaterName, addRater, ratingBehaviour,
    setRatingBehaviour, ratingDecision, setRatingDecision, ratingScore, setRatingScore,
    ratingConfidence, setRatingConfidence, ratingEvidence, setRatingEvidence, ratingNotes,
    setRatingNotes, saveRating, setSelectedItemId,
  } = props;
  const selectedRatings = selectedItem ? evidence.ratings.filter((rating) => rating.itemId === selectedItem.id) : [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-semibold">Human-labeled Behaviour Corpus</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Add a metadata-only item or use a stored system evaluation as a candidate. Raw transcripts are never imported here automatically.
          </p>
          <div className="mt-4 space-y-3">
            <Field id="evidence-item-title" label="Item title">
              <TextInput id="evidence-item-title" value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} placeholder="e.g. Meeting response, round 1" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="evidence-item-kind" label="Item kind">
                <select id="evidence-item-kind" className={CONTROL_CLASS} style={selectStyle} value={itemKind} onChange={(event) => setItemKind(event.target.value as CorpusItemKind)}>
                  <option value="simulation-evaluation">Simulation evaluation</option>
                  <option value="real-world-challenge">Real-world challenge</option>
                </select>
              </Field>
              <SkillSelect id="evidence-item-skill" label="Skill" value={itemSkillId} onChange={setItemSkillId} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <BehaviourSelect id="evidence-item-behaviour" label="System behaviour" value={itemBehaviour} onChange={setItemBehaviour} />
              <Field id="evidence-item-score" label="System score" hint="0 to 1">
                <TextInput id="evidence-item-score" inputMode="decimal" value={itemSystemScore} onChange={(event) => setItemSystemScore(event.target.value)} />
              </Field>
            </div>
            <Field id="evidence-item-system-evidence" label="System evidence" hint="The countable evidence behind the system score.">
              <TextArea id="evidence-item-system-evidence" rows={2} value={itemSystemEvidence} onChange={(event) => setItemSystemEvidence(event.target.value)} />
            </Field>
            <Button type="button" onClick={() => void addItem()}>Add corpus item</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-semibold">Multiple Independent Human Raters</h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Give each reviewer a stable pseudonym. A second label stays independent until an adjudicator resolves a stored disagreement.
          </p>
          <div className="mt-4 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field id="evidence-rater-name" label="Rater name or pseudonym">
                <TextInput id="evidence-rater-name" value={raterName} onChange={(event) => setRaterName(event.target.value)} placeholder="Rater A" />
              </Field>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void addRater()}>Add rater</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeRaters.map((rater) => <Badge key={rater.id} tone={rater.id === selectedRaterId ? "accent" : "neutral"}>{rater.displayName}</Badge>)}
            {activeRaters.length === 0 ? <span className="text-sm" style={{ color: "var(--text-faint)" }}>No raters registered yet.</span> : null}
          </div>

          <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold">Record a label</h3>
            <div className="mt-3 space-y-3">
              <Field id="evidence-rating-item" label="Corpus item">
                <select id="evidence-rating-item" className={CONTROL_CLASS} style={selectStyle} value={selectedItem?.id ?? ""} onChange={(event) => props.setSelectedItemId(event.target.value)}>
                  <option value="">Choose an item</option>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="evidence-rating-rater" label="Independent rater">
                  <select id="evidence-rating-rater" className={CONTROL_CLASS} style={selectStyle} value={selectedRaterId} onChange={(event) => setSelectedRaterId(event.target.value)}>
                    <option value="">Choose a rater</option>
                    {activeRaters.map((rater) => <option key={rater.id} value={rater.id}>{rater.displayName}</option>)}
                  </select>
                </Field>
                <BehaviourSelect id="evidence-rating-behaviour" label="Behaviour" value={ratingBehaviour} onChange={setRatingBehaviour} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="evidence-rating-decision" label="Decision">
                  <select id="evidence-rating-decision" className={CONTROL_CLASS} style={selectStyle} value={ratingDecision} onChange={(event) => setRatingDecision(event.target.value as HumanDecision)}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="uncertain">Uncertain</option>
                  </select>
                </Field>
                <Field id="evidence-rating-score" label="Rater score" hint="0 to 1">
                  <TextInput id="evidence-rating-score" inputMode="decimal" value={ratingScore} onChange={(event) => setRatingScore(event.target.value)} />
                </Field>
                <Field id="evidence-rating-confidence" label="Rater confidence" hint="1 low, 5 high">
                  <select id="evidence-rating-confidence" className={CONTROL_CLASS} style={selectStyle} value={ratingConfidence} onChange={(event) => setRatingConfidence(Number(event.target.value) as RaterConfidence)}>
                    {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </Field>
              </div>
              <Field id="evidence-rating-exact" label="Exact Behaviour Evidence" hint="One observable detail per line. No summary without the observation.">
                <TextArea id="evidence-rating-exact" rows={3} value={ratingEvidence} onChange={(event) => setRatingEvidence(event.target.value)} placeholder="They asked one relevant follow-up." />
              </Field>
              <Field id="evidence-rating-notes" label="Rater note" hint="Optional context; keep the evidence above exact.">
                <TextArea id="evidence-rating-notes" rows={2} value={ratingNotes} onChange={(event) => setRatingNotes(event.target.value)} />
              </Field>
              <Button type="button" onClick={() => void saveRating()} disabled={!selectedItem || activeRaters.length === 0}>Save independent label</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-base font-semibold">Corpus queue</h2>
        <div className="mt-3 space-y-3">
          {items.length === 0 ? (
            <EmptyState title="No items ready for labelling" body="Add a metadata-only item above, or complete a simulation evaluation first." />
          ) : items.map((item) => {
            const ratings = evidence.ratings.filter((rating) => rating.itemId === item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
                className="w-full rounded-[10px] border p-3 text-left transition-colors"
                style={{ borderColor: item.id === selectedItem?.id ? "var(--accent)" : "var(--border)", background: item.id === selectedItem?.id ? "var(--accent-soft)" : "var(--bg)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">{item.title}</h3>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{item.source.replaceAll("-", " ")} · {ratings.length} rating{ratings.length === 1 ? "" : "s"}</p>
                  </div>
                  <Badge tone={ratings.length >= 2 ? "accent" : "neutral"}>{ratings.length >= 2 ? "double-marked" : "needs labels"}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {item.systemScores.map((score) => <Meter key={score.key} value={score.score} label={score.key} sublabel={score.reliable ? "reliable system estimate" : "not reliable enough to compare"} />)}
                </div>
              </button>
            );
          })}
        </div>
        {selectedItem && selectedRatings.length > 0 ? (
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold">Stored human evidence for {selectedItem.title}</h3>
            <div className="mt-3 space-y-3">
              {selectedRatings.map((rating) => (
                <div key={rating.id} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{raterNameFor(evidence, rating.raterId)}</Badge>
                    {rating.labels.map((label) => <Badge key={label.key} tone={label.decision === "uncertain" ? "warn" : "neutral"}>{label.key}: {label.decision} · {label.confidence}/5</Badge>)}
                  </div>
                  <Evidence items={rating.labels.flatMap((label) => label.evidence)} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function AdjudicateTab({ evidence, items, agreement, confidence, systemAgreement, calibration, drafts, updateDraft, adjudicate }: AdjudicateProps) {
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

function TransferTab(props: TransferProps) {
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

function EventHistoryTab({ events, pulseHistory }: { events: DomainEvent[]; pulseHistory: ReturnType<typeof buildRapportPulseHistory> }) {
  const [pulseOptIn, setPulseOptIn] = useState(false);
  useEffect(() => {
    // Shared storage is optional; the event log remains in IndexedDB either way.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPulseOptIn(readRapportPulseOptIn());
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-base font-semibold">Persistent Rapport Event History</h2><p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>Every human review and real-world outcome is appended beside the existing practice events. The log is the audit trail; derived reports can be rebuilt from it.</p></div>
          <Badge tone="accent">{events.length} events</Badge>
        </div>
        <div className="mt-4 space-y-2">
          {events.length === 0 ? <EmptyState title="No events yet" body="Events appear after practice, a human label, an adjudication or a real-world outcome." /> : [...events].reverse().slice(0, 40).map((event, index) => <div key={`${event.at}:${index}`} className="flex items-start justify-between gap-3 rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}><div><p className="text-sm font-medium">{eventLabel(event)}</p><p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{event.at}</p></div><Badge>{event.kind}</Badge></div>)}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Pulse-Compatible Event Log</h2><p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>A transcript-free sidecar uses the existing Pulse source-history envelope. It contains aggregate events only; Pulse sharing still requires its separate opt-in.</p></div><Badge tone={pulseOptIn ? "accent" : "neutral"}>{pulseOptIn ? "Pulse sharing on" : "Pulse sharing off"}</Badge></div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4"><Metric label="Practice records" value={pulseHistory.records.length} /><Metric label="Safe event records" value={pulseHistory.eventLog.length} /><Metric label="Human review events" value={pulseHistory.eventLog.filter((event) => event.kind === "human-rating" || event.kind === "human-adjudication").length} /><Metric label="Transfer outcomes" value={pulseHistory.eventLog.filter((event) => event.kind === "real-world-outcome").length} /></div>
        <div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => downloadJson("rapport-pulse-event-log.json", pulseHistory)}>Download safe event log</Button><Hedged label="Privacy boundary">Exact behaviour evidence stays in the local Rapport evidence workspace. The Pulse-compatible log contains counts, scores and event labels only.</Hedged></div>
      </Card>
    </div>
  );
}

function SkillSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <Field id={id} label={label}><select id={id} className={CONTROL_CLASS} style={selectStyle} value={value} onChange={(event) => onChange(event.target.value)}>{SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></Field>;
}

function BehaviourSelect({ id, label, value, onChange }: { id: string; label: string; value: BehaviourKey; onChange: (value: BehaviourKey) => void }) {
  return <Field id={id} label={label}><select id={id} className={CONTROL_CLASS} style={selectStyle} value={value} onChange={(event) => onChange(event.target.value as BehaviourKey)}>{BEHAVIOUR_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}</select></Field>;
}

function ComparisonList({ title, items }: { title: string; items: NonNullable<ReturnType<typeof humanVsSystemAgreement>>["comparisons"] }) {
  return <div><h3 className="text-sm font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-2 text-sm" style={{ color: "var(--text-faint)" }}>None recorded.</p> : <div className="mt-2 space-y-2">{items.slice(0, 6).map((item) => <div key={`${item.itemId}:${item.behaviourKey}`} className="rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--bg)" }}><p className="text-sm font-medium">{item.itemTitle} · {item.behaviourKey}</p><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>System {percent(item.systemScore)} · human {percent(item.humanScore)}</p><Evidence items={item.humanEvidence} /></div>)}</div>}</div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><dt className="text-xs" style={{ color: "var(--text-faint)" }}>{label}</dt><dd className="mt-1 text-lg font-semibold tracking-tight">{value}</dd></div>;
}

function raterNameFor(state: HumanEvidenceState, id: string): string {
  return state.raters.find((rater) => rater.id === id)?.displayName ?? id;
}

function metricNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : value.toFixed(2);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${Math.round(value * 100)}pp`;
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rater";
}

function boundedWholeNumber(value: string, lower: number, upper: number): number {
  const number = Math.round(Number(value));
  return Math.max(lower, Math.min(upper, Number.isFinite(number) ? number : lower));
}

function defaultDraft(score: number): AdjudicationDraft {
  return { decision: "uncertain", score: score.toFixed(2), rationale: "", evidence: "" };
}

function eventLabel(event: DomainEvent): string {
  switch (event.kind) {
    case "simulation-evaluated": return `Simulation evaluated · ${event.skillIds.join(", ") || "no skill"}`;
    case "challenge-attempted": return `Challenge attempted · ${event.outcome}`;
    case "challenge-skipped": return "Challenge skipped";
    case "exercise-completed": return "Exercise completed";
    case "lesson-read": return "Lesson read";
    case "assessment-completed": return "Assessment completed";
    case "user-corrected-skill": return "User corrected a skill estimate";
    case "session-completed": return "Session completed";
    case "human-rating-recorded": return `Human rating recorded · ${event.behaviourKeys.join(", ")}`;
    case "human-adjudication-completed": return `Adjudication completed · ${event.behaviourKey}`;
    case "real-world-outcome-recorded": return `Real-world outcome recorded · ${event.outcome}`;
  }
}

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface AdjudicationDraft {
  decision: HumanDecision;
  score: string;
  rationale: string;
  evidence: string;
}

interface CorpusProps {
  evidence: HumanEvidenceState;
  items: HumanEvidenceItem[];
  selectedItem?: HumanEvidenceItem;
  activeRaters: HumanEvidenceState["raters"];
  selectedRaterId: string;
  setSelectedRaterId: (value: string) => void;
  itemTitle: string;
  setItemTitle: (value: string) => void;
  itemKind: CorpusItemKind;
  setItemKind: (value: CorpusItemKind) => void;
  itemSkillId: string;
  setItemSkillId: (value: string) => void;
  itemBehaviour: BehaviourKey;
  setItemBehaviour: (value: BehaviourKey) => void;
  itemSystemScore: string;
  setItemSystemScore: (value: string) => void;
  itemSystemEvidence: string;
  setItemSystemEvidence: (value: string) => void;
  addItem: () => Promise<void>;
  raterName: string;
  setRaterName: (value: string) => void;
  addRater: () => Promise<void>;
  ratingBehaviour: BehaviourKey;
  setRatingBehaviour: (value: BehaviourKey) => void;
  ratingDecision: HumanDecision;
  setRatingDecision: (value: HumanDecision) => void;
  ratingScore: string;
  setRatingScore: (value: string) => void;
  ratingConfidence: RaterConfidence;
  setRatingConfidence: (value: RaterConfidence) => void;
  ratingEvidence: string;
  setRatingEvidence: (value: string) => void;
  ratingNotes: string;
  setRatingNotes: (value: string) => void;
  saveRating: () => Promise<void>;
  setSelectedItemId: (value: string) => void;
}

interface AdjudicateProps {
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

interface TransferProps {
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

