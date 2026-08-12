import { describe, expect, it } from "vitest";
import { buildInitialProfile, ONBOARDING_QUESTIONS, sessionMinutesFor } from "@/domain/assessment";
import { buildSession, estimatedMinutes, homeSummary, markStepComplete } from "@/domain/session";
import { recomputeStates, focusHistoryFrom, recentEvidence, SCORING_MODEL_VERSION } from "@/domain/events";
import type { DomainEvent } from "@/domain/events";
import { extractSignals, performanceFromReflection, redact, shouldRedact } from "@/domain/reflection";
import { evaluateSimulation, performanceFrom, scoreTranscript } from "@/domain/evaluation";
import { buildWeeklyReview, weekStartFor } from "@/domain/weekly-review";
import { stateFor } from "@/domain/mastery";
import { DEFAULT_PREFERENCE } from "@/data/repository";
import { getScenario } from "@/domain/scenarios";
import type { Assessment, Preference, Reflection, Simulation } from "@/domain/types";

const NOW = "2026-03-04T09:00:00.000Z";
const at = (dayOffset: number, hour = 9) =>
  new Date(Date.UTC(2026, 2, 4 + dayOffset, hour)).toISOString();

const preference: Preference = { ...DEFAULT_PREFERENCE, userId: "u", updatedAt: NOW };

const assessment: Assessment = {
  id: "a1",
  userId: "u",
  kind: "onboarding",
  answers: [
    { questionId: "goals", value: ["conversation", "confidence"] },
    { questionId: "hard-situations", value: ["keeping-going", "groups"] },
    { questionId: "comfortable", value: ["listening"] },
    { questionId: "group-vs-one", value: "group-much-harder" },
    { questionId: "intensity", value: "steady" },
    { questionId: "contexts", value: ["work", "social"] },
  ],
  createdAt: NOW,
};

describe("onboarding", () => {
  it("asks a short, purposeful set of questions", () => {
    expect(ONBOARDING_QUESTIONS.length).toBeLessThanOrEqual(8);
    for (const question of ONBOARDING_QUESTIONS) {
      expect(question.purpose.length, question.id).toBeGreaterThan(20);
      if (question.kind !== "text") expect(question.options?.length ?? 0).toBeGreaterThan(1);
    }
  });

  it("builds a profile without labelling the user", () => {
    const result = buildInitialProfile("u", assessment, NOW);
    expect(result.states.length).toBeGreaterThan(50);
    expect(result.prioritySkillIds.length).toBeGreaterThan(0);
    expect(result.intensity).toBe("steady");
    expect(result.contexts).toEqual(["work", "social"]);
  });

  it("keeps onboarding priors uncertain so evidence can overwrite them", () => {
    const result = buildInitialProfile("u", assessment, NOW);
    for (const state of result.states) {
      expect(state.masteryUncertainty).toBeGreaterThan(0.2);
      expect(state.mastery).toBeGreaterThan(0);
      expect(state.mastery).toBeLessThan(1);
    }
  });

  it("moves named difficulties down and named strengths up", () => {
    const result = buildInitialProfile("u", assessment, NOW);
    const followUp = result.states.find((state) => state.skillId === "conv.follow-up");
    const listening = result.states.find((state) => state.skillId === "conv.active-listening");
    expect(followUp!.mastery).toBeLessThan(listening!.mastery);
  });

  it("maps intensity to a session length people will actually do", () => {
    expect(sessionMinutesFor("light")).toBeLessThan(sessionMinutesFor("steady"));
    expect(sessionMinutesFor("focused")).toBeLessThanOrEqual(20);
  });
});

