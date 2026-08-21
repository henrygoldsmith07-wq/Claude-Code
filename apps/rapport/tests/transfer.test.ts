import { describe, expect, it } from "vitest";
import { buildTransferRecords, summariseTransfer, challengeLifecycle } from "@/domain/transfer";
import type {
  Challenge,
  ChallengeAttempt,
  Id,
  Reflection,
  Simulation,
  SimulationEvaluation,
  SimulationScenario,
} from "@/domain/types";

const NOW = "2026-08-20T10:00:00.000Z";

const SCENARIO_A: SimulationScenario = {
  id: "sc.a",
  title: "Office chat",
  context: "A colleague.",
  skillIds: ["conv.follow-up"],
  objective: "Keep it going.",
  difficulty: 3,
  characters: [],
  branches: [],
  evaluationCriteria: ["followUpQuality"],
};

const SCENARIO_B: SimulationScenario = { ...SCENARIO_A, id: "sc.b", title: "Coffee queue" };

function evaluation(id: Id, simulationId: Id, behaviourScore: number | null, createdAt: string): SimulationEvaluation {
  return {
    id,
    simulationId,
    userId: "u",
    scores: [
      {
        key: "followUpQuality",
        score: behaviourScore ?? 0.5,
        evidence: "2 of 3 questions followed a detail they had just mentioned",
        reliable: behaviourScore !== null,
      },
    ],
    whatWorked: [],
    highestImpactImprovement: { behaviour: "followUpQuality", observation: "o", principle: "p", exampleAlternative: "e" },
    nextExercise: { id: `ex.${id}`, skillId: "conv.follow-up", kind: "rewrite", prompt: "Write a follow-up.", criteria: ["Use a detail"], difficulty: 3 },
    source: "deterministic",
    createdAt,
  };
}

function simulation(id: Id, scenarioId: Id): Simulation {
  return {
    id,
    userId: "u",
    scenarioId,
    scenario: scenarioId === "sc.a" ? SCENARIO_A : SCENARIO_B,
    mode: "text",
    startedAt: NOW,
    deliveredDifficulty: 3,
    assistLevel: "none",
    turns: [],
  };
}

function challenge(): Challenge {
  return {
    id: "ch.one-follow-up",
    skillId: "conv.follow-up",
    behaviour: "followUpQuality",
    difficulty: 2,
    objective: "Ask one genuine follow-up question about a detail the other person mentioned.",
    context: "Any conversation.",
    completionCriteria: ["The question referred to something they actually said"],
    reflectionPrompt: "What detail did you pick?",
    contexts: ["social"],
  };
}

function attempt(overrides: Partial<ChallengeAttempt> = {}): ChallengeAttempt {
  return {
    id: "attempt-1",
    userId: "u",
    challengeId: "ch.one-follow-up",
    challenge: challenge(),
    assignedAt: "2026-08-10T09:00:00.000Z",
    completedAt: "2026-08-11T18:00:00.000Z",
    outcome: "yes",
    ...overrides,
  };
}

function reflection(attemptId: Id, createdAt = "2026-08-11T19:00:00.000Z"): Reflection {
  return {
    id: `refl-${attemptId}`,
    userId: "u",
    subject: { kind: "challenge", attemptId },
    attempted: "yes",
    difficulty: 3,
    wentWell: "Asked a follow-up and they kept talking.",
    wouldChange: "",
    skillIds: ["conv.follow-up"],
    createdAt,
  };
}

