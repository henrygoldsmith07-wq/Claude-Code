// Pure validators shared by the API route and the UI — and exercised directly by regression tests.
// They enforce the structured pipeline and the hedged-language contract.

import type { BiasFlag, LongitudinalReview, ReflectionSummary, StructuredTrace } from "./types";

const FORBIDDEN_CERTAINTY_RE = /\b(you have|you are suffering from|diagnosis|you suffer from)\b/i;
const MIN_CONFIDENCE_THRESHOLD = 0.45;

export function containsFalseCertainty(text: string): boolean {
  return FORBIDDEN_CERTAINTY_RE.test(text);
}

export function isHedgedDescription(text: string): boolean {
  // Hedged bias descriptions should contain a hedge and avoid forbidden certainty phrases
  if (containsFalseCertainty(text)) return false;
  return /\b(may|might|could|appears|seems|possibly|perhaps)\b/i.test(text);
}

export function validateBiasFlag(b: BiasFlag): string[] {
  const errors: string[] = [];
  if (!b.type || !b.type.trim()) errors.push("bias type is required");
  if (!b.description || !b.description.trim()) errors.push("bias description is required");
  else {
    if (containsFalseCertainty(b.description)) {
      errors.push(`bias description must not assert false certainty [${b.type}]`);
    }
    if (!isHedgedDescription(b.description)) {
      errors.push(`bias description should be hedged (may/might/could…) [${b.type}]`);
    }
  }
  if (!Array.isArray(b.evidenceFor)) errors.push("evidenceFor must be an array");
  if (!Array.isArray(b.evidenceAgainst)) errors.push("evidenceAgainst must be an array");
  if (typeof b.confidence !== "number" || b.confidence < 0 || b.confidence > 1) {
    errors.push("confidence must be a number in [0,1]");
  } else if (b.confidence > 0 && b.confidence < MIN_CONFIDENCE_THRESHOLD) {
    // Below threshold, the flag should have been omitted entirely rather than hedged — warn
    errors.push(`confidence ${b.confidence} below hedged threshold; omit the flag instead`);
  }
  return errors;
}

export function validateTrace(t: StructuredTrace): string[] {
  const errors: string[] = [];
  if (!t.event || !t.event.trim()) errors.push("trace.event is required");
  if (!Array.isArray(t.observations) || t.observations.length === 0) errors.push("trace.observations (at least 1) required");
  if (!Array.isArray(t.alternativeInterpretations) || t.alternativeInterpretations.length === 0)
    errors.push("trace.alternativeInterpretations (at least 1) required");
  if (!t.namedEmotion || !t.namedEmotion.trim()) errors.push("trace.namedEmotion is required");
  if (!t.intendedOutcome || !t.intendedOutcome.trim()) errors.push("trace.intendedOutcome is required");
  if (!t.intendedAction || !t.intendedAction.trim()) errors.push("trace.intendedAction is required");
  if (!t.predictedOutcome || !String(t.predictedOutcome).trim()) errors.push("trace.predictedOutcome is required (what did I think would happen?)");
  // Check false certainty in observation vs assumption leakage — observations shouldn't contain mind-reading
  const obsText = t.observations.join(" ");
  if (/\b(they think|they believe|they want to make me)\b/i.test(obsText)) {
    errors.push("observations should be factual, not mind-reading; move inferences to assumptions");
  }
  return errors;
}

export function validateSummary(s: ReflectionSummary): string[] {
  const errors: string[] = [];
  if (!s.trace) errors.push("summary.trace is required");
  else errors.push(...validateTrace(s.trace));
  if (!s.coreEmotion || !s.coreEmotion.trim()) errors.push("coreEmotion is required");
  if (!Array.isArray(s.possibleBiases)) errors.push("possibleBiases must be an array");
  else {
    for (const b of s.possibleBiases) errors.push(...validateBiasFlag(b));
  }
  if (s.possibleBiases.length > 0) {
    if (!s.hedgedDisclaimer || !s.hedgedDisclaimer.trim()) {
      errors.push("hedgedDisclaimer is required when biases are flagged");
    } else if (containsFalseCertainty(s.hedgedDisclaimer)) {
      errors.push("hedgedDisclaimer must not assert false certainty");
    }
  }
  if (!s.balancedAssessment || !s.balancedAssessment.trim()) errors.push("balancedAssessment is required");
  return errors;
}

const VALID_VERDICTS: LongitudinalReview["assumptionVerdict"][] = ["supported", "unsupported", "partial", "unclear"];

export function validateLongitudinalReview(r: LongitudinalReview | null | undefined): string[] {
  if (!r) return [];
  const hasAny = Boolean(r.actualActionTaken || r.actualOutcome || r.assumptionVerdict || r.calibrationNote);
  if (!hasAny) return [];
  const errors: string[] = [];
  if (r.assumptionVerdict !== null && !VALID_VERDICTS.includes(r.assumptionVerdict)) {
    errors.push("assumptionVerdict must be supported|unsupported|partial|unclear");
  }
  // If a review is started, actualOutcome is the core field
  if (r.assumptionVerdict !== null && (!r.actualOutcome || !r.actualOutcome.trim())) {
    errors.push("actualOutcome is required when recording a verdict");
  }
  if (r.actualOutcome && r.actualOutcome.trim().length > 2000) errors.push("actualOutcome too long");
  if (r.calibrationNote && r.calibrationNote.trim().length > 2000) errors.push("calibrationNote too long");
  return errors;
}

export const VALIDATION = { MIN_CONFIDENCE_THRESHOLD, VALID_VERDICTS } as const;
