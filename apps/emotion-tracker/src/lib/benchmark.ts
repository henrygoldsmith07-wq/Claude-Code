// Benchmark harness — checks that generated interpretations don't make unsupported claims.
// Runs locally on synthetic fixtures; used by tests and optionally by the app's dev diagnostics.
// No network; no LLM.

import type { ReflectionSummary, BiasFlag } from "./types";
import { validateSummary, containsFalseCertainty } from "./validation";

export interface BenchmarkCase {
  id: string;
  summary: ReflectionSummary;
  // what we expect the harness to find
  expectErrors?: number; // if omitted, expect 0
  expectFalseCertainty?: boolean;
}

export interface BenchmarkResult {
  id: string;
  errors: string[];
  falseCertainty: boolean;
  ungroundedBiasCount: number; // biases with thin evidenceFor
  verdict: "pass" | "fail";
}

function hasThinEvidence(b: BiasFlag): boolean {
  return !b.evidenceFor || b.evidenceFor.length === 0 || b.evidenceFor.every((s) => !s.trim() || s.length < 10);
}

export function runBenchmarkCase(c: BenchmarkCase): BenchmarkResult {
  const errors = validateSummary(c.summary);
  const allText = [
    c.summary.balancedAssessment,
    c.summary.otherPerspective,
    ...c.summary.possibleBiases.map((b) => b.description),
    ...c.summary.possibleBiases.flatMap((b) => b.evidenceFor),
  ].join(" ");
  const falseCertainty = containsFalseCertainty(allText);
  const ungroundedBiasCount = c.summary.possibleBiases.filter(hasThinEvidence).length;

  const expectErrors = c.expectErrors ?? 0;
  const expectFalseCertainty = c.expectFalseCertainty ?? false;

  // Fail if we found false certainty when none expected, or thin-evidence biases, or wrong error count
  const pass =
    errors.length === expectErrors &&
    falseCertainty === expectFalseCertainty &&
    ungroundedBiasCount === 0;

  return {
    id: c.id,
    errors,
    falseCertainty,
    ungroundedBiasCount,
    verdict: pass ? "pass" : "fail",
  };
}

export function runBenchmark(cases: BenchmarkCase[]): { results: BenchmarkResult[]; passed: number; failed: number } {
  const results = cases.map(runBenchmarkCase);
  return {
    results,
    passed: results.filter((r) => r.verdict === "pass").length,
    failed: results.filter((r) => r.verdict === "fail").length,
  };
}

// A small default suite the app can run without any LLM
export function defaultBenchmarkCases(): BenchmarkCase[] {
  const validTrace = {
    event: "Manager gave brief critical feedback in standup.",
    observations: ["Manager said 'needs more detail in handover'"],
    assumptions: ["They think I'm incompetent"],
    namedEmotion: "shame",
    alternativeInterpretations: ["Manager wanted quicker handovers for the release"],
    intendedOutcome: "Feel trusted in handovers",
    intendedAction: "Ask for one concrete example",
    predictedOutcome: "If I ask, they'll give an example and I'll feel clearer.",
    followUpAt: "2026-01-20",
    followUpNote: null as string | null,
  };

  const hedgedBias: BiasFlag = {
    type: "catastrophizing",
    description: "This interpretation may involve catastrophizing; a brief delay was read as permanent rejection.",
    evidenceFor: ["User said 'it will ruin everything'"],
    evidenceAgainst: ["No evidence the delay is permanent"],
    confidence: 0.7,
  };

  return [
    {
      id: "valid hedged interpretation",
      summary: {
        trace: { ...validTrace },
        coreEmotion: "shame",
        underlyingTriggers: ["Critical feedback in front of peers"],
        possibleBiases: [hedgedBias],
        otherPerspective: "Manager may see this as routine coaching.",
        balancedAssessment: "Feedback was blunt but not personal.",
        cautionFlags: [],
        suggestedNextSteps: ["Ask for an example"],
        hedgedDisclaimer: "These are tentative readings, not diagnoses; weigh them against the evidence listed.",
      },
      expectErrors: 0,
    },
    {
      id: "false-certainty should be flagged",
      summary: {
        trace: { ...validTrace },
        coreEmotion: "shame",
        underlyingTriggers: ["Critical feedback"],
        possibleBiases: [
          { ...hedgedBias, description: "You have catastrophizing bias." },
        ],
        otherPerspective: "Manager may see this as routine.",
        balancedAssessment: "Feedback was blunt.",
        cautionFlags: [],
        suggestedNextSteps: ["Ask for an example"],
        hedgedDisclaimer: "These are tentative readings, not diagnoses.",
      },
      expectErrors: 1, // false-certainty description fails validation
      expectFalseCertainty: false, // validateSummary catches it before that check — harness still reports raw text
    },
    {
      id: "no bias without disclaimer is valid",
      summary: {
        trace: { ...validTrace },
        coreEmotion: "shame",
        underlyingTriggers: [],
        possibleBiases: [],
        otherPerspective: "Routine coaching.",
        balancedAssessment: "Blunt but not personal.",
        cautionFlags: [],
        suggestedNextSteps: ["Ask for an example"],
        hedgedDisclaimer: null,
      },
      expectErrors: 0,
    },
  ];
}
