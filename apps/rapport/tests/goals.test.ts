import { describe, expect, it } from "vitest";
import {
  advanceGoal,
  cueMetBy,
  describeOutcome,
  goalOutcomes,
  goalPressure,
  inLiveConflict,
  liveConflicts,
  matchesPhrasing,
  newGoalState,
} from "@/domain/goals";
import { applyPlan, newMemory, planTurn, rebuildMemory, seededRng, updateEngagement } from "@/domain/simulator";
import { bidsFor, floorSnapshot } from "@/domain/floor";
import { evaluateSimulation } from "@/domain/evaluation";
import { SCENARIOS, atDifficulty, getScenario } from "@/domain/scenarios";
import type {
  CharacterGoal,
  Id,
  SimulatedCharacter,
  Simulation,
  SimulationScenario,
  SimulationTurn,
} from "@/domain/types";

// --- Fixtures --------------------------------------------------------------

const MOVABLE: CharacterGoal = {
  id: "g.date",
  want: "the date held",
  intensity: 0.8,
  movedBy: {
    cues: [
      { id: "heard", label: "said the date is the fixed part", phrasings: ["the date is fixed", "keep the date"] },
      { id: "cut", label: "named something that could come out", phrasings: ["we could drop", "leave out"] },
    ],
    required: 2,
    concession: "She agrees to a smaller first release.",
  },
};

const FIXED: CharacterGoal = { id: "g.fixed", want: "the decision reversed", intensity: 0.9 };

