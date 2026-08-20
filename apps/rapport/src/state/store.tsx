"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { buildInitialProfile, sessionMinutesFor } from "@/domain/assessment";
import type { AssessmentResult } from "@/domain/assessment";
import { behaviourForSkill } from "@/domain/behaviours";
import { generateInsights } from "@/domain/analytics";
import { selectChallenge } from "@/domain/challenges";
import { evaluateSimulation, performanceFrom } from "@/domain/evaluation";
import { focusHistoryFrom, recentEvidence, recomputeStates } from "@/domain/events";
import type { DomainEvent } from "@/domain/events";
import { buildContext, newlyUnlocked } from "@/domain/gamification";
import { applyUserCorrection } from "@/domain/mastery";
import { extractSignals, performanceFromReflection, screenReflection } from "@/domain/reflection";
import { todayIso } from "@/domain/scheduling";
import { buildSession, markStepComplete } from "@/domain/session";
import type { SessionPlan } from "@/domain/session";
import { buildWeeklyReview, weekStartFor } from "@/domain/weekly-review";
import type {
  Achievement,
  Assessment,
  ChallengeAttempt,
  Experiment,
  ExperimentObservation,
  Exercise,
  Goal,
  Id,
  Insight,
  Preference,
  Reflection,
  Simulation,
  SimulationEvaluation,
  TrainingSession,
  User,
  UserSkillState,
  WeeklyReview,
} from "@/domain/types";
import * as repo from "@/data/repository";
import { LOCAL_USER_ID } from "@/data/repository";
import { useNow } from "@/state/clock";
import { publishRapportPulseHistory } from "@/data/pulse-history";

// ---------------------------------------------------------------------------
// One store for the whole app.
//
// The data is small — a few thousand rows at the outside — so it is held in
// memory and every derived value (skill states, today's plan, insights) is
// recomputed from the event log on change. That keeps the numbers consistent by
// construction rather than by cache invalidation, which matters here because
// mastery, the recommender and the weekly review all have to agree.
//
// Writes go to IndexedDB first and the UI never awaits the network.
// ---------------------------------------------------------------------------

interface StoreValue {
  ready: boolean;
  needsOnboarding: boolean;
  user: User | null;
  preference: Preference;
  states: UserSkillState[];
  goals: Goal[];
  events: DomainEvent[];
  attempts: ChallengeAttempt[];
  reflections: Reflection[];
  simulations: Simulation[];
  evaluations: SimulationEvaluation[];
  sessions: TrainingSession[];
  insights: Insight[];
  experiments: Experiment[];
  observations: ExperimentObservation[];
  achievements: Achievement[];
  reviews: WeeklyReview[];
  todayPlan: SessionPlan | null;
  /** Achievements unlocked during this session, for the one-time toast. */
  justUnlocked: Achievement[];
  dismissUnlocked(): void;

