import { describe, expect, it } from "vitest";
import {
  addressee,
  bidsFor,
  floorSnapshot,
  isMultiParty,
  maxConsecutiveCharacterTurns,
  namesAddressed,
  nextSpeaker,
  participation,
} from "@/domain/floor";
import { newMemory } from "@/domain/simulator";
import type { CharacterMemory } from "@/domain/simulator";
import type { Id, SimulatedCharacter, Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

function character(id: string, name: string, style: SimulatedCharacter["style"], extra: Partial<SimulatedCharacter> = {}): SimulatedCharacter {
  return {
    id,
    name,
    style,
    role: "a colleague",
    background: [],
    interests: [],
    openness: 0.5,
    reciprocity: 0.5,
    ...extra,
  };
}

function scenarioWith(characters: SimulatedCharacter[]): SimulationScenario {
  return {
    id: "sc.test",
    title: "Test",
    context: "A room.",
    skillIds: [],
    objective: "Talk.",
    difficulty: 3,
    characters,
    branches: [],
    evaluationCriteria: [],
  };
}

function sim(scenario: SimulationScenario, spec: [speaker: "user" | Id, text: string][]): Simulation {
  const turns: SimulationTurn[] = spec.map(([who, text], index) => ({
    id: `t${index}`,
    simulationId: "s1",
    index,
    speaker: who === "user" ? "user" : "character",
    characterId: who === "user" ? undefined : who,
    text,
    createdAt: new Date(Date.UTC(2026, 0, 1, 9, index)).toISOString(),
  }));
  return {
    id: "s1",
    userId: "u1",
    scenarioId: scenario.id,
    scenario,
    mode: "text",
    startedAt: new Date(Date.UTC(2026, 0, 1, 9)).toISOString(),
    deliveredDifficulty: scenario.difficulty,
    assistLevel: "none",
    turns,
  };
}

function memoriesFor(scenario: SimulationScenario, engagement = 0.5): Map<Id, CharacterMemory> {
  return new Map(scenario.characters.map((c) => [c.id, { ...newMemory(c), engagement }]));
}

const SAM = character("ch.sam", "Sam", "quiet", { reciprocity: 0.2 });
const ALEX = character("ch.alex", "Alex", "talkative", { reciprocity: 0.6 });
const PRIYA = character("ch.priya", "Priya", "direct");

describe("addressing", () => {
  const scenario = scenarioWith([SAM, ALEX]);

  it("routes a named question to that character", () => {
    expect(addressee("What do you reckon, Sam?", scenario, true)).toBe("ch.sam");
  });

  it("treats an unnamed character question as aimed at the user", () => {
    expect(addressee("So how was your weekend?", scenario, false)).toBe("user");
  });

  it("does not treat an unnamed user statement as addressing anyone", () => {
    expect(addressee("That sounds difficult.", scenario, true)).toBeNull();
  });

  it("collects every name the user brought in", () => {
    expect(namesAddressed("Sam, did you see what Alex sent?", scenario)).toEqual(["ch.sam", "ch.alex"]);
  });
});

describe("floor snapshot", () => {
  const scenario = scenarioWith([SAM, ALEX]);

  it("counts character turns since the user last spoke", () => {
    const s = floorSnapshot(sim(scenario, [
      ["user", "Morning."],
      ["ch.alex", "Morning! Long week."],
      ["ch.sam", "Mm."],
    ]));
    expect(s.consecutiveCharacterTurns).toBe(2);
    expect(s.lastSpeaker).toBe("ch.sam");
  });

  it("resets the exclusion counter when the user speaks", () => {
    const s = floorSnapshot(sim(scenario, [
      ["ch.alex", "So anyway."],
      ["ch.sam", "Right."],
      ["user", "Can I ask something?"],
    ]));
    expect(s.consecutiveCharacterTurns).toBe(0);
  });

  it("reports characters who have never spoken", () => {
    const s = floorSnapshot(sim(scenario, [["ch.alex", "Hello."]]));
    expect(s.silent).toEqual(["ch.sam"]);
  });

  it("handles an empty transcript", () => {
    const s = floorSnapshot(sim(scenario, []));
    expect(s.lastSpeaker).toBeNull();
    expect(s.userTurnShare).toBe(0);
  });
});

describe("turn allocation", () => {
  const scenario = scenarioWith([SAM, ALEX, PRIYA]);
  const always = () => 0.999;
  const never = () => 0;

  it("gives the floor to the user when they are asked directly", () => {
    const state = floorSnapshot(sim(scenario, [["ch.alex", "What did you think of it?"]]));
    const next = nextSpeaker(scenario, memoriesFor(scenario), state, 3, always);
    expect(next.speaker).toBe("user");
    expect(next.invited).toBe(true);
  });

  it("answers a character who was named rather than picking someone else", () => {
    const state = floorSnapshot(sim(scenario, [["user", "Sam, what do you think?"]]));
    const next = nextSpeaker(scenario, memoriesFor(scenario), state, 3, always);
    expect(next.speaker).toBe("ch.sam");
  });

  it("returns the floor to the user once the group has held it long enough", () => {
    // Difficulty 3 allows three consecutive character turns; the fourth is the
    // user's, invited or not.
    const state = floorSnapshot(sim(scenario, [
      ["ch.alex", "One."],
      ["ch.priya", "Two."],
      ["ch.sam", "Three."],
    ]));
    const next = nextSpeaker(scenario, memoriesFor(scenario), state, 3, never);
    expect(next.speaker).toBe("user");
    expect(next.invited).toBe(false);
    expect(next.reason).toContain("come in");
  });

  it("never excludes the user at the lowest difficulty", () => {
    // Preserves the behaviour existing one-to-one scenarios rely on.
    expect(maxConsecutiveCharacterTurns(1)).toBe(1);
    const state = floorSnapshot(sim(scenario, [["ch.alex", "Something."]]));
    const next = nextSpeaker(scenario, memoriesFor(scenario), state, 1, never);
    expect(next.speaker).toBe("user");
  });

  it("lets the group hold the floor longer as difficulty rises", () => {
    expect(maxConsecutiveCharacterTurns(2)).toBe(2);
    expect(maxConsecutiveCharacterTurns(3)).toBe(3);
    expect(maxConsecutiveCharacterTurns(5)).toBe(4);
  });

  it("does not hand the floor back to whoever just spoke", () => {
    const state = floorSnapshot(sim(scenario, [["user", "Hi all."], ["ch.alex", "Hello."]]));
    const bids = bidsFor(scenario, memoriesFor(scenario), state, 3);
    const alex = bids.find((b) => b.characterId === "ch.alex")!;
    const priya = bids.find((b) => b.characterId === "ch.priya")!;
    expect(alex.weight).toBeLessThan(priya.weight);
    expect(alex.reasons).toContain("just spoke");
  });

  it("weights a talkative character above a quiet one", () => {
    const state = floorSnapshot(sim(scenario, [["user", "Hi all."]]));
    const bids = bidsFor(scenario, memoriesFor(scenario), state, 3);
    const alex = bids.find((b) => b.characterId === "ch.alex")!;
    const sam = bids.find((b) => b.characterId === "ch.sam")!;
    expect(alex.weight).toBeGreaterThan(sam.weight);
  });

  it("raises a disengaged character's bid less than an engaged one's", () => {
    const state = floorSnapshot(sim(scenario, [["user", "Hi all."]]));
    const engaged = bidsFor(scenario, memoriesFor(scenario, 0.9), state, 3);
    const flat = bidsFor(scenario, memoriesFor(scenario, 0.1), state, 3);
    const of = (bids: ReturnType<typeof bidsFor>, id: string) => bids.find((b) => b.characterId === id)!.weight;
    expect(of(engaged, "ch.sam")).toBeGreaterThan(of(flat, "ch.sam"));
  });

  it("copes with a scenario that has no characters", () => {
    const empty = scenarioWith([]);
    const next = nextSpeaker(empty, new Map(), floorSnapshot(sim(empty, [])), 3, always);
    expect(next.speaker).toBe("user");
  });
});

describe("participation", () => {
  const scenario = scenarioWith([SAM, ALEX]);

  it("reports who the user never brought in", () => {
    const p = participation(sim(scenario, [
      ["user", "Alex, how did the demo go?"],
      ["ch.alex", "Fine, mostly."],
      ["user", "Alex, did they ask about pricing?"],
      ["ch.alex", "They did."],
    ]));
    expect(p.neverAddressed.map((c) => c.name)).toEqual(["Sam"]);
    expect(p.attentionBalance).toBe(0);
  });

  it("scores balanced attention as balanced", () => {
    const p = participation(sim(scenario, [
      ["user", "Alex, how did it go?"],
      ["ch.alex", "Fine."],
      ["user", "Sam, what did you make of it?"],
      ["ch.sam", "Mm."],
    ]));
    expect(p.attentionBalance).toBe(1);
    expect(p.neverAddressed).toEqual([]);
  });

  it("measures the longest stretch the user stayed out of", () => {
    const p = participation(sim(scenario, [
      ["user", "Hi."],
      ["ch.alex", "One."],
      ["ch.sam", "Two."],
      ["ch.alex", "Three."],
      ["user", "Sorry — can I say something?"],
    ]));
    expect(p.longestExclusion).toBe(3);
  });

  it("treats a one-to-one scenario as perfectly balanced", () => {
    const solo = scenarioWith([SAM]);
    const p = participation(sim(solo, [["user", "Hello."], ["ch.sam", "Hi."]]));
    expect(p.attentionBalance).toBe(1);
    expect(isMultiParty(solo)).toBe(false);
  });
});
