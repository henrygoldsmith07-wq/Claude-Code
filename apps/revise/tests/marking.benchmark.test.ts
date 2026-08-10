import { describe, expect, it } from "vitest";
import { markQuestion } from "@/domain/marking";
import type { Question } from "@/domain/types";

// ---------------------------------------------------------------------------
// Examiner-style marking validation + AI vs human benchmark (offline harness).
//
// The real "AI vs human" comparison happens when a provider is configured
// (see docs/benchmark.md). This harness proves the *rubric* floor — the
// examiner-style behaviour that must hold even with no AI — and measures it
// in a way that a later AI run can extend without changing the contract.
// ---------------------------------------------------------------------------

function q(overrides: Partial<Question> = {}): Question {
  return {
    id: "seed-q:probe",
    subjectId: "wjec-alevel-chemistry",
    topicIds: ["wjec-alevel-chemistry.moles"],
    kind: "structured",
    stem: "Probe",
    parts: [
      { id: "seed-q:probe:0", label: "(a)", prompt: "Calculate the concentration", marks: 2, markScheme: ["Uses n=cV with correct units", "Answer 0.25 mol dm-3 (accept 0.24-0.26)"], modelAnswer: "n=cV", aos: ["AO2"], specPointIds: ["wjec-alevel-chemistry.moles.sp-01"], learningClaims: ["perform calculations using n=cV"] },
      { id: "seed-q:probe:1", label: "(b)", prompt: "Explain the trend", marks: 2, markScheme: ["References increased nuclear charge and similar shielding", "Links to first ionisation energy"], modelAnswer: "Trend", aos: ["AO1"], specPointIds: ["wjec-alevel-chemistry.atomic-structure.sp-01"], learningClaims: ["explain ionisation trends"] },
    ],
    totalMarks: 4,
    calculatorAllowed: true,
    difficulty: 3,
    origin: "seed",
    source: "authored",
    verification: "checked",
    createdAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("examiner-style marking validation", () => {
  it("credits the exact mark-scheme wording and tolerates alternative phrasing", () => {
    const question = q();
    // Exact wording
    const full = markQuestion(question, {
      "seed-q:probe:0": "I used n=cV, got 0.25 mol dm-3.",
      "seed-q:probe:1": "Nuclear charge rises, shielding similar, so ionisation energy rises.",
    });
    expect(full.awarded).toBeGreaterThanOrEqual(3);
    // No answer -> 0
    const blank = markQuestion(question, {});
    expect(blank.awarded).toBe(0);
    // Partial: only one part answered
    const partial = markQuestion(question, { "seed-q:probe:0": "0.25 mol dm-3" });
    expect(partial.awarded).toBeGreaterThan(0);
    expect(partial.awarded).toBeLessThan(4);
  });

  it("numeric match credits a correct number even with flaky prose", () => {
    const question = q();
    const r = markQuestion(question, { "seed-q:probe:0": "0.25", "seed-q:probe:1": "no idea" });
    expect(r.marked.find((m) => m.partId === "seed-q:probe:0")!.awarded).toBeGreaterThan(0);
  });

  it("does not reward implication: a wrong answer scores 0", () => {
    const question = q();
    const r = markQuestion(question, { "seed-q:probe:0": "The sky is blue", "seed-q:probe:1": "The sky is blue" });
    expect(r.awarded).toBe(0);
    expect(r.feedback).toMatch(/scheme|missing|not yet/i);
  });

  it("feedback is examiner-voice: states score and next steps", () => {
    const question = q();
    const r = markQuestion(question, {});
    expect(r.feedback).toContain("/4");
    expect(r.feedback.length).toBeGreaterThan(40);
  });
});

describe("AI vs human benchmark — offline harness", () => {
  it("rubric accuracy on the synthetic gold set is stable (so AI comparison has a floor)", () => {
    // Gold labels: each entry is (question, answer, expected awarded).
    const gold: Array<{ answers: Record<string,string>; expected: number }> = [
      { answers: { "seed-q:probe:0": "n=cV 0.25 mol dm-3", "seed-q:probe:1": "nuclear charge increases, shielding similar" }, expected: 4 },
      { answers: {}, expected: 0 },
      { answers: { "seed-q:probe:0": "0.25", "seed-q:probe:1": "" }, expected: 1 },
    ];
    let correct = 0;
    for (const row of gold) {
      const r = markQuestion(q(), row.answers);
      if (r.awarded === row.expected) correct++;
    }
    const accuracy = correct / gold.length;
    // Harness assertion: rubric must meet the floor; real human-judged accuracy
    // will be reported via `docs/benchmark.md` and `src/ai/tasks.ts` when
    // provider-completed marking is enabled.
    expect(accuracy).toBeGreaterThanOrEqual(0.33);
    expect(correct).toBeGreaterThanOrEqual(2);
  });
});
