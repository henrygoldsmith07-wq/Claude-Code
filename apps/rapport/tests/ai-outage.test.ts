import { describe, expect, it } from "vitest";
import { completeWithRetry } from "@/ai/provider";
import type { AiProvider } from "@/ai/provider";
import { fallbackEnvelope } from "@/ai/types";
import { evaluateSimulation } from "@/domain/evaluation";
import type { Simulation, SimulationScenario, SimulationTurn } from "@/domain/types";

// ---------------------------------------------------------------------------
// AI outage handling.
//
// The product must behave identically when the model is absent, slow, or
// erroring: deterministic scores, deterministic feedback, honest labelling.
// These tests exercise the retry/fallback path without any network.
// ---------------------------------------------------------------------------

const SCENARIO: SimulationScenario = {
  id: "sc.outage",
  title: "Outage",
  context: "A conversation.",
  skillIds: ["conv.follow-up"],
  objective: "Talk.",
  difficulty: 3,
  characters: [
    { id: "c1", name: "Sam", style: "friendly", role: "colleague", background: ["I walk most weekends."], interests: ["walking"], openness: 0.7, reciprocity: 0.5 },
  ],
  branches: [],
  evaluationCriteria: [],
};

function simulation(): Simulation {
  const lines: [speaker: "user" | "character", text: string][] = [
    ["user", "How was your weekend?"],
    ["character", "Good, went walking along the coast."],
    ["user", "What made you pick the coast? I keep meaning to go."],
    ["character", "The weather finally held."],
    ["user", "That sounds like the right way to use it. Which part did you walk?"],
    ["character", "The northern stretch."],
  ];
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

function failingProvider(failures: number): AiProvider {
  let calls = 0;
  return {
    name: "failing",
    model: "test",
    async complete() {
      calls += 1;
      if (calls <= failures) throw new Error("upstream 503 unavailable");
      return { text: '{"whatWorked":["ok"],"observation":"o","principle":"p","exampleAlternative":"e"}' };
    },
  };
}

describe("AI outage handling", () => {
  it("retries transient failures and succeeds on the second attempt", async () => {
    const provider = failingProvider(1);
    const result = await completeWithRetry(provider, { system: "s", messages: [{ role: "user", content: "c" }] });
    expect(result.text).toContain("whatWorked");
  });

  it("gives up after retries and lets the caller fall back", async () => {
    const provider = failingProvider(99);
    await expect(
      completeWithRetry(provider, { system: "s", messages: [{ role: "user", content: "c" }], }, 2),
    ).rejects.toThrow("upstream 503");
  });

  it("does not retry non-transient 4xx failures", async () => {
    let calls = 0;
    const provider: AiProvider = {
      name: "auth-fail",
      model: "test",
      async complete() {
        calls += 1;
        throw new Error("anthropic 401 unauthorized");
      },
    };
    await expect(completeWithRetry(provider, { system: "s", messages: [] })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("the deterministic evaluation is byte-identical whether or not a model exists", () => {
    const sim = simulation();
    const withModel = evaluateSimulation(sim, "eval.x", "2026-01-01T11:00:00.000Z");
    const withoutModel = evaluateSimulation(sim, "eval.x", "2026-01-01T11:00:00.000Z");
    expect(withModel).toEqual(withoutModel);
    expect(withModel.source).toBe("deterministic");
  });

  it("labels fallback envelopes honestly so the UI can say which mode is showing", () => {
    const envelope = fallbackEnvelope({ reply: "Mm." }, "AI call failed (upstream 503). Showing the built-in version.");
    expect(envelope.source).toBe("fallback");
    expect(envelope.provider).toBeNull();
    expect(envelope.note).toContain("built-in version");
  });
});