describe("transfer loop lifecycle", () => {
  it("stays at baseline phase when no attempt exists", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      evaluations: [evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z")],
      simulations: [simulation("sim-a", "sc.a")],
      attempts: [],
      reflections: [],
    }, NOW);
    expect(records).toHaveLength(0);
  });

  it("does not claim transfer before reflection", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      evaluations: [evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z")],
      simulations: [simulation("sim-a", "sc.a")],
      attempts: [attempt()],
      reflections: [],
    }, NOW);
    expect(records[0]?.validated).toBe(false);
    expect(records[0]?.validationNote).toContain("reflection");
    expect(records[0]?.phase).toBe("reflection");
  });

  it("does not claim transfer before unseen practice on a different scenario", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      // Only evaluation is on the SAME scenario as baseline — memory, not transfer.
      evaluations: [
        evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z"),
        evaluation("eval-same-scenario", "sim-a2", 0.8, "2026-08-12T10:00:00.000Z"),
      ],
      simulations: [simulation("sim-a", "sc.a"), simulation("sim-a2", "sc.a")],
      attempts: [attempt()],
      reflections: [reflection("attempt-1")],
    }, NOW);
    expect(records[0]?.validated).toBe(false);
    expect(records[0]?.unseenPracticeEvaluationId).toBeNull();
  });

  it("records gain only after unseen practice on a different scenario", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      evaluations: [
        evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z"),
        evaluation("eval-unseen", "sim-b", 0.7, "2026-08-15T10:00:00.000Z"),
      ],
      simulations: [simulation("sim-a", "sc.a"), simulation("sim-b", "sc.b")],
      attempts: [attempt()],
      reflections: [reflection("attempt-1")],
    }, NOW);
    const record = records[0]!;
    expect(record.unseenPracticeEvaluationId).toBe("eval-unseen");
    expect(record.gain).toBeCloseTo(0.3);
    expect(record.validated).toBe(true);
    expect(record.validationNote).toContain("Validated transfer");
    expect(record.phase).toBe("analysis");
  });

  it("refuses to claim transfer when the deterministic comparison is not human-validated", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      evaluations: [
        evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z"),
        evaluation("eval-unseen", "sim-b", 0.9, "2026-08-15T10:00:00.000Z"),
      ],
      simulations: [simulation("sim-a", "sc.a"), simulation("sim-b", "sc.b")],
      attempts: [attempt()],
      reflections: [reflection("attempt-1")],
      humanValidatedBehaviours: new Set<string>(), // explicitly nothing validated by humans
    }, NOW);
    expect(records[0]?.validated).toBe(false);
    expect(records[0]?.validationNote).toContain("not yet human-validated");
  });

  it("treats an incomplete challenge as not transferable", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      evaluations: [evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z")],
      simulations: [simulation("sim-a", "sc.a")],
      attempts: [attempt({ completedAt: undefined, outcome: undefined })],
      reflections: [],
    }, NOW);
    expect(records[0]?.challengeCompleted).toBe(false);
    expect(records[0]?.phase).toBe("challenge");
  });

  it("summarises with a headline that never overclaims", () => {
    const summary = summariseTransfer([], "conv.follow-up", "followUpQuality");
    expect(summary.headline).toContain("cannot be assessed");

    const pending = summariseTransfer(
      buildTransferRecords({
        skillId: "conv.follow-up",
        behaviour: "followUpQuality",
        evaluations: [evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z")],
        simulations: [simulation("sim-a", "sc.a")],
        attempts: [attempt()],
        reflections: [reflection("attempt-1")],
      }, NOW),
      "conv.follow-up",
      "followUpQuality",
    );
    expect(pending.headline).toContain("no transfer claimed");
  });
});

describe("challenge lifecycle", () => {
  it("traces assigned → completed → reflected → follow-up-scored in order", () => {
    const events = challengeLifecycle(
      attempt(),
      reflection("attempt-1"),
      evaluation("eval-unseen", "sim-b", 0.7, "2026-08-15T10:00:00.000Z"),
    );
    expect(events.map((e) => e.kind)).toEqual(["assigned", "completed", "reflected", "follow-up-scored"]);
    expect(events.every((e) => e.at.length > 0 && e.detail.length > 5)).toBe(true);
  });

  it("records perceived outcome and difficulty from the reflection", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      evaluations: [],
      simulations: [],
      attempts: [attempt({ perceivedDifficulty: 2 })],
      reflections: [reflection("attempt-1")],
    }, NOW);
    expect(records[0]?.perceivedOutcome).toBe("yes");
    expect(records[0]?.perceivedDifficulty).toBe(3); // reflection's difficulty wins
  });

  it("keeps the loop honest when scores were unreliable on either side", () => {
    const records = buildTransferRecords({
      skillId: "conv.follow-up",
      behaviour: "followUpQuality",
      evaluations: [
        evaluation("eval-base", "sim-a", null, "2026-08-01T10:00:00.000Z"), // unreliable baseline
        evaluation("eval-unseen", "sim-b", 0.8, "2026-08-15T10:00:00.000Z"),
      ],
      simulations: [simulation("sim-a", "sc.a"), simulation("sim-b", "sc.b")],
      attempts: [attempt()],
      reflections: [reflection("attempt-1")],
    }, NOW);
    const record = records[0]!;
    expect(record.gain).toBeNull();
    expect(record.validated).toBe(false);
    expect(record.validationNote).toContain("not comparable");
  });
});
