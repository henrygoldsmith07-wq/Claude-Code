// ---------------------------------------------------------------------------
// Multi-step working analysis.
//
// Exam questions reward working, not just answers. When the rubric has
// already marked a part, this module digs into the working itself: it splits
// the student's response into steps, checks each against the model working
// (or the mark scheme / learning claims when the model answer is a single
// line), and pinpoints the FIRST step where the student goes wrong. That is
// what an examiner's marginal note does — "here is where the marks stop".
// ---------------------------------------------------------------------------

import { pointCoverage, numericEquivalent } from "./marking";
import { mathsEquivalent } from "./maths-equivalence";
import type { QuestionPart } from "./types";

export interface StudentStep {
  index: number;
  text: string;
}

export interface FirstIncorrect {
  /** 0-based index into the student's steps. */
  stepIndex: number;
  studentStep: string;
  /** The model step this one should have matched (best guess). */
  expected: string;
  /** 0–1 similarity of this step to its best model match. */
  similarity: number;
  reason:
    | "content-mismatch"
    | "missing-expected-step"
    | "unrecognised-step"
    | "working-runs-out";
}

export interface WorkingAnalysis {
  modelSteps: string[];
  steps: StudentStep[];
  /** First step that diverges, or null when all steps match the model. */
  firstIncorrect: FirstIncorrect | null;
  /** True when every student step matched and no model step was skipped. */
  consistentWithModel: boolean;
}

/** Split working into discrete steps: one per line, or on `=>`, `;`, or "then". */
export function splitSteps(text: string): string[] {
  // Non-capturing group: a capturing alternative would insert `undefined`
  // entries when another branch (\n, =>, ;) wins the split.
  const raw = (text ?? "")
    .split(/\n|=>|;|\b(?:then|therefore|so)\b/i)
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  return raw.length ? raw : [];
}

/**
 * Model steps for a part: prefer the model answer's own line structure; when
 * the model answer is a single line but the part declares learning claims,
 * use those (they are written 1:1 with the mark scheme).
 */
export function modelStepsForPart(part: QuestionPart): string[] {
  const fromModel = splitSteps(part.modelAnswer);
  if (fromModel.length > 1) return fromModel;
  const claims = (part.learningClaims ?? []).filter((c) => c.trim());
  return claims.length ? claims : fromModel;
}

/** 0–1 similarity of one step to one model step (symbolic > numeric > keyword). */
export function stepSimilarity(studentStep: string, modelStep: string): number {
  const sym = mathsEquivalent(studentStep, modelStep);
  if (sym === "equivalent") return 1;
  // A proven-different expression is a strong mismatch signal; do not let a
  // shared digit (both contain "2" or "6") disguise it as a near-match.
  if (sym === "not-equivalent") return 0.15;
  if (numericEquivalent(modelStep, studentStep)) return 0.8;
  return pointCoverage(modelStep, studentStep);
}

const STEP_THRESHOLD = 0.6;

/**
 * Find the first incorrect step in the student's working.
 *
 * Alignment: for each student step, take its best similarity to ANY model
 * step. The first student step below threshold is the first incorrect step.
 * If every written step passes but a model step is never covered, that
 * omission is reported (working runs out before the answer).
 */
export function firstIncorrectStep(part: QuestionPart, answer: string): WorkingAnalysis {
  const modelSteps = modelStepsForPart(part);
  const steps = splitSteps(answer).map((text, index) => ({ index, text }));

  if (!steps.length) {
    return {
      modelSteps,
      steps,
      firstIncorrect: modelSteps.length
        ? {
            stepIndex: 0,
            studentStep: "",
            expected: modelSteps[modelSteps.length - 1]!, // the final answer they never reached
            similarity: 0,
            reason: "working-runs-out",
          }
        : null,
      consistentWithModel: false,
    };
  }

  const covered = new Array<boolean>(modelSteps.length).fill(false);
  let nextModel = 0;

  // An examiner reads working line by line, so alignment is sequential: each
  // student step is expected to match the NEXT model step first. (Symbolic
  // equality alone cannot order algebra steps — every line of an expansion is
  // the same polynomial — so order is what disambiguates them.)
  for (const step of steps) {
    if (nextModel >= modelSteps.length) {
      // Working continues past the model — treat as extra, not an error.
      continue;
    }
    const forward = stepSimilarity(step.text, modelSteps[nextModel]!);
    if (forward >= STEP_THRESHOLD) {
      covered[nextModel] = true;
      nextModel++;
      continue;
    }

    // Does this step match a LATER model step instead? Then the student
    // skipped an expected step before it.
    let laterIndex = -1;
    let laterScore = 0;
    for (let mi = nextModel + 1; mi < modelSteps.length; mi++) {
      const s = stepSimilarity(step.text, modelSteps[mi]!);
      if (s > laterScore) {
        laterScore = s;
        laterIndex = mi;
      }
    }
    if (laterIndex >= 0 && laterScore >= STEP_THRESHOLD) {
      return {
        modelSteps,
        steps,
        firstIncorrect: {
          stepIndex: step.index,
          studentStep: step.text,
          expected: modelSteps[nextModel]!,
          similarity: 0,
          reason: "missing-expected-step",
        },
        consistentWithModel: false,
      };
    }

    // This step matches nothing in the model — it is where the marks stop.
    return {
      modelSteps,
      steps,
      firstIncorrect: {
        stepIndex: step.index,
        studentStep: step.text,
        expected: modelSteps[nextModel]!,
        similarity: forward,
        reason: "content-mismatch",
      },
      consistentWithModel: false,
    };
  }

  // All written steps passed; look for the first skipped model step.
  const skipped = covered.findIndex((c) => !c);
  if (skipped >= 0) {
    return {
      modelSteps,
      steps,
      firstIncorrect: {
        stepIndex: steps[steps.length - 1]?.index ?? 0,
        studentStep: steps[steps.length - 1]?.text ?? "",
        expected: modelSteps[skipped],
        similarity: 0,
        reason: "missing-expected-step",
      },
      consistentWithModel: false,
    };
  }

  return { modelSteps, steps, firstIncorrect: null, consistentWithModel: true };
}

/** Convenience: does this response's working match the model throughout? */
export function consistentWithModel(part: QuestionPart, answer: string): boolean {
  return firstIncorrectStep(part, answer).consistentWithModel;
}