  completeOnboarding(assessment: Assessment, statement: string): Promise<void>;
  recordEvidenceEvent(event: DomainEvent): Promise<void>;
  setFocus(skillId: Id): Promise<void>;
  recordLessonRead(skillId: Id, lessonId: Id): Promise<void>;
  recordExercise(exercise: Exercise, performance: number): Promise<void>;
  saveSimulation(simulation: Simulation): Promise<SimulationEvaluation | null>;
  assignChallenge(skillId: Id): Promise<ChallengeAttempt>;
  completeChallenge(attemptId: Id, reflection: Omit<Reflection, "id" | "userId" | "createdAt" | "subject">): Promise<{ warning?: string }>;
  skipChallenge(attemptId: Id, reason?: string): Promise<void>;
  swapChallenge(attemptId: Id): Promise<ChallengeAttempt | null>;
  postponeChallenge(attemptId: Id, days?: number): Promise<void>;
  correctSkill(skillId: Id, values: { mastery?: number; confidence?: number }): Promise<void>;
  updatePreference(patch: Partial<Preference>): Promise<void>;
  startExperiment(experiment: Experiment): Promise<void>;
  recordObservation(observation: ExperimentObservation): Promise<void>;
  endExperiment(experimentId: Id): Promise<void>;
  dismissInsight(insightId: Id): Promise<void>;
  exportData(): Promise<string>;
  wipeData(): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

const EMPTY_PREFERENCE: Preference = {
  ...repo.DEFAULT_PREFERENCE,
  userId: LOCAL_USER_ID,
  updatedAt: new Date().toISOString(),
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [preference, setPreference] = useState<Preference>(EMPTY_PREFERENCE);
  const [states, setStates] = useState<UserSkillState[]>([]);
  const [events, setEvents] = useState<DomainEvent[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [attempts, setAttempts] = useState<ChallengeAttempt[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [evaluations, setEvaluations] = useState<SimulationEvaluation[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [dismissedInsightIds, setDismissedInsightIds] = useState<string[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [observations, setObservations] = useState<ExperimentObservation[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [justUnlocked, setJustUnlocked] = useState<Achievement[]>([]);
  const [focusOverride, setFocusOverride] = useState<Id | null>(null);

  const load = useCallback(async () => {
    const now = new Date().toISOString();
    const [
      loadedUser,
      loadedPreference,
      loadedStates,
      loadedEvents,
      loadedGoals,
      loadedAttempts,
      loadedReflections,
      loadedSimulations,
      loadedEvaluations,
      loadedSessions,
      loadedDismissed,
      loadedExperiments,
      loadedObservations,
      loadedAchievements,
    ] = await Promise.all([
      repo.getUser(),
      repo.getPreference(),
      repo.getSkillStates(now),
      repo.allEvents(),
      repo.all("goals"),
      repo.all("attempts"),
      repo.all("reflections"),
      repo.all("simulations"),
      repo.all("evaluations"),
      repo.all("sessions"),
      repo.dismissedInsightIds(),
      repo.all("experiments"),
      repo.all("observations"),
      repo.all("achievements"),
    ]);

    setUser(loadedUser);
    setPreference(loadedPreference);
    setStates(loadedStates);
    setEvents(loadedEvents);
    setGoals(loadedGoals);
    setAttempts(loadedAttempts);
    setReflections(loadedReflections);
    setSimulations(loadedSimulations);
    setEvaluations(loadedEvaluations);
    setSessions(loadedSessions);
    setDismissedInsightIds(loadedDismissed);
    setExperiments(loadedExperiments);
    setObservations(loadedObservations);
    setAchievements(loadedAchievements);
    setReady(true);

    if (loadedPreference.retentionDays > 0) {
      const redacted = await repo.applyRetention(loadedPreference.retentionDays, now);
      if (redacted > 0) setReflections(await repo.all("reflections"));
    }
  }, []);

  useEffect(() => {
    // Hydrating from IndexedDB is the "subscribe to an external system" case
    // the lint rule exists to allow: every setState here happens after an
    // await, not synchronously during the effect, so no cascading render is
    // possible. The rule cannot see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!ready) return;
    publishRapportPulseHistory(events, simulations);
  }, [ready, events, simulations]);

  const now = useNow();

  const recommendationInput = useMemo(
    () => ({
      states,
      goals,
      preference,
      focusHistory: focusHistoryFrom(events),
      recentEvidence: recentEvidence(events),
      now,
    }),
    [states, goals, preference, events, now],
  );

  const todayPlan = useMemo(() => {
    if (!ready || states.length === 0) return null;
    return buildSession({
      ...recommendationInput,
      userId: LOCAL_USER_ID,
      recentScenarioIds: simulations.slice(-4).map((simulation) => simulation.scenarioId),
      challengeHistory: attempts,
      evaluations,
      focusSkillId: focusOverride ?? undefined,
    });
  }, [ready, states, recommendationInput, simulations, attempts, evaluations, focusOverride]);

  // Insights and weekly reviews are derived from the event log rather than
  // accumulated and stored. Two consequences, both wanted: they can never go
  // stale relative to the evidence, and a change to the scoring model
  // regenerates the whole history rather than leaving old conclusions behind.
  // The only thing persisted is which insights the user dismissed.
  const insights = useMemo(() => {
    if (!ready || events.length < 3) return [];
    const weekAgo = new Date(new Date(now).getTime() - 7 * 86_400_000).toISOString();
    const previousStates = recomputeStates(
      LOCAL_USER_ID,
      events.filter((event) => event.at < weekAgo),
      weekAgo,
    );
    const dismissed = new Set(dismissedInsightIds);
    return generateInsights({
      userId: LOCAL_USER_ID,
      states,
      previousStates,
      attempts,
      events,
      now,
    }).filter((item) => !dismissed.has(item.id));
  }, [ready, events, states, attempts, now, dismissedInsightIds]);

  const reviews = useMemo(() => {
    if (!ready || events.length === 0) return [];
    const today = todayIso(new Date(now));
    // The last four completed weeks, most recent first.
    const weeks: string[] = [];
    for (let offset = 1; offset <= 4; offset += 1) {
      const start = weekStartFor(shiftDays(today, -7 * offset));
      if (!weeks.includes(start)) weeks.push(start);
    }
    return weeks
      .map((weekStart) =>
        buildWeeklyReview({
          userId: LOCAL_USER_ID,
          events,
          attempts,
          weekStart,
          recommendation: {
            goals,
            preference,
            focusHistory: focusHistoryFrom(events),
            recentEvidence: recentEvidence(events),
          },
          now,
        }),
      )
      .filter(
        (review) =>
          review.trainingCompleted.simulations +
            review.trainingCompleted.challenges +
            review.trainingCompleted.sessions >
          0,
      );
  }, [ready, events, attempts, goals, preference, now]);

  const applyEvent = useCallback(async (event: DomainEvent): Promise<UserSkillState[]> => {
    const at = event.at;
    const nextStates = await repo.appendEvent(event, at);
    const nextEvents = await repo.allEvents();
    setStates(nextStates);
    setEvents(nextEvents);

    const context = buildContext(nextStates, nextEvents);
    const unlocked = newlyUnlocked(LOCAL_USER_ID, context, achievements, at);
    if (unlocked.length > 0) {
      await repo.putMany("achievements", unlocked);
      setAchievements((current) => [...current, ...unlocked]);
      setJustUnlocked(unlocked);
    }
    return nextStates;
  }, [achievements]);

  const recordEvidenceEvent = useCallback<StoreValue["recordEvidenceEvent"]>(async (event) => {
    await applyEvent(event);
  }, [applyEvent]);

  const completeOnboarding = useCallback<StoreValue["completeOnboarding"]>(async (assessment, statement) => {
    const at = new Date().toISOString();
    const result: AssessmentResult = buildInitialProfile(LOCAL_USER_ID, assessment, at);

    const newUser: User = {
      id: LOCAL_USER_ID,
      displayName: "",
      createdAt: at,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    };
    await repo.saveUser(newUser);
    setUser(newUser);

    const newPreference: Preference = {
      ...preference,
      intensity: result.intensity,
      sessionMinutes: sessionMinutesFor(result.intensity),
      contexts: result.contexts,
      updatedAt: at,
    };
    await repo.savePreference(newPreference);
    setPreference(newPreference);

    if (statement.trim()) {
      const goal: Goal = {
        id: `goal.${at}`,
        userId: LOCAL_USER_ID,
        statement: statement.trim(),
        skillIds: result.prioritySkillIds,
        contexts: result.contexts,
        createdAt: at,
      };
      await repo.put("goals", goal);
      setGoals([goal]);
    } else {
      const goal: Goal = {
        id: `goal.${at}`,
        userId: LOCAL_USER_ID,
        statement: result.goalDomains.length ? `Get better at ${result.goalDomains.join(", ")}` : "General practice",
        skillIds: result.prioritySkillIds,
        contexts: result.contexts,
        createdAt: at,
      };
      await repo.put("goals", goal);
      setGoals([goal]);
    }

    await applyEvent({
      kind: "assessment-completed",
      at,
      assessmentId: assessment.id,
      priors: result.states.map((state) => ({
        skillId: state.skillId,
        mastery: state.mastery,
        confidence: state.confidence,
      })),
    });
  }, [preference, applyEvent]);

  const setFocus = useCallback<StoreValue["setFocus"]>(async (skillId) => {
    setFocusOverride(skillId);
  }, []);

  const recordLessonRead = useCallback<StoreValue["recordLessonRead"]>(async (skillId, lessonId) => {
    await applyEvent({ kind: "lesson-read", at: new Date().toISOString(), lessonId, skillId });
    if (todayPlan) {
      const updated = markStepComplete(todayPlan.session, "lesson", new Date().toISOString());
      await repo.put("sessions", updated);
      setSessions((current) => [...current.filter((item) => item.id !== updated.id), updated]);
    }
  }, [applyEvent, todayPlan]);

  const recordExercise = useCallback<StoreValue["recordExercise"]>(async (exercise, performance) => {
    const at = new Date().toISOString();
    await applyEvent({
      kind: "exercise-completed",
      at,
      exerciseId: exercise.id,
      skillId: exercise.skillId,
      performance: Math.min(1, Math.max(0, performance)),
      difficulty: exercise.difficulty,
    });
    if (todayPlan) {
      const updated = markStepComplete(todayPlan.session, "exercise", at);
      await repo.put("sessions", updated);
      setSessions((current) => [...current.filter((item) => item.id !== updated.id), updated]);
    }
  }, [applyEvent, todayPlan]);

  const saveSimulation = useCallback<StoreValue["saveSimulation"]>(async (simulation) => {
    const at = new Date().toISOString();
    await repo.put("simulations", simulation);
    setSimulations((current) => [...current.filter((item) => item.id !== simulation.id), simulation]);

    const evaluation = evaluateSimulation(simulation, `eval.${simulation.id}`, at);
    await repo.put("evaluations", evaluation);
    setEvaluations((current) => [...current.filter((item) => item.id !== evaluation.id), evaluation]);
    await repo.put("exercises", evaluation.nextExercise);

    const performance = performanceFrom(evaluation.scores);
    if (performance) {
      const skillEvidence = simulation.scenario.skillIds.map((skillId) => {
        const behaviour = behaviourForSkill(skillId);
        const score = behaviour ? evaluation.scores.find((item) => item.key === behaviour && item.reliable) : undefined;
        return {
          skillId,
          performance: score?.score ?? performance.performance,
          reliability: score ? 1 : performance.reliability,
        };
      });
      await applyEvent({
        kind: "simulation-evaluated",
        at,
        simulationId: simulation.id,
        skillIds: simulation.scenario.skillIds,
        performance: performance.performance,
        difficulty: simulation.deliveredDifficulty,
        reliability: performance.reliability,
        behaviours: evaluation.scores.map((score) => ({ key: score.key, score: score.score })),
        skillEvidence,
      });
    }

    if (todayPlan) {
      const updated = markStepComplete(todayPlan.session, "simulation", at);
      await repo.put("sessions", updated);
      setSessions((current) => [...current.filter((item) => item.id !== updated.id), updated]);
    }
    return evaluation;
  }, [applyEvent, todayPlan]);

  const assignChallenge = useCallback<StoreValue["assignChallenge"]>(async (skillId) => {
    const at = new Date().toISOString();
    const state = states.find((item) => item.skillId === skillId);
    const selection = selectChallenge(
      skillId,
      state ?? {
        userId: LOCAL_USER_ID,
        skillId,
        mastery: 0.4,
        masteryUncertainty: 0.3,
        confidence: 0.4,
        confidenceUncertainty: 0.3,
        attemptCount: 0,
        successEvidence: 0,
        difficultyTolerance: 2,
        retentionEstimate: 0.5,
        updatedAt: at,
      },
      attempts,
      preference.contexts,
      todayPlan?.challenge?.challenge.behaviour,
    );
    const attempt: ChallengeAttempt = {
      id: `attempt.${at}`,
      userId: LOCAL_USER_ID,
      challengeId: selection.challenge.id,
      challenge: selection.challenge,
      assignedAt: at,
      reminderAt: at,
    };
    await repo.put("attempts", attempt);
    if (selection.challenge.generated) await repo.put("challenges", selection.challenge);
    setAttempts((current) => [...current, attempt]);
    return attempt;
  }, [states, attempts, preference.contexts, todayPlan]);

  const completeChallenge = useCallback<StoreValue["completeChallenge"]>(async (attemptId, input) => {
    const at = new Date().toISOString();
    const attempt = attempts.find((item) => item.id === attemptId);
    if (!attempt) return {};

    const reflection: Reflection = {
      ...input,
      id: `reflection.${at}`,
      userId: LOCAL_USER_ID,
      subject: { kind: "challenge", attemptId },
      createdAt: at,
    };

    const screen = screenReflection(reflection);
    const signal = extractSignals(reflection);

    await repo.put("reflections", reflection);
    await repo.put("signals", signal);
    setReflections((current) => [...current, reflection]);

    const updatedAttempt: ChallengeAttempt = {
      ...attempt,
      completedAt: input.attempted === "no" ? undefined : at,
      skippedAt: input.attempted === "no" ? at : undefined,
      postponedUntil: undefined,
      reminderAt: undefined,
      outcome: input.attempted,
      perceivedDifficulty: input.difficulty,
    };
    await repo.put("attempts", updatedAttempt);
    setAttempts((current) => current.map((item) => (item.id === attemptId ? updatedAttempt : item)));

    const performance = performanceFromReflection(reflection, signal);
    if (performance && input.attempted !== "no-opportunity" && input.attempted !== "wrong-situation") {
      await applyEvent({
        kind: "challenge-attempted",
        at,
        attemptId,
        skillId: attempt.challenge.skillId,
        outcome: input.attempted,
        difficulty: performance.difficulty,
        performance: performance.performance,
        reliability: performance.reliability,
        comfort: performance.comfort,
      });
    }

    if (todayPlan) {
      const updated = markStepComplete(
        markStepComplete(todayPlan.session, "challenge", at),
        "reflection",
        at,
      );
      await repo.put("sessions", updated);
      setSessions((current) => [...current.filter((item) => item.id !== updated.id), updated]);
      if (updated.completedAt) {
        await applyEvent({ kind: "session-completed", at, sessionId: updated.id, focusSkillId: updated.focusSkillId });
      }
    }

    return screen.verdict === "support" ? { warning: screen.message } : {};
  }, [attempts, applyEvent, todayPlan]);

  const skipChallenge = useCallback<StoreValue["skipChallenge"]>(async (attemptId, reason) => {
    const at = new Date().toISOString();
    const attempt = attempts.find((item) => item.id === attemptId);
    if (!attempt) return;
    const updated = { ...attempt, skippedAt: at };
    await repo.put("attempts", updated);
    setAttempts((current) => current.map((item) => (item.id === attemptId ? updated : item)));
    await applyEvent({ kind: "challenge-skipped", at, attemptId, skillId: attempt.challenge.skillId, reason });
  }, [attempts, applyEvent]);

  const swapChallenge = useCallback<StoreValue["swapChallenge"]>(async (attemptId) => {
    const attempt = attempts.find((item) => item.id === attemptId);
    if (!attempt) return null;
    await skipChallenge(attemptId, "swapped");
    return assignChallenge(attempt.challenge.skillId);
  }, [attempts, skipChallenge, assignChallenge]);

  const postponeChallenge = useCallback<StoreValue["postponeChallenge"]>(async (attemptId, days = 1) => {
    const attempt = attempts.find((item) => item.id === attemptId);
    if (!attempt || attempt.completedAt || attempt.skippedAt) return;
    const at = new Date().toISOString();
    const reminder = new Date(at);
    reminder.setUTCDate(reminder.getUTCDate() + Math.max(0, days));
    const updated: ChallengeAttempt = {
      ...attempt,
      postponedUntil: days > 0 ? reminder.toISOString().slice(0, 10) : undefined,
      reminderAt: reminder.toISOString(),
    };
    await repo.put("attempts", updated);
    setAttempts((current) => current.map((item) => (item.id === attemptId ? updated : item)));
  }, [attempts]);

  const correctSkill = useCallback<StoreValue["correctSkill"]>(async (skillId, values) => {
    const at = new Date().toISOString();
    await applyEvent({ kind: "user-corrected-skill", at, skillId, ...values });
    setStates((current) =>
      current.map((state) => (state.skillId === skillId ? applyUserCorrection(state, { ...values, at }) : state)),
    );
  }, [applyEvent]);

  const updatePreference = useCallback<StoreValue["updatePreference"]>(async (patch) => {
    const next: Preference = { ...preference, ...patch, updatedAt: new Date().toISOString() };
    await repo.savePreference(next);
    setPreference(next);
  }, [preference]);

  const startExperiment = useCallback<StoreValue["startExperiment"]>(async (experiment) => {
    await repo.put("experiments", experiment);
    setExperiments((current) => [...current.filter((item) => item.id !== experiment.id), experiment]);
  }, []);

  const recordObservation = useCallback<StoreValue["recordObservation"]>(async (observation) => {
    await repo.put("observations", observation);
    setObservations((current) => [...current, observation]);
  }, []);

  const endExperiment = useCallback<StoreValue["endExperiment"]>(async (experimentId) => {
    const experiment = experiments.find((item) => item.id === experimentId);
    if (!experiment) return;
    const updated = { ...experiment, endedAt: new Date().toISOString() };
    await repo.put("experiments", updated);
    setExperiments((current) => current.map((item) => (item.id === experimentId ? updated : item)));
  }, [experiments]);

  const dismissInsight = useCallback<StoreValue["dismissInsight"]>(async (insightId) => {
    const next = [...new Set([...dismissedInsightIds, insightId])];
    await repo.saveDismissedInsightIds(next);
    setDismissedInsightIds(next);
  }, [dismissedInsightIds]);

  const exportData = useCallback<StoreValue["exportData"]>(async () => {
    const payload = await repo.exportAll(new Date().toISOString());
    return JSON.stringify(payload, null, 2);
  }, []);

  const wipeData = useCallback<StoreValue["wipeData"]>(async () => {
    await repo.wipe();
    setUser(null);
    setStates([]);
    setEvents([]);
    setGoals([]);
    setAttempts([]);
    setReflections([]);
    setSimulations([]);
    setEvaluations([]);
    setSessions([]);
    setDismissedInsightIds([]);
    setExperiments([]);
    setObservations([]);
    setAchievements([]);
    setPreference(EMPTY_PREFERENCE);
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ready,
      needsOnboarding: ready && user === null,
      user,
      preference,
      states,
      goals,
      events,
      attempts,
      reflections,
      simulations,
      evaluations,
      sessions,
      insights,
      experiments,
      observations,
      achievements,
      reviews,
      todayPlan,
      justUnlocked,
      dismissUnlocked: () => setJustUnlocked([]),
      completeOnboarding,
      recordEvidenceEvent,
      setFocus,
      recordLessonRead,
      recordExercise,
      saveSimulation,
      assignChallenge,
      completeChallenge,
      skipChallenge,
      swapChallenge,
      postponeChallenge,
      correctSkill,
      updatePreference,
      startExperiment,
      recordObservation,
      endExperiment,
      dismissInsight,
      exportData,
      wipeData,
    }),
    [
      ready, user, preference, states, goals, events, attempts, reflections, simulations, evaluations,
      sessions, insights, experiments, observations, achievements, reviews, todayPlan, justUnlocked,
      completeOnboarding, setFocus, recordLessonRead, recordExercise, saveSimulation, assignChallenge,
      completeChallenge, skipChallenge, swapChallenge, postponeChallenge, correctSkill, updatePreference,
      startExperiment, recordObservation, recordEvidenceEvent,
      endExperiment, dismissInsight, exportData, wipeData,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider");
  return value;
}

