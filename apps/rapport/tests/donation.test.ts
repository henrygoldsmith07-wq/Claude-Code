import { scrubContactDetails } from "../src/domain/donation";
import { describe, expect, it } from "vitest";
import {
  applyRedactions,
  donate,
  emptyRatedCorpus,
  evaluatorAgreement,
  isActive,
  prepareDonation,
  ratedCorpusEligibility,
  redactionCandidates,
  withdraw,
  CONSENT_TERMS,
  type RatedCorpus,
} from "@/domain/donation";
import type { BehaviourKey, Id, SimulatedCharacter, Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

const SAM: SimulatedCharacter = {
  id: "ch.sam", name: "Sam", style: "quiet", role: "a colleague",
  background: ["I was on Bristol."], interests: [], openness: 0.4, reciprocity: 0.4,
};

const SCENARIO: SimulationScenario = {
  id: "sc.d", title: "Meeting someone new", context: "A room.", skillIds: [], objective: "Talk.",
  difficulty: 3, characters: [SAM], branches: [], evaluationCriteria: [],
};

function sim(texts: [speaker: "user" | "character", text: string][]): Simulation {
  const turns: SimulationTurn[] = texts.map(([speaker, text], index) => ({
    id: `t${index}`, simulationId: "s1", index, speaker,
    characterId: speaker === "character" ? SAM.id : undefined,
    text, createdAt: new Date(Date.UTC(2026, 0, 1, 9, index)).toISOString(),
  }));
  return {
    id: "s1", userId: "u1", scenarioId: SCENARIO.id, scenario: SCENARIO, mode: "text",
    startedAt: new Date(Date.UTC(2026, 0, 1, 9)).toISOString(),
    deliveredDifficulty: 3, assistLevel: "none", turns,
  };
}

describe("redaction suggestions", () => {
  it("flags contact details", () => {
    const found = redactionCandidates("Email me at jo.smith@example.com or call 07700 900123.");
    expect(found.map((c) => c.kind)).toContain("email");
    expect(found.map((c) => c.kind)).toContain("phone");
  });

  it("flags an unfamiliar capitalised word as a possible name", () => {
    const found = redactionCandidates("I was talking to Marcus about it.", ["Sam"]);
    expect(found.some((c) => c.kind === "name" && c.text === "Marcus")).toBe(true);
  });

  it("does not flag the scenario's own characters", () => {
    const found = redactionCandidates("I asked Sam about the project.", ["Sam"]);
    expect(found.some((c) => c.text === "Sam")).toBe(false);
  });

  it("does not flag a word that is capitalised only because it starts a sentence", () => {
    const found = redactionCandidates("Really it was fine. Anyway we moved on.", []);
    expect(found.some((c) => c.kind === "name")).toBe(false);
  });

  it("does not flag weekdays and months as people", () => {
    const found = redactionCandidates("We met on Tuesday in March about it.", []);
    expect(found.some((c) => c.kind === "name")).toBe(false);
  });

  it("replaces every occurrence when a redaction is applied", () => {
    expect(applyRedactions("Marcus said Marcus would do it.", ["Marcus"])).toBe("[removed] said [removed] would do it.");
  });
});

describe("preparing a donation", () => {
  it("shows exactly what would be sent, with redactions already applied", () => {
    const preview = prepareDonation(sim([
      ["user", "I was chatting to Marcus about the move."],
      ["character", "Oh really, how did that go?"],
    ]), ["Marcus"]);
    expect(preview.turns[0]?.text).toBe("I was chatting to [removed] about the move.");
    expect(preview.candidates.some((c) => c.text === "Marcus")).toBe(false);
  });

  it("carries the warnings about what redaction cannot do", () => {
    const preview = prepareDonation(sim([["user", "Hello."]]));
    expect(preview.warnings.join(" ")).toContain("will miss things");
    expect(preview.warnings.join(" ")).toContain("identify you by what it describes");
  });

  it("includes nothing that could link the donation back to a person", () => {
    const donated = donate(prepareDonation(sim([["user", "Hello."]])), "d1", "2026-08-14T00:00:00.000Z");
    const keys = Object.keys(donated);
    expect(keys).not.toContain("userId");
    expect(keys).not.toContain("simulationId");
    // Turns carry text and speaker only — no timings, no voice metrics, no ids.
    expect(Object.keys(donated.turns[0] ?? {}).sort()).toEqual(["speaker", "text"]);
  });

  it("records the consent wording that was actually shown", () => {
    const donated = donate(prepareDonation(sim([["user", "Hi."]])), "d1", "2026-08-14T00:00:00.000Z");
    expect(donated.consent.consentVersion).toBeTruthy();
    expect(CONSENT_TERMS.join(" ")).toContain("You can withdraw it at any time");
  });
});

describe("withdrawal", () => {
  it("marks a donation withdrawn and stops it counting", () => {
    const donated = donate(prepareDonation(sim([["user", "Hi."]])), "d1", "2026-08-14T00:00:00.000Z");
    expect(isActive(donated)).toBe(true);
    const gone = withdraw(donated, "2026-08-15T00:00:00.000Z");
    expect(isActive(gone)).toBe(false);
    expect(gone.consent.withdrawnAt).toBe("2026-08-15T00:00:00.000Z");
  });
});

describe("evaluator agreement", () => {
  const rating = (transcriptId: Id, raterId: string, key: BehaviourKey, score: number) => ({
    transcriptId, raterId, at: "2026-08-14T00:00:00.000Z", ratings: [{ key, score }],
  });

  function corpusWith(ratings: RatedCorpus["ratings"]): RatedCorpus {
    return {
      transcripts: [donate(prepareDonation(sim([["user", "Hi."]])), "d1", "2026-08-14T00:00:00.000Z")],
      ratings,
    };
  }

  it("says plainly when nothing has been checked", () => {
    const result = evaluatorAgreement(emptyRatedCorpus(), new Map());
    expect(result.compared).toBe(0);
    expect(result.note).toContain("has not been checked against human judgement");
  });

  it("ignores a transcript with only one rater", () => {
    const corpus = corpusWith([rating("d1", "r1", "clarity", 0.8)]);
    const computed = new Map([["d1", [{ key: "clarity" as BehaviourKey, score: 0.5 }]]]);
    expect(evaluatorAgreement(corpus, computed).compared).toBe(0);
  });

  it("ignores a behaviour the raters themselves disagree about", () => {
    // Rater disagreement means the behaviour is not well enough defined to be
    // a reference; scoring against it would measure noise.
    const corpus = corpusWith([
      rating("d1", "r1", "clarity", 0.9),
      rating("d1", "r2", "clarity", 0.2),
    ]);
    const computed = new Map([["d1", [{ key: "clarity" as BehaviourKey, score: 0.5 }]]]);
    expect(evaluatorAgreement(corpus, computed).compared).toBe(0);
  });

  it("measures error against two agreeing raters", () => {
    const corpus = corpusWith([
      rating("d1", "r1", "clarity", 0.8),
      rating("d1", "r2", "clarity", 0.7),
    ]);
    const computed = new Map([["d1", [{ key: "clarity" as BehaviourKey, score: 0.5 }]]]);
    const result = evaluatorAgreement(corpus, computed);
    expect(result.compared).toBe(1);
    expect(result.meanAbsoluteError).toBeCloseTo(0.25, 2);
    expect(result.worst[0]?.key).toBe("clarity");
  });

  it("excludes a withdrawn transcript from the comparison", () => {
    const base = corpusWith([
      rating("d1", "r1", "clarity", 0.8),
      rating("d1", "r2", "clarity", 0.75),
    ]);
    const corpus: RatedCorpus = {
      ...base,
      transcripts: base.transcripts.map((t) => withdraw(t, "2026-08-15T00:00:00.000Z")),
    };
    const computed = new Map([["d1", [{ key: "clarity" as BehaviourKey, score: 0.5 }]]]);
    expect(evaluatorAgreement(corpus, computed).compared).toBe(0);
  });
});

describe("corpus eligibility", () => {
  it("refuses an empty corpus", () => {
    const result = ratedCorpusEligibility(emptyRatedCorpus());
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toContain("0 donated transcripts");
  });
});

describe("scrubContactDetails", () => {
  it("removes emails, phones, urls and postcodes unconditionally", () => {
    const { text, removed } = scrubContactDetails(
      "Write to jane.doe@example.com or call +44 20 7946 0958; details at https://example.org/invite, SW1A 1AA.",
    );
    expect(removed).toBe(4);
    expect(text).not.toContain("@");
    expect(text).not.toContain("7946");
    expect(text).not.toContain("example.org");
    expect(text).not.toContain("SW1A");
    expect(text).toContain("[removed]");
  });

  it("leaves ordinary sentences untouched", () => {
    const original = "They moved house in March and the commute is longer now.";
    const { text, removed } = scrubContactDetails(original);
    expect(text).toBe(original);
    expect(removed).toBe(0);
  });
});
