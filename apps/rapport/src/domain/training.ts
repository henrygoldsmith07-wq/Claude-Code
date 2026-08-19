import { nextDifficulty, suggestedAssistLevel } from "./recommender";
import { atDifficulty, scenariosForSkill } from "./scenarios";
import { getSkill, unmetPrerequisites } from "./skills";
import type {
  AssistLevel,
  BehaviourKey,
  ChallengeAttempt,
  Exercise,
  Id,
  IsoDate,
  IsoInstant,
  SimulationEvaluation,
  SimulationScenario,
  UserSkillState,
} from "./types";

// ---------------------------------------------------------------------------
// The training policy.
//
// The individual engines already know how to score a conversation, estimate a
// skill and schedule a challenge. This module is the connective tissue: it
// decides what the next training exposure should be and explains the decision
// in terms the user can act on. It is intentionally deterministic and local.
// ---------------------------------------------------------------------------

export interface AssistancePlan {
  level: AssistLevel;
  label: string;
  summary: string;
  next: string;
}

const ASSISTANCE_COPY: Record<AssistLevel, Omit<AssistancePlan, "level">> = {
  full: {
    label: "Full prompts",
    summary: "Prompts are visible while you build the first reliable attempts.",
    next: "After two attempts, prompts reduce automatically if the evidence supports it.",
  },
  partial: {
    label: "One prompt",
    summary: "You get one useful cue, then the rest of the conversation is yours.",
    next: "The cue disappears as this skill becomes more consistent.",
  },
  minimal: {
    label: "Light prompt",
    summary: "Only a small nudge remains, so you have to retrieve the behaviour yourself.",
    next: "A few more reliable attempts will remove the prompt entirely.",
  },
  none: {
    label: "No prompts",
    summary: "You are practising retrieval without scaffolding.",
    next: "Prompts return only if later evidence shows the difficulty is no longer well matched.",
  },
};

export function assistancePlan(state: UserSkillState, preference: AssistLevel = "full"): AssistancePlan {
  const level = preference === "none" ? "none" : suggestedAssistLevel(state);
  return { level, ...ASSISTANCE_COPY[level] };
}

export interface RecurringError {
  behaviour: BehaviourKey;
  count: number;
  evaluationIds: Id[];
  exercise: Exercise;
  message: string;
}

/**
 * Recycle only a weakness that has appeared in at least two reliable
 * evaluations. One low score is a prompt to look again, not a diagnosis.
 */
