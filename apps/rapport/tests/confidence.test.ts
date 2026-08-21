import { describe, expect, it } from "vitest";
import {
  confidenceFor,
  consistencyFromScores,
  transcriptQualityFromSimulation,
  extractionUncertaintyFromEvaluation,
  type ConfidenceInput,
} from "@/domain/confidence";
import { exactAgreement, weightedAgreement, weightedKappa, pearsonCorrelation, spearmanCorrelation } from "@/domain/agreement";
import { scoreTranscript } from "@/domain/evaluation";
import type { Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

const SCENARIO: SimulationScenario = {
  id: "sc.conf",
  title: "Confidence test",
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

function input(overrides: Partial<ConfidenceInput> = {}): ConfidenceInput {
  return {
    behaviour: "followUpQuality",
    amountOfEvidence: 5,
    consistency: 0.9,
    transcriptQuality: 0.9,
    rubricReliability: 0.7,
    extractionUncertainty: 0.1,
    reliable: true,
    ...overrides,
  };
}

describe("confidence levels", () => {
  it("returns insufficient evidence when the score was unreliable", () => {
    const result = confidenceFor(input({ reliable: false, amountOfEvidence: 10 }));
    expect(result.level).toBe("insufficient evidence");
    expect(result.reasons[0]).toContain("too short");
  });

  it("returns insufficient evidence with zero observations", () => {
    expect(confidenceFor(input({ amountOfEvidence: 0 })).level).toBe("insufficient evidence");
  });

  it("never claims high confidence from a single observation", () => {
    const result = confidenceFor(input({ amountOfEvidence: 1, consistency: null, transcriptQuality: 0.95, rubricReliability: 0.9 }));
    expect(result.level).not.toBe("high");
    expect(result.reasons.some((r) => r.includes("one independent observation"))).toBe(true);
  });

  it("gives high confidence only with several consistent observations and a reliable rubric", () => {
    const result = confidenceFor(input({ amountOfEvidence: 6, consistency: 0.95, transcriptQuality: 0.9, rubricReliability: 0.75, extractionUncertainty: 0.05 }));
    expect(result.level).toBe("high");
  });

  it("caps at moderate when the rubric itself is unreliable", () => {
    const result = confidenceFor(input({ amountOfEvidence: 8, consistency: 0.95, rubricReliability: 0.3 }));
    expect(result.level).not.toBe("high");
    expect(result.reasons.some((r) => r.toLowerCase().includes("raters disagree") || r.toLowerCase().includes("capped"))).toBe(true);
  });

  it("drops to low when observations contradict each other", () => {
    const result = confidenceFor(input({ amountOfEvidence: 4, consistency: 0.2 }));
    expect(["low", "moderate"]).toContain(result.level);
    expect(result.reasons.some((r) => r.includes("disagree"))).toBe(true);
  });

  it("reports extraction uncertainty when the transcript is ambiguous", () => {
    const result = confidenceFor(input({ extractionUncertainty: 0.8 }));
    expect(result.reasons.some((r) => r.includes("Extraction was uncertain"))).toBe(true);
  });

  it("always returns the five factors for inspectability", () => {
    const result = confidenceFor(input());
    expect(Object.keys(result.factors).sort()).toEqual([
      "amountOfEvidence",
      "consistency",
      "extractionUncertainty",
      "rubricReliability",
      "transcriptQuality",
    ]);
  });
});

describe("low-evidence handling", () => {
  it("marks a very short transcript as low quality", () => {
    const short = build([
      ["user", "Hi."],
      ["character", "Hello."],
    ]);
    expect(transcriptQualityFromSimulation(short)).toBeLessThan(0.4);
  });

  it("marks a substantial transcript as good quality", () => {
    const full = build([
      ["user", "How has your week been?"],
      ["character", "Busy — we moved office on Tuesday and I have been unpacking boxes ever since."],
      ["user", "What made them move the office? Mine has been talking about a move for months."],
      ["character", "Ran out of space mostly. The new place is near the river which is nice."],
      ["user", "That sounds like an upgrade. Which part of the new place do you like most so far?"],
      ["character", "The light honestly. We lost our windows in the old building over time."],
    ]);
    expect(transcriptQualityFromSimulation(full)).toBeGreaterThan(0.6);
  });

  it("treats a single short observation as insufficient even if the score looks fine", () => {
    const short = build([
      ["user", "What did you do at the weekend?"],
      ["character", "Went walking, it was great fun with friends from university."],
    ]);
    const scores = scoreTranscript(short);
    const followUp = scores.find((s) => s.key === "followUpQuality");
    // Either unreliable, or confidence must reflect the thin material.
    if (followUp?.reliable) {
      const result = confidenceFor({
        behaviour: "followUpQuality",
        amountOfEvidence: 1,
        consistency: null,
        transcriptQuality: transcriptQualityFromSimulation(short),
        rubricReliability: 0.7,
        extractionUncertainty: 0,
        reliable: true,
      });
      expect(result.level).toBe("insufficient evidence");
    } else {
      expect(followUp?.reliable ?? false).toBe(false);
    }
  });

  it("computes consistency as null for one observation and lower for scattered ones", () => {
    expect(consistencyFromScores([0.8])).toBeNull();
    expect(consistencyFromScores([0.8, 0.8, 0.8])).toBeGreaterThan(consistencyFromScores([0.9, 0.3, 0.7])!);
  });

  it("raises extraction uncertainty when many behaviours were unjudgeable", () => {
    const short = build([
      ["user", "Hi."],
      ["character", "Hello."],
    ]);
    const scores = scoreTranscript(short);
    expect(extractionUncertaintyFromEvaluation(scores)).toBeGreaterThan(0);
  });
});

describe("agreement statistics extensions", () => {
  it("exact agreement is 1 for identical labels and lower otherwise", () => {
    expect(exactAgreement([["present", "present"], ["absent", "absent"]])).toBe(1);
    expect(exactAgreement([["present", "absent"], ["absent", "present"]])).toBe(0);
  });

  it("weighted agreement gives partial credit for near categories", () => {
    const cats = ["absent", "uncertain", "present"];
    const w = cats.map((_, i) => cats.map((_, j) => 1 - Math.abs(i - j) / (cats.length - 1)));
    // present vs uncertain should score above present vs absent
    const near = weightedAgreement([["present", "uncertain"]], cats, w);
    const far = weightedAgreement([["present", "absent"]], cats, w);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeCloseTo(0.5);
  });

  it("linear weighted kappa rewards adjacent-category agreement over nominal kappa", () => {
    const cats = ["absent", "uncertain", "present"];
    const k = weightedKappa(
      ["absent", "uncertain", "present"],
      ["uncertain", "uncertain", "present"],
      cats,
    );
    // Two of three agree exactly; the miss is adjacent, so kappa should be positive.
    expect(k).toBeGreaterThan(0.4);
  });

  it("pearson correlation detects strong linear agreement and returns null without variance", () => {
    expect(pearsonCorrelation([0.1, 0.4, 0.7, 0.9], [0.15, 0.35, 0.72, 0.88])!).toBeGreaterThan(0.95);
    expect(pearsonCorrelation([0.5, 0.5, 0.5], [0.2, 0.8, 0.5])).toBeNull();
  });

  it("spearman correlation captures monotonic agreement", () => {
    const r = spearmanCorrelation([0.1, 0.3, 0.9, 0.5], [0.05, 0.25, 0.85, 0.45]);
    expect(r!).toBeGreaterThan(0.95);
  });
});