describe("daily session", () => {
  const states = buildInitialProfile("u", assessment, NOW).states;

  const plan = () =>
    buildSession({
      userId: "u",
      states,
      goals: [{ id: "g", userId: "u", statement: "Speak up", skillIds: ["conf.groups"], contexts: ["work"], createdAt: NOW }],
      preference,
      focusHistory: [],
      recentEvidence: [],
      now: NOW,
      recentScenarioIds: [],
      challengeHistory: [],
    });

  it("produces a session inside the time budget", () => {
    const built = plan();
    expect(built).not.toBeNull();
    // The challenge and reflection cost almost no app time by design.
    expect(estimatedMinutes(built!.session)).toBeLessThanOrEqual(sessionMinutesFor("steady") + 2);
  });

  it("always offers a real-world challenge", () => {
    expect(plan()!.challenge).not.toBeNull();
    expect(plan()!.session.steps.some((step) => step.kind === "challenge")).toBe(true);
  });

  it("gives every step a reason the user can read", () => {
    for (const step of plan()!.session.steps) {
      expect(step.reason.length, step.kind).toBeGreaterThan(10);
    }
  });

  it("answers what, why and next on the home screen", () => {
    const built = plan()!;
    const summary = homeSummary(built, states.find((state) => state.skillId === built.session.focusSkillId));
    expect(summary.practising.length).toBeGreaterThan(2);
    expect(summary.why.length).toBeGreaterThan(10);
    expect(summary.next.length).toBeGreaterThan(5);
  });

  it("honours an explicit focus override", () => {
    const built = buildSession({
      userId: "u",
      states,
      goals: [],
      preference,
      focusHistory: [],
      recentEvidence: [],
      now: NOW,
      recentScenarioIds: [],
      challengeHistory: [],
      focusSkillId: "asrt.no",
    });
    expect(built?.session.focusSkillId).toBe("asrt.no");
  });

  it("drops the lesson once the skill has evidence behind it", () => {
    const practised = states.map((state) =>
      state.skillId === "conf.groups"
        ? { ...state, attemptCount: 6, mastery: 0.7, lastPractisedAt: at(-1) }
        : state,
    );
    const built = buildSession({
      userId: "u",
      states: practised,
      goals: [],
      preference,
      focusHistory: [],
      recentEvidence: [],
      now: NOW,
      recentScenarioIds: [],
      challengeHistory: [],
      focusSkillId: "conf.groups",
    });
    expect(built?.session.steps.some((step) => step.kind === "lesson")).toBe(false);
  });

  it("marks steps complete and closes the session when the app steps are done", () => {
    let session = plan()!.session;
    for (const kind of ["lesson", "simulation", "reflection"] as const) {
      session = markStepComplete(session, kind, NOW);
    }
    expect(session.startedAt).toBe(NOW);
    expect(session.completedAt).toBe(NOW);
  });
});

describe("reflection", () => {
  const reflection = (overrides: Partial<Reflection> = {}): Reflection => ({
    id: "r1",
    userId: "u",
    subject: { kind: "challenge", attemptId: "a1" },
    attempted: "yes",
    difficulty: 3,
    skillIds: ["conv.follow-up"],
    createdAt: NOW,
    ...overrides,
  });

  it("extracts behaviours and obstacles without diagnosing", () => {
    const signal = extractSignals(
      reflection({
        wentWell: "I asked a follow-up about her course and she talked for ages.",
        wouldChange: "I got nervous and rushed the first bit.",
      }),
    );
    expect(signal.behavioursMentioned).toContain("followUpQuality");
    expect(signal.obstacles).toContain("nerves");
    expect(signal.obstacles).toContain("rushed");
    expect(signal.source).toBe("deterministic");
  });

  it("reads a non-attempt as information about comfort, not competence", () => {
    const signal = extractSignals(reflection({ attempted: "no", wouldChange: "I chickened out." }));
    const performance = performanceFromReflection(reflection({ attempted: "no" }), signal);
    expect(performance!.reliability).toBeLessThan(0.4);
    expect(signal.obstacles).toContain("avoided");
  });

  it("scores an attempt above a non-attempt", () => {
    const yes = performanceFromReflection(reflection({ attempted: "yes" }), extractSignals(reflection()));
    const no = performanceFromReflection(reflection({ attempted: "no" }), extractSignals(reflection({ attempted: "no" })));
    expect(yes!.performance).toBeGreaterThan(no!.performance);
  });

  it("redacts free text on the retention schedule but keeps the entry", () => {
    const old = reflection({ createdAt: at(-100), wentWell: "private note" });
    expect(shouldRedact(old, 30, NOW)).toBe(true);
    const redacted = redact(old, NOW);
    expect(redacted.wentWell).toBeUndefined();
    expect(redacted.redactedAt).toBe(NOW);
    expect(shouldRedact(redacted, 30, NOW)).toBe(false);
  });

  it("keeps text indefinitely when retention is off", () => {
    expect(shouldRedact(reflection({ createdAt: at(-999) }), 0, NOW)).toBe(false);
  });
});

