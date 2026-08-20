import { describe, expect, it } from "vitest";
import { buildEvidenceLedger } from "@/domain/evidence";
import { emptyHumanEvidence } from "@/domain/human-evidence";
import { initialSkillState } from "@/domain/mastery";
import type { ChallengeAttempt, Simulation, SimulationEvaluation } from "@/domain/types";

const NOW = "2026-08-20T10:00:00.000Z";

const simulation: Simulation = {
  id: "sim.1",
  userId: "u",
  scenarioId: "sc.follow-up",
  scenario: {
    id: "sc.follow-up",
    title: "Short answers",
    context: "A colleague gives short answers.",
    skillIds: ["conv.follow-up"],
    objective: "Keep the exchange going.",
    difficulty: 3,
    characters: [],
    branches: [],
    evaluationCriteria: ["followUpQuality"],
  },
  mode: "text",
  startedAt: "2026-08-18T10:00:00.000Z",
  deliveredDifficulty: 3,
  assistLevel: "partial",
  turns: [],
};

const evaluation: SimulationEvaluation = {
  id: "eval.1",
  simulationId: simulation.id,
  userId: "u",
  scores: [{ key: "followUpQuality", score: 0.8, evidence: "1 of 1 questions followed a detail", reliable: true }],
  whatWorked: [],
  highestImpactImprovement: {
    behaviour: "followUpQuality",
    observation: "test",
    principle: "test",
    exampleAlternative: "test",
  },
  nextExercise: {
    id: "exercise.1",
    skillId: "conv.follow-up",
    kind: "rewrite",
    prompt: "Write a follow-up.",
    criteria: ["Use a detail"],
    difficulty: 3,
    generatedFrom: { evaluationId: "eval.1", behaviour: "followUpQuality" },
  },
  source: "deterministic",
  createdAt: "2026-08-18T10:00:00.000Z",
};

const attempt: ChallengeAttempt = {
  id: "attempt.1",
  userId: "u",
  challengeId: "ch.one-follow-up",
  challenge: {
    id: "ch.one-follow-up",
    skillId: "conv.follow-up",
    behaviour: "followUpQuality",
    difficulty: 2,
    objective: "Ask one genuine follow-up.",
    context: "Any conversation.",
    completionCriteria: ["Ask about a detail"],
    reflectionPrompt: "How did it go?",
    contexts: ["social"],
  },
  assignedAt: "2026-08-19T10:00:00.000Z",
  completedAt: "2026-08-19T11:00:00.000Z",
  outcome: "yes",
};

describe("source-separated evidence ledger", () => {
  it("keeps simulator and self-reported mission evidence distinct", () => {
    const ledger = buildEvidenceLedger({
      evaluations: [evaluation],
      simulations: [simulation],
      attempts: [attempt],
      states: [{ ...initialSkillState("u", "conv.follow-up", NOW), retentionEstimate: 0.72 }],
    });
    const profile = ledger.find((item) => item.behaviour === "followUpQuality")!;
    expect(profile.sources.simulator.count).toBe(1);
    expect(profile.sources["self-reported-mission"].count).toBe(1);
    expect(profile.sources["human-rated"].count).toBe(0);
    expect(profile.sources["validated-transfer"].count).toBe(0);
    expect(profile.scenarioDiversity).toBe(1);
    expect(profile.assistance).toBe("partial");
    expect(profile.retention).toBe(0.72);
    expect(profile.amountOfEvidence).toBe(2);
  });

  it("counts validated transfer only after independent human agreement", () => {
    const human = emptyHumanEvidence();
    human.items.push({
      id: "item.real",
      title: "Observed follow-up",
      kind: "real-world-challenge",
      source: "researcher-entered",
      occurredAt: "2026-08-20T09:00:00.000Z",
      skillIds: ["conv.follow-up"],
      systemScores: [],
    });
    human.raters.push(
      { id: "r1", displayName: "A", role: "rater", createdAt: NOW, active: true },
      { id: "r2", displayName: "B", role: "rater", createdAt: NOW, active: true },
    );
    human.ratings.push(
      { id: "rating.1", itemId: "item.real", raterId: "r1", ratedAt: NOW, labels: [{ key: "followUpQuality", decision: "present", score: 0.8, confidence: 4, evidence: ["Asked about the detail."] }], status: "independent" },
      { id: "rating.2", itemId: "item.real", raterId: "r2", ratedAt: NOW, labels: [{ key: "followUpQuality", decision: "present", score: 0.9, confidence: 4, evidence: ["Returned to the detail."] }], status: "independent" },
    );
    const profile = buildEvidenceLedger({ evaluations: [], simulations: [], attempts: [], states: [], humanEvidence: human })
      .find((item) => item.behaviour === "followUpQuality")!;
    expect(profile.sources["human-rated"].count).toBe(1);
    expect(profile.sources["validated-transfer"].count).toBe(1);
    expect(profile.amountOfEvidence).toBe(1);
  });
});

