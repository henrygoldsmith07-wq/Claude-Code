// ---------------------------------------------------------------------------
// Human-rated corpus infrastructure.
//
// The evaluator's scores are a claim about human conversation, so the product
// needs a bench that can answer "would two independent people agree with this
// number?". That bench cannot be synthetic or fabricated — it has to be built
// from real, opted-in transcripts, rated by real humans, with the disagreement
// left inspectable rather than smoothed away.
//
// This module defines a benchmark format for that bench. It:
//
//  * names the 11 observable behaviours the rubric cares about (deliberately a
//    superset of the 13 internal BehaviourKeys so mapping is explicit, not
//    accidental);
//  * stores the transcript, exact evidence spans, rater A/B, consensus, notes,
//    rubric version and provenance together — the unit that a later audit needs;
//  * validates imports without inventing ratings; a missing human rating is a
//    gap, not a zero;
//  * keeps benchmark/research data structurally separate from normal product data.
//
// Privacy is load-bearing here: the corpus never holds a user id, never holds
// the original unredacted text, and is gated behind an opt-in that is stored
// as a consent record rather than a boolean flag.
// ---------------------------------------------------------------------------

import type { BehaviourKey, EvidenceSpan, Id, IsoInstant } from "./types";

// ---------------------------------------------------------------------------
// Behaviour vocabulary for human rating
// ---------------------------------------------------------------------------

/**
 * The 11 observable behaviours a rater judges. Each maps onto one or more
 * internal BehaviourKeys — the mapping is explicit so the evaluator's own
 * blind spots are visible rather than hidden behind a shared name.
 *
 * Example: "active listening" maps to relevance + listening; "acknowledgement"
 * maps to listening + empathy's validation component; "domination" is the
 * inverse of contribution/reciprocity, etc. The mapping is kept auditable in
 * `CORPUS_BEHAVIOUR_MAP`.
 */
export const CORPUS_BEHAVIOURS = [
  "active-listening",
  "follow-up-quality",
  "acknowledgement",
  "interruption",
  "conversational-balance",
  "curiosity",
  "responsiveness",
  "topic-continuity",
  "domination",
  "missed-opportunities",
  "observable-empathy",
] as const;
export type CorpusBehaviour = (typeof CORPUS_BEHAVIOURS)[number];

/**
 * Mapping from corpus behaviours to the evaluator's internal keys. One corpus
 * behaviour can map to several internal keys; a single internal key can be hit
 * by several corpus behaviours — the overlap is intentional and documented.
 */
export const CORPUS_BEHAVIOUR_MAP: Record<CorpusBehaviour, BehaviourKey[]> = {
  "active-listening": ["relevance", "listening"],
  "follow-up-quality": ["followUpQuality"],
  acknowledgement: ["listening", "empathy"],
  interruption: ["interruptionHandling"],
  "conversational-balance": ["reciprocity", "contribution"],
  curiosity: ["questionQuality", "followUpQuality"],
  responsiveness: ["relevance", "reciprocity"],
  "topic-continuity": ["relevance", "topicTransitions"],
  domination: ["contribution", "reciprocity"],
  "missed-opportunities": ["listening", "followUpQuality", "empathy"],
  "observable-empathy": ["empathy"],
};

export function corpusToInternalBehaviours(behaviour: CorpusBehaviour): BehaviourKey[] {
  return CORPUS_BEHAVIOUR_MAP[behaviour] ?? [];
}

export function internalToCorpusBehaviours(key: BehaviourKey): CorpusBehaviour[] {
  return (Object.entries(CORPUS_BEHAVIOUR_MAP) as [CorpusBehaviour, BehaviourKey[]][])
    .filter(([, keys]) => keys.includes(key))
    .map(([behaviour]) => behaviour);
}

// ---------------------------------------------------------------------------
// Transcript & evidence
// ---------------------------------------------------------------------------

export interface CorpusTurn {
  turnId: Id;
  index: number;
  speaker: "user" | "character";
  text: string;
  /** Optional character id when speaker is character, for group conversations. */
  characterId?: Id;
}

/** An exact quote with character offsets inside the turn, so a UI can highlight it. */
export interface CorpusEvidenceSpan {
  turnId: Id;
  turnIndex: number;
  speaker: "user" | "character";
  quote: string;
  /** Character offsets within the turn text, inclusive-start exclusive-end. Null when quote is whole turn. */
  start?: number;
  end?: number;
  role: "support" | "missed-opportunity";
}

