import { describe, expect, it } from "vitest";
import { detectInterruptions, summariseInterruptions } from "@/domain/interruption";
import { scoreTranscript } from "@/domain/evaluation";
import type { SimulatedCharacter, Simulation, SimulationScenario, SimulationTurn, VoiceTurnMetrics } from "@/domain/types";

const SAM: SimulatedCharacter = {
  id: "ch.sam", name: "Sam", style: "quiet", role: "a colleague",
  background: [], interests: [], openness: 0.4, reciprocity: 0.4,
};
const ALEX: SimulatedCharacter = {
  id: "ch.alex", name: "Alex", style: "talkative", role: "a colleague",
  background: [], interests: [], openness: 0.7, reciprocity: 0.6,
};

const SCENARIO: SimulationScenario = {
  id: "sc.t", title: "T", context: "A room.", skillIds: [], objective: "Talk.",
  difficulty: 3, characters: [SAM, ALEX], branches: [], evaluationCriteria: [],
};

const BASE = Date.UTC(2026, 0, 1, 9, 0, 0);

function voice(durationMs: number): VoiceTurnMetrics {
  return { durationMs, wordCount: 10, wordsPerMinute: 140, fillerCount: 0, fillerWords: [], longPauseCount: 0, longestPauseMs: 0 };
}

/** [speaker, text, startOffsetMs, durationMs?] */
type Spec = [speaker: "user" | string, text: string, startMs: number, durationMs?: number];

function sim(spec: Spec[], mode: "text" | "voice" = "voice"): Simulation {
  const turns: SimulationTurn[] = spec.map(([who, text, start, duration], index) => ({
    id: `t${index}`,
    simulationId: "s1",
    index,
    speaker: who === "user" ? "user" : "character",
    characterId: who === "user" ? undefined : who,
    text,
    createdAt: new Date(BASE + start).toISOString(),
    voice: duration === undefined ? undefined : voice(duration),
  }));
  return {
    id: "s1", userId: "u1", scenarioId: SCENARIO.id, scenario: SCENARIO, mode,
    startedAt: new Date(BASE).toISOString(), deliveredDifficulty: 3, assistLevel: "none", turns,
  };
}

describe("overlap classification", () => {
  it("treats a short supportive noise as a backchannel, not a takeover", () => {
    const events = detectInterruptions(sim([
      ["ch.alex", "So we got the whole thing rebuilt over the weekend and it finally works.", 0, 5000],
      ["user", "Yeah", 3000, 400],
    ]));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("backchannel");
    expect(events[0]?.disruptive).toBe(false);
  });

  it("calls it cooperative when the other person carries on", () => {
    const events = detectInterruptions(sim([
      ["ch.alex", "We rebuilt the whole thing over the weekend.", 0, 5000],
      ["user", "Oh that's the migration you mentioned before, right?", 4000, 2000],
      ["ch.alex", "That's the one, and it took ages.", 6500, 3000],
    ]));
    const overlap = events.find((e) => e.by === "user")!;
    expect(overlap.kind).toBe("cooperative-overlap");
    expect(overlap.disruptive).toBe(false);
  });

  it("calls it a cut-off when the other person stops", () => {
    const events = detectInterruptions(sim([
      ["ch.sam", "I was going to say that the report actually shows something different when you", 0, 6000],
      ["user", "Right but that's not what the client asked for at all.", 3000, 3000],
      ["ch.alex", "Anyway, next item.", 7000, 2000],
    ]));
    const cut = events.find((e) => e.by === "user" && e.against === "ch.sam")!;
    expect(cut.kind).toBe("cut-off");
    expect(cut.disruptive).toBe(true);
    expect(cut.overlapMs).toBe(3000);
  });

  it("detects a character cutting the user off", () => {
    const events = detectInterruptions(sim([
      ["user", "I think the timeline is the bigger risk here because we still haven't", 0, 6000],
      ["ch.alex", "The timeline's fine, it's the budget I'd worry about.", 2500, 3000],
      ["ch.sam", "Mm.", 6000, 500],
    ]));
    const cut = events.find((e) => e.against === "user")!;
    expect(cut.kind).toBe("cut-off");
    expect(cut.by).toBe("ch.alex");
  });

  it("records no overlap when turns do not actually overlap", () => {
    const events = detectInterruptions(sim([
      ["ch.alex", "How did the demo go?", 0, 2000],
      ["user", "Better than expected, thanks.", 2500, 2000],
    ]));
    // The user was asked directly, so this is not self-selection either.
    expect(events).toHaveLength(0);
  });
});

describe("self-selection", () => {
  it("counts taking the floor uninvited as a self-selection", () => {
    const events = detectInterruptions(sim([
      ["ch.alex", "So that's the plan for the quarter.", 0, 3000],
      ["user", "Can I add something about the second half?", 4000, 2000],
    ]));
    expect(events[0]?.kind).toBe("self-selection");
    expect(events[0]?.disruptive).toBe(false);
  });

  it("does not count answering a direct question as self-selection", () => {
    const events = detectInterruptions(sim([
      ["ch.alex", "What do you think?", 0, 1500],
      ["user", "I'd push the deadline.", 2000, 1500],
    ]));
    expect(events).toHaveLength(0);
  });

  it("works in text mode, where it is the only detectable kind", () => {
    const events = detectInterruptions(sim([
      ["ch.alex", "So that's the plan.", 0],
      ["user", "Can I add something?", 1000],
    ], "text"));
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("self-selection");
  });
});

describe("summary", () => {
  it("reports coming back after being cut off", () => {
    const s = summariseInterruptions(sim([
      ["user", "I think the timeline is the bigger risk because we still haven't", 0, 6000],
      ["ch.alex", "The timeline's fine.", 2500, 2000],
      ["user", "Still — I'd like to finish the point.", 5000, 2500],
    ]));
    expect(s.timesCutOff).toBe(1);
    expect(s.reclaims).toBe(1);
    expect(s.note).toContain("coming back after 1");
  });

  it("says plainly that text cannot show overlap", () => {
    const s = summariseInterruptions(sim([
      ["ch.alex", "How was your weekend?", 0],
      ["user", "Good thanks.", 1000],
    ], "text"));
    expect(s.overlapUnavailable).toBe(true);
    expect(s.note).toContain("cannot show overlap");
  });

  it("does not claim interruptions in a clean voice exchange", () => {
    const s = summariseInterruptions(sim([
      ["ch.alex", "What did you make of it?", 0, 2000],
      ["user", "Mixed, honestly.", 2500, 1500],
    ]));
    expect(s.events).toHaveLength(0);
    expect(s.note).toBe("No interruptions either way.");
  });

  it("handles an empty transcript", () => {
    expect(summariseInterruptions(sim([])).events).toEqual([]);
  });
});

describe("evaluation integration", () => {
  it("scores a reclaim only when timing supplies an interruption opportunity", () => {
    const simulation = sim([
      ["user", "I think the timeline is the bigger risk because we still haven't", 0, 6000],
      ["ch.alex", "The timeline's fine.", 2500, 2000],
      ["user", "Still — I'd like to finish the point.", 5000, 2500],
    ]);
    const score = scoreTranscript(simulation).find((item) => item.key === "interruptionHandling");
    expect(score?.reliable).toBe(true);
    expect(score?.score).toBeGreaterThan(0.5);
    expect(score?.evidenceSpans?.some((item) => item.quote.includes("finish the point"))).toBe(true);
  });
});