describe("event log and recomputation", () => {
  const scenario = getScenario("sc.short-answers")!;
  const simulation: Simulation = {
    id: "sim1",
    userId: "u",
    scenarioId: scenario.id,
    scenario,
    mode: "text",
    startedAt: at(-3),
    deliveredDifficulty: 3,
    assistLevel: "partial",
    turns: [
      { id: "1", simulationId: "sim1", index: 0, speaker: "user", text: "How's your week been?", createdAt: at(-3) },
      { id: "2", simulationId: "sim1", index: 1, speaker: "character", text: "Busy. Lots of reporting work.", createdAt: at(-3) },
      { id: "3", simulationId: "sim1", index: 2, speaker: "user", text: "What kind of reporting is it?", createdAt: at(-3) },
      { id: "4", simulationId: "sim1", index: 3, speaker: "character", text: "Month end mostly.", createdAt: at(-3) },
      { id: "5", simulationId: "sim1", index: 4, speaker: "user", text: "That sounds relentless. I've had month ends like that.", createdAt: at(-3) },
      { id: "6", simulationId: "sim1", index: 5, speaker: "character", text: "Yeah.", createdAt: at(-3) },
    ],
  };

  const events: DomainEvent[] = [
    {
      kind: "assessment-completed",
      at: at(-7),
      assessmentId: "a1",
      priors: buildInitialProfile("u", assessment, at(-7)).states.map((state) => ({
        skillId: state.skillId,
        mastery: state.mastery,
        confidence: state.confidence,
      })),
    },
    { kind: "lesson-read", at: at(-6), lessonId: "lesson.conv.follow-up", skillId: "conv.follow-up" },
    {
      kind: "simulation-evaluated",
      at: at(-3),
      simulationId: "sim1",
      skillIds: ["conv.follow-up"],
      performance: 0.7,
      difficulty: 3,
      reliability: 0.8,
      behaviours: [],
    },
    {
      kind: "challenge-attempted",
      at: at(-2),
      attemptId: "att1",
      skillId: "conv.follow-up",
      outcome: "yes",
      difficulty: 3,
      performance: 0.8,
      reliability: 0.9,
      comfort: 0.5,
    },
    { kind: "session-completed", at: at(-2), sessionId: "s1", focusSkillId: "conv.follow-up" },
  ];

  it("folds the log into skill states deterministically", () => {
    const a = recomputeStates("u", events, NOW);
    const b = recomputeStates("u", [...events].reverse(), NOW);
    const findA = a.find((state) => state.skillId === "conv.follow-up")!;
    const findB = b.find((state) => state.skillId === "conv.follow-up")!;
    expect(findA.mastery).toBeCloseTo(findB.mastery, 10);
  });

  it("moves mastery from evidence, not from reading a lesson", () => {
    const withoutEvidence = recomputeStates("u", events.slice(0, 2), NOW).find((state) => state.skillId === "conv.follow-up")!;
    const withEvidence = recomputeStates("u", events, NOW).find((state) => state.skillId === "conv.follow-up")!;
    expect(withEvidence.mastery).toBeGreaterThan(withoutEvidence.mastery);
    expect(withEvidence.attemptCount).toBe(2);
  });

  it("ignores skipped challenges when computing mastery", () => {
    const withSkip = recomputeStates(
      "u",
      [...events, { kind: "challenge-skipped", at: at(-1), attemptId: "att2", skillId: "conv.follow-up" }],
      NOW,
    ).find((state) => state.skillId === "conv.follow-up")!;
    const without = recomputeStates("u", events, NOW).find((state) => state.skillId === "conv.follow-up")!;
    expect(withSkip.mastery).toBeCloseTo(without.mastery, 10);
    expect(withSkip.attemptCount).toBe(without.attemptCount);
  });

  it("lets a user correction override computed evidence", () => {
    const corrected = recomputeStates(
      "u",
      [...events, { kind: "user-corrected-skill", at: at(-1), skillId: "conv.follow-up", mastery: 0.9 }],
      NOW,
    ).find((state) => state.skillId === "conv.follow-up")!;
    expect(corrected.mastery).toBe(0.9);
  });

  it("derives focus history and recent evidence for the recommender", () => {
    expect(focusHistoryFrom(events)).toEqual([{ skillId: "conv.follow-up", date: at(-2).slice(0, 10) }]);
    const recent = recentEvidence(events);
    expect(recent[0]?.kind).toBe("challenge");
    expect(recent.length).toBe(2);
  });

  it("stamps a scoring version so cached projections can be invalidated", () => {
    expect(SCORING_MODEL_VERSION).toBeGreaterThan(0);
  });

  it("evaluates a real transcript end to end", () => {
    const evaluation = evaluateSimulation(simulation, "eval1", NOW);
    const performance = performanceFrom(scoreTranscript(simulation));
    expect(performance).not.toBeNull();
    expect(evaluation.scores.length).toBeGreaterThan(3);
    expect(evaluation.nextExercise.skillId).toBe("conv.follow-up");
  });
});

