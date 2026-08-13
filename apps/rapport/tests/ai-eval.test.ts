import { describe, expect, it } from "vitest";
import { BENCHMARK_CASES, SAFETY_PROBES, toSimulation } from "@/ai/benchmark";
import { evaluateSimulation, scoreTranscript, selectImprovement } from "@/domain/evaluation";
import { checkPracticeRequest } from "@/domain/safety";
import { JSON_HINTS, MAX_TOKENS, PROMPT_VERSIONS, SYSTEM_PROMPTS, TEMPERATURES } from "@/ai/prompts";
import { AI_TASKS, RESPONSE_SCHEMAS, aiRequestSchema, fallbackEnvelope } from "@/ai/types";
import { extractJson } from "@/ai/provider";

// ---------------------------------------------------------------------------
// AI quality evaluation.
//
// These run with no provider configured, which is the point: they test the
// contracts and the deterministic behaviour that the AI layer is required to
// preserve. A prompt change that alters what the model is allowed to do fails
// here (versions, hints and schemas must stay in step); a change to the
// evaluator that makes feedback harsher or scoring miscalibrated fails on the
// benchmark set.
// ---------------------------------------------------------------------------

const NOW = "2026-01-01T12:00:00.000Z";

describe("evaluator calibration on the benchmark set", () => {
  for (const benchmark of BENCHMARK_CASES) {
    it(`${benchmark.id}: ranks the expected behaviours`, () => {
      const scores = scoreTranscript(toSimulation(benchmark));
      const byKey = new Map(scores.map((score) => [score.key, score]));

      for (const key of benchmark.expectWeakest) {
        const score = byKey.get(key);
        expect(score, `${benchmark.id} missing ${key}`).toBeDefined();
        expect(score!.score, `${key} scored ${score!.score}`).toBeLessThan(0.45);
        // The product names exactly one improvement, so the benchmark asserts
        // on that decision rather than on the raw ordering: this is the
        // sentence the user would actually read.
        const chosen = selectImprovement(scores);
        expect(chosen?.key, `${benchmark.id} chose ${chosen?.key}`).toBe(key);
      }

      for (const key of benchmark.expectStrong) {
        const score = byKey.get(key);
        expect(score?.score ?? 0, `${benchmark.id} ${key}`).toBeGreaterThan(0.5);
      }
    });
  }

  it("separates the competent conversation from the weak ones overall", () => {
    const mean = (id: string) => {
      const benchmark = BENCHMARK_CASES.find((item) => item.id === id)!;
      const scores = scoreTranscript(toSimulation(benchmark)).filter((score) => score.reliable);
      return scores.reduce((sum, score) => sum + score.score, 0) / scores.length;
    };
    expect(mean("bench.good-follow-up")).toBeGreaterThan(mean("bench.topic-hopping"));
    expect(mean("bench.good-follow-up")).toBeGreaterThan(mean("bench.interview"));
  });

  it("is stable — repeated evaluation gives identical numbers", () => {
    for (const benchmark of BENCHMARK_CASES) {
      const simulation = toSimulation(benchmark);
      expect(scoreTranscript(simulation)).toEqual(scoreTranscript(simulation));
    }
  });
});

describe("feedback quality", () => {
  it("never returns more than one improvement", () => {
    for (const benchmark of BENCHMARK_CASES) {
      const evaluation = evaluateSimulation(toSimulation(benchmark), `eval.${benchmark.id}`, NOW);
      expect(evaluation.highestImpactImprovement.behaviour).toBeTruthy();
      expect(evaluation.whatWorked.length).toBeLessThanOrEqual(2);
    }
  });

  it("avoids excessive criticism: weak conversations still get either praise or an honest limit", () => {
    for (const benchmark of BENCHMARK_CASES) {
      const evaluation = evaluateSimulation(toSimulation(benchmark), `eval.${benchmark.id}`, NOW);
      const text = [...evaluation.whatWorked, evaluation.highestImpactImprovement.observation].join(" ");
      // No verdicts about the person.
      expect(text.toLowerCase()).not.toMatch(/you are (?:bad|poor|weak|terrible)|you always|you never/);
    }
  });

  it("teaches a transferable principle rather than a line to say", () => {
    for (const benchmark of BENCHMARK_CASES) {
      const evaluation = evaluateSimulation(toSimulation(benchmark), `eval.${benchmark.id}`, NOW);
      const principle = evaluation.highestImpactImprovement.principle;
      expect(principle.length).toBeGreaterThan(40);
      expect(principle.toLowerCase()).not.toMatch(/say exactly|use this line|repeat after/);
    }
  });

  it("does not repeat the same feedback across different failure modes", () => {
    const improvements = BENCHMARK_CASES.map(
      (benchmark) => evaluateSimulation(toSimulation(benchmark), `eval.${benchmark.id}`, NOW).highestImpactImprovement.behaviour,
    );
    expect(new Set(improvements).size).toBeGreaterThan(2);
  });

  it("never infers traits, mood or characteristics from a transcript", () => {
    const forbidden = /\b(anxious|shy|introvert|extrovert|confident person|personality|attractive|intelligent|autis|adhd)\w*/i;
    for (const benchmark of BENCHMARK_CASES) {
      const evaluation = evaluateSimulation(toSimulation(benchmark), `eval.${benchmark.id}`, NOW);
      const text = JSON.stringify(evaluation);
      expect(forbidden.test(text), `${benchmark.id}: ${text.match(forbidden)?.[0]}`).toBe(false);
    }
  });

  it("attaches countable evidence to every claim", () => {
    for (const benchmark of BENCHMARK_CASES) {
      const evaluation = evaluateSimulation(toSimulation(benchmark), `eval.${benchmark.id}`, NOW);
      for (const score of evaluation.scores) {
        expect(score.evidence, `${benchmark.id}/${score.key}`).toMatch(/\d/);
      }
    }
  });

  it("scales difficulty of the generated exercise to the session", () => {
    const easy = evaluateSimulation({ ...toSimulation(BENCHMARK_CASES[0]!), deliveredDifficulty: 1 }, "e1", NOW);
    const hard = evaluateSimulation({ ...toSimulation(BENCHMARK_CASES[0]!), deliveredDifficulty: 5 }, "e2", NOW);
    expect(easy.nextExercise.difficulty).toBeLessThan(hard.nextExercise.difficulty);
  });
});

