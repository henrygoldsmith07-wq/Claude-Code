"use client";

import { Badge, Button, Card, EmptyState, Evidence, Field, Meter, TextArea, TextInput } from "@/components/ui";
import type { BehaviourKey } from "@/domain/types";
import type { CorpusItemKind, HumanDecision, HumanEvidenceItem, HumanEvidenceState, RaterConfidence } from "@/domain/human-evidence";
import { CONTROL_CLASS, BehaviourSelect, SkillSelect, raterNameFor, selectStyle } from "./shared";

export function CorpusTab(props: CorpusProps) {
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

export interface CorpusProps {
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