describe("weekly review", () => {
  const weekStart = weekStartFor("2026-02-25");
  const events: DomainEvent[] = [
    {
      kind: "challenge-attempted",
      at: `${weekStart}T10:00:00.000Z`,
      attemptId: "a1",
      skillId: "conv.follow-up",
      outcome: "yes",
      difficulty: 3,
      performance: 0.8,
      reliability: 0.9,
    },
    {
      kind: "simulation-evaluated",
      at: `${weekStart}T11:00:00.000Z`,
      simulationId: "s1",
      skillIds: ["conv.follow-up"],
      performance: 0.7,
      difficulty: 3,
      reliability: 0.8,
      behaviours: [],
    },
    { kind: "session-completed", at: `${weekStart}T11:30:00.000Z`, sessionId: "sess1", focusSkillId: "conv.follow-up" },
  ];

  const review = buildWeeklyReview({
    userId: "u",
    events,
    attempts: [
      {
        id: "a1",
        userId: "u",
        challengeId: "ch.one-follow-up",
        challenge: {
          id: "ch.one-follow-up",
          skillId: "conv.follow-up",
          difficulty: 2,
          objective: "Ask one follow-up.",
          context: "Any conversation.",
          completionCriteria: ["Asked one"],
          reflectionPrompt: "How did it go?",
          contexts: ["work"],
        },
        assignedAt: `${weekStart}T09:00:00.000Z`,
        completedAt: `${weekStart}T10:00:00.000Z`,
        outcome: "yes",
        perceivedDifficulty: 3,
      },
    ],
    weekStart,
    recommendation: { goals: [], preference, focusHistory: [], recentEvidence: [] },
    now: NOW,
  });

  it("counts the week's training", () => {
    expect(review.trainingCompleted.challenges).toBe(1);
    expect(review.trainingCompleted.simulations).toBe(1);
    expect(review.trainingCompleted.sessions).toBe(1);
  });

  it("prefers real-world evidence for its strongest claim", () => {
    expect(review.strongestEvidence).not.toBeNull();
    expect(review.strongestEvidence!.statement).toMatch(/real conversations/);
    expect(review.strongestEvidence!.evidence.length).toBeGreaterThan(1);
  });

  it("explains why the next focus was chosen", () => {
    expect(review.nextFocus.skillId).toBeTruthy();
    expect(review.nextFocus.reason.length).toBeGreaterThan(25);
  });

  it("declines to manufacture evidence from an empty week", () => {
    const empty = buildWeeklyReview({
      userId: "u",
      events: [],
      attempts: [],
      weekStart,
      recommendation: { goals: [], preference, focusHistory: [], recentEvidence: [] },
      now: NOW,
    });
    expect(empty.strongestEvidence).toBeNull();
    expect(empty.trainingCompleted.sessions).toBe(0);
  });

  it("computes Monday-based week starts", () => {
    expect(weekStartFor("2026-03-04")).toBe("2026-03-02");
    expect(weekStartFor("2026-03-01")).toBe("2026-02-23");
  });

  it("regenerates identically from the same log", () => {
    const again = buildWeeklyReview({
      userId: "u",
      events,
      attempts: [],
      weekStart,
      recommendation: { goals: [], preference, focusHistory: [], recentEvidence: [] },
      now: NOW,
    });
    expect(again.trainingCompleted).toEqual(review.trainingCompleted);
  });
});

describe("state bands", () => {
  it("describes progress without a single overall score", () => {
    // There is deliberately no function anywhere that returns one number for a
    // person; this test documents that intent.
    expect(stateFor(0.66)).toBe("strong");
    expect(typeof stateFor).toBe("function");
  });
});
