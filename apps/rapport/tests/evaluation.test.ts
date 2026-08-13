import { describe, expect, it } from "vitest";
import {
  evaluateSimulation,
  extractFeatures,
  performanceFrom,
  scoreTranscript,
  selectImprovement,
} from "@/domain/evaluation";
import type { BehaviourKey, Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

const scenario: SimulationScenario = {
  id: "sc.test",
  title: "Test",
  context: "A test conversation.",
  skillIds: ["conv.follow-up"],
  objective: "Keep it going.",
  difficulty: 3,
  characters: [
    {
      id: "c1",
      name: "Sam",
      style: "quiet",
      role: "a colleague",
      background: ["I moved here last year."],
      interests: ["running"],
      openness: 0.2,
      reciprocity: 0.2,
    },
  ],
  branches: [],
  evaluationCriteria: [],
};

function build(lines: [speaker: "user" | "character", text: string][]): Simulation {
  const turns: SimulationTurn[] = lines.map(([speaker, text], index) => ({
    id: `t${index}`,
    simulationId: "sim",
    index,
    speaker,
    characterId: speaker === "character" ? "c1" : undefined,
    text,
    createdAt: new Date(Date.UTC(2026, 0, 1, 10, index)).toISOString(),
  }));
  return {
    id: "sim",
    userId: "u",
    scenarioId: scenario.id,
    scenario,
    mode: "text",
    startedAt: "2026-01-01T10:00:00.000Z",
    deliveredDifficulty: 3,
    assistLevel: "none",
    turns,
  };
}

const GOOD_FOLLOW_UP = build([
  ["user", "How's the week been treating you?"],
  ["character", "Busy. We moved office on Tuesday."],
  ["user", "What made them move the office?"],
  ["character", "Ran out of space, mostly. New place is near the river."],
  ["user", "So you've gone from cramped to somewhere with a view. Mine's the opposite — we lost our windows in the last move."],
  ["character", "That sounds grim."],
  ["user", "It is. Which part of the new place do you like most?"],
  ["character", "The light, honestly."],
]);

const TOPIC_HOPPING = build([
  ["user", "Hi."],
  ["character", "Busy. We moved office on Tuesday."],
  ["user", "I watched a documentary about deep sea creatures last night, it was incredible."],
  ["character", "Right."],
  ["user", "Do you think the trains will be running properly this weekend at all?"],
  ["character", "No idea."],
  ["user", "My brother is buying a house in Leeds which is completely unrelated but there we go."],
  ["character", "Mm."],
]);

const INTERVIEW = build([
  ["user", "What do you do here?"],
  ["character", "Reporting side, mostly."],
  ["user", "How long have you been doing that?"],
  ["character", "Two years."],
  ["user", "What did you do before?"],
  ["character", "Manchester."],
  ["user", "Which part of Manchester?"],
  ["character", "North."],
]);

describe("transcript features", () => {
  it("counts replies that pick up the previous turn", () => {
    const features = extractFeatures(GOOD_FOLLOW_UP);
    expect(features.referencingReplies).toBeGreaterThanOrEqual(2);
    expect(features.userTurns.length).toBe(4);
  });

  it("counts open questions separately from closed ones", () => {
    const features = extractFeatures(INTERVIEW);
    expect(features.openQuestions).toBeGreaterThan(0);
    expect(features.openQuestions + features.closedQuestions).toBe(4);
  });

  it("notices a run of questions with nothing offered back", () => {
    const features = extractFeatures(INTERVIEW);
    expect(features.questionRuns).toBeGreaterThan(0);
    expect(features.disclosures).toBe(0);
  });

  it("notices unsignalled topic changes", () => {
    const features = extractFeatures(TOPIC_HOPPING);
    expect(features.unsignalledTransitions).toBeGreaterThan(0);
  });
});

describe("behaviour scoring", () => {
  const scoreOf = (simulation: Simulation, key: BehaviourKey) =>
    scoreTranscript(simulation).find((score) => score.key === key)?.score ?? 0;

  it("scores relevance higher for a conversation that stays with the other person", () => {
    expect(scoreOf(GOOD_FOLLOW_UP, "relevance")).toBeGreaterThan(scoreOf(TOPIC_HOPPING, "relevance"));
  });

  it("scores follow-up quality higher when questions build on a detail", () => {
    expect(scoreOf(GOOD_FOLLOW_UP, "followUpQuality")).toBeGreaterThan(scoreOf(TOPIC_HOPPING, "followUpQuality"));
  });

  it("penalises pure questioning on reciprocity", () => {
    expect(scoreOf(INTERVIEW, "reciprocity")).toBeLessThan(scoreOf(GOOD_FOLLOW_UP, "reciprocity"));
  });

  it("attaches countable evidence to every score", () => {
    for (const score of scoreTranscript(GOOD_FOLLOW_UP)) {
      expect(score.evidence.length, score.key).toBeGreaterThan(5);
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(1);
    }
  });

  it("marks scores unreliable when the transcript is too short", () => {
    const short = build([
      ["user", "Hello."],
      ["character", "Hi."],
    ]);
    const scores = scoreTranscript(short);
    expect(scores.filter((score) => score.reliable && score.key === "reciprocity")).toHaveLength(0);
  });

  it("excludes unreliable scores from the mastery signal", () => {
    const short = build([["user", "Hi."]]);
    const result = performanceFrom(scoreTranscript(short));
    // Either nothing usable, or only the small number of turn-independent scores.
    if (result) expect(result.reliability).toBeLessThan(1);
  });

  it("is deterministic — the same transcript scores identically twice", () => {
    expect(scoreTranscript(GOOD_FOLLOW_UP)).toEqual(scoreTranscript(GOOD_FOLLOW_UP));
  });
});

describe("feedback selection", () => {
  it("names exactly one improvement", () => {
    const evaluation = evaluateSimulation(TOPIC_HOPPING, "eval.1", "2026-01-01T11:00:00.000Z");
    expect(evaluation.highestImpactImprovement.behaviour).toBeTruthy();
    expect(evaluation.highestImpactImprovement.principle.length).toBeGreaterThan(20);
    expect(Object.keys(evaluation.highestImpactImprovement)).toHaveLength(4);
  });

  it("picks the weakest reliable behaviour as the improvement", () => {
    const scores = scoreTranscript(INTERVIEW);
    const improvement = selectImprovement(scores);
    const reliable = scores.filter((score) => score.reliable);
    const min = Math.min(...reliable.map((score) => score.score));
    expect(improvement?.score).toBe(min);
  });

  it("generates a targeted exercise from the weakness", () => {
    const evaluation = evaluateSimulation(INTERVIEW, "eval.2", "2026-01-01T11:00:00.000Z");
    expect(evaluation.nextExercise.generatedFrom?.behaviour).toBe(evaluation.highestImpactImprovement.behaviour);
    expect(evaluation.nextExercise.criteria.length).toBeGreaterThan(1);
    expect(evaluation.nextExercise.prompt.length).toBeGreaterThan(20);
  });

  it("never frames the example as the correct answer", () => {
    const evaluation = evaluateSimulation(GOOD_FOLLOW_UP, "eval.3", "2026-01-01T11:00:00.000Z");
    const text = evaluation.highestImpactImprovement.exampleAlternative.toLowerCase();
    expect(text).not.toMatch(/you should have said|the correct (answer|response)|the right thing to say/);
  });

  it("finds something that worked in a competent conversation", () => {
    const evaluation = evaluateSimulation(GOOD_FOLLOW_UP, "eval.4", "2026-01-01T11:00:00.000Z");
    expect(evaluation.whatWorked.length).toBeGreaterThan(0);
  });

  it("labels itself deterministic when no model was involved", () => {
    const evaluation = evaluateSimulation(GOOD_FOLLOW_UP, "eval.5", "2026-01-01T11:00:00.000Z");
    expect(evaluation.source).toBe("deterministic");
  });
});
