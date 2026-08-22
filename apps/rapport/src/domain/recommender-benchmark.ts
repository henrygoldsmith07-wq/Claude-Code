// ---------------------------------------------------------------------------
// Recommender benchmark: ablation + baseline comparison.
//
// Two questions this answers, both offline and deterministic:
//
//  1. Which factor actually moves the recommendation? Removing a factor that
//     changes nothing is a candidate for deletion; removing one that flips the
//     top pick constantly is evidence it is doing work.
//  2. Is the adaptive engine better than the trivial baselines? Random,
//     round-robin (the "user just picks a skill" proxy) and weakest-skill (the
//     classic naive design) are run over the same synthetic profiles and
//     compared on the metrics the product actually cares about: does the top
//     pick surface the skill that genuinely needs work, and does it avoid
//     grinding the same skill every day.
//
// Every profile plants a ground truth: one skill that a good coach would
// choose (weak, in the user's goals, and overdue — not practised for weeks)
// and one trap skill (equally weak but practised yesterday, so a naive engine
// grinds it). The adaptive engine has the spacing/fatigue/variety signals to
// tell them apart; the baselines do not.
// ---------------------------------------------------------------------------

import { recommend } from "./recommender";
import type { Goal, Id, IsoDate, IsoInstant, Preference, RecommendationFactor, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// Synthetic profiles
// ---------------------------------------------------------------------------

/** Skills drawn from the real graph so the engine's skill lookups all resolve. */
export const PROFILE_SKILLS: Id[] = [
  "conv.start",
  "conv.follow-up",
  "conv.active-listening",
  "conv.balance",
  "conf.initiative",
  "conf.opinions",
  "conf.nervousness",
  "nv.eye-contact",
];

export interface Profile {
  states: UserSkillState[];
  goals: Goal[];
  focusHistory: { skillId: Id; date: IsoDate }[];
  recentEvidence: { skillId: Id; performance: number; at: IsoInstant; kind: string }[];
  now: IsoInstant;
  /** The skill a good coach would pick today. */
  targetSkillId: Id;
  /** The trap: equally weak but just practised — a naive engine grinds it. */
  trapSkillId: Id;
}

function state(skillId: Id, mastery: number, confidence: number, attemptCount: number, lastPractisedAt: IsoInstant | undefined, updatedAt: IsoInstant): UserSkillState {
  return {
    userId: "bench-user",
    skillId,
    mastery,
    masteryUncertainty: 0.12,
    confidence,
    confidenceUncertainty: 0.12,
    attemptCount,
    successEvidence: attemptCount > 0 ? 1 : 0,
    difficultyTolerance: 3,
    lastPractisedAt,
    retentionEstimate: lastPractisedAt ? 0.4 : 0.5,
    updatedAt,
  };
}

const PREFERENCE: Preference = {
  userId: "bench-user",
  intensity: "steady",
  sessionMinutes: 20,
  contexts: ["work", "social"],
  syncEnabled: false,
  aiMayReadReflections: false,
  allowModelTraining: false,
  retentionDays: 0,
  transcriptRetentionDays: 0,
  theme: "system",
  reducedMotion: false,
  voiceEnabled: false,
  assistLevel: "partial",
  updatedAt: "2026-06-01T09:00:00.000Z",
};

const NOW = "2026-06-30T09:00:00.000Z";
const YESTERDAY = "2026-06-29T09:00:00.000Z";
const THIRTY_FIVE_DAYS_AGO = "2026-05-26T09:00:00.000Z";

/**
 * Build a profile: target is weak + in-goal + not practised for 35 days;
 * trap is equally weak + in-goal but practised yesterday (fatigue signal);
 * the remaining skills are healthy. A fraction of profiles vary the target
 * skill so the benchmark is not one layout.
 */
export type ProfileVariant = "overdue" | "fatigued";

const SIX_DAYS_AGO = "2026-06-24T09:00:00.000Z";
const TEN_DAYS_AGO = "2026-06-20T09:00:00.000Z";

/**
 * Two profile flavours so both brake factors get exercised:
 *
 *  - "overdue": the target has not been practised for 35 days (spacing is the
 *    signal that separates it from the trap).
 *  - "fatigued": the target is only mildly due, but the trap has been focused
 *    four times this week (fatigue is the signal).
 *
 * In both, target and trap are equally weak; the baselines cannot tell them
 * apart, the adaptive engine can.
 */
export function makeProfile(seed: number, variant: ProfileVariant = seed % 2 === 0 ? "overdue" : "fatigued"): Profile {
  const targetIdx = seed % PROFILE_SKILLS.length;
  const trapIdx = (seed * 3 + 1) % PROFILE_SKILLS.length;
  const targetSkillId = PROFILE_SKILLS[targetIdx]!;
  const trapSkillId =
    PROFILE_SKILLS[trapIdx] === targetSkillId ? PROFILE_SKILLS[(trapIdx + 1) % PROFILE_SKILLS.length]! : PROFILE_SKILLS[trapIdx]!;

  const targetLastPractised = variant === "overdue" ? THIRTY_FIVE_DAYS_AGO : TEN_DAYS_AGO;
  const trapFocuses = variant === "overdue" ? 2 : 4;
  const trapMomentum = variant === "overdue" ? 0.5 : 0.9;

  const states = PROFILE_SKILLS.map((skillId) => {
    if (skillId === targetSkillId) return state(skillId, 0.28, 0.3, 3, targetLastPractised, targetLastPractised);
    if (skillId === trapSkillId) return state(skillId, 0.28, 0.32, 6, YESTERDAY, YESTERDAY);
    const healthy = 0.68 + ((seed + skillId.length) % 3) * 0.1; // 0.68 / 0.78 / 0.88
    return state(skillId, Math.min(0.95, healthy), healthy - 0.05, 12, "2026-06-20T09:00:00.000Z", "2026-06-20T09:00:00.000Z");
  });

  const goalSkills = [targetSkillId, trapSkillId, PROFILE_SKILLS[(seed + 5) % PROFILE_SKILLS.length]!];
  const goals: Goal[] = [
    {
      id: "goal.1",
      userId: "bench-user",
      statement: "Benchmark goal",
      skillIds: goalSkills,
      contexts: ["work"],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  const focusHistory =
    trapFocuses === 4
      ? [
          { skillId: trapSkillId, date: SIX_DAYS_AGO.slice(0, 10) },
          { skillId: trapSkillId, date: "2026-06-26" },
          { skillId: trapSkillId, date: "2026-06-28" },
          { skillId: trapSkillId, date: YESTERDAY.slice(0, 10) },
        ]
      : [
          { skillId: trapSkillId, date: SIX_DAYS_AGO.slice(0, 10) },
          { skillId: trapSkillId, date: YESTERDAY.slice(0, 10) },
        ];

  return {
    states,
    goals,
    focusHistory,
    recentEvidence: [{ skillId: trapSkillId, performance: trapMomentum, at: YESTERDAY, kind: "simulation" }],
    now: NOW,
    targetSkillId,
    trapSkillId,
  };
}

export function recommendationInput(profile: Profile) {
  return { ...profile, preference: PREFERENCE };
}

// ---------------------------------------------------------------------------
// Baselines
// ---------------------------------------------------------------------------

export type StrategyId = "adaptive" | "random" | "round-robin" | "weakest-skill";

/** Deterministic seeded RNG (LCG) so random baselines are reproducible. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export interface StrategyResult {
  top1: Id;
  /** 1-based rank of the target skill in the full ranked list. */
  targetRank: number;
  /** The target was the top pick. */
  hit: boolean;
  /** The top pick is the skill focused yesterday (grinding). */
  repeatsFocus: boolean;
}

export function runStrategy(profile: Profile, strategy: StrategyId, seed: number): StrategyResult {
  const { states, targetSkillId, focusHistory } = profile;
  const ranked = (): Id[] => {
    switch (strategy) {
      case "adaptive":
        return recommend(recommendationInput(profile), states.length).map((r) => r.skillId);
      case "random": {
        const rng = seededRng(seed);
        return [...states.map((s) => s.skillId)].sort(() => rng() - 0.5);
      }
      case "round-robin": {
        // User-choice proxy: the user cycles through their skills from a
        // seeded starting point, paying no attention to state.
        const start = Math.floor(seededRng(seed)() * states.length);
        return [...states.map((s) => s.skillId).slice(start), ...states.map((s) => s.skillId).slice(0, start)];
      }
      case "weakest-skill": {
        // The classic naive design: always practise the weakest skill.
        return [...states]
          .sort((a, b) => a.mastery - b.mastery || a.skillId.localeCompare(b.skillId))
          .map((s) => s.skillId);
      }
    }
  };
  const order = ranked();
  const top1 = order[0]!;
  return {
    top1,
    targetRank: order.indexOf(targetSkillId) + 1,
    hit: top1 === targetSkillId,
    repeatsFocus: top1 === focusHistory[0]?.skillId,
  };
}

export interface BaselineComparison {
  strategy: StrategyId;
  profiles: number;
  top1TargetRate: number;
  meanTargetRank: number;
  repetitionRate: number;
}

export function compareBaselines(profiles: Profile[], seeds: number[]): BaselineComparison[] {
  const strategies: StrategyId[] = ["adaptive", "random", "round-robin", "weakest-skill"];
  return strategies.map((strategy) => {
    const results = profiles.map((profile, i) => runStrategy(profile, strategy, seeds[i] ?? i * 7 + 1));
    return {
      strategy,
      profiles: results.length,
      top1TargetRate: results.filter((r) => r.hit).length / results.length,
      meanTargetRank: results.reduce((a, r) => a + r.targetRank, 0) / results.length,
      repetitionRate: results.filter((r) => r.repeatsFocus).length / results.length,
    };
  });
}

// ---------------------------------------------------------------------------
// Ablation
// ---------------------------------------------------------------------------

export interface AblationRow {
  factor: RecommendationFactor;
  /** Fraction of profiles where the top pick changed when this factor was removed. */
  top1FlipRate: number;
  /** Mean absolute change in the target skill's rank. */
  meanTargetRankDelta: number;
  /** Mean absolute change in the trap skill's rank (how much this factor suppresses it). */
  meanTrapRankDelta: number;
}

const FACTORS: RecommendationFactor[] = [
  "goalAlignment",
  "weakness",
  "prerequisite",
  "spacing",
  "confidenceGap",
  "variety",
  "challengeFit",
  "recentProgress",
  "contextRelevance",
  "fatigue",
];

export function ablateRecommender(profiles: Profile[]): AblationRow[] {
  return FACTORS.map((factor) => {
    let flips = 0;
    let targetDelta = 0;
    let trapDelta = 0;
    for (const profile of profiles) {
      const input = recommendationInput(profile);
      const full = recommend(input, profile.states.length).map((r) => r.skillId);
      const ablated = recommend(input, profile.states.length, { [factor]: 0 }).map((r) => r.skillId);
      if (full[0] !== ablated[0]) flips++;
      targetDelta += Math.abs(full.indexOf(profile.targetSkillId) - ablated.indexOf(profile.targetSkillId));
      trapDelta += Math.abs(full.indexOf(profile.trapSkillId) - ablated.indexOf(profile.trapSkillId));
    }
    return {
      factor,
      top1FlipRate: flips / profiles.length,
      meanTargetRankDelta: targetDelta / profiles.length,
      meanTrapRankDelta: trapDelta / profiles.length,
    };
  });
}
