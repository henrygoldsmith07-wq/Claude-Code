// ---------------------------------------------------------------------------
// Behaviour-level state.
//
// The skill-level model in mastery.ts answers "how well is this person at
// group conversation?". That number is real, but it is the wrong resolution for
// deciding what someone practises next: a user can be strong at reassurance and
// consistently avoidant about taking the floor, and one number cannot hold both
// facts — so a weakness that is highly diagnostic of real performance has
// nowhere to live.
//
// Diagnosis already happens at behaviour resolution. evaluation.ts emits a
// BehaviourScore for each of the 13 observable behaviours in every conversation,
// confidence.ts already computes a per-behaviour confidence, agreement.ts already
// carries a per-behaviour inter-rater reliability, and transfer.ts already
// tracks transfer per (skill, behaviour). All of that measurement was real and
// then stopped at the edge of the skill fold — events.ts projects a
// simulation's behaviours down to a single per-skill scalar and the behaviour
// detail is discarded from the projection.
//
// This module is the missing half: a durable, decayed, uncertainty-bearing state
// per behaviour, folded from the same append-only event log as the skill states,
// so the product can finally answer "which exact behaviour, in which context,
// for what reason" rather than "what was worst in the conversation you just had".
//
// It deliberately does NOT depend on skills.ts. Behaviour state is keyed by
// BehaviourKey, which lives in types.ts; keeping this module free of the skill
// graph means it can be recomputed and tested without loading content.
// ---------------------------------------------------------------------------

import type { BehaviourKey, Id, IsoInstant } from "./types";

// ---------------------------------------------------------------------------
// The state
// ---------------------------------------------------------------------------

/**
 * Per-behaviour analogue of UserSkillState.
 *
 * The fields are deliberately the same six the skill model reasons about —
 * mastery, uncertainty, confidence, evidence count, difficulty tolerance and
 * retention — so a future recommender can treat the two resolutions uniformly
 * and a human reading either model sees the same shape.
 */
