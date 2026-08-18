/**
 * AI boundary and Ask Pulse.
 *
 * The guard tests are the ones that matter: a language model is allowed to
 * make Pulse's prose nicer and is never allowed to change a number. Everything
 * else about the AI layer is negotiable; that rule is not.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { buildAllowedNumbers, buildPrompt, guardNarrative, narrate, offlineModel, type LanguageModel } from "../src/ai/guard.js";
import { factsFromExperiment, factsFromFinding, mergeFacts } from "../src/ai/facts.js";
import { parseQuestion } from "../src/ask/intents.js";
import { createDefaultRegistry } from "../src/metrics/catalogue.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import type { Pulse } from "../src/pulse.js";
import type { Finding } from "../src/discovery/finding.js";

const registry = createDefaultRegistry();

const finding: Finding = {
  id: "f1",
  createdAt: "2025-06-30T00:00:00Z",
  evidenceClass: "correlation",
  title: "Question accuracy is higher after exercise",
  statement: "Across 42 revision sessions, sessions within four hours of exercise had 8.7% higher question accuracy.",
  metricIds: ["study.accuracy", "exercise.volume"],
  sources: ["revise", "arise"],
  sampleSize: 42,
  sampleDescription: "18 within window vs 24 outside",
  effect: { kind: "hedges_g", value: 0.45, magnitude: "small", label: "+0.45 SD", ci: { low: 0.12, high: 0.78, level: 0.95 } },
  confidence: { level: "moderate", score: 0.62, reasons: ["Based on 42 observations"], limitations: [] },
  confounders: [],
  causalityNote: "This is an association, not a cause.",
  nextAction: null,
  evidence: [{ kind: "events", description: "42 sessions", metricIds: ["study.accuracy"], sources: ["revise"], eventCount: 42, dateRange: null }],
  tags: [],
};

function fixedModel(response: string): LanguageModel {
  return { async complete() { return response; } };
}

describe("the numeric guard", () => {
  const facts = factsFromFinding(finding);

  it("extracts every engine-computed number as a permitted fact", () => {
    const values = facts.map((fact) => fact.value);
    expect(values).toContain("42");
    expect(values.some((value) => value.startsWith("0.45"))).toBe(true);
    expect(values).toContain("8.7");
  });

  it("accepts a rewrite that only reuses permitted numbers", () => {
    const result = guardNarrative(
      "Over 42 sessions, accuracy ran 8.7% higher when exercise came within four hours.",
      facts,
    );
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("rejects a rewrite that invents a number", () => {
    const result = guardNarrative("Accuracy was 23.4% higher across 42 sessions.", facts);
    expect(result.ok).toBe(false);
    expect(result.violations[0]!.token).toBe("23.4");
  });

  it("rejects a subtly wrong restatement of a real number", () => {
    // 8.9 is not 8.7, and this is exactly the failure that would be invisible.
    expect(guardNarrative("Accuracy was 8.9% higher.", facts).ok).toBe(false);
  });

  it("tolerates legitimate re-rendering of the same quantity", () => {
    const allowed = buildAllowedNumbers([{ label: "effect", value: "0.45" }]);
    expect(allowed.has("0.45")).toBe(true);
    expect(allowed.has("45")).toBe(true); // as a percentage
    expect(allowed.has("0.5")).toBe(true); // rounded to one decimal
  });

  it("allows small counting numbers used in ordinary prose", () => {
    expect(guardNarrative("There are 2 things worth noting here.", facts).ok).toBe(true);
  });

  it("falls back to the deterministic text when the model invents a number", async () => {
    const result = await narrate(
      { deterministic: finding.statement, facts, task: "explain" },
      fixedModel("Your accuracy jumped by a massive 31% after exercise."),
    );
    expect(result.usedModel).toBe(false);
    expect(result.text).toBe(finding.statement);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("falls back when the model introduces causal language", async () => {
    const result = await narrate(
      { deterministic: finding.statement, facts, task: "explain" },
      fixedModel("Exercise causes your accuracy to rise by 8.7% across 42 sessions."),
    );
    expect(result.usedModel).toBe(false);
    expect(result.violations[0]!.token).toBe("causal-language");
  });

  it("uses the model's text when it stays inside the facts", async () => {
    const result = await narrate(
      { deterministic: finding.statement, facts, task: "explain" },
      fixedModel("Across 42 sessions, the ones soon after exercise scored 8.7% higher."),
    );
    expect(result.usedModel).toBe(true);
    expect(result.text).toMatch(/8.7/);
  });

  it("falls back silently when the model errors or returns nothing", async () => {
    const broken: LanguageModel = { async complete() { throw new Error("no network"); } };
    await expect(narrate({ deterministic: "x", facts, task: "summarise" }, broken)).resolves.toMatchObject({ usedModel: false, text: "x" });
    await expect(narrate({ deterministic: "x", facts, task: "summarise" }, offlineModel)).resolves.toMatchObject({ usedModel: false });
  });

  it("works with no model configured at all", async () => {
    const result = await narrate({ deterministic: finding.statement, facts, task: "explain" });
    expect(result.text).toBe(finding.statement);
    expect(result.usedModel).toBe(false);
  });

  it("builds a prompt that states the constraint and lists the facts", () => {
    const prompt = buildPrompt({ deterministic: finding.statement, facts, task: "explain", context: ["Accuracy is a ratio"] });
    expect(prompt).toMatch(/Do not add numbers/);
    expect(prompt).toMatch(/do not claim that anything causes anything/);
    expect(prompt).toMatch(/sample size: 42/);
    expect(prompt).toMatch(/Accuracy is a ratio/);
  });

  it("merges fact sets without duplicating values", () => {
    const merged = mergeFacts(facts, facts);
    expect(new Set(merged.map((fact) => fact.value)).size).toBe(merged.length);
  });

  it("extracts facts from an experiment result too", () => {
    const facts = factsFromExperiment({
      experimentId: "e1",
      hypothesisId: "h1",
      analysedAt: "2025-07-01T00:00:00Z",
      verdict: "supported",
      summary: "Accuracy was 12.0% higher.",
      reasons: [],
      comparison: null,
      secondaryComparison: null,
      differenceCi: { low: 0.02, high: 0.14, level: 0.95 },
      observedEffect: 0.5,
      predictedEffect: 0.45,
      adherence: { assignedDays: 28, daysWithSessions: 24, adherence: 0.857, conditionASessions: 30, conditionBSessions: 28, outOfWindowSessions: 0 },
      washout: null,
      confidence: { level: "moderate", score: 0.6, reasons: [], limitations: [] },
      causalityNote: "",
      blocks: [],
      achievedPower: 0.72,
    });
    const values = facts.map((fact) => fact.value);
    expect(values).toContain("30");
    expect(values).toContain("12.0");
  });
});

describe("question parsing", () => {
  it.each([
    ["When do I revise most effectively?", "best-time"],
    ["What time of day is best for studying?", "best-time"],
    ["Does exercise affect study performance?", "does-x-affect-y"],
    ["Does French speaking practice improve later recall?", "does-x-affect-y"],
    ["Which revision methods produce the best retention?", "best-method"],
    ["Which routines predict missed study sessions?", "predicts-missed"],
    ["Which behaviours tend to precede my strongest days?", "precedes-strong-days"],
    ["What changed this week?", "what-changed"],
    ["What should I test next?", "what-to-test"],
  ])("understands %s", (question, expected) => {
    expect(parseQuestion(question, registry).intent).toBe(expected);
  });

  it("identifies the metrics a question is about", () => {
    const parsed = parseQuestion("Does exercise affect study accuracy?", registry);
    expect(parsed.outcomeMetricId).toBe("study.accuracy");
    expect(parsed.exposureMetricId).toBe("exercise.volume");
  });

  it("puts the outcome metric on the outcome side regardless of word order", () => {
    const parsed = parseQuestion("Is my study accuracy related to sleep?", registry);
    expect(parsed.outcomeMetricId).toBe("study.accuracy");
    expect(parsed.exposureMetricId).toBe("wellbeing.sleep");
  });

  it("returns an explicit unknown rather than guessing", () => {
    const parsed = parseQuestion("What is the airspeed velocity of an unladen swallow?", registry);
    expect(parsed.intent).toBe("unknown");
    expect(parsed.parseConfidence).toBe(0);
  });
});

describe("Ask Pulse answers", () => {
  let pulse: Pulse;

  beforeAll(async () => {
    const harness = await createSyntheticPulse({ days: 180, seed: "ask-suite" });
    pulse = harness.pulse;
    pulse.discover();
  });

  it("answers when I revise most effectively, with the sample behind it", () => {
    const answer = pulse.ask("When do I revise most effectively?");
    expect(answer.intent).toBe("best-time");
    expect(answer.declined).toBe(false);
    expect(answer.statement).toMatch(/highest in the/);
    expect(answer.statement).toMatch(/sessions/);
    expect(answer.evidence[0]!.sampleSize).toBeGreaterThan(20);
    // Never asserts a cause.
    expect(answer.statement).toMatch(/not proof that the time itself is responsible/);
  });

  it("answers a relationship question and carries the caveats", () => {
    const answer = pulse.ask("Does exercise affect study accuracy?");
    expect(answer.intent).toBe("does-x-affect-y");
    expect(answer.statement.length).toBeGreaterThan(40);
    // Either it found something (and disclaims causation) or it found nothing
    // (and says a null result is weak). Both are acceptable; silence is not.
    expect(answer.statement).toMatch(/association|not a cause|did not find|not the same as proving/i);
  });

  it("does not treat a null result as proof of no effect", () => {
    const answer = pulse.ask("Does meal plan adherence affect study accuracy?");
    if (answer.findings.length === 0) {
      expect(answer.statement).toMatch(/not the same as proving there is no relationship/);
    }
  });

  it("answers which method produces the best retention, and flags self-selection", () => {
    const answer = pulse.ask("Which revision methods produce the best retention?");
    expect(answer.intent).toBe("best-method");
    if (!answer.declined) {
      expect(answer.statement).toMatch(/comes out ahead|not a verdict/);
      expect(answer.caveats.join(" ")).toMatch(/easier or harder/);
    }
  });

  it("answers what changed this week from the brief", () => {
    const answer = pulse.ask("What changed this week?");
    expect(answer.intent).toBe("what-changed");
    expect(answer.statement.length).toBeGreaterThan(10);
  });

  it("answers what to test next, or says nothing is ready", () => {
    const answer = pulse.ask("What should I test next?");
    expect(answer.intent).toBe("what-to-test");
    expect(answer.statement).toMatch(/experiment|hypothesis|Keep logging|strong enough/i);
  });

  it("answers which behaviours precede the strongest days, with heavy caveats", () => {
    const answer = pulse.ask("Which behaviours tend to precede my strongest days?");
    expect(answer.intent).toBe("precedes-strong-days");
    if (!answer.declined) {
      expect(answer.statement).toMatch(/not a mechanism/);
      expect(answer.caveats.join(" ")).toMatch(/nothing about this comparison was controlled/i);
    }
  });

  it("declines a question it cannot ground in data", () => {
    const answer = pulse.ask("Will I pass my exams?");
    expect(answer.declined).toBe(true);
    expect(answer.caveats.join(" ")).toMatch(/only answers questions it can support/);
  });

  it("declines, with the count, when a metric has too little data", async () => {
    // Ten days yields only a handful of speaking sessions — well under the
    // pronunciation metric's declared minimum.
    const { pulse: thin } = await createSyntheticPulse({ days: 10, seed: "thin-ask" });
    const answer = thin.ask("When is my pronunciation best?");
    expect(answer.declined).toBe(true);
    expect(answer.statement).toMatch(/I have \d+ sessions|I only have \d+ days|I need at least|concentrated in one part/);
  });

  it("is deterministic", () => {
    const first = pulse.ask("When do I revise most effectively?");
    const second = pulse.ask("When do I revise most effectively?");
    expect(second.statement).toBe(first.statement);
  });
});

describe("ask never leaks sensitive data", () => {
  it("excludes Reflect from answers unless it was granted", async () => {
    const { pulse } = await createSyntheticPulse({ days: 120, seed: "sensitive-ask", includeReflect: true });
    // Reflect is granted in this harness, but `events()` still withholds it
    // from the analytic path by default.
    expect(pulse.events().some((event) => event.source === "reflect")).toBe(false);
    expect(pulse.events({ includeSensitive: true }).some((event) => event.source === "reflect")).toBe(true);

    const answer = pulse.ask("How is my mood?");
    expect(JSON.stringify(answer)).not.toMatch(/reflect\.entry/);
  });
});
