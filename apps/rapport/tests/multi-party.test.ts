import { describe, expect, it } from "vitest";
import { scoreTranscript } from "@/domain/evaluation";
import { rebuildMemory } from "@/domain/simulator";
import { MULTI_PARTY_BEHAVIOURS } from "@/domain/types";
import type { BehaviourKey, SimulatedCharacter, Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

function person(id: string, name: string, style: SimulatedCharacter["style"], background: string[] = []): SimulatedCharacter {
  return { id, name, style, role: "a colleague", background, interests: [], openness: 0.5, reciprocity: 0.5 };
}

const SAM = person("ch.sam", "Sam", "quiet", ["I was on the Bristol project last year."]);
const ALEX = person("ch.alex", "Alex", "talkative", ["We shipped the migration in March."]);
const PRIYA = person("ch.priya", "Priya", "direct");

function scenario(characters: SimulatedCharacter[], criteria: BehaviourKey[] = []): SimulationScenario {
  return {
    id: "sc.g", title: "Group", context: "A team room.", skillIds: [], objective: "Take part.",
    difficulty: 3, characters, branches: [], evaluationCriteria: criteria,
  };
}

function sim(sc: SimulationScenario, spec: [speaker: "user" | string, text: string][]): Simulation {
  const turns: SimulationTurn[] = spec.map(([who, text], index) => ({
    id: `t${index}`, simulationId: "s1", index,
    speaker: who === "user" ? "user" : "character",
    characterId: who === "user" ? undefined : who,
    text,
    createdAt: new Date(Date.UTC(2026, 0, 1, 9, index)).toISOString(),
  }));
  return {
    id: "s1", userId: "u1", scenarioId: sc.id, scenario: sc, mode: "text",
    startedAt: new Date(Date.UTC(2026, 0, 1, 9)).toISOString(),
    deliveredDifficulty: 3, assistLevel: "none", turns,
  };
}

const scoreFor = (s: Simulation, key: BehaviourKey) => scoreTranscript(s).find((x) => x.key === key);

describe("group behaviours only apply to groups", () => {
  it("does not score inclusion or floor entry in a one-to-one conversation", () => {
    // The important guarantee: a two-person chat must not manufacture a
    // weakness in a behaviour it had no way of displaying.
    const s = sim(scenario([SAM]), [
      ["user", "How did the Bristol project go in the end?"],
      ["ch.sam", "Slower than we wanted."],
      ["user", "What slowed it down most?"],
      ["ch.sam", "Procurement, mostly."],
    ]);
    const keys = scoreTranscript(s).map((x) => x.key);
    for (const key of MULTI_PARTY_BEHAVIOURS) expect(keys).not.toContain(key);
  });

  it("scores them once there is more than one other person", () => {
    const s = sim(scenario([SAM, ALEX]), [
      ["user", "Alex, how did the migration go?"],
      ["ch.alex", "Painful but it shipped."],
      ["user", "Sam, was it the same on Bristol?"],
      ["ch.sam", "Bit worse, actually."],
    ]);
    const keys = scoreTranscript(s).map((x) => x.key);
    for (const key of MULTI_PARTY_BEHAVIOURS) expect(keys).toContain(key);
  });
});

describe("inclusion", () => {
  it("scores low and says who was left out when one person is ignored", () => {
    const s = sim(scenario([SAM, ALEX]), [
      ["user", "Alex, how did the migration go?"],
      ["ch.alex", "Painful but it shipped."],
      ["user", "Alex, and what's next for it?"],
      ["ch.alex", "More of the same."],
      ["user", "Alex, sounds relentless."],
      ["ch.alex", "It is."],
    ]);
    const score = scoreFor(s, "inclusion")!;
    expect(score.score).toBeLessThan(0.45);
    expect(score.evidence).toContain("1 of 2");
    expect(score.evidence).toContain("never spoke and were never asked");
  });

  it("scores well when everyone is brought in by name", () => {
    const s = sim(scenario([SAM, ALEX, PRIYA]), [
      ["user", "Alex, how did the migration go?"],
      ["ch.alex", "Painful but it shipped."],
      ["user", "Sam, was Bristol similar?"],
      ["ch.sam", "Bit worse."],
      ["user", "Priya, does that match what you saw?"],
      ["ch.priya", "Broadly, yes."],
    ]);
    const score = scoreFor(s, "inclusion")!;
    expect(score.score).toBeGreaterThan(0.9);
    expect(score.evidence).toContain("3 of 3");
  });

  it("marks the worst case with high severity and names it plainly", () => {
    const s = sim(scenario([SAM, ALEX]), [
      ["user", "So what's everyone been up to?"],
      ["ch.alex", "Not much."],
      ["user", "Fair enough."],
      ["ch.alex", "You?"],
    ]);
    const score = scoreFor(s, "inclusion")!;
    expect(score.evidence).toContain("did not bring in any");
    expect(score.severity).toBe(1);
  });
});

describe("floor entry", () => {
  it("credits coming in while the group holds the floor", () => {
    const s = sim(scenario([SAM, ALEX]), [
      ["ch.alex", "So the whole thing slipped again."],
      ["ch.sam", "Same as last quarter."],
      ["user", "Can I pick up on that — we saw it too."],
      ["ch.alex", "Go on."],
      ["ch.sam", "Yeah, when?"],
      ["user", "March, same window as yours."],
    ]);
    const score = scoreFor(s, "floorEntry")!;
    expect(score.score).toBeGreaterThan(0.5);
    expect(score.evidence).toContain("came in unprompted");
  });

  it("does not penalise the user when the group never held the floor", () => {
    // Nothing was demonstrated either way, so this must be unreliable rather
    // than a low score that would feed the mastery model.
    const s = sim(scenario([SAM, ALEX]), [
      ["ch.alex", "How's your week?"],
      ["user", "Busy, but fine."],
      ["ch.sam", "Same here?"],
      ["user", "More or less."],
    ]);
    const score = scoreFor(s, "floorEntry")!;
    expect(score.reliable).toBe(false);
    expect(score.evidence).toContain("never talked among themselves");
  });
});

describe("group memory", () => {
  it("disengages a character the user never addresses", () => {
    // Attention has to cost something, or "include the quiet one" is advice
    // with no mechanism behind it.
    const s = sim(scenario([SAM, ALEX]), [
      ["ch.alex", "We shipped the migration in March."],
      ["user", "Alex, that sounds like it was a long haul for you."],
      ["ch.alex", "It really was."],
      ["user", "Alex, what was the worst part of it?"],
      ["ch.alex", "The rollback plan."],
      ["user", "Alex, that makes sense given the timeline."],
    ]);
    const memories = rebuildMemory(s);
    const alex = memories.get("ch.alex")!;
    const sam = memories.get("ch.sam")!;
    expect(alex.engagement).toBeGreaterThan(sam.engagement);
    expect(alex.timesAddressed).toBe(3);
    expect(sam.timesAddressed).toBe(0);
    expect(sam.turnsSinceAddressed).toBe(3);
  });

  it("lets each character hear what the others said", () => {
    const s = sim(scenario([SAM, ALEX]), [
      ["ch.alex", "We shipped the migration in March."],
      ["user", "Sam, were you on that?"],
      ["ch.sam", "I was on Bristol instead."],
    ]);
    const memories = rebuildMemory(s);
    const sam = memories.get("ch.sam")!;
    const alex = memories.get("ch.alex")!;
    expect(sam.heardFromOthers.map((h) => h.characterId)).toContain("ch.alex");
    expect(alex.heardFromOthers.map((h) => h.characterId)).toContain("ch.sam");
    // A character does not "hear" themselves into their own cross-reference log.
    expect(sam.heardFromOthers.every((h) => h.characterId !== "ch.sam")).toBe(true);
  });

  it("leaves one-to-one engagement behaviour unchanged", () => {
    // The group damping must not alter how existing solo scenarios behave.
    const s = sim(scenario([SAM]), [
      ["ch.sam", "I was on the Bristol project last year."],
      ["user", "That sounds like it was a difficult one to be on."],
    ]);
    const sam = rebuildMemory(s).get("ch.sam")!;
    expect(sam.engagement).toBeGreaterThan(0.5);
  });
});