export interface UserBehaviourState {
  userId: Id;
  behaviour: BehaviourKey;
  /** 0-1 estimated competence on this observable behaviour. */
  mastery: number;
  /** 0-1 standard-deviation-like uncertainty. High = the app is guessing. */
  masteryUncertainty: number;
  /**
   * 0-1 self-reported/observed comfort with this behaviour specifically.
   *
   * Comfort is tracked per behaviour because confidence is not a mood — it is
   * "how willing am I to do THIS thing", and someone can be comfortable
   * reassuring a colleague while dreading taking the floor. Collapsing that to a
   * skill-level number is what made the skill model unable to name the real
   * obstacle.
   */
  confidence: number;
  confidenceUncertainty: number;
  /** Every observation that touched this behaviour, reliable or not. */
  observationCount: number;
  /** Distinct corroborating pieces of evidence; real-world attempts count double. */
  successEvidence: number;
  /**
   * 1-5. The hardest occasion on which this behaviour was recently held.
   * Tracks the behaviour, not a whole skill, so a user can be
   * high-tolerance on empathy and low-tolerance on floor entry at the same time.
   */
  difficultyTolerance: number;
  /** 0-1 estimated current retention, decayed from lastObservedAt. */
  retentionEstimate: number;
  lastObservedAt?: IsoInstant;
  updatedAt: IsoInstant;
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface BehaviourEvidence {
  behaviour: BehaviourKey;
  /** 0-1 how well the behaviour was performed on this occasion. */
  performance: number;
  /** 1-5 how demanding the occasion was. */
  difficulty: number;
  kind: "simulation" | "challenge" | "exercise" | "self-report" | "human-rating";
  /** 0-1 how much to trust this observation (thin transcripts are weak evidence). */
  reliability: number;
  at: IsoInstant;
  /** Optional self-reported comfort on this occasion; updates confidence only. */
  comfort?: number;
  /**
   * True when the occasion carries no information about competence at all
   * (a non-attempt, or a turn too short to judge). Mastery, success evidence and
   * difficulty tolerance are left untouched; only comfort moves.
   */
  comfortOnly?: boolean;
}

/**
 * Per-source weight, mirroring mastery.ts KIND_WEIGHT.
 *
 * Real-world attempts outrank simulation; a human rater outranks both, because a
 * named person looked at the transcript and said the behaviour was there.
 */
const KIND_WEIGHT: Record<BehaviourEvidence["kind"], number> = {
  challenge: 1,
  simulation: 0.6,
  exercise: 0.35,
  "self-report": 0.3,
  "human-rating": 1,
};

const DEFAULT_UNCERTAINTY = 0.3;
/** Uncertainty never collapses to zero: people change, and the model stays corrigible. */
const MIN_UNCERTAINTY = 0.06;
/** Days over which an unobserved behaviour's uncertainty regrows to its starting width. */
const UNCERTAINTY_REGROWTH_DAYS = 90;
const BASE_RETENTION_HALF_LIFE_DAYS = 12;
/**
 * Below this performance the behaviour was not demonstrated. Matches the
 * skill-level threshold so the two resolutions do not disagree about what
 * "succeeded" means.
 */
const SUCCESS_THRESHOLD = 0.6;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function daysBetween(from: IsoInstant, to: IsoInstant): number {
  return Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * A starting point, not a measurement. Unlike a skill, a behaviour has no
 * intrinsic base difficulty, so every behaviour starts from the same neutral
 * prior. The real signal arrives from the first observation, which — because
 * uncertainty starts wide — moves the estimate a long way. That is the desired
 * behaviour for a fresh install: ask nothing, assume nothing.
 */
export function initialBehaviourState(userId: Id, behaviour: BehaviourKey, at: IsoInstant): UserBehaviourState {
  return {
    userId,
    behaviour,
    mastery: 0.5,
    masteryUncertainty: DEFAULT_UNCERTAINTY,
    confidence: 0.5,
    confidenceUncertainty: DEFAULT_UNCERTAINTY,
    observationCount: 0,
    successEvidence: 0,
    difficultyTolerance: 2,
    retentionEstimate: 0.5,
    updatedAt: at,
  };
}

/**
 * Difficulty-adjusted target: performing well at difficulty 5 implies more
 * mastery than the same performance at difficulty 1; performing badly at 1
 * implies less than the same performance at 5. Same shape as mastery.ts
 * evidenceTarget so a skill score and a behaviour score are comparable.
 */
function evidenceTarget(performance: number, difficulty: number): number {
  const d = Math.min(5, Math.max(1, difficulty));
  const ceiling = 0.45 + d * 0.11;
  const floor = (d - 1) * 0.1125;
  return clamp01(floor + performance * (ceiling - floor));
}

/** Apply one observation to a behaviour state. Pure; returns a new state. */
export function applyBehaviourEvidence(state: UserBehaviourState, evidence: BehaviourEvidence): UserBehaviourState {
  const weight = KIND_WEIGHT[evidence.kind] * clamp01(evidence.reliability);
  if (weight <= 0) return state;

  const decayed = decayBehaviourState(state, evidence.at);

  // A comfort-only occasion (a non-attempt, or a turn too thin to judge) is
  // information about willingness and none about competence. It must not move
  // mastery, success evidence or difficulty tolerance in either direction.
  if (evidence.comfortOnly) {
    if (evidence.comfort === undefined) return state;
    const cVariance = decayed.confidenceUncertainty ** 2;
    const cGain = cVariance / (cVariance + (0.3 / Math.max(weight, 0.2)) ** 2);
    return {
      ...decayed,
      confidence: clamp01(decayed.confidence + cGain * (clamp01(evidence.comfort) - decayed.confidence)),
      confidenceUncertainty: Math.max(MIN_UNCERTAINTY, Math.sqrt(cVariance * (1 - cGain))),
    };
  }

  const target = evidenceTarget(clamp01(evidence.performance), evidence.difficulty);

  const observationNoise = 0.35 / weight;
  const variance = decayed.masteryUncertainty ** 2;
  const gain = variance / (variance + observationNoise ** 2);

  const mastery = clamp01(decayed.mastery + gain * (target - decayed.mastery));
  const masteryUncertainty = Math.max(MIN_UNCERTAINTY, Math.sqrt(variance * (1 - gain)));

  let confidence = decayed.confidence;
  let confidenceUncertainty = decayed.confidenceUncertainty;
  if (evidence.comfort !== undefined) {
    const cVariance = confidenceUncertainty ** 2;
    const cGain = cVariance / (cVariance + (0.3 / Math.max(weight, 0.2)) ** 2);
    confidence = clamp01(confidence + cGain * (clamp01(evidence.comfort) - confidence));
    confidenceUncertainty = Math.max(MIN_UNCERTAINTY, Math.sqrt(cVariance * (1 - cGain)));
  } else {
    confidence = clamp01(confidence + 0.25 * gain * (target - confidence));
    confidenceUncertainty = Math.max(MIN_UNCERTAINTY, confidenceUncertainty * 0.98);
  }

  const succeeded = evidence.performance >= SUCCESS_THRESHOLD;
  const successEvidence =
    decayed.successEvidence + (succeeded ? (evidence.kind === "challenge" ? 2 : 1) * clamp01(evidence.reliability) : 0);

  let difficultyTolerance = decayed.difficultyTolerance;
  if (succeeded && evidence.difficulty >= difficultyTolerance) {
    difficultyTolerance = Math.min(5, difficultyTolerance + 0.5);
  } else if (evidence.performance < 0.35 && evidence.difficulty <= difficultyTolerance) {
    difficultyTolerance = Math.max(1, difficultyTolerance - 0.34);
  }

  return {
    ...decayed,
    mastery,
    masteryUncertainty,
    confidence,
    confidenceUncertainty,
    observationCount: decayed.observationCount + 1,
    successEvidence,
    difficultyTolerance,
    lastObservedAt: evidence.at,
    retentionEstimate: 1,
    updatedAt: evidence.at,
  };
}

/**
 * Age a behaviour state to `now`. Mastery is left alone — what someone *can* do
 * is not what decays; whether they would do it *today* is. Uncertainty regrows
 * so the app stops asserting a confident claim about behaviour it last saw four
 * months ago.
 */
export function decayBehaviourState(state: UserBehaviourState, now: IsoInstant): UserBehaviourState {
  if (!state.lastObservedAt) return state;
  const days = daysBetween(state.lastObservedAt, now);
  if (days <= 0) return state;
  const halfLife = behaviourHalfLifeDays(state);
  const retentionEstimate = clamp01(Math.pow(0.5, days / halfLife));
  const regrowth = Math.min(1, days / UNCERTAINTY_REGROWTH_DAYS);
  return {
    ...state,
    retentionEstimate,
    masteryUncertainty: Math.min(DEFAULT_UNCERTAINTY, state.masteryUncertainty + regrowth * (DEFAULT_UNCERTAINTY - state.masteryUncertainty)),
    confidenceUncertainty: Math.min(DEFAULT_UNCERTAINTY, state.confidenceUncertainty + regrowth * (DEFAULT_UNCERTAINTY - state.confidenceUncertainty)),
  };
}

/** Retention half-life grows with corroboration and mastery, like the skill model. */
export function behaviourHalfLifeDays(state: UserBehaviourState): number {
  const evidenceBoost = 1 + Math.min(3, state.successEvidence * 0.35);
  const masteryBoost = 0.6 + state.mastery * 1.6;
  return BASE_RETENTION_HALF_LIFE_DAYS * evidenceBoost * masteryBoost;
}

/**
 * Positive when the user is more confident than competent on this behaviour
 * (over-reach); negative when better than they feel (the common case). Computed
 * per behaviour, so it can point at the specific gap that matters — the user who
 * is comfortable reassuring but dreadful about taking the floor.
 */
export function behaviourConfidenceGap(state: UserBehaviourState): number {
  return state.confidence - state.mastery;
}

// ---------------------------------------------------------------------------
// Decay-to-now (R4)
// ---------------------------------------------------------------------------

/**
 * Age every behaviour state to `now`.
 *
 * events.ts recomputes skill states by folding evidence keyed to each event's
 * own timestamp, so a lapsed user's retention is frozen at its last-event value
 * and never reflects elapsed time. This exposes the same decay applied at read
 * time so behaviour retention — the signal that could demonstrate independence
 * after an absence — is honest. See recomputeStates' comment; this is the
 * behaviour-resolution counterpart and must be called after the fold.
 */
export function ageBehaviourStates(states: UserBehaviourState[], now: IsoInstant): UserBehaviourState[] {
  return states.map((state) => decayBehaviourState(state, now));
}

// ---------------------------------------------------------------------------
// Selection: the exact behaviour worth practising next (R2 primitive)
// ---------------------------------------------------------------------------

export interface BehaviourWeakness {
  behaviour: BehaviourKey;
  state: UserBehaviourState;
  /**
   * Expected gain from one more occasion of practice, 0-1. Higher = more worth
   * the user's time. This is the ranking the recommender needs and the thing
   * that does not exist today.
   */
  expectedGain: number;
  /** Human-readable, no jargon, suitable for "why this". */
  reason: string;
}

/**
 * Rank behaviours by expected gain from the next practice occasion.
 *
 * The point of ranking by *gain* rather than by *lowest score* is that a
 * behaviour can be weak and irrelevant while another is slightly less weak and
 * central to what the user is trying to do. Selection factors, in order:
 *
 *   1. headroom      — how far below a usable level the behaviour sits (the gap)
 *   2. decay         — how much retention has fallen (is this urgent now?)
 *   3. evidenceGap   — thin evidence raises gain (the app is guessing; one more
 *                      observation resolves it), heavy evidence lowers it (we
 *                      already know)
 *   4. uncertainty   — high uncertainty nudges up (worth measuring), very low
 *                      nudges down (stop re-measuring a settled fact)
 *
 * Behaviours never observed are excluded: "no data" is not "high value", and
 * selecting an unseen behaviour would hand the user a weak they have never been
 * told about, in a place they never were.
 */
export function rankBehavioursByExpectedGain(states: UserBehaviourState[], now: IsoInstant): BehaviourWeakness[] {
  const aged = ageBehaviourStates(states, now).filter((state) => state.lastObservedAt !== undefined);

  const ranked = aged.map((state) => {
    const decayed = decayBehaviourState(state, now);
    // Headroom: distance below the "strong" band. A behaviour already at/above
    // 0.65 has little to gain from more of the same practice.
    const headroom = clamp01((0.65 - decayed.mastery) / 0.65);
    // Decay: retention below 1 means time has passed and the skill is fading.
    const decayedness = 1 - decayed.retentionEstimate;
    // Evidence gap: few observations -> more gain from one more; many -> less.
    const evidenceGap = clamp01(1 - decayed.observationCount / 6);
    // Uncertainty: high -> measuring is valuable; near-zero -> stop.
    const uncertainty = clamp01((decayed.masteryUncertainty - MIN_UNCERTAINTY) / (DEFAULT_UNCERTAINTY - MIN_UNCERTAINTY));

    const expectedGain = Number(
      (0.45 * headroom + 0.25 * decayedness + 0.15 * evidenceGap + 0.15 * uncertainty).toFixed(4),
    );
    return { behaviour: decayed.behaviour, state: decayed, expectedGain, reason: reasonFor(decayed, now) };
  });

  return ranked.sort((a, b) => b.expectedGain - a.expectedGain);
}

function reasonFor(state: UserBehaviourState, now: IsoInstant): string {
  const parts: string[] = [];
  const weak = state.mastery < 0.4;
  const fading = state.retentionEstimate < 0.6;
  if (weak) parts.push(`it is one of your weaker behaviours (${state.mastery.toFixed(2)})`);
  if (fading) parts.push(`and it is fading without practice (retention ${state.retentionEstimate.toFixed(2)})`);
  if (state.observationCount <= 2) parts.push(`you have only seen it ${state.observationCount === 1 ? "once" : "twice"} so far`);
  const days = state.lastObservedAt ? Math.round(daysBetween(state.lastObservedAt, now)) : null;
  if (days !== null && days > 14 && parts.length === 0) parts.push(`you have not practised it in ${days} days`);
  if (parts.length === 0) parts.push(`it has faded a little and is worth a refresh (${state.mastery.toFixed(2)})`);
  return `Next because ${parts.join(", ")}.`;
}