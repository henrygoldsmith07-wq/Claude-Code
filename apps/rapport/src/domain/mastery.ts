import { prerequisitesOf, requireSkill } from "./skills";
import type { Id, IsoInstant, SkillState, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// The mastery model.
//
// Not XP. XP only goes up, which makes it useless for deciding what to practise
// — the number a training system needs is "how likely is this person to perform
// the behaviour right now", and that decays.
//
// Each skill carries a belief: a point estimate plus an uncertainty. Evidence
// moves the estimate by an amount proportional to how uncertain the app
// currently is (a Kalman-style update), so early evidence moves things a long
// way and later evidence refines. Uncertainty shrinks with evidence and grows
// with time, which is what stops the app asserting "strong" about a skill it
// last saw four months ago.
//
// Real-world evidence outweighs simulation evidence. A simulation is a
// rehearsal; the claim the product actually makes is about life outside it.
// ---------------------------------------------------------------------------

export const STATE_THRESHOLDS: { state: SkillState; min: number }[] = [
  { state: "advanced", min: 0.85 },
  { state: "strong", min: 0.65 },
  { state: "functional", min: 0.4 },
  { state: "developing", min: 0 },
];

/** Band a mastery value. Bands are presentational — the engine always uses the number. */
export function stateFor(mastery: number): SkillState {
  for (const band of STATE_THRESHOLDS) {
    if (mastery >= band.min) return band.state;
  }
  return "developing";
}

/**
 * A band is only asserted when the app is reasonably sure. With wide
 * uncertainty the UI says "still working this out" rather than picking a label
 * the user will read as a verdict.
 */
export function stateIsConfident(state: UserSkillState): boolean {
  return state.masteryUncertainty <= 0.18;
}

export interface Evidence {
  skillId: Id;
  /** 0-1 how well the behaviour was performed on this occasion. */
  performance: number;
  /** 1-5 how demanding the occasion was. Success at 5 counts for far more than at 1. */
  difficulty: number;
  /** Where the evidence came from. */
  kind: "simulation" | "challenge" | "exercise" | "self-report";
  /** 0-1 how much to trust this observation at all (short transcripts are weak evidence). */
  reliability: number;
  at: IsoInstant;
  /** Optional self-reported comfort on this occasion, 0-1. Updates confidence only. */
  comfort?: number;
}

/** Real-world attempts are the point of the product, so they carry the most weight. */
const KIND_WEIGHT: Record<Evidence["kind"], number> = {
  challenge: 1,
  simulation: 0.6,
  exercise: 0.35,
  "self-report": 0.3,
};

export const DEFAULT_UNCERTAINTY = 0.3;
/** Uncertainty never collapses to zero: people change, and the model should stay corrigible. */
const MIN_UNCERTAINTY = 0.06;
/** Days over which an unpractised skill's uncertainty returns to roughly its starting width. */
const UNCERTAINTY_REGROWTH_DAYS = 90;
/** Half-life of retention for a skill practised once, in days. Scales up with evidence. */
const BASE_RETENTION_HALF_LIFE_DAYS = 12;

export function initialSkillState(userId: Id, skillId: Id, at: IsoInstant): UserSkillState {
  const skill = requireSkill(skillId);
  // Prior: harder skills start lower. This is a starting guess, not an assessment.
  const prior = 0.5 - (skill.baseDifficulty - 3) * 0.08;
  return {
    userId,
    skillId,
    mastery: clamp01(prior),
    masteryUncertainty: DEFAULT_UNCERTAINTY,
    confidence: clamp01(prior),
    confidenceUncertainty: DEFAULT_UNCERTAINTY,
    attemptCount: 0,
    successEvidence: 0,
    difficultyTolerance: 2,
    retentionEstimate: 0.5,
    updatedAt: at,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function daysBetween(from: IsoInstant, to: IsoInstant): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, ms / 86_400_000);
}

/**
 * Difficulty-adjusted target. Performing well at difficulty 5 implies higher
 * mastery than the same performance at difficulty 1; performing badly at 1
 * implies lower mastery than the same performance at 5.
 */
function evidenceTarget(performance: number, difficulty: number): number {
  const d = Math.min(5, Math.max(1, difficulty));
  // Maps difficulty 1..5 onto a ceiling of 0.55..1 and a floor of 0..0.45.
  const ceiling = 0.45 + d * 0.11;
  const floor = (d - 1) * 0.1125;
  return clamp01(floor + performance * (ceiling - floor));
}

/**
 * Apply one observation. Returns a new state; the caller decides whether to
 * persist it, which keeps recomputation from the event log pure.
 */
export function applyEvidence(state: UserSkillState, evidence: Evidence): UserSkillState {
  const weight = KIND_WEIGHT[evidence.kind] * clamp01(evidence.reliability);
  if (weight <= 0) return state;

  const decayed = decay(state, evidence.at);
  const target = evidenceTarget(clamp01(evidence.performance), evidence.difficulty);

  // Kalman-style gain: uncertainty relative to observation noise. Confident
  // states move slowly; a fresh profile moves fast.
  const observationNoise = 0.35 / weight;
  const variance = decayed.masteryUncertainty ** 2;
  const gain = variance / (variance + observationNoise ** 2);

  const mastery = clamp01(decayed.mastery + gain * (target - decayed.mastery));
  const masteryUncertainty = Math.max(MIN_UNCERTAINTY, Math.sqrt(variance * (1 - gain)));

  // Confidence tracks self-reported comfort where given, and otherwise drifts
  // towards performance more slowly than mastery does — feeling comfortable
  // lags being competent, and the product is honest about the gap.
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

  const succeeded = evidence.performance >= 0.6;
  const successEvidence =
    decayed.successEvidence + (succeeded ? (evidence.kind === "challenge" ? 2 : 1) * clamp01(evidence.reliability) : 0);

  // Difficulty tolerance ratchets up on success and eases down after a clear
  // failure, so the recommender stops proposing a level that is not working.
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
    attemptCount: decayed.attemptCount + 1,
    successEvidence,
    difficultyTolerance,
    lastPractisedAt: evidence.at,
    retentionEstimate: 1,
    updatedAt: evidence.at,
  };
}

