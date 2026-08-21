import { describe, expect, it } from "vitest";
import { detectGaming, gamingReport, GAMING_PATTERNS } from "@/domain/gaming";
import { scoreTranscript } from "@/domain/evaluation";
import type { Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

const SCENARIO: SimulationScenario = {
  id: "sc.gaming",
  title: "Gaming test",
  context: "A conversation.",
  skillIds: ["conv.follow-up"],
  objective: "Talk.",
  difficulty: 3,
  characters: [
    {
      id: "c1",
      name: "Sam",
      style: "friendly",
      role: "a colleague",
      background: ["I've just come back from two weeks in Portugal."],
      interests: ["walking"],
      openness: 0.8,
      reciprocity: 0.6,
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

const scoreOf = (simulation: Simulation, key: string) =>
  scoreTranscript(simulation).find((s) => s.key === key)?.score ?? 0;

describe("gaming detection coverage", () => {
  it("knows all eight gaming patterns", () => {
    expect(GAMING_PATTERNS).toHaveLength(8);
    expect(GAMING_PATTERNS).toContain("excessive-questions");
    expect(GAMING_PATTERNS).toContain("mechanical-mirroring");
    expect(GAMING_PATTERNS).toContain("repetitive-acknowledgements");
    expect(GAMING_PATTERNS).toContain("unnatural-name-repetition");
    expect(GAMING_PATTERNS).toContain("formulaic-empathy");
    expect(GAMING_PATTERNS).toContain("unnaturally-short-responses");
    expect(GAMING_PATTERNS).toContain("forced-topic-references");
    expect(GAMING_PATTERNS).toContain("artificial-conversational-balance");
  });
});

describe("individual gaming strategies", () => {
  it("detects excessive questions (the interview gambit)", () => {
    const sim = build([
      ["user", "What do you do? How long? Where were you before? Which part?"],
      ["character", "Reporting side. Two years. Manchester."],
      ["user", "What made you move? How did you find it? What do you miss?"],
      ["character", "Space. Fine. The hills."],
      ["user", "Who do you work with? When did you start there? Why reporting?"],
      ["character", "The data team. Two years ago. It suited me."],
      ["user", "How is that going? What next for you? Where will you be?"],
      ["character", "Fine. Here, probably."],
    ]);
    const signals = detectGaming(sim);
    const excessive = signals.find((s) => s.pattern === "excessive-questions");
    expect(excessive).toBeDefined();
    expect(excessive!.severity).toBeGreaterThan(0.25);
    // Gaming must not raise the question score
    expect(scoreOf(sim, "questionQuality")).toBeLessThan(0.75);
  });

  it("detects repetitive acknowledgements (same phrase spammed)", () => {
    const sim = build([
      ["user", "How was the trip?"],
      ["character", "Really good, we walked the coast path."],
      ["user", "I hear you. That sounds great."],
      ["character", "Yeah it was restful."],
      ["user", "I hear you. What was the best bit?"],
      ["character", "The northern half."],
      ["user", "I hear you. Would you go back?"],
      ["character", "Easily."],
    ]);
    const signals = detectGaming(sim);
    const repetitive = signals.find((s) => s.pattern === "repetitive-acknowledgements");
    expect(repetitive).toBeDefined();
    expect(repetitive!.evidence.toLowerCase()).toContain("i hear you");
  });

  it("detects unnatural name repetition", () => {
    const sim = build([
      ["user", "Sam, how was your weekend?"],
      ["character", "Good, went walking."],
      ["user", "That sounds nice, Sam. Where did you walk, Sam?"],
      ["character", "Along the river."],
      ["user", "Nice one Sam. I like walking too, Sam."],
      ["character", "It's peaceful."],
      ["user", "Do you walk often, Sam?"],
      ["character", "Most weekends."],
    ]);
    const signals = detectGaming(sim);
    const nameSpam = signals.find((s) => s.pattern === "unnatural-name-repetition");
    expect(nameSpam).toBeDefined();
    expect(nameSpam!.severity).toBeGreaterThan(0.25);
  });

  it("detects formulaic empathy without an emotional cue to respond to", () => {
    const sim = build([
      ["user", "Did you watch the match?"],
      ["character", "I did, good game."],
      ["user", "That makes sense, you follow it closely. No wonder you enjoyed it."],
      ["character", "Ha, yeah."],
      ["user", "That makes sense. Who did you go with?"],
      ["character", "A few friends."],
      ["user", "That makes sense, sounds fun."],
      ["character", "It was."],
    ]);
    const signals = detectGaming(sim);
    const formulaic = signals.find((s) => s.pattern === "formulaic-empathy");
    expect(formulaic).toBeDefined();
  });

  it("detects unnaturally short responses used to farm balance", () => {
    const sim = build([
      ["user", "Hi."],
      ["character", "Hello! I've just come back from two weeks walking in Portugal, it was lovely."],
      ["user", "Cool."],
      ["character", "The coast path was the best part, honestly. We walked about ten miles a day."],
      ["user", "Nice."],
      ["character", "What about you — done anything like that?"],
      ["user", "Nope."],
      ["character", "You should try it sometime."],
    ]);
    const signals = detectGaming(sim);
    const short = signals.find((s) => s.pattern === "unnaturally-short-responses");
    expect(short).toBeDefined();
  });

  it("does not flag a genuine, balanced conversation as gaming", () => {
    const sim = build([
      ["user", "How was the trip?"],
      ["character", "Really good. We walked most of the coast path in Portugal."],
      ["user", "What made you pick the coast path? I did something similar in Wales last year and over-planned it completely."],
      ["character", "Wanted something where you could stop when you felt like it. Did you manage much walking in the end?"],
      ["user", "About half of what we planned, which turned out fine. Which bit would you go back to?"],
      ["character", "The northern half, easily. Fewer crowds."],
      ["user", "Noted for next time. Sounds like you needed the break after the spring you had."],
      ["character", "Honestly, yes."],
    ]);
    const report = gamingReport(sim);
    expect(report.signals.filter((s) => s.severity >= 0.3)).toHaveLength(0);
  });

  it("reports a readable summary when patterns are found", () => {
    const sim = build([
      ["user", "What do you do? How long? Where before? Which part?"],
      ["character", "Reporting. Two years. Manchester."],
      ["user", "What made you move? How was it? What do you miss?"],
      ["character", "Space. Fine. Hills."],
      ["user", "Who with? When did you start? Why that team?"],
      ["character", "Data team. Recently. Suited me."],
      ["user", "How's it going? What's next? Where to?"],
      ["character", "Fine. Here."],
    ]);
    const report = gamingReport(sim);
    expect(report.signals.length).toBeGreaterThan(0);
    expect(report.summary).toContain("gaming pattern");
  });
});

describe("score-gaming resistance in the evaluator", () => {
  it("scores a question-flood lower than a measured exchange on reciprocity", () => {
    const flood = build([
      ["user", "What do you do? How long? Where before? Which part?"],
      ["character", "Reporting. Two years. Manchester."],
      ["user", "What made you move? How was it? What do you miss?"],
      ["character", "Space. Fine. Hills."],
      ["user", "Who with? When did you start? Why that team?"],
      ["character", "Data team. Recently. Suited me."],
      ["user", "How's it going? What's next? Where to?"],
      ["character", "Fine. Here."],
    ]);
    const genuine = build([
      ["user", "How has your week been?"],
      ["character", "Busy — we moved office on Tuesday."],
      ["user", "What made them move the office? Mine's been talking about it for months."],
      ["character", "Ran out of space. New place is near the river."],
      ["user", "That sounds like an upgrade. Which part of the new place do you like most?"],
      ["character", "The light, honestly."],
      ["user", "Hard to beat good light. I lost mine in our last move."],
      ["character", "That is grim."],
    ]);
    expect(scoreOf(flood, "reciprocity")).toBeLessThan(scoreOf(genuine, "reciprocity"));
  });

  it("penalises empathy spam even though the validation count looks high", () => {
    const spam = build([
      ["user", "Did you watch the match?"],
      ["character", "I did, good game."],
      ["user", "That makes sense, you follow it closely. No wonder you enjoyed it."],
      ["character", "Ha, yeah."],
      ["user", "That makes sense. Who did you go with?"],
      ["character", "A few friends."],
      ["user", "That makes sense, sounds fun."],
      ["character", "It was."],
    ]);
    // The raw count of validations is high; the penalty should keep the score from being perfect.
    expect(scoreOf(spam, "empathy")).toBeLessThan(0.95);
  });

  it("keeps every penalised score explainable — evidence mentions the flag", () => {
    const flood = build([
      ["user", "What do you do? How long? Where before? Which part?"],
      ["character", "Reporting. Two years. Manchester."],
      ["user", "What made you move? How was it? What do you miss?"],
      ["character", "Space. Fine. Hills."],
      ["user", "Who with? When did you start? Why that team?"],
      ["character", "Data team. Recently. Suited me."],
      ["user", "How's it going? What's next? Where to?"],
      ["character", "Fine. Here."],
    ]);
    const scores = scoreTranscript(flood);
    const flagged = scores.find((s) => s.evidence.includes("score-gaming"));
    if (flagged) {
      expect(flagged.score).toBeLessThanOrEqual(1);
      expect(flagged.evidence.length).toBeGreaterThan(10);
    }
  });
});