export function toCorpusEvidenceSpan(span: EvidenceSpan): CorpusEvidenceSpan {
  return {
    turnId: span.turnId,
    turnIndex: span.turnIndex,
    speaker: span.speaker,
    quote: span.quote,
    role: span.role,
  };
}

// ---------------------------------------------------------------------------
// Rating types
// ---------------------------------------------------------------------------

export const CORPUS_RUBRIC_VERSION = "2026-08-20.1";

export interface RaterInfo {
  id: Id;
  displayName: string;
  trainedAt?: IsoInstant;
}

export type CorpusDecision = "present" | "absent" | "uncertain" | "not-applicable";

export interface CorpusLabel {
  behaviour: CorpusBehaviour;
  /** Categorical judgement for this behaviour on this transcript. */
  decision: CorpusDecision;
  /** 0-1 continuous score, retained alongside the category. */
  score: number;
  /** 1-5 rater confidence. */
  confidence: 1 | 2 | 3 | 4 | 5;
  /** Exact excerpts that justify the judgement. */
  evidence: CorpusEvidenceSpan[];
  /** Free-form note, kept next to the decision, never synthesized. */
  note?: string;
}

export interface CorpusRating {
  id: Id;
  itemId: Id;
  raterId: Id;
  ratedAt: IsoInstant;
  rubricVersion: string;
  labels: CorpusLabel[];
  /** Overall notes for this rating pass. */
  notes?: string;
  status: "independent" | "excluded";
}

export interface CorpusConsensus {
  id: Id;
  itemId: Id;
  behaviour: CorpusBehaviour;
  /** How the consensus was reached. */
  method: "agreement" | "adjudicated" | "averaged";
  consensusDecision: CorpusDecision;
  consensusScore: number;
  /** Mean rater confidence. */
  meanConfidence: number;
  /** The exact evidence the adjudicator/consensus considered. */
  evidence: CorpusEvidenceSpan[];
  raterIds: Id[];
  ratingIds: Id[];
  /** Remaining disagreement after consensus (0 = full agreement). */
  residualSpread: number;
  adjudicatorId?: Id;
  rationale?: string;
  resolvedAt: IsoInstant;
  rubricVersion: string;
}

// ---------------------------------------------------------------------------
// Corpus item
// ---------------------------------------------------------------------------

export type CorpusItemProvenance =
  | { kind: "donated-transcript"; donatedAt: IsoInstant; consentVersion: string }
  | { kind: "researcher-entered"; enteredAt: IsoInstant; enteredBy?: Id }
  | { kind: "imported"; importedAt: IsoInstant; source: string; originalId?: string };

export interface CorpusItem {
  id: Id;
  title: string;
  transcript: CorpusTurn[];
  /** System scores at time of donation, retained for comparison but never used as ground truth. */
  systemScores?: { key: BehaviourKey; score: number; evidence: string }[];
  evidenceSpans?: CorpusEvidenceSpan[];
  provenance: CorpusItemProvenance;
  rubricVersion: string;
  createdAt: IsoInstant;
  skillIds?: Id[];
  /** Whether observable empathy could be judged in this transcript (requires emotional cue). */
  empathyApplicable?: boolean;
  /** Opt-in still valid. A withdrawn item is retained only as a tombstone for audit. */
  withdrawnAt?: IsoInstant;
}

export interface CorpusBenchmark {
  version: string;
  rubricVersion: string;
  createdAt: IsoInstant;
  items: CorpusItem[];
  ratings: CorpusRating[];
  consensus: CorpusConsensus[];
  raters: RaterInfo[];
  /** Methodology note, stored with the data so it travels. */
  methodology: string;
}

export const CORPUS_METHODOLOGY =
  "This corpus holds opt-in conversations, each rated independently by two humans. " +
  "Raters judge 11 observable behaviours on this transcript only. Scores are 0-1 with evidence spans. " +
  "Consensus is reached by agreement when spread ≤0.25, otherwise adjudicated. " +
  "System scores are stored alongside but never used as ground truth. No ratings are fabricated; " +
  "a missing rating is a gap. Identifying information is stripped before storage, and donation is one transcript at a time with explicit consent.";

