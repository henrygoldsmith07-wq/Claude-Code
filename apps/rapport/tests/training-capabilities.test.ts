import { describe, expect, it } from "vitest";
import {
  assistancePlan,
  buildTrainingGuidance,
  challengeReminder,
  delayedRetestFor,
  overpracticeStatus,
  prerequisiteRoute,
  recurringErrorFor,
  selectTrainingScenario,
  trainingStageFor,
} from "@/domain/training";
import { initialSkillState } from "@/domain/mastery";
import { selectChallenge } from "@/domain/challenges";
import { extractSignals, performanceFromReflection, REFLECTION_PROMPTS } from "@/domain/reflection";
import { SCENARIOS } from "@/domain/scenarios";
import type { ChallengeAttempt, Reflection, SimulationEvaluation } from "@/domain/types";

const NOW = "2026-03-10T09:00:00.000Z";

function evaluation(id: string, score: number, skillId = "conv.follow-up"): SimulationEvaluation {
  return {
    id,
    simulationId: `sim.${id}`,
    userId: "u",
    scores: [{ key: "followUpQuality", score, evidence: "test evidence", reliable: true }],
    whatWorked: [],
    highestImpactImprovement: {
      behaviour: "followUpQuality",
      observation: "test",
      principle: "test",
      exampleAlternative: "test",
    },
    nextExercise: {
      id: `exercise.${id}`,
      skillId,
      kind: "rewrite",
      prompt: "Write one follow-up.",
      criteria: ["It refers to a detail"],
      difficulty: 3,
      generatedFrom: { evaluationId: id, behaviour: "followUpQuality" },
    },
    source: "deterministic",
    createdAt: id === "e1" ? "2026-03-01T09:00:00.000Z" : "2026-03-05T09:00:00.000Z",
  };
}

describe("adaptive training policy", () => {
  it("fades assistance in evidence-sized stages", () => {
    const fresh = initialSkillState("u", "conv.follow-up", NOW);
    expect(assistancePlan(fresh).level).toBe("full");
    expect(assistancePlan({ ...fresh, attemptCount: 3, mastery: 0.6 }).level).toBe("minimal");
    expect(assistancePlan({ ...fresh, attemptCount: 8, mastery: 0.8 }).level).toBe("none");
  });

  it("names the next stage instead of treating practice and transfer as one step", () => {
    const state = { ...initialSkillState("u", "conv.follow-up", NOW), attemptCount: 4, mastery: 0.8, retentionEstimate: 0.8 };
    const stage = trainingStageFor(state, assistancePlan({ ...state, mastery: 0.8 }), null, [0.8, 0.85]);
    expect(stage.stage).toBe("real-world-mission");
    expect(stage.next).toMatch(/real-world mission|outside the simulator/i);
  });

  it("marks a mission with the behaviour it is meant to transfer", () => {
    const state = initialSkillState("u", "conv.follow-up", NOW);
    const selection = selectChallenge("conv.follow-up", state, [], ["social"], "followUpQuality");
    expect(selection.challenge.behaviour).toBe("followUpQuality");
    expect(selection.reason).toMatch(/follow-up/i);
  });

  it("recycles an error only after it recurs", () => {
    expect(recurringErrorFor([evaluation("e1", 0.4)])).toBeNull();
    const recycled = recurringErrorFor([evaluation("e1", 0.4), evaluation("e2", 0.45)]);
    expect(recycled?.behaviour).toBe("followUpQuality");
    expect(recycled?.count).toBe(2);
    expect(recycled?.exercise.prompt).toBe("Write one follow-up.");
  });

  it("chooses a fresh scenario and scales it to recent performance", () => {
    const state = { ...initialSkillState("u", "conf.groups", NOW), difficultyTolerance: 3 };
    const candidates = SCENARIOS.filter((item) => item.skillIds.includes("conf.groups"));
    expect(candidates.length).toBeGreaterThan(1);
    const chosen = selectTrainingScenario({
      skillId: "conf.groups",
      state,
      recentScenarioIds: [candidates[0]!.id],
      recentPerformances: [0.9, 0.9],
      evaluations: [],
      now: NOW,
    });
    expect(chosen).not.toBeNull();
    expect(chosen?.scenario.id).not.toBe(candidates[0]!.id);
    expect(chosen?.difficulty).toBe(4);
  });

  it("routes a blocked skill to its prerequisite", () => {
    const route = prerequisiteRoute("conv.follow-up", (skillId) => skillId === "conv.open-questions" ? 0.1 : 0.8);
    expect(route?.requiredSkillId).toBe("conv.open-questions");
    expect(route?.rationale.length).toBeGreaterThan(20);
  });

  it("schedules a delayed retest after strong evidence", () => {
    const retest = delayedRetestFor("conv.follow-up", [evaluation("e1", 0.85)], NOW);
    expect(retest?.due).toBe(true);
    expect(retest?.message).toMatch(/delayed retest/i);
  });

  it("flags repeated weekly focus as overpractice", () => {
    const status = overpracticeStatus(
      "conv.follow-up",
      [
        { skillId: "conv.follow-up", date: "2026-03-04" },
        { skillId: "conv.follow-up", date: "2026-03-07" },
        { skillId: "conv.follow-up", date: "2026-03-10" },
      ],
      NOW,
    );
    expect(status.isOverpractised).toBe(true);
  });

  it("does not turn context outcomes into competence evidence", () => {
    const base: Reflection = {
      id: "r1",
      userId: "u",
      subject: { kind: "freeform" },
      attempted: "no-opportunity",
      difficulty: 3,
      skillIds: ["conv.follow-up"],
      createdAt: NOW,
    };
    expect(performanceFromReflection(base, extractSignals(base))).toBeNull();
    expect(
      performanceFromReflection({ ...base, attempted: "wrong-situation" }, extractSignals({ ...base, attempted: "wrong-situation" })),
    ).toBeNull();
    const options = REFLECTION_PROMPTS[0]?.options?.map((item) => item.value);
    expect(options).toContain("no-opportunity");
    expect(options).toContain("wrong-situation");
  });

  it("makes postponement visible without calling it a failure", () => {
    const attempt: ChallengeAttempt = {
      id: "a1",
      userId: "u",
      challengeId: "ch1",
      challenge: {
        id: "ch1",
        skillId: "conv.follow-up",
        difficulty: 2,
        objective: "Ask one follow-up.",
        context: "Any conversation.",
        completionCriteria: ["Ask one", "Use a detail"],
        reflectionPrompt: "How did it go?",
        contexts: ["social"],
      },
      assignedAt: NOW,
      postponedUntil: "2026-03-11",
      reminderAt: "2026-03-11T09:00:00.000Z",
    };
    const reminder = challengeReminder(attempt, NOW);
    expect(reminder.due).toBe(false);
    expect(reminder.detail).toMatch(/not failed/i);
  });

  it("exposes all controls through one guidance object", () => {
    const state = { ...initialSkillState("u", "conv.follow-up", NOW), attemptCount: 4, mastery: 0.6, retentionEstimate: 0.4 };
    const guidance = buildTrainingGuidance({
      skillId: "conv.follow-up",
      states: [state, initialSkillState("u", "conv.open-questions", NOW)],
      recentScenarioIds: [],
      recentPerformances: [],
      evaluations: [evaluation("e1", 0.4), evaluation("e2", 0.45)],
      focusHistory: [],
      now: NOW,
    });
    expect(guidance?.assistance.level).toBe("minimal");
    expect(guidance?.recurringError).not.toBeNull();
    expect(guidance?.maintenance.due).toBe(true);
    expect(guidance?.scenario?.selection).toBe("error-recycle");
  });
});