/**
 * Age a state to `now`: retention falls, uncertainty widens. Mastery itself is
 * left alone — the estimate of what someone *can* do is not what decays; the
 * estimate of whether they would do it *today* is.
 */
export function decay(state: UserSkillState, now: IsoInstant): UserSkillState {
  if (!state.lastPractisedAt) return { ...state, retentionEstimate: state.retentionEstimate };
  const days = daysBetween(state.lastPractisedAt, now);
  if (days <= 0) return state;

  const halfLife = retentionHalfLifeDays(state);
  const retentionEstimate = clamp01(Math.pow(0.5, days / halfLife));
  const regrowth = Math.min(1, days / UNCERTAINTY_REGROWTH_DAYS);
  const masteryUncertainty = Math.min(
    DEFAULT_UNCERTAINTY,
    state.masteryUncertainty + regrowth * (DEFAULT_UNCERTAINTY - state.masteryUncertainty),
  );
  const confidenceUncertainty = Math.min(
    DEFAULT_UNCERTAINTY,
    state.confidenceUncertainty + regrowth * (DEFAULT_UNCERTAINTY - state.confidenceUncertainty),
  );
  return { ...state, retentionEstimate, masteryUncertainty, confidenceUncertainty };
}

/**
 * How long a skill stays fresh. Grows with corroborated evidence and with
 * mastery — a well-practised behaviour survives a gap that a new one does not.
 */
export function retentionHalfLifeDays(state: UserSkillState): number {
  const evidenceBoost = 1 + Math.min(3, state.successEvidence * 0.35);
  const masteryBoost = 0.6 + state.mastery * 1.6;
  return BASE_RETENTION_HALF_LIFE_DAYS * evidenceBoost * masteryBoost;
}

/**
 * Positive when someone is more confident than competent (over-reach risk),
 * negative when they are better than they feel (the more common case, and one
 * worth telling the user about).
 */
export function confidenceGap(state: UserSkillState): number {
  return state.confidence - state.mastery;
}

/**
 * A user correcting the app is authoritative. The override is recorded so the
 * engine does not immediately argue back, but it still carries uncertainty:
 * self-assessment is evidence, not measurement.
 */
export function applyUserCorrection(
  state: UserSkillState,
  input: { mastery?: number; confidence?: number; at: IsoInstant },
): UserSkillState {
  return {
    ...state,
    mastery: input.mastery !== undefined ? clamp01(input.mastery) : state.mastery,
    masteryUncertainty: input.mastery !== undefined ? 0.2 : state.masteryUncertainty,
    confidence: input.confidence !== undefined ? clamp01(input.confidence) : state.confidence,
    confidenceUncertainty: input.confidence !== undefined ? 0.15 : state.confidenceUncertainty,
    userAssertedAt: input.at,
    updatedAt: input.at,
  };
}

/** Within this window the recommender defers to the user's own assessment. */
export function correctionIsFresh(state: UserSkillState, now: IsoInstant): boolean {
  if (!state.userAssertedAt) return false;
  return daysBetween(state.userAssertedAt, now) < 14;
}

/**
 * Mastery discounted by unmet prerequisites. Someone can look competent at
 * "conflict resolution" in a friendly simulation while lacking the disagreement
 * skill underneath it; this keeps the displayed estimate honest.
 */
export function effectiveMastery(skillId: Id, masteryOf: (id: Id) => number): number {
  const own = masteryOf(skillId);
  const reqs = prerequisitesOf(skillId);
  if (reqs.length === 0) return own;
  const worstShortfall = Math.max(
    0,
    ...reqs.map((dep) => Math.max(0, dep.minMastery - masteryOf(dep.requires)) / Math.max(dep.minMastery, 0.01)),
  );
  return clamp01(own * (1 - 0.35 * worstShortfall));
}

/** Human-readable, hedged when uncertain. Used everywhere a state is displayed. */
export function describeState(state: UserSkillState): string {
  const band = stateFor(state.mastery);
  if (!stateIsConfident(state)) return `${band} (still estimating)`;
  return band;
}
