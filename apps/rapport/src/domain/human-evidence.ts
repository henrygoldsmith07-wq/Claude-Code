import { agreementReport } from "./agreement";
import type { AgreementReport, RaterItem } from "./agreement";
import type {
  BehaviourKey,
  BehaviourScore,
  ChallengeOutcome,
  Id,
  IsoInstant,
  SimulationEvaluation,
} from "./types";

/**
 * Human evidence is deliberately separate from the mastery projection. A
 * rater can disagree with the evaluator without changing a user's skill
 * state, and the disagreement must remain inspectable rather than becoming a
 * hidden correction to a number.
 */

export const HUMAN_DECISIONS = ["present", "absent", "uncertain"] as const;
export type HumanDecision = (typeof HUMAN_DECISIONS)[number];

export const RATER_CONFIDENCE_LEVELS = [1, 2, 3, 4, 5] as const;
export type RaterConfidence = (typeof RATER_CONFIDENCE_LEVELS)[number];

export type CorpusItemKind = "simulation-evaluation" | "real-world-challenge";
export type CorpusItemSource = "local-evaluation" | "donated-transcript" | "researcher-entered";
export type RatingStatus = "independent" | "excluded";
export type DisagreementStatus = "open" | "resolved" | "deferred";
export type ComparisonClassification = "aligned" | "false-positive" | "false-negative" | "uncertain";

export interface HumanRater {
  id: Id;
  displayName: string;
  role: "rater" | "adjudicator";
  createdAt: IsoInstant;
  active: boolean;
}

export interface HumanBehaviourLabel {
  key: BehaviourKey;
  decision: HumanDecision;
  /** 0-1 score supplied by the rater, retained alongside the categorical call. */
  score: number;
  confidence: RaterConfidence;
  /** Short, exact observations. The app never creates these from a transcript. */
  evidence: string[];
}

export interface HumanEvidenceItem {
  id: Id;
  title: string;
  kind: CorpusItemKind;
  source: CorpusItemSource;
  occurredAt: IsoInstant;
  skillIds: Id[];
  systemScores: BehaviourScore[];
}

export interface HumanRating {
  id: Id;
  itemId: Id;
  raterId: Id;
  ratedAt: IsoInstant;
  labels: HumanBehaviourLabel[];
  notes?: string;
  status: RatingStatus;
}

export interface RaterDisagreement {
  id: Id;
  itemId: Id;
  behaviourKey: BehaviourKey;
  ratingIds: Id[];
  raterIds: Id[];
  spread: number;
  meanScore: number;
  threshold: number;
  status: DisagreementStatus;
  openedAt: IsoInstant;
  resolvedAt?: IsoInstant;
  adjudicationId?: Id;
  resolutionNote?: string;
}

export interface Adjudication {
  id: Id;
  disagreementId: Id;
  itemId: Id;
  behaviourKey: BehaviourKey;
  selectedDecision: HumanDecision;
  selectedScore: number;
  adjudicatorId: Id;
  /** The evidence considered by the adjudicator, kept next to the decision. */
  exactEvidence: string[];
  rationale: string;
  createdAt: IsoInstant;
}

export interface TransferStudy {
  id: Id;
  title: string;
  skillId: Id;
  targetMeasure: string;
  baselinePracticeScore?: number;
  status: "planned" | "active" | "complete";
  plannedAt: IsoInstant;
  startedAt?: IsoInstant;
  endedAt?: IsoInstant;
}

export interface RealWorldChallengeOutcome {
  id: Id;
  studyId?: Id;
  challengeAttemptId?: Id;
  skillId: Id;
  challengeTitle: string;
  outcome: ChallengeOutcome;
  completed: boolean;
  comfort?: number;
  followUpScore?: number;
  exactEvidence: string[];
  occurredAt: IsoInstant;
  createdAt: IsoInstant;
}

