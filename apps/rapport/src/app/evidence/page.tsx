"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, PageHeader, Skeleton } from "@/components/ui";
import { SKILLS } from "@/domain/skills";
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
import { buildRapportPulseHistory } from "@/data/pulse-history";
import * as repo from "@/data/repository";
import { useStore } from "@/state/store";
import { EvidenceLedger } from "@/components/evidence-ledger";
import { AdjudicateTab } from "./adjudicate-tab";
import { CorpusTab } from "./corpus-tab";
import { EventHistoryTab } from "./event-history-tab";
import { TransferTab } from "./transfer-tab";
import { boundedWholeNumber, defaultDraft, slug, type AdjudicationDraft } from "./shared";

const TABS = ["Ledger", "Corpus", "Adjudicate", "Transfer", "Event history"] as const;
type Tab = (typeof TABS)[number];

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

      {/* Toggle group rather than tabs: the panels are conditionally rendered
          sections, and declaring the ARIA tab pattern without tabpanel roles,
          arrow-key handling or aria-controls mislabels the widget to screen
          readers. aria-pressed says exactly what this is. */}
      <div className="mb-5 flex gap-1 overflow-x-auto" role="group" aria-label="Evidence sections">
        {TABS.map((item) => (
          <button
            key={item}
            aria-pressed={tab === item}
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
