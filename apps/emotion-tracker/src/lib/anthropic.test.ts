import { describe, it, expect } from "vitest";
import { __test } from "./gemini";

const { buildSystemPrompt, ASK_TOOL, CONCLUDE_TOOL, MODEL } = __test;

describe("Reflect prompts — regression", () => {
  it("uses the expected model", () => {
    expect(MODEL).toMatch(/sonnet/i);
  });

  it("buildSystemPrompt encodes the structured pipeline", () => {
    const p = buildSystemPrompt(0);
    expect(p).toMatch(/event → observations → assumptions → emotion/i);
    expect(p).toMatch(/alternative interpretations/i);
    expect(p).toMatch(/intended outcome/i);
    expect(p).toMatch(/follow-up/i);
  });

  it("does not assert 'you have bias' as fact outside quoted examples — quotes as counter-examples are allowed", () => {
    const p = buildSystemPrompt(2);
    // The prompt must never unhedged-assert the pattern; it quotes it only to forbid it
    const withoutForbiddenExamples = p.replace(/NEVER write "[^"]+"/gi, "");
    expect(withoutForbiddenExamples).not.toMatch(/you have .* bias/i);
  });

  it("requires hedged bias language (may/might + evidence for/against + confidence)", () => {
    const p = buildSystemPrompt(0);
    expect(p).toMatch(/This interpretation may involve/i);
    expect(p).toMatch(/evidenceFor.*evidenceAgainst/i);
    expect(p).toMatch(/confidence/i);
    expect(p).toMatch(/0\.45/);
  });

  it("directs ask_followup to advance the pipeline step-wise", () => {
    expect(ASK_TOOL.description).toMatch(/pipeline/i);
    expect(ASK_TOOL.input_schema.properties.question.description).toMatch(/pipeline|observations|assumptions|alternatives|outcome|action/i);
  });

  it("enforces min questions before conclude", () => {
    expect(buildSystemPrompt(0)).toMatch(/at least 3 more/i);
    expect(buildSystemPrompt(3)).not.toMatch(/at least .* more/i);
  });

  it("caps at MAX questions", () => {
    const p = buildSystemPrompt(0);
    expect(p).toMatch(/Never more than 5/i);
  });

  it("conclude_reflection trace requires observations/assumptions/alternatives/outcome/action/followUpAt", () => {
    const props = CONCLUDE_TOOL.input_schema.properties.trace.properties;
    expect(props.observations).toBeDefined();
    expect(props.assumptions).toBeDefined();
    expect(props.alternativeInterpretations).toBeDefined();
    expect(props.intendedOutcome).toBeDefined();
    expect(props.intendedAction).toBeDefined();
    expect(props.followUpAt).toBeDefined();
  });

  it("bias items require hedged description + evidenceFor/evidenceAgainst + confidence", () => {
    const bias = CONCLUDE_TOOL.input_schema.properties.possibleBiases.items;
    const props = (bias as unknown as { properties: Record<string, unknown> }).properties;
    expect(props.description).toBeDefined();
    expect((props.description as { description: string }).description).toMatch(/HEDGED/i);
    expect(props.evidenceFor).toBeDefined();
    expect(props.evidenceAgainst).toBeDefined();
    expect(props.confidence).toBeDefined();
  });

  it("requires hedgedDisclaimer when biases are flagged", () => {
    expect(CONCLUDE_TOOL.input_schema.properties.hedgedDisclaimer).toBeDefined();
  });
});