function character(id: string, name: string, extra: Partial<SimulatedCharacter> = {}): SimulatedCharacter {
  return {
    id,
    name,
    style: "direct",
    role: "a colleague",
    background: ["Something happened."],
    interests: ["running"],
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
    evaluationCriteria: ["clarity"],
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

// --- Cue matching ----------------------------------------------------------

describe("cue matching", () => {
  it("matches a phrasing whose words are reordered or padded", () => {
    expect(matchesPhrasing("honestly the date is completely fixed for us", "the date is fixed")).toBe(true);
    expect(matchesPhrasing("I know we have to keep that date", "keep the date")).toBe(true);
  });

  it("requires every significant word, so one shared word is not a match", () => {
    // "date" alone would let almost any turn about scheduling count.
    expect(matchesPhrasing("what date were you thinking", "the date is fixed")).toBe(false);
  });

  it("ignores punctuation and case", () => {
    expect(matchesPhrasing("Right — the DATE is fixed, then.", "the date is fixed")).toBe(true);
  });

  it("returns the first cue a turn meets", () => {
    const cues = MOVABLE.movedBy!.cues;
    expect(cueMetBy("we could drop the second phase", cues)?.id).toBe("cut");
    expect(cueMetBy("nothing relevant here", cues)).toBeNull();
  });
});

// --- Advancing and conceding ----------------------------------------------

describe("advancing a goal", () => {
  it("moves the character only once every required need is met", () => {
    let state = newGoalState(MOVABLE);
    state = advanceGoal(state, MOVABLE, "I know the date is fixed.");
    expect(state.satisfied).toBe(false);
    expect(state.cuesMet).toEqual(["heard"]);

    state = advanceGoal(state, MOVABLE, "So we could drop the reporting piece.");
    expect(state.satisfied).toBe(true);
    expect(state.justConceded).toBe(true);
  });

  it("does not count the same need twice", () => {
    let state = newGoalState(MOVABLE);
    state = advanceGoal(state, MOVABLE, "the date is fixed");
    state = advanceGoal(state, MOVABLE, "again, the date is fixed");
    expect(state.cuesMet).toEqual(["heard"]);
    expect(state.satisfied).toBe(false);
  });

  it("never moves a fixed position, however well the user does", () => {
    let state = newGoalState(FIXED);
    for (const turn of ["I completely understand", "the date is fixed", "we could drop everything"]) {
      state = advanceGoal(state, FIXED, turn);
    }
    expect(state.satisfied).toBe(false);
    expect(state.cuesMet).toEqual([]);
  });

  it("keeps a pending concession until the character actually speaks", () => {
    // In a group the person just satisfied may not have the next turn, and
    // clearing the flag on the next user turn would swallow the concession.
    let state = newGoalState(MOVABLE);
    state = advanceGoal(state, MOVABLE, "the date is fixed");
    state = advanceGoal(state, MOVABLE, "we could drop the reporting piece");
    expect(state.justConceded).toBe(true);
    state = advanceGoal(state, MOVABLE, "some unrelated later turn");
    expect(state.justConceded).toBe(true);
  });
});

describe("goal pressure", () => {
  it("falls once the character has been partly heard, and to zero once satisfied", () => {
    const fresh = newGoalState(MOVABLE);
    const partway = advanceGoal(fresh, MOVABLE, "the date is fixed");
    const done = advanceGoal(partway, MOVABLE, "we could drop the reporting piece");

    expect(goalPressure(MOVABLE, partway)).toBeLessThan(goalPressure(MOVABLE, fresh));
    expect(goalPressure(MOVABLE, done)).toBe(0);
  });

  it("is zero for a character with no goal at all", () => {
    expect(goalPressure(undefined, undefined)).toBe(0);
  });
});

// --- The simulator ---------------------------------------------------------

describe("goals in the simulator", () => {
  const withGoal = character("ch.p", "Priya", { goal: MOVABLE });

  it("gives a character with a goal somewhere to start from", () => {
    expect(newMemory(withGoal).goalState?.goalId).toBe("g.date");
    expect(newMemory(character("ch.q", "Quinn")).goalState).toBeUndefined();
  });

  it("advances the goal from what the user said", () => {
    const memory = updateEngagement(newMemory(withGoal), "I know the date is fixed.", null, { goal: MOVABLE });
    expect(memory.goalState?.cuesMet).toEqual(["heard"]);
  });

  it("warms a character up for being heard on the thing they came about", () => {
    const heard = updateEngagement(newMemory(withGoal), "I know the date is fixed.", null, { goal: MOVABLE });
    const notHeard = updateEngagement(newMemory(withGoal), "I know the diary is full.", null, { goal: MOVABLE });
    expect(heard.engagement).toBeGreaterThan(notHeard.engagement);
  });

  it("concedes on the next turn after being satisfied, and only once", () => {
    let memory = newMemory(withGoal);
    memory = updateEngagement(memory, "the date is fixed", null, { goal: MOVABLE });
    memory = updateEngagement(memory, "we could drop the reporting piece", null, { goal: MOVABLE });

    const plan = planTurn(withGoal, memory, 4, 3, seededRng("seed"));
    expect(plan.intent).toBe("concede");
    expect(plan.concession).toContain("smaller first release");

    memory = applyPlan(memory, plan);
    const next = planTurn(withGoal, memory, 5, 3, seededRng("seed"));
    expect(next.intent).not.toBe("concede");
  });

  it("presses an unmet goal rather than winding down", () => {
    // Turn 12 would otherwise be a wind-down; someone with an unresolved
    // agenda does not decide the conversation is over.
    const plan = planTurn(withGoal, newMemory(withGoal), 13, 3, seededRng("seed"));
    expect(plan.intent).toBe("press-goal");
    expect(plan.goalWant).toBe("the date held");
  });

  it("leaves a character with no goal behaving exactly as before", () => {
    const plain = character("ch.q", "Quinn");
    const plan = planTurn(plain, newMemory(plain), 3, 3, seededRng("seed"));
    expect(["press-goal", "concede"]).not.toContain(plan.intent);
  });

  it("rebuilds goal progress from the transcript", () => {
    const scenario = scenarioWith([withGoal]);
    const memories = rebuildMemory(
      sim(scenario, [
        ["user", "I know the date is fixed."],
        ["ch.p", "Right."],
        ["user", "So we could drop the reporting piece."],
      ]),
    );
    expect(memories.get("ch.p")?.goalState?.satisfied).toBe(true);
  });

  it("counts a push so impatience decays", () => {
    const memory = newMemory(withGoal);
    const plan = planTurn(withGoal, memory, 13, 3, seededRng("seed"));
    expect(applyPlan(memory, plan).goalState?.pushes).toBe(1);
  });
});

// --- Conflict --------------------------------------------------------------

describe("conflicting goals", () => {
  const goalA: CharacterGoal = { ...MOVABLE, id: "g.a", conflictsWith: ["g.b"] };
  const goalB: CharacterGoal = { id: "g.b", want: "the work kept whole", intensity: 0.7 };
  const a = character("ch.a", "Ana", { goal: goalA });
  const b = character("ch.b", "Ben", { goal: goalB });

  it("finds a pair whose goals are opposed", () => {
    const conflicts = liveConflicts([a, b], () => undefined);
    expect(conflicts).toHaveLength(1);
    expect(inLiveConflict("ch.a", conflicts)).toBe(true);
  });

  it("stops staging the argument once one side is satisfied", () => {
    // A user who brokered a compromise should not watch the same two people
    // keep fighting about it.
    const satisfied = { ...newGoalState(goalA), satisfied: true };
    expect(liveConflicts([a, b], (id) => (id === "ch.a" ? satisfied : undefined))).toEqual([]);
  });

  it("is not triggered by two characters who merely both want something", () => {
    const unrelated = character("ch.c", "Cass", { goal: { id: "g.c", want: "a quiet meeting", intensity: 0.5 } });
    expect(liveConflicts([a, unrelated], () => undefined)).toEqual([]);
  });

  it("makes an opponent bid harder for the floor right after the other side speaks", () => {
    const scenario = scenarioWith([a, b]);
    const memories = new Map([
      ["ch.a", newMemory(a)],
      ["ch.b", newMemory(b)],
    ]);
    const weightOf = (spec: [speaker: "user" | Id, text: string][]) =>
      bidsFor(scenario, memories, floorSnapshot(sim(scenario, spec)), 4).find((bid) => bid.characterId === "ch.b")!
        .weight;

    const provoked = weightOf([
      ["user", "Where are we on this?"],
      ["ch.a", "I still need the date held."],
    ]);
    const unprovoked = weightOf([["user", "Hello."]]);

    // This is what turns a written-down disagreement into one happening in the
    // room: Ben answers Ana whether or not the user says anything.
    expect(provoked).toBeGreaterThan(unprovoked * 1.5);
  });

  it("gives a character with an unmet goal a louder claim on the floor than one without", () => {
    const plain = character("ch.c", "Cass");
    const scenario = scenarioWith([a, plain]);
    const memories = new Map([
      ["ch.a", newMemory(a)],
      ["ch.c", newMemory(plain)],
    ]);
    const bids = bidsFor(scenario, memories, floorSnapshot(sim(scenario, [["user", "Where are we?"]])), 4);
    const withGoal = bids.find((bid) => bid.characterId === "ch.a")!;
    const without = bids.find((bid) => bid.characterId === "ch.c")!;
    expect(withGoal.weight).toBeGreaterThan(without.weight);
    expect(withGoal.reasons).toContain("has a point to make");
  });
});

// --- Reporting -------------------------------------------------------------

describe("goal outcomes", () => {
  const withGoal = character("ch.p", "Priya", { goal: MOVABLE });
  const fixed = character("ch.f", "Frank", { goal: FIXED });

  it("tells the user what someone wanted even when they never found it", () => {
    const outcome = goalOutcomes([withGoal], () => newGoalState(MOVABLE))[0]!;
    expect(outcome.moved).toBe(false);
    expect(outcome.want).toBe("the date held");
    expect(describeOutcome(outcome)).toContain("It never came up");
  });

  it("says plainly when a position could never have been shifted", () => {
    const outcome = goalOutcomes([fixed], () => newGoalState(FIXED))[0]!;
    expect(outcome.movable).toBe(false);
    // A user who spent the session failing to move someone deserves to know
    // the position was fixed rather than conclude they handled it badly.
    expect(describeOutcome(outcome)).toContain("That position was fixed");
  });

  it("names what actually moved someone", () => {
    let state = newGoalState(MOVABLE);
    state = advanceGoal(state, MOVABLE, "the date is fixed");
    state = advanceGoal(state, MOVABLE, "we could drop the reporting piece");
    const outcome = goalOutcomes([withGoal], () => state)[0]!;
    expect(outcome.moved).toBe(true);
    expect(describeOutcome(outcome)).toContain("said the date is the fixed part");
  });

  it("reports partial progress as partial", () => {
    const state = advanceGoal(newGoalState(MOVABLE), MOVABLE, "the date is fixed");
    expect(describeOutcome(goalOutcomes([withGoal], () => state)[0]!)).toContain("part of the way");
  });

  it("puts outcomes in the debrief without touching the behaviour scores", () => {
    const scenario = scenarioWith([withGoal]);
    const conversation = sim(scenario, [
      ["user", "I know the date is fixed."],
      ["ch.p", "Right."],
      ["user", "So we could drop the reporting piece."],
      ["ch.p", "Alright — that's what I needed to hear."],
    ]);
    const evaluation = evaluateSimulation(conversation, "ev1", "2026-01-01T10:00:00.000Z");
    expect(evaluation.goalOutcomes?.[0]?.moved).toBe(true);
    // Goal keys are not behaviour keys: a concession depends on how the
    // scenario was written as much as on the user, so it stays out of mastery.
    for (const score of evaluation.scores) expect(score.key).not.toContain("goal");
  });

  it("omits the section entirely for a scenario whose characters want nothing", () => {
    const scenario = scenarioWith([character("ch.q", "Quinn")]);
    const evaluation = evaluateSimulation(sim(scenario, [["user", "Hi."]]), "ev2", "2026-01-01T10:00:00.000Z");
    expect(evaluation.goalOutcomes).toBeUndefined();
  });
});

// --- Content ---------------------------------------------------------------

describe("scenarios with goals", () => {
  const goalScenarios = SCENARIOS.filter((scenario) => scenario.characters.some((c) => c.goal));

  it("ships scenarios that need one", () => {
    expect(goalScenarios.length).toBeGreaterThanOrEqual(4);
  });

  it("gives every movable goal reachable cues and a stated concession", () => {
    for (const scenario of goalScenarios) {
      for (const item of scenario.characters) {
        if (!item.goal?.movedBy) continue;
        const { cues, required, concession } = item.goal.movedBy;
        expect(cues.length, `${scenario.id}/${item.name}`).toBeGreaterThanOrEqual(required);
        expect(concession.length, `${scenario.id}/${item.name}`).toBeGreaterThan(10);
        for (const cue of cues) {
          expect(cue.phrasings.length, `${scenario.id}/${cue.id}`).toBeGreaterThan(0);
          // A phrasing with no significant words could never be matched.
          for (const phrasing of cue.phrasings) {
            expect(matchesPhrasing(phrasing, phrasing), `${scenario.id}/${cue.id}: "${phrasing}"`).toBe(true);
          }
        }
      }
    }
  });

  it("points every conflictsWith at a goal that exists in the same scenario", () => {
    for (const scenario of goalScenarios) {
      const ids = new Set(scenario.characters.map((item) => item.goal?.id).filter(Boolean));
      for (const item of scenario.characters) {
        for (const opposed of item.goal?.conflictsWith ?? []) {
          expect(ids.has(opposed), `${scenario.id}: ${opposed}`).toBe(true);
        }
      }
    }
  });

  it("stages a real disagreement in the competing-needs scenario", () => {
    const scenario = getScenario("sc.competing-needs")!;
    expect(liveConflicts(scenario.characters, () => undefined)).toHaveLength(1);
  });

  it("makes a harder setting mean more insistent, not less winnable", () => {
    const scenario = getScenario("sc.competing-needs")!;
    const easy = atDifficulty(scenario, 1);
    const hard = atDifficulty(scenario, 5);
    expect(hard.characters[0]!.goal!.intensity).toBeGreaterThan(easy.characters[0]!.goal!.intensity);
    // What has to be said is the same at every level.
    expect(hard.characters[0]!.goal!.movedBy).toEqual(easy.characters[0]!.goal!.movedBy);
  });
});
