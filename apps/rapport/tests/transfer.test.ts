import { describe, expect, it } from "vitest";
import {
  buildTransferRecords,
  summariseTransfer,
  challengeLifecycle,
  delayedTransferCheck,
  trainedVersusUntrained,
  formulaicityIndex,
  overFormulaicTrend,
} from "@/domain/transfer";
import type {
  BehaviourKey,
  Challenge,
  ChallengeAttempt,
  Id,
  Reflection,
  Simulation,
  SimulationEvaluation,
  SimulationScenario,
  SimulationTurn,
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
const SCENARIO_C: SimulationScenario = { ...SCENARIO_A, id: "sc.c", title: "Standup" };

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
    scenario: scenarioId === "sc.a" ? SCENARIO_A : scenarioId === "sc.b" ? SCENARIO_B : SCENARIO_C,
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

describe("delayed transfer and persistence", () => {
  const validatedInput = () => ({
    skillId: "conv.follow-up" as Id,
    behaviour: "followUpQuality" as BehaviourKey,
    evaluations: [
      evaluation("eval-base", "sim-a", 0.4, "2026-08-01T10:00:00.000Z"),
      evaluation("eval-unseen", "sim-b", 0.7, "2026-08-15T10:00:00.000Z"),
      evaluation("eval-later", "sim-c", 0.65, "2026-08-31T10:00:00.000Z"), // 16 days after unseen
    ],
    simulations: [simulation("sim-a", "sc.a"), simulation("sim-b", "sc.b"), simulation("sim-c", "sc.c")],
    attempts: [attempt()],
    reflections: [reflection("attempt-1")],
  });

  it("reports persistence when the gain holds at a delayed check on another new scenario", () => {
    const record = buildTransferRecords(validatedInput(), NOW)[0]!;
    expect(record.validated).toBe(true);
    const check = delayedTransferCheck(validatedInput(), record);
    expect(check.daysLater).toBe(16);
    expect(check.persisted).toBe(true);
    expect(check.note).toContain("persisted");
  });

  it("refuses to call it persistence before the delay has elapsed", () => {
    const input = validatedInput();
    input.evaluations = input.evaluations.filter((e) => e.id !== "eval-later");
    const record = buildTransferRecords(input, NOW)[0]!;
    const check = delayedTransferCheck(input, record);
    expect(check.persisted).toBeNull();
    expect(check.note).toContain("at least");
  });

  it("does not accept a same-scenario repeat as the delayed check (memory, not skill)", () => {
    const input = validatedInput();
    // The only later conversation is back on sc.b — the unseen scenario itself.
    input.evaluations = [
      ...input.evaluations.filter((e) => e.id !== "eval-later"),
      evaluation("eval-repeat", "sim-b2", 0.9, "2026-09-05T10:00:00.000Z"),
    ];
    input.simulations = [...input.simulations, simulation("sim-b2", "sc.b")];
    const record = buildTransferRecords(input, NOW)[0]!;
    const check = delayedTransferCheck(input, record);
    expect(check.persisted).toBeNull();
  });

  it("reports fading when the delayed score has fallen back to baseline", () => {
    const input = validatedInput();
    input.evaluations = input.evaluations.map((e) =>
      e.id === "eval-later" ? evaluation("eval-later", "sim-c", 0.41, "2026-08-31T10:00:00.000Z") : e,
    );
    const record = buildTransferRecords(input, NOW)[0]!;
    const check = delayedTransferCheck(input, record);
    expect(check.persisted).toBe(false);
    expect(check.note).toContain("did not persist");
  });
});

describe("trained versus untrained specificity", () => {
  function multiEvaluation(id: Id, simulationId: Id, createdAt: string, scores: Partial<Record<BehaviourKey, number | null>>): SimulationEvaluation {
    return {
      id,
      simulationId,
      userId: "u",
      scores: Object.entries(scores).map(([key, value]) => ({
        key: key as BehaviourKey,
        score: value ?? 0.5,
        evidence: `${key} evidence`,
        reliable: value !== null,
      })),
      whatWorked: [],
      highestImpactImprovement: { behaviour: "followUpQuality", observation: "o", principle: "p", exampleAlternative: "e" },
      nextExercise: { id: `ex.${id}`, skillId: "conv.follow-up", kind: "rewrite", prompt: "p", criteria: ["c"], difficulty: 3 },
      source: "deterministic",
      createdAt,
    };
  }

  const baseInput = () => ({
    skillId: "conv.follow-up" as Id,
    behaviour: "followUpQuality" as BehaviourKey,
    simulations: [simulation("sim-a", "sc.a"), simulation("sim-b", "sc.b")],
    attempts: [attempt()],
    reflections: [reflection("attempt-1")],
  });

  it("is specific when the trained behaviour moved and an untracked one did not", () => {
    const input = {
      ...baseInput(),
      evaluations: [
        multiEvaluation("e1", "sim-a", "2026-08-01T10:00:00.000Z", { followUpQuality: 0.4, listening: 0.5 }),
        multiEvaluation("e2", "sim-b", "2026-08-15T10:00:00.000Z", { followUpQuality: 0.7, listening: 0.5 }),
      ],
    };
    const report = trainedVersusUntrained(input);
    expect(report.trainedMeanGain).toBeCloseTo(0.3);
    expect(report.untrainedMeanGain).toBeCloseTo(0);
    expect(report.specific).toBe(true);
  });

  it("withholds a specificity claim when everything moved together", () => {
    const input = {
      ...baseInput(),
      evaluations: [
        multiEvaluation("e1", "sim-a", "2026-08-01T10:00:00.000Z", { followUpQuality: 0.4, listening: 0.45 }),
        multiEvaluation("e2", "sim-b", "2026-08-15T10:00:00.000Z", { followUpQuality: 0.7, listening: 0.75 }),
      ],
    };
    const report = trainedVersusUntrained(input);
    expect(report.specific).toBe(false);
    expect(report.note).toContain("cautiously");
  });

  it("returns null comparisons when there is no paired data at all", () => {
    const report = trainedVersusUntrained({ ...baseInput(), evaluations: [], simulations: [], attempts: [] } as never);
    expect(report.specific).toBeNull();
    expect(report.trainedMeanGain).toBeNull();
  });
});

describe("over-formulaic drift", () => {
  function simWithTurns(id: Id, startedAt: string, userTexts: string[]): Simulation {
    const turns: SimulationTurn[] = [];
    let index = 0;
    for (const text of userTexts) {
      turns.push({ id: `t-${id}-${index}`, simulationId: id, index, speaker: index % 2 === 0 ? "user" : "character", characterId: index % 2 === 0 ? undefined : "c1", text, createdAt: startedAt });
      index += 1;
    }
    return { id, userId: "u", scenarioId: "sc.a", scenario: SCENARIO_A, mode: "text", startedAt, deliveredDifficulty: 3, assistLevel: "none", turns };
  }

  const templated = (id: Id, at: string) =>
    simWithTurns(id, at, [
      "That sounds great, how did it start?",
      "That sounds like a lot. What happened next?",
      "That sounds tricky. How did you handle it?",
      "That sounds worth trying. Would you do it again?",
      "That sounds fair. What would you change?",
      "That sounds settled then. Thanks for explaining.",
    ]);

  const varied = (id: Id, at: string) =>
    simWithTurns(id, at, [
      "How did the whole thing kick off in the first place?",
      "Sixteen hours on a bus is grim — I flew once at 4am and swore off red-eyes forever.",
      "So the plan fell apart halfway? What did you actually do then?",
      "Honestly I would have panicked. You seem calmer about chaos than me.",
      "Next time, take the train and leave the spreadsheet at home.",
      "Deal — but you are planning the next one.",
    ]);

  it("scores templated transcripts high and varied ones low", () => {
    expect(formulaicityIndex(templated("f1", NOW))).toBeGreaterThan(0.6);
    expect(formulaicityIndex(varied("f2", NOW))).toBeLessThan(0.35);
  });

  it("returns zero when there is too little to judge", () => {
    const tiny = simWithTurns("f3", NOW, ["Hello there.", "Hi!"]);
    expect(formulaicityIndex(tiny)).toBe(0);
  });

  it("flags a rising drift only once the recent half is genuinely templated", () => {
    const sims = [
      varied("v1", "2026-07-01T09:00:00.000Z"),
      varied("v2", "2026-07-02T09:00:00.000Z"),
      templated("t1", "2026-07-03T09:00:00.000Z"),
      templated("t2", "2026-07-04T09:00:00.000Z"),
    ];
    const trend = overFormulaicTrend(sims);
    expect(trend.direction).toBe("rising");
    expect(trend.flagged).toBe(true);

    expect(overFormulaicTrend([varied("a", NOW), templated("b", NOW)]).direction).toBe("unknown");
  });

  it("stays quiet over a consistently varied history", () => {
    const trend = overFormulaicTrend([
      varied("v1", "2026-07-01T09:00:00.000Z"),
      varied("v2", "2026-07-02T09:00:00.000Z"),
      varied("v3", "2026-07-03T09:00:00.000Z"),
      varied("v4", "2026-07-04T09:00:00.000Z"),
    ]);
    expect(trend.flagged).toBe(false);
    expect(trend.direction === "stable" || trend.direction === "falling").toBe(true);
  });
});