describe("safety probes", () => {
  for (const probe of SAFETY_PROBES) {
    it(`${probe.id} → ${probe.expect}`, () => {
      expect(checkPracticeRequest(probe.text).verdict).toBe(probe.expect);
    });
  }

  it("does not over-refuse ordinary requests", () => {
    const ordinary = SAFETY_PROBES.filter((probe) => probe.expect === "ok");
    expect(ordinary.length).toBeGreaterThanOrEqual(4);
    for (const probe of ordinary) {
      expect(checkPracticeRequest(probe.text).verdict, probe.text).toBe("ok");
    }
  });
});

describe("AI contracts", () => {
  it("defines a prompt, hint, temperature, token budget and version for every task", () => {
    for (const task of AI_TASKS) {
      expect(SYSTEM_PROMPTS[task], task).toBeTruthy();
      expect(JSON_HINTS[task], task).toBeTruthy();
      expect(PROMPT_VERSIONS[task], task).toMatch(/-v\d+$/);
      expect(TEMPERATURES[task], task).toBeGreaterThanOrEqual(0);
      expect(MAX_TOKENS[task], task).toBeGreaterThan(100);
      expect(RESPONSE_SCHEMAS[task], task).toBeTruthy();
    }
  });

  it("states the house rules in every system prompt", () => {
    for (const task of AI_TASKS) {
      const prompt = SYSTEM_PROMPTS[task];
      expect(prompt, task).toMatch(/manipulat/i);
      expect(prompt, task).toMatch(/never invent scores|numbers are supplied/i);
      expect(prompt, task).toMatch(/appearance|identity/i);
    }
  });

  it("uses a low temperature wherever the output is a factual restatement", () => {
    expect(TEMPERATURES["summarise-reflection"]).toBeLessThanOrEqual(0.3);
    expect(TEMPERATURES["explain-insight"]).toBeLessThanOrEqual(0.4);
    // Character replies should vary; feedback should not vary much.
    expect(TEMPERATURES["simulate-turn"]).toBeGreaterThan(TEMPERATURES["phrase-feedback"]);
  });

  it("rejects malformed requests at the schema boundary", () => {
    expect(aiRequestSchema.safeParse({ task: "unknown" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ task: "coach-explain" }).success).toBe(false);
    expect(
      aiRequestSchema.safeParse({
        task: "coach-explain",
        question: "x".repeat(5000),
        skillName: "Follow-up questions",
        diagnosis: "d",
        technique: "t",
        context: "c",
      }).success,
    ).toBe(false);
  });

  it("accepts a well-formed request", () => {
    const result = aiRequestSchema.safeParse({
      task: "coach-explain",
      question: "My conversations keep dying.",
      skillName: "Follow-up questions",
      diagnosis: "Follow-up problem.",
      technique: "Listen, pick a detail, ask about it.",
      context: "You are functional on this skill.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a model reply that does not match the schema", () => {
    const schema = RESPONSE_SCHEMAS["phrase-feedback"];
    expect(schema.safeParse({ whatWorked: [], observation: "x" }).success).toBe(false);
    expect(
      schema.safeParse({
        whatWorked: ["You asked two open questions."],
        observation: "Three of five replies changed subject.",
        principle: "Reply to the last thing they said.",
        exampleAlternative: "What made you pick that?",
      }).success,
    ).toBe(true);
  });

  it("caps how much a model may write, so feedback cannot become an essay", () => {
    const schema = RESPONSE_SCHEMAS["coach-explain"];
    expect(schema.safeParse({ explanation: "x".repeat(2000), example: "y" }).success).toBe(false);
  });

  it("recovers JSON from a fenced or prosey reply", () => {
    expect(extractJson<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson<{ a: number }>('Sure! Here you go: {"a": 2} Hope that helps.')).toEqual({ a: 2 });
    expect(extractJson("no json here at all")).toBeNull();
  });

  it("labels fallback output as such", () => {
    const envelope = fallbackEnvelope({ reply: "Mm." }, "No provider configured.");
    expect(envelope.source).toBe("fallback");
    expect(envelope.provider).toBeNull();
  });
});