export function emptyCorpus(now = new Date().toISOString()): CorpusBenchmark {
  return {
    version: "1.0.0",
    rubricVersion: CORPUS_RUBRIC_VERSION,
    createdAt: now,
    items: [],
    ratings: [],
    consensus: [],
    raters: [],
    methodology: CORPUS_METHODOLOGY,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface CorpusImportIssue {
  path: string;
  message: string;
}

export function validateCorpusImport(payload: unknown): { ok: boolean; issues: CorpusImportIssue[] } {
  const issues: CorpusImportIssue[] = [];
  if (!payload || typeof payload !== "object") {
    return { ok: false, issues: [{ path: "", message: "Payload must be an object." }] };
  }
  const obj = payload as Record<string, unknown>;
  if (!Array.isArray(obj.items)) issues.push({ path: "items", message: "items must be an array." });
  if (!Array.isArray(obj.ratings)) issues.push({ path: "ratings", message: "ratings must be an array." });
  if (typeof obj.rubricVersion !== "string") issues.push({ path: "rubricVersion", message: "rubricVersion must be a string." });

  const items = Array.isArray(obj.items) ? (obj.items as unknown[]) : [];
  const ratings = Array.isArray(obj.ratings) ? (obj.ratings as unknown[]) : [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown>;
    if (!item || typeof item !== "object") {
      issues.push({ path: `items[${i}]`, message: "Item must be object." });
      continue;
    }
    if (typeof item.id !== "string" || !item.id) issues.push({ path: `items[${i}].id`, message: "Missing id." });
    if (!Array.isArray(item.transcript) || (item.transcript as unknown[]).length === 0) {
      issues.push({ path: `items[${i}].transcript`, message: "Transcript must be non-empty array." });
    } else {
      const transcript = item.transcript as unknown[];
      for (let t = 0; t < transcript.length; t++) {
        const turn = transcript[t] as Record<string, unknown>;
        if (typeof turn.text !== "string" || !turn.text.trim()) {
          issues.push({ path: `items[${i}].transcript[${t}].text`, message: "Turn text required." });
        }
        if (turn.speaker !== "user" && turn.speaker !== "character") {
          issues.push({ path: `items[${i}].transcript[${t}].speaker`, message: "speaker must be user or character." });
        }
      }
    }
    if (!item.provenance || typeof item.provenance !== "object") {
      issues.push({ path: `items[${i}].provenance`, message: "provenance required (donated, researcher-entered, or imported)." });
    }
  }

  for (let i = 0; i < ratings.length; i++) {
    const rating = ratings[i] as Record<string, unknown>;
    if (!rating || typeof rating !== "object") {
      issues.push({ path: `ratings[${i}]`, message: "Rating must be object." });
      continue;
    }
    if (typeof rating.itemId !== "string" || !rating.itemId) issues.push({ path: `ratings[${i}].itemId`, message: "Missing itemId." });
    if (typeof rating.raterId !== "string" || !rating.raterId) issues.push({ path: `ratings[${i}].raterId`, message: "Missing raterId." });
    if (!Array.isArray(rating.labels)) issues.push({ path: `ratings[${i}].labels`, message: "labels must be array." });
    else {
      const labels = rating.labels as unknown[];
      for (let l = 0; l < labels.length; l++) {
        const label = labels[l] as Record<string, unknown>;
        if (!CORPUS_BEHAVIOURS.includes(label.behaviour as CorpusBehaviour)) {
          issues.push({ path: `ratings[${i}].labels[${l}].behaviour`, message: `Unknown behaviour ${String(label.behaviour)}.` });
        }
        if (typeof label.score !== "number" || label.score < 0 || label.score > 1) {
          issues.push({ path: `ratings[${i}].labels[${l}].score`, message: "score must be 0-1." });
        }
        if (typeof label.confidence !== "number" || label.confidence < 1 || label.confidence > 5) {
          issues.push({ path: `ratings[${i}].labels[${l}].confidence`, message: "confidence must be 1-5." });
        }
        if (label.evidence !== undefined && !Array.isArray(label.evidence)) {
          issues.push({ path: `ratings[${i}].labels[${l}].evidence`, message: "evidence must be array." });
        }
      }
    }
    // Provenance for rating: rater must have seen exact transcript version.
    if (typeof rating.rubricVersion !== "string" || !rating.rubricVersion) {
      issues.push({ path: `ratings[${i}].rubricVersion`, message: "rubricVersion required for traceability." });
    }
  }

  // Referential integrity: ratings must point at existing items.
  const itemIds = new Set(items.map((it) => (it as Record<string, unknown>).id as string));
  for (let i = 0; i < ratings.length; i++) {
    const r = ratings[i] as Record<string, unknown>;
    if (typeof r.itemId === "string" && !itemIds.has(r.itemId)) {
      issues.push({ path: `ratings[${i}].itemId`, message: `References unknown item ${r.itemId}.` });
    }
  }

  // Do not fabricate ratings: flag if a single rater appears twice for same item+behaviour.
  const seen = new Set<string>();
  for (let i = 0; i < ratings.length; i++) {
    const r = ratings[i] as Record<string, unknown>;
    const labels = Array.isArray(r.labels) ? (r.labels as Record<string, unknown>[]) : [];
    for (const label of labels) {
      const key = `${r.itemId}:${r.raterId}:${String(label.behaviour)}`;
      if (seen.has(key)) {
        issues.push({ path: `ratings[${i}]`, message: `Duplicate rating ${key} — each rater rates each behaviour once.` });
      } else seen.add(key);
    }
  }

  return { ok: issues.length === 0, issues };
}

export function isCorpusImportValid(payload: unknown): boolean {
  return validateCorpusImport(payload).ok;
}

// ---------------------------------------------------------------------------
// Consensus derivation
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function decisionFromScore(score: number): CorpusDecision {
  if (score >= 0.6) return "present";
  if (score <= 0.35) return "absent";
  return "uncertain";
}

export function deriveConsensus(
  item: CorpusItem,
  ratings: CorpusRating[],
  threshold = 0.25,
  adjudicatorId?: Id,
  now = new Date().toISOString(),
): CorpusConsensus[] {
  const active = ratings.filter((r) => r.status === "independent" && r.itemId === item.id);
  const byBehaviour = new Map<CorpusBehaviour, CorpusRating[]>();

  // Group ratings by behaviour (each rating may contain that behaviour)
  for (const behaviour of CORPUS_BEHAVIOURS) {
    const group = active.filter((r) => r.labels.some((l) => l.behaviour === behaviour));
    if (group.length > 0) byBehaviour.set(behaviour, group);
  }

  const results: CorpusConsensus[] = [];
  for (const [behaviour, group] of byBehaviour) {
    if (group.length < 2) continue; // need two raters to produce consensus
    const scores = group.flatMap((r) => r.labels.filter((l) => l.behaviour === behaviour).map((l) => l.score));
    if (scores.length < 2) continue;
    const spread = Math.max(...scores) - Math.min(...scores);
    const consensusScore = mean(scores);
    const evidence = [...new Set(group.flatMap((r) => r.labels.filter((l) => l.behaviour === behaviour).flatMap((l) => l.evidence.map((e) => e.quote.trim())).filter(Boolean)))].map(
      (quote) => ({ turnId: "consensus", turnIndex: -1, speaker: "user" as const, quote, role: "support" as const }),
    );
    const raterIds = [...new Set(group.map((r) => r.raterId))];
    const ratingIds = group.map((r) => r.id);

    if (spread <= threshold) {
      results.push({
        id: `consensus:${item.id}:${behaviour}`,
        itemId: item.id,
        behaviour,
        method: "agreement",
        consensusDecision: decisionFromScore(consensusScore),
        consensusScore,
        meanConfidence: mean(group.flatMap((r) => r.labels.map((l: CorpusLabel) => l.confidence))),
        evidence,
        raterIds,
        ratingIds,
        residualSpread: spread,
        resolvedAt: now,
        rubricVersion: item.rubricVersion,
      });
    } else if (adjudicatorId) {
      // Adjudicated when spread exceeds threshold and adjudicator supplied — caller provides adjudicated score separately.
      // Here we surface the disagreement for adjudication rather than inventing a number.
      results.push({
        id: `consensus:${item.id}:${behaviour}`,
        itemId: item.id,
        behaviour,
        method: "adjudicated",
        consensusDecision: "uncertain",
        consensusScore,
        meanConfidence: mean(group.flatMap((r) => r.labels.map((l: CorpusLabel) => l.confidence))),
        evidence,
        raterIds,
        ratingIds,
        residualSpread: spread,
        adjudicatorId,
        rationale: `Spread ${spread.toFixed(2)} exceeds ${threshold} — requires adjudication. No fabricated consensus.`,
        resolvedAt: now,
        rubricVersion: item.rubricVersion,
      });
    }
    // else: no consensus yet — returned as empty; caller must adjudicate rather than average silently.
  }
  return results;
}

// ---------------------------------------------------------------------------
// Privacy: stripping
// ---------------------------------------------------------------------------

/**
 * Strip identifying information from a corpus item before storage. The transcript
 * text is the payload; metadata that could link it back is removed.
 * This is deliberately conservative — better to over-strip than to leak.
 */
export function stripCorpusItemForStorage(item: CorpusItem): CorpusItem {
  // Whitelist, not blacklist: anything not named here cannot survive into storage,
  // so a later refactor that adds a userId field cannot quietly leak it.
  return {
    id: item.id,
    title: item.title,
    transcript: item.transcript.map((turn) => ({
      turnId: turn.turnId,
      index: turn.index,
      speaker: turn.speaker,
      text: turn.text,
    })),
    ...(item.systemScores ? { systemScores: item.systemScores } : {}),
    ...(item.evidenceSpans ? { evidenceSpans: item.evidenceSpans } : {}),
    provenance:
      item.provenance.kind === "donated-transcript"
        ? { kind: "donated-transcript", donatedAt: item.provenance.donatedAt, consentVersion: item.provenance.consentVersion }
        : item.provenance.kind === "researcher-entered"
          ? { kind: "researcher-entered", enteredAt: item.provenance.enteredAt }
          : { kind: "imported", importedAt: item.provenance.importedAt, source: item.provenance.source },
    rubricVersion: item.rubricVersion,
    createdAt: item.createdAt,
    ...(item.skillIds ? { skillIds: item.skillIds } : {}),
    ...(item.empathyApplicable !== undefined ? { empathyApplicable: item.empathyApplicable } : {}),
    ...(item.withdrawnAt ? { withdrawnAt: item.withdrawnAt } : {}),
  };
}

export function anonymizeTranscriptTurns(turns: CorpusTurn[], redact: string[] = []): CorpusTurn[] {
  if (redact.length === 0) return turns;
  const sorted = [...redact].sort((a, b) => b.length - a.length);
  return turns.map((turn) => {
    let text = turn.text;
    for (const value of sorted) {
      if (!value) continue;
      const esc = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp(esc, "g"), "[removed]");
    }
    return { ...turn, text };
  });
}

// ---------------------------------------------------------------------------
// Helpers: build items from simulations/donations
// ---------------------------------------------------------------------------

import type { DonatedTranscript } from "./donation";
import type { Simulation } from "./types";

export function corpusItemFromDonation(
  donation: DonatedTranscript,
  title?: string,
  skillIds: Id[] = [],
): CorpusItem {
  return {
    id: donation.id,
    title: title ?? donation.scenarioTitle,
    transcript: donation.turns.map((turn, index) => ({
      turnId: `turn:${donation.id}:${index}`,
      index,
      speaker: turn.speaker,
      text: turn.text,
    })),
    provenance: { kind: "donated-transcript", donatedAt: donation.donatedAt, consentVersion: donation.consent.consentVersion },
    rubricVersion: CORPUS_RUBRIC_VERSION,
    createdAt: donation.donatedAt,
    skillIds: skillIds.length ? skillIds : undefined,
  };
}

export function corpusItemFromSimulation(
  simulation: Simulation,
  provenanceNote?: string,
  now = new Date().toISOString(),
): CorpusItem {
  return {
    id: `corpus:${simulation.id}`,
    title: simulation.scenario.title,
    transcript: [...simulation.turns]
      .sort((a, b) => a.index - b.index)
      .map((turn) => ({
        turnId: turn.id,
        index: turn.index,
        speaker: turn.speaker,
        text: turn.text,
        characterId: turn.characterId,
      })),
    provenance: { kind: "researcher-entered", enteredAt: now, enteredBy: provenanceNote },
    rubricVersion: CORPUS_RUBRIC_VERSION,
    createdAt: now,
    skillIds: simulation.scenario.skillIds,
  };
}

export function corpusItemWithdrawn(item: CorpusItem, now: IsoInstant): CorpusItem {
  return { ...item, withdrawnAt: now, transcript: [] };
}

export function isCorpusItemActive(item: CorpusItem): boolean {
  return item.withdrawnAt === undefined;
}
