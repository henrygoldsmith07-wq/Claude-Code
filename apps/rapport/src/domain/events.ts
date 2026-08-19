import { applyEvidence, applyUserCorrection, initialSkillState } from "./mastery";
import type { Evidence } from "./mastery";
import { SKILLS } from "./skills";
import type { BehaviourKey, ChallengeOutcome, Id, IsoInstant, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// Event log.
//
// Skill states are a projection, not a source of truth. Everything that could
// move mastery is appended here first, and the states are folded from the log.
//
// The reason is concrete: the scoring model in evaluation.ts and mastery.ts
// will change. When it does, a stored-state design silently keeps months of
// numbers produced by the old model, and a user's history becomes an
// archaeological layer nobody can interpret. With a log, `recomputeStates`
// re-derives everything under the new model and the past stays consistent with
// the present.
// ---------------------------------------------------------------------------

export type DomainEvent =
  | {
      kind: "simulation-evaluated";
      at: IsoInstant;
      simulationId: Id;
      skillIds: Id[];
      /** 0-1 aggregate over reliable behaviours only. */
      performance: number;
      difficulty: number;
      reliability: number;
      behaviours: { key: BehaviourKey; score: number }[];
    }
  | {
      kind: "challenge-attempted";
      at: IsoInstant;
      attemptId: Id;
      skillId: Id;
      outcome: "yes" | "partly" | "no";
      difficulty: number;
      performance: number;
      reliability: number;
      comfort?: number;
    }
  | {
      kind: "challenge-skipped";
      at: IsoInstant;
      attemptId: Id;
      skillId: Id;
      /** Skips are signal about fit, never a failure — they do not move mastery. */
      reason?: string;
    }
  | {
      kind: "exercise-completed";
      at: IsoInstant;
      exerciseId: Id;
      skillId: Id;
      performance: number;
      difficulty: number;
    }
  | {
      kind: "lesson-read";
      at: IsoInstant;
      lessonId: Id;
      skillId: Id;
    }
  | {
      kind: "assessment-completed";
      at: IsoInstant;
      assessmentId: Id;
      /** Priors from onboarding, applied before any other evidence. */
      priors: { skillId: Id; mastery: number; confidence: number }[];
    }
  | {
      kind: "user-corrected-skill";
      at: IsoInstant;
      skillId: Id;
      mastery?: number;
      confidence?: number;
    }
  | {
      kind: "session-completed";
      at: IsoInstant;
      sessionId: Id;
      focusSkillId: Id;
    }
  | {
      kind: "human-rating-recorded";
      at: IsoInstant;
      ratingId: Id;
      itemId: Id;
      raterId: Id;
      behaviourKeys: BehaviourKey[];
      meanConfidence: number;
    }
  | {
      kind: "human-adjudication-completed";
      at: IsoInstant;
      adjudicationId: Id;
      disagreementId: Id;
      itemId: Id;
      behaviourKey: BehaviourKey;
      selectedDecision: "present" | "absent" | "uncertain";
      selectedScore: number;
    }
  | {
      kind: "real-world-outcome-recorded";
      at: IsoInstant;
      outcomeId: Id;
      studyId?: Id;
      challengeAttemptId?: Id;
      skillId: Id;
      outcome: ChallengeOutcome;
      completed: boolean;
      comfort?: number;
      followUpScore?: number;
    };

/** Events that carry evidence, in the order the mastery model should see them. */
function evidenceFrom(event: DomainEvent): Evidence[] {
  switch (event.kind) {
    case "simulation-evaluated":
      return event.skillIds.map((skillId) => ({
        skillId,
        performance: event.performance,
        difficulty: event.difficulty,
        kind: "simulation" as const,
        reliability: event.reliability,
        at: event.at,
      }));
    case "challenge-attempted":
      return [
        {
          skillId: event.skillId,
          performance: event.performance,
          difficulty: event.difficulty,
          kind: "challenge" as const,
          reliability: event.reliability,
          at: event.at,
          comfort: event.comfort,
        },
      ];
    case "exercise-completed":
      return [
        {
          skillId: event.skillId,
          performance: event.performance,
          difficulty: event.difficulty,
          kind: "exercise" as const,
          reliability: 0.6,
          at: event.at,
        },
      ];
    default:
      return [];
  }
}

/**
 * Fold the log into current skill states. Pure and total: given the same log it
 * always produces the same states, which is what makes the recompute safe to
 * run on every load.
 */
export function recomputeStates(userId: Id, events: DomainEvent[], now: IsoInstant): UserSkillState[] {
  const createdAt = events[0]?.at ?? now;
  const states = new Map<Id, UserSkillState>(
    SKILLS.map((skill) => [skill.id, initialSkillState(userId, skill.id, createdAt)]),
  );

  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at));

  for (const event of ordered) {
    if (event.kind === "assessment-completed") {
      for (const prior of event.priors) {
        const state = states.get(prior.skillId);
        if (!state) continue;
        states.set(prior.skillId, {
          ...state,
          mastery: prior.mastery,
          confidence: prior.confidence,
          masteryUncertainty: 0.28,
          confidenceUncertainty: 0.26,
          updatedAt: event.at,
        });
      }
      continue;
    }

    if (event.kind === "user-corrected-skill") {
      const state = states.get(event.skillId);
      if (!state) continue;
      states.set(
        event.skillId,
        applyUserCorrection(state, { mastery: event.mastery, confidence: event.confidence, at: event.at }),
      );
      continue;
    }

    for (const evidence of evidenceFrom(event)) {
      const state = states.get(evidence.skillId);
      if (!state) continue;
      states.set(evidence.skillId, applyEvidence(state, evidence));
    }
  }

  return [...states.values()];
}

/** Focus history for the recommender's variety and fatigue factors. */
export function focusHistoryFrom(events: DomainEvent[]): { skillId: Id; date: string }[] {
  return events
    .filter((event): event is Extract<DomainEvent, { kind: "session-completed" }> => event.kind === "session-completed")
    .map((event) => ({ skillId: event.focusSkillId, date: event.at.slice(0, 10) }));
}

/** Recent evidence, newest first, for the recommender's momentum factor. */
export function recentEvidence(events: DomainEvent[], limit = 40): { skillId: Id; performance: number; at: IsoInstant; kind: string }[] {
  const items: { skillId: Id; performance: number; at: IsoInstant; kind: string }[] = [];
  for (const event of events) {
    for (const evidence of evidenceFrom(event)) {
      items.push({ skillId: evidence.skillId, performance: evidence.performance, at: evidence.at, kind: evidence.kind });
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Events inside a window, used by the weekly review and analytics. */
export function eventsBetween(events: DomainEvent[], fromIso: IsoInstant, toIso: IsoInstant): DomainEvent[] {
  return events.filter((event) => event.at >= fromIso && event.at < toIso);
}

/**
 * Version stamp for the scoring model. Bumped whenever mastery.ts or
 * evaluation.ts change in a way that alters historical numbers; the store
 * compares it against the stamp on the cached projection and recomputes when
 * they differ, so upgrades do not need a migration.
 */
// 4: added the multi-party behaviours (inclusion, floorEntry). Existing skill
// states were produced by a model that could not score them, so the projection
// is recomputed rather than left to mix two scales in one history.
export const SCORING_MODEL_VERSION = 4;
