import { sessionMinutesFor } from "./assessment";
import { objectiveText, selectChallenge } from "./challenges";
import { lessonFor } from "./lessons";
import { nextDifficulty, selectDailyFocus, suggestedAssistLevel } from "./recommender";
import type { RecommendationInput } from "./recommender";
import { atDifficulty, selectScenario } from "./scenarios";
import { todayIso } from "./scheduling";
import { getSkill } from "./skills";
import type {
  Challenge,
  Id,
  IsoDate,
  Lesson,
  SessionStep,
  SimulationScenario,
  TrainingSession,
  UserSkillState,
} from "./types";

// ---------------------------------------------------------------------------
// The daily session.
//
// One skill, four optional steps: learn, practise, apply, reflect. The
// constraint that shapes everything is the time budget — five to fifteen
// minutes — because a training system that cannot be done on a bad day gets
// done on no days.
//
// Steps are dropped rather than shortened when the budget is tight, and they
// are dropped in a fixed order: the lesson goes first (reading is the least
// valuable minute), then the exercise. The simulation and the real-world
// challenge are the last things to go, because they are the only two steps
// that generate evidence about behaviour.
// ---------------------------------------------------------------------------

export interface SessionPlan {
  session: TrainingSession;
  lesson: Lesson | null;
  scenario: SimulationScenario | null;
  challenge: { challenge: Challenge; objectiveText: string; reason: string } | null;
  /** Suggestion density for this session's simulation. */
  assistLevel: "full" | "partial" | "minimal" | "none";
}

export interface BuildSessionInput extends RecommendationInput {
  userId: Id;
  date?: IsoDate;
  /** Scenario ids seen recently, so practice is not the same conversation twice. */
  recentScenarioIds: Id[];
  challengeHistory: Parameters<typeof selectChallenge>[2];
  /** Overrides the engine's choice when the user picks their own focus. */
  focusSkillId?: Id;
}

export function buildSession(input: BuildSessionInput): SessionPlan | null {
  const date = input.date ?? todayIso(new Date(input.now));
  const byId = new Map(input.states.map((state) => [state.skillId, state]));

  const chosen = input.focusSkillId
    ? { skillId: input.focusSkillId, reason: "You chose this focus.", suggested: "simulation" as const }
    : selectDailyFocus(input);
  if (!chosen) return null;

  const state = byId.get(chosen.skillId);
  const skill = getSkill(chosen.skillId);
  if (!state || !skill) return null;

  const budget = sessionMinutesFor(input.preference.intensity);
  const performances = input.recentEvidence.filter((e) => e.skillId === skill.id).map((e) => e.performance);
  const difficulty = nextDifficulty(state, performances);

  const lesson = lessonFor(skill.id);
  const baseScenario = selectScenario(skill.id, state, input.recentScenarioIds);
  const scenario = baseScenario ? atDifficulty(baseScenario, difficulty) : null;
  const challengeSelection = selectChallenge(skill.id, state, input.challengeHistory, input.preference.contexts);

  const steps: SessionStep[] = [];
  let spent = 0;

  // Learn — skipped once there is evidence the behaviour is already being
  // performed. Re-reading a lesson you are already acting on is the clearest
  // example of practice time being wasted.
  const needsLesson = state.attemptCount === 0 || state.mastery < 0.45 || chosen.suggested === "lesson";
  if (needsLesson && spent + lesson.estimatedMinutes <= budget) {
    steps.push({
      kind: "lesson",
      refId: lesson.id,
      estimatedMinutes: lesson.estimatedMinutes,
      reason: state.attemptCount === 0 ? "First time on this skill." : "A quick refresher on the principle.",
    });
    spent += lesson.estimatedMinutes;
  }

  // Practise — the core of the session.
  if (scenario) {
    const minutes = Math.min(8, Math.max(4, budget - spent - 2));
    if (minutes >= 3) {
      steps.push({
        kind: "simulation",
        refId: scenario.id,
        estimatedMinutes: minutes,
        reason: `Rehearsal at difficulty ${difficulty} of 5 — just above what you handled last time.`,
      });
      spent += minutes;
    }
  }

  // Apply — always offered, even when over budget, because it happens outside
  // the app and costs no session time. Optional, like every step.
  steps.push({
    kind: "challenge",
    refId: challengeSelection.challenge.id,
    estimatedMinutes: 0,
    reason: challengeSelection.reason,
  });

  steps.push({
    kind: "reflection",
    refId: `reflect.${date}`,
    estimatedMinutes: 1,
    reason: "Two taps and two optional lines. This is what the next session is built from.",
  });

  const session: TrainingSession = {
    id: `session.${input.userId}.${date}`,
    userId: input.userId,
    date,
    focusSkillId: skill.id,
    focusReason: chosen.reason,
    steps,
  };

  return {
    session,
    lesson: steps.some((step) => step.kind === "lesson") ? lesson : null,
    scenario,
    challenge: {
      challenge: challengeSelection.challenge,
      objectiveText: objectiveText(challengeSelection),
      reason: challengeSelection.reason,
    },
    assistLevel: input.preference.assistLevel === "none" ? "none" : suggestedAssistLevel(state),
  };
}

/** Total estimated minutes for a plan, shown up front so the ask is honest. */
export function estimatedMinutes(session: TrainingSession): number {
  return session.steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
}

export function markStepComplete(session: TrainingSession, kind: SessionStep["kind"], at: string): TrainingSession {
  let changed = false;
  const steps = session.steps.map((step) => {
    if (step.kind !== kind || step.completedAt) return step;
    changed = true;
    return { ...step, completedAt: at };
  });
  if (!changed) return session;
  const allDone = steps.filter((step) => step.kind !== "challenge").every((step) => step.completedAt);
  return {
    ...session,
    steps,
    startedAt: session.startedAt ?? at,
    completedAt: allDone ? at : session.completedAt,
  };
}

/**
 * The three questions the home screen has to answer, in order. Kept here rather
 * than in the component so they are testable and so the copy stays consistent
 * wherever a session is shown.
 */
export function homeSummary(plan: SessionPlan, state: UserSkillState | undefined): {
  practising: string;
  why: string;
  next: string;
} {
  const skill = getSkill(plan.session.focusSkillId);
  const first = plan.session.steps.find((step) => !step.completedAt);
  const nextLabel: Record<SessionStep["kind"], string> = {
    lesson: "Read the two-minute principle",
    exercise: "Do the short exercise",
    simulation: "Start the practice conversation",
    challenge: "Take the challenge into today",
    reflection: "Log how it went",
  };
  return {
    practising: skill?.name ?? "Today's skill",
    why: plan.session.focusReason,
    next: first ? nextLabel[first.kind] : state && state.mastery > 0.7 ? "Done for today — the challenge is still open" : "Done for today",
  };
}