export function recurringErrorFor(
  evaluations: SimulationEvaluation[],
  skillId?: Id,
): RecurringError | null {
  const relevant = evaluations
    .filter((evaluation) => !skillId || evaluation.nextExercise.skillId === skillId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const byBehaviour = new Map<BehaviourKey, { ids: Id[]; exercise: Exercise }>();

  for (const evaluation of relevant) {
    const weak = evaluation.scores.find((score) => score.reliable && score.score < 0.55);
    if (!weak) continue;
    const current = byBehaviour.get(weak.key) ?? { ids: [], exercise: evaluation.nextExercise };
    if (!current.ids.includes(evaluation.id)) current.ids.push(evaluation.id);
    byBehaviour.set(weak.key, current);
  }

  const recurring = [...byBehaviour.entries()]
    .filter(([, value]) => value.ids.length >= 2)
    .sort(([, a], [, b]) => b.ids.length - a.ids.length)[0];
  if (!recurring) return null;

  const [behaviour, value] = recurring;
  return {
    behaviour,
    count: value.ids.length,
    evaluationIds: value.ids,
    exercise: value.exercise,
    message: `${labelForBehaviour(behaviour)} has been the clearest repeat signal. The next exercise recycles it in a new situation.`,
  };
}

export interface ScenarioTrainingPlan {
  scenario: SimulationScenario;
  difficulty: 1 | 2 | 3 | 4 | 5;
  selection: "personalised" | "error-recycle" | "maintenance" | "retest";
  reason: string;
}

export interface SelectTrainingScenarioInput {
  skillId: Id;
  state: UserSkillState;
  recentScenarioIds: Id[];
  recentPerformances: number[];
  evaluations: SimulationEvaluation[];
  now: IsoInstant;
}

/** Difficulty sits just above recent handling, then falls back after a run of failure. */
export function adaptiveScenarioDifficulty(state: UserSkillState, recentPerformances: number[]): 1 | 2 | 3 | 4 | 5 {
  return nextDifficulty(state, recentPerformances);
}

/**
 * Choose a new situation where possible. A repeated scenario is allowed only
 * when the library has no fresh option for the skill, so variety is a control
 * rather than a promise that can strand someone without practice.
 */
export function selectTrainingScenario(input: SelectTrainingScenarioInput): ScenarioTrainingPlan | null {
  const candidates = scenariosForSkill(input.skillId);
  if (candidates.length === 0) return null;

  const recent = new Set(input.recentScenarioIds);
  const fresh = candidates.filter((scenario) => !recent.has(scenario.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  const recurring = recurringErrorFor(input.evaluations, input.skillId);
  const maintenance = input.state.attemptCount >= 2 && input.state.retentionEstimate < 0.65;
  const difficulty = maintenance
    ? (Math.min(5, Math.max(1, Math.round(input.state.difficultyTolerance))) as 1 | 2 | 3 | 4 | 5)
    : adaptiveScenarioDifficulty(input.state, input.recentPerformances);
  const retest = delayedRetestFor(input.skillId, input.evaluations, input.now)?.due ?? false;

  const selected = [...pool].sort((a, b) => {
    const aError = recurring && a.evaluationCriteria.includes(recurring.behaviour) ? 1 : 0;
    const bError = recurring && b.evaluationCriteria.includes(recurring.behaviour) ? 1 : 0;
    if (aError !== bError) return bError - aError;
    return Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty);
  })[0];
  if (!selected) return null;

  const selection = recurring ? "error-recycle" : retest ? "retest" : maintenance ? "maintenance" : "personalised";
  const reason = recurring
    ? `New situation for the recurring ${labelForBehaviour(recurring.behaviour).toLowerCase()} error.`
    : retest
      ? "Delayed retest: retrieve the skill after a gap rather than repeating it immediately."
      : maintenance
        ? `Maintenance practice: retention is around ${Math.round(input.state.retentionEstimate * 100)}%.`
        : fresh.length > 0
          ? "Chosen for your skill, current level and a situation you have not just seen."
          : "The best-matched situation is being revisited because this skill has no fresh scenario left.";

  return {
    scenario: atDifficulty(selected, difficulty),
    difficulty,
    selection,
    reason,
  };
}

export interface PrerequisiteRoute {
  targetSkillId: Id;
  requiredSkillId: Id;
  requiredSkillName: string;
  rationale: string;
}

export function prerequisiteRoute(skillId: Id, masteryOf: (skillId: Id) => number): PrerequisiteRoute | null {
  const [first] = unmetPrerequisites(skillId, masteryOf);
  if (!first) return null;
  return {
    targetSkillId: skillId,
    requiredSkillId: first.requires,
    requiredSkillName: getSkill(first.requires)?.name ?? first.requires,
    rationale: first.rationale,
  };
}

export interface MaintenancePlan {
  due: boolean;
  retention: number;
  message: string;
}

export function maintenancePlan(state: UserSkillState): MaintenancePlan {
  const retention = Math.round(state.retentionEstimate * 100);
  const due = state.attemptCount >= 2 && state.retentionEstimate < 0.65;
  return {
    due,
    retention,
    message: due
      ? `This skill is worth maintaining now; current retention is estimated at ${retention}%.`
      : "Maintenance is not due yet — spacing is protecting the skill.",
  };
}

export interface RetestPlan {
  skillId: Id;
  dueAt: IsoInstant;
  due: boolean;
  message: string;
}

/** A good result earns a later retrieval check, not another immediate drill. */
export function delayedRetestFor(
  skillId: Id,
  evaluations: SimulationEvaluation[],
  now: IsoInstant,
): RetestPlan | null {
  const latest = evaluations
    .filter((evaluation) => evaluation.nextExercise.skillId === skillId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  const reliable = latest.scores.filter((score) => score.reliable);
  if (reliable.length === 0) return null;
  const mean = reliable.reduce((sum, score) => sum + score.score, 0) / reliable.length;
  if (mean < 0.7) return null;

  const dueAt = addDays(latest.createdAt, mean >= 0.82 ? 7 : 3);
  return {
    skillId,
    dueAt,
    due: now >= dueAt,
    message: now >= dueAt
      ? "A delayed retest is due — check whether the skill survives without immediate feedback."
      : `Retest scheduled for ${formatDate(dueAt)} so the gap itself is part of the training.`,
  };
}

export interface OverpracticeStatus {
  isOverpractised: boolean;
  count: number;
  message: string;
}

export function overpracticeStatus(
  skillId: Id,
  focusHistory: { skillId: Id; date: IsoDate }[],
  now: IsoInstant,
): OverpracticeStatus {
  const today = now.slice(0, 10);
  const start = shiftDate(today, -6);
  const count = focusHistory.filter((item) => item.skillId === skillId && item.date >= start && item.date <= today).length;
  const isOverpractised = count >= 3;
  return {
    isOverpractised,
    count,
    message: isOverpractised
      ? `${count} focus sessions in the last 7 days — the plan will favour maintenance or another skill.`
      : "Practice volume is still varied enough to be useful.",
  };
}

export interface TrainingGuidance {
  skillId: Id;
  assistance: AssistancePlan;
  scenario: ScenarioTrainingPlan | null;
  recurringError: RecurringError | null;
  prerequisite: PrerequisiteRoute | null;
  maintenance: MaintenancePlan;
  retest: RetestPlan | null;
  overpractice: OverpracticeStatus;
}

export interface TrainingGuidanceInput {
  skillId: Id;
  states: UserSkillState[];
  recentScenarioIds: Id[];
  recentPerformances: number[];
  evaluations: SimulationEvaluation[];
  focusHistory: { skillId: Id; date: IsoDate }[];
  now: IsoInstant;
  preferenceAssistLevel?: AssistLevel;
}

export function buildTrainingGuidance(input: TrainingGuidanceInput): TrainingGuidance | null {
  const state = input.states.find((item) => item.skillId === input.skillId);
  if (!state) return null;
  const masteryOf = (skillId: Id) => input.states.find((item) => item.skillId === skillId)?.mastery ?? 0;
  return {
    skillId: input.skillId,
    assistance: assistancePlan(state, input.preferenceAssistLevel),
    scenario: selectTrainingScenario({
      skillId: input.skillId,
      state,
      recentScenarioIds: input.recentScenarioIds,
      recentPerformances: input.recentPerformances,
      evaluations: input.evaluations,
      now: input.now,
    }),
    recurringError: recurringErrorFor(input.evaluations, input.skillId),
    prerequisite: prerequisiteRoute(input.skillId, masteryOf),
    maintenance: maintenancePlan(state),
    retest: delayedRetestFor(input.skillId, input.evaluations, input.now),
    overpractice: overpracticeStatus(input.skillId, input.focusHistory, input.now),
  };
}

export interface ChallengeReminder {
  due: boolean;
  label: string;
  detail: string;
}

export function challengeReminder(attempt: ChallengeAttempt, now: IsoInstant): ChallengeReminder {
  if (attempt.postponedUntil && attempt.postponedUntil > now.slice(0, 10)) {
    return {
      due: false,
      label: `Reminder set for ${formatDate(`${attempt.postponedUntil}T09:00:00.000Z`)}`,
      detail: "This is postponed, not failed. Bring it back when the situation is available.",
    };
  }
  return {
    due: true,
    label: "Real-world challenge ready",
    detail: attempt.reminderAt && attempt.reminderAt > now ? `Reminder set for ${formatDate(attempt.reminderAt)}.` : "Try it when a natural opportunity appears.",
  };
}

function addDays(instant: IsoInstant, days: number): IsoInstant {
  const date = new Date(instant);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function shiftDate(date: IsoDate, days: number): IsoDate {
  return addDays(`${date}T00:00:00.000Z`, days).slice(0, 10);
}

function formatDate(instant: IsoInstant): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(instant));
}

function labelForBehaviour(behaviour: BehaviourKey): string {
  const labels: Record<BehaviourKey, string> = {
    relevance: "staying with what they said",
    listening: "showing you listened",
    followUpQuality: "follow-up questions",
    reciprocity: "give and take",
    clarity: "clarity",
    assertiveness: "stating your position",
    empathy: "acknowledging how they felt",
    topicTransitions: "signposted topic changes",
    questionQuality: "question quality",
    contribution: "contribution",
    inclusion: "including others",
    floorEntry: "entering the floor",
  };
  return labels[behaviour];
}