export interface HumanEvidenceState {
  raters: HumanRater[];
  items: HumanEvidenceItem[];
  ratings: HumanRating[];
  disagreements: RaterDisagreement[];
  adjudications: Adjudication[];
  studies: TransferStudy[];
  outcomes: RealWorldChallengeOutcome[];
}

export function emptyHumanEvidence(): HumanEvidenceState {
  return { raters: [], items: [], ratings: [], disagreements: [], adjudications: [], studies: [], outcomes: [] };
}

export function clampEvidenceScore(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function itemFromEvaluation(evaluation: SimulationEvaluation): HumanEvidenceItem {
  return {
    id: `evaluation:${evaluation.id}`,
    title: `Simulation evaluation ${evaluation.createdAt.slice(0, 10)}`,
    kind: "simulation-evaluation",
    source: "local-evaluation",
    occurredAt: evaluation.createdAt,
    skillIds: [],
    systemScores: evaluation.scores,
  };
}

function labelsFor(state: HumanEvidenceState, itemId: Id, behaviourKey: BehaviourKey): { rating: HumanRating; label: HumanBehaviourLabel }[] {
  const matches: { rating: HumanRating; label: HumanBehaviourLabel }[] = [];
  for (const rating of state.ratings) {
    if (rating.itemId !== itemId || rating.status === "excluded") continue;
    const label = rating.labels.find((candidate) => candidate.key === behaviourKey);
    if (label) matches.push({ rating, label });
  }
  return matches;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function majorityDecision(labels: HumanBehaviourLabel[]): HumanDecision {
  const counts = new Map<HumanDecision, number>();
  for (const label of labels) counts.set(label.decision, (counts.get(label.decision) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!ordered[0]) return "uncertain";
  if (ordered[1] && ordered[1][1] === ordered[0][1]) return "uncertain";
  return ordered[0][0];
}

function exactEvidence(labels: HumanBehaviourLabel[]): string[] {
  return [...new Set(labels.flatMap((label) => label.evidence.map((item) => item.trim()).filter(Boolean)))];
}

/** Find stored disagreement rows without losing resolved rows from the audit trail. */
export function detectRaterDisagreements(
  state: HumanEvidenceState,
  threshold = 0.25,
  openedAt = new Date().toISOString(),
): RaterDisagreement[] {
  const detected = new Map<string, RaterDisagreement>();
  const groups = new Map<string, { itemId: Id; behaviourKey: BehaviourKey; matches: { rating: HumanRating; label: HumanBehaviourLabel }[] }>();

  for (const rating of state.ratings) {
    if (rating.status === "excluded") continue;
    for (const label of rating.labels) {
      const id = `${rating.itemId}:${label.key}`;
      const group = groups.get(id) ?? { itemId: rating.itemId, behaviourKey: label.key, matches: [] };
      group.matches.push({ rating, label });
      groups.set(id, group);
    }
  }

  for (const group of groups.values()) {
    const scores = group.matches.map(({ label }) => clampEvidenceScore(label.score));
    if (scores.length < 2) continue;
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread <= threshold) continue;
    const id = `disagreement:${group.itemId}:${group.behaviourKey}`;
    const previous = state.disagreements.find((item) => item.id === id);
    detected.set(id, {
      id,
      itemId: group.itemId,
      behaviourKey: group.behaviourKey,
      ratingIds: group.matches.map(({ rating }) => rating.id),
      raterIds: group.matches.map(({ rating }) => rating.raterId),
      spread,
      meanScore: mean(scores),
      threshold,
      status: previous?.status ?? "open",
      openedAt: previous?.openedAt ?? openedAt,
      ...(previous?.resolvedAt ? { resolvedAt: previous.resolvedAt } : {}),
      ...(previous?.adjudicationId ? { adjudicationId: previous.adjudicationId } : {}),
      ...(previous?.resolutionNote ? { resolutionNote: previous.resolutionNote } : {}),
    });
  }

  const retained = state.disagreements.filter((item) => !detected.has(item.id));
  return [...retained, ...detected.values()].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function reconcileDisagreements(
  state: HumanEvidenceState,
  threshold = 0.25,
  openedAt = new Date().toISOString(),
): HumanEvidenceState {
  return { ...state, disagreements: detectRaterDisagreements(state, threshold, openedAt) };
}

export function resolveAdjudication(
  state: HumanEvidenceState,
  input: Omit<Adjudication, "id"> & { id?: Id },
): HumanEvidenceState {
  const adjudication: Adjudication = { ...input, id: input.id ?? `adjudication:${input.disagreementId}:${input.createdAt}` };
  const disagreements = state.disagreements.map((item) =>
    item.id === adjudication.disagreementId
      ? {
          ...item,
          status: "resolved" as const,
          resolvedAt: adjudication.createdAt,
          adjudicationId: adjudication.id,
          resolutionNote: adjudication.rationale,
        }
      : item,
  );
  return { ...state, adjudications: [...state.adjudications, adjudication], disagreements };
}

function comparisonGroups(state: HumanEvidenceState): RaterItem[] {
  const groups = new Map<string, RaterItem>();
  for (const rating of state.ratings) {
    if (rating.status === "excluded") continue;
    for (const label of rating.labels) {
      const id = `${rating.itemId}:${label.key}`;
      const item = groups.get(id) ?? { categorical: [], scores: [] };
      item.categorical.push(label.decision);
      item.scores.push(clampEvidenceScore(label.score));
      groups.set(id, item);
    }
  }
  return [...groups.values()];
}

export function interRaterReliability(state: HumanEvidenceState): AgreementReport {
  return agreementReport(comparisonGroups(state));
}

export interface RaterConfidenceSummary {
  labels: number;
  mean: number;
  highConfidenceShare: number;
}

export function raterConfidenceSummary(state: HumanEvidenceState): RaterConfidenceSummary {
  const confidences = state.ratings
    .filter((rating) => rating.status !== "excluded")
    .flatMap((rating) => rating.labels.map((label) => label.confidence));
  return {
    labels: confidences.length,
    mean: mean(confidences),
    highConfidenceShare: confidences.length === 0 ? 0 : confidences.filter((confidence) => confidence >= 4).length / confidences.length,
  };
}

export interface BehaviourComparison {
  itemId: Id;
  itemTitle: string;
  behaviourKey: BehaviourKey;
  systemScore: number;
  systemEvidence: string;
  humanScore: number;
  humanDecision: HumanDecision;
  humanConfidence: number;
  humanEvidence: string[];
  absoluteError: number;
  classification: ComparisonClassification;
  reference: "independent" | "adjudicated";
}

export interface SystemAgreementReport {
  compared: number;
  aligned: number;
  meanAbsoluteError: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  comparisons: BehaviourComparison[];
}

function classificationFor(systemScore: number, humanScore: number, decision: HumanDecision): ComparisonClassification {
  if (decision === "uncertain") return "uncertain";
  if (decision === "absent" && systemScore >= 0.6) return "false-positive";
  if (decision === "present" && systemScore <= 0.35) return "false-negative";
  return Math.abs(systemScore - humanScore) <= 0.2 ? "aligned" : "uncertain";
}

export function humanVsSystemAgreement(state: HumanEvidenceState): SystemAgreementReport {
  const itemsById = new Map(state.items.map((item) => [item.id, item]));
  const comparisons: BehaviourComparison[] = [];

  for (const item of state.items) {
    for (const systemScore of item.systemScores) {
      const matches = labelsFor(state, item.id, systemScore.key);
      if (matches.length === 0) continue;
      const adjudication = [...state.adjudications]
        .filter((candidate) => candidate.itemId === item.id && candidate.behaviourKey === systemScore.key)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const labels = matches.map(({ label }) => label);
      const humanScore = adjudication?.selectedScore ?? mean(labels.map((label) => clampEvidenceScore(label.score)));
      const decision = adjudication?.selectedDecision ?? majorityDecision(labels);
      const confidence = adjudication?.id ? 5 : mean(labels.map((label) => label.confidence));
      const system = clampEvidenceScore(systemScore.score);
      comparisons.push({
        itemId: item.id,
        itemTitle: itemsById.get(item.id)?.title ?? item.id,
        behaviourKey: systemScore.key,
        systemScore: system,
        systemEvidence: systemScore.evidence,
        humanScore,
        humanDecision: decision,
        humanConfidence: confidence,
        humanEvidence: exactEvidence(labels.length ? labels : []),
        absoluteError: Math.abs(system - humanScore),
        classification: classificationFor(system, humanScore, decision),
        reference: adjudication ? "adjudicated" : "independent",
      });
    }
  }

  const meanAbsoluteError = mean(comparisons.map((item) => item.absoluteError));
  return {
    compared: comparisons.length,
    aligned: comparisons.filter((item) => item.classification === "aligned").length,
    meanAbsoluteError,
    falsePositiveCount: comparisons.filter((item) => item.classification === "false-positive").length,
    falseNegativeCount: comparisons.filter((item) => item.classification === "false-negative").length,
    comparisons,
  };
}

export interface CalibrationBucket {
  label: string;
  lower: number;
  upper: number;
  count: number;
  meanSystemScore: number;
  meanHumanScore: number;
  bias: number;
}

const CALIBRATION_BUCKETS = [
  { label: "0–35%", lower: 0, upper: 0.35 },
  { label: "35–60%", lower: 0.35, upper: 0.6 },
  { label: "60–85%", lower: 0.6, upper: 0.85 },
  { label: "85–100%", lower: 0.85, upper: 1.01 },
] as const;

export function scoreCalibration(state: HumanEvidenceState): CalibrationBucket[] {
  const comparisons = humanVsSystemAgreement(state).comparisons;
  return CALIBRATION_BUCKETS.map((bucket) => {
    const values = comparisons.filter((item) => item.systemScore >= bucket.lower && item.systemScore < bucket.upper);
    const meanSystemScore = mean(values.map((item) => item.systemScore));
    const meanHumanScore = mean(values.map((item) => item.humanScore));
    return {
      ...bucket,
      count: values.length,
      meanSystemScore,
      meanHumanScore,
      bias: values.length === 0 ? 0 : meanHumanScore - meanSystemScore,
    };
  });
}

export interface TransferReport {
  studyId: Id;
  title: string;
  status: TransferStudy["status"];
  outcomeCount: number;
  completedCount: number;
  completionRate: number;
  meanComfort: number | null;
  baselinePracticeScore: number | null;
  meanFollowUpScore: number | null;
  scoreGain: number | null;
  evidenceCount: number;
}

export function transferReports(state: HumanEvidenceState): TransferReport[] {
  return state.studies.map((study) => {
    const outcomes = state.outcomes.filter((outcome) => outcome.studyId === study.id);
    const followUp = outcomes.flatMap((outcome) => (outcome.followUpScore === undefined ? [] : [outcome.followUpScore]));
    const comforts = outcomes.flatMap((outcome) => (outcome.comfort === undefined ? [] : [outcome.comfort]));
    const meanFollowUpScore = followUp.length ? mean(followUp) : null;
    const baseline = study.baselinePracticeScore ?? null;
    return {
      studyId: study.id,
      title: study.title,
      status: study.status,
      outcomeCount: outcomes.length,
      completedCount: outcomes.filter((outcome) => outcome.completed).length,
      completionRate: outcomes.length === 0 ? 0 : outcomes.filter((outcome) => outcome.completed).length / outcomes.length,
      meanComfort: comforts.length ? mean(comforts) : null,
      baselinePracticeScore: baseline,
      meanFollowUpScore,
      scoreGain: baseline === null || meanFollowUpScore === null ? null : meanFollowUpScore - baseline,
      evidenceCount: outcomes.reduce((total, outcome) => total + outcome.exactEvidence.length, 0),
    };
  });
}

