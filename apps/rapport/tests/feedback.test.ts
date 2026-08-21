import { describe, expect, it } from "vitest";
import {
  buildDeterministicFeedback,
  validateAiFeedback,
  feedbackFromEvaluation,
} from "@/domain/feedback";
import { checkAiBoundary, AI_ALLOWED_ROLES, aiMayReadTranscript, aiMayReadReflection } from "@/domain/ai-boundaries";
import { evaluateSimulation } from "@/domain/evaluation";
import type { Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

const SCENARIO: SimulationScenario = {
  id: "sc.fb",
  title: "Feedback test",
  context: "A conversation.",
  skillIds: ["conv.follow-up"],
  objective: "Talk.",
  difficulty: 3,
  characters: [
    {
      id: "c1",
      name: "Sam",
      style: "quiet",
      role: "a colleague",
      background: ["I moved here last year."],
      interests: ["running"],
      openness: 0.3,
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
    scenarioId: SCENARIO.id,
    scenario: SCENARIO,
    mode: "text",
    startedAt: "2026-01-01T10:00:00.000Z",
    deliveredDifficulty: 3,
    assistLevel: "none",
    turns,
  };
}

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

describe("transcript-backed feedback", () => {
  const evaluation = evaluateSimulation(TOPIC_HOPPING, "eval.fb", "2026-01-01T11:00:00.000Z");
  const feedback = buildDeterministicFeedback(TOPIC_HOPPING, evaluation.scores, "eval.fb");

  it("gives every feedback item behaviour + evidence + explanation + improvement", () => {
    expect(feedback.items.length).toBeGreaterThan(0);
    for (const item of feedback.items) {
      expect(item.behaviour).toBeTruthy();
      expect(item.label.length).toBeGreaterThan(3);
      expect(item.evidence.length).toBeGreaterThan(5);
      expect(item.explanation.length).toBeGreaterThan(20);
      expect(item.suggestedImprovement.length).toBeGreaterThan(20);
    }
  });

  it("names exactly one primary improvement backed by the weakest reliable score", () => {
    expect(feedback.primaryImprovement).not.toBeNull();
    const weakest = evaluation.scores.filter((s) => s.reliable).sort((a, b) => a.score - b.score)[0];
    expect(feedback.primaryImprovement!.behaviour).toBe(weakest?.key);
  });

  it("attaches exact transcript spans where the transcript exposes them", () => {
    const withSpans = feedback.items.filter((item) => item.evidenceSpans.length > 0);
    expect(withSpans.length).toBeGreaterThan(0);
    for (const item of withSpans) {
      for (const span of item.evidenceSpans) {
        expect(span.quote.length).toBeGreaterThan(0);
        expect(["support", "missed-opportunity"]).toContain(span.role);
        // The quote must exist verbatim in the transcript — no invented quotes.
        const found = TOPIC_HOPPING.turns.some((turn) => turn.text.trim() === span.quote);
        expect(found, `quote not in transcript: ${span.quote}`).toBe(true);
      }
    }
  });

  it("never produces advice without evidence", () => {
    for (const item of [...feedback.items, ...(feedback.primaryImprovement ? [feedback.primaryImprovement] : [])]) {
      // Evidence must contain either a count (digit) or an exact span.
      const hasCount = /\d/.test(item.evidence);
      const hasSpan = item.evidenceSpans.length > 0;
      expect(hasCount || hasSpan, `${item.behaviour} has neither count nor span`).toBe(true);
    }
  });

  it("marks itself deterministic when no model was involved", () => {
    expect(feedback.source).toBe("deterministic");
  });
});

describe("AI phrasing validation", () => {
  const evaluation = evaluateSimulation(TOPIC_HOPPING, "eval.fb2", "2026-01-01T11:00:00.000Z");
  const deterministic = buildDeterministicFeedback(TOPIC_HOPPING, evaluation.scores, "eval.fb2");

  it("accepts faithful AI phrasing that stays grounded in the evidence", () => {
    const grounded = {
      whatWorked: [`You stayed in the conversation — ${deterministic.items[0]?.evidence ?? "measured on device"}.`],
      observation: deterministic.primaryImprovement?.evidence ?? "Measured observation.",
      principle: "Reply to the last thing they said before adding anything new.",
      exampleAlternative: "What's holding it up?",
    };
    const result = validateAiFeedback(deterministic, grounded);
    expect(result.ok).toBe(true);
  });

  it("rejects generic ungrounded advice with no numbers or behaviour references", () => {
    const generic = {
      whatWorked: ["You did well overall in the conversation and kept things moving nicely throughout."],
      observation: "You could work on being more present and engaged in conversations generally speaking.",
      principle: "Being present helps conversations flow better over time.",
      exampleAlternative: "Try to focus more next time.",
    };
    const result = validateAiFeedback(deterministic, generic);
    expect(result.ok).toBe(false);
  });

  it("rejects trait language", () => {
    const traity = {
      whatWorked: ["You asked 1 question that followed a detail."],
      observation: "As an introvert you may find this harder; your personality tends toward quietness.",
      principle: "Reply to the last thing they said.",
      exampleAlternative: "What made you pick that?",
    };
    expect(validateAiFeedback(deterministic, traity).ok).toBe(false);
  });

  it("rejects payloads missing what-worked (all critique)", () => {
    expect(validateAiFeedback(deterministic, { whatWorked: [], observation: "x", principle: "y", exampleAlternative: "z" }).ok).toBe(false);
  });

  it("falls back to deterministic when AI payload fails validation", () => {
    const result = feedbackFromEvaluation(TOPIC_HOPPING, evaluation.scores, "eval.fb3", { whatWorked: [] });
    expect(result.source).toBe("deterministic");
    expect(result.note).toContain("not used");
  });
});

describe("AI boundaries", () => {
  it("declares allowed roles per task — extraction/explanation/personalisation/interpretation only", () => {
    for (const roles of Object.values(AI_ALLOWED_ROLES)) {
      for (const role of roles) {
        expect(["extraction", "explanation", "personalisation", "contextual-interpretation"]).toContain(role);
      }
    }
    // No task is allowed to be a "scorer"
    expect(Object.values(AI_ALLOWED_ROLES).flat()).not.toContain("scoring");
  });

  it("rejects AI output containing an invented score", () => {
    const check = checkAiBoundary(
      "phrase-feedback",
      { whatWorked: ["Good."], observation: "Your score was 8/10.", principle: "p", exampleAlternative: "e" },
      { behaviour: "relevance", evidence: "2 of 4 replies referenced something they had said" },
    );
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("score");
  });

  it("allows scores only when they match the deterministic evidence", () => {
    const check = checkAiBoundary(
      "phrase-feedback",
      { whatWorked: ["Good."], observation: "2 of 4 replies referenced something they had said.", principle: "p", exampleAlternative: "e" },
      { behaviour: "relevance", evidence: "2 of 4 replies referenced something they had said", scores: [{ key: "relevance", score: 0.5 }] },
    );
    expect(check.ok).toBe(true);
  });

  it("applies safety gates to AI output regardless of task", () => {
    const check = checkAiBoundary(
      "coach-explain",
      { explanation: "You should manipulate them into agreeing by wearing them down over days.", example: "" },
      {},
    );
    expect(check.ok).toBe(false);
  });

  it("restricts which tasks may read transcripts and reflections", () => {
    expect(aiMayReadTranscript("simulate-turn")).toBe(true);
    expect(aiMayReadTranscript("summarise-reflection")).toBe(false);
    expect(aiMayReadReflection("summarise-reflection")).toBe(true);
    expect(aiMayReadReflection("coach-explain")).toBe(false);
  });
});
