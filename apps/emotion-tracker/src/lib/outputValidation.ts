// outputValidation.ts — strengthen structured schemas; reject/retry invalid outputs.

import { validateSummary, containsFalseCertainty } from "./validation";
import type { ReflectionSummary } from "./types";

export type ValidationOutcome = "accept" | "retry" | "reject";

export interface ValidationResult {
  outcome: ValidationOutcome;
  errors: string[];
  summary: ReflectionSummary | null;
}

export function validateProviderOutput(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null) return { outcome: "reject", errors: ["response is not an object"], summary: null };
  const r = raw as Record<string, unknown>;
  // must be either {question} or {summary}
  if ("question" in r && typeof r.question === "string") {
    const q = String(r.question).trim();
    if (!q) return { outcome: "retry", errors: ["question is empty"], summary: null };
    if (containsFalseCertainty(q)) return { outcome: "retry", errors: ["question contains false certainty"], summary: null };
    return { outcome: "accept", errors: [], summary: null };
  }
  if ("trace" in r || "coreEmotion" in r) {
    const summary = raw as ReflectionSummary;
    const errors = validateSummary(summary);
    // additional hard checks beyond validateSummary
    if (!summary.trace?.observations || summary.trace.observations.length === 0) errors.push("missing observations — cannot render interpretation without evidence");
    if (!summary.trace?.alternativeInterpretations || summary.trace.alternativeInterpretations.length === 0) errors.push("missing alternative interpretations — unsupported single-reading output");
    // contradictory output: assumptions equal observations verbatim (leakage)
    const obsSet = new Set((summary.trace?.observations ?? []).map((s) => s.trim().toLowerCase()));
    for (const a of summary.trace?.assumptions ?? []) {
      if (obsSet.has(a.trim().toLowerCase())) errors.push(`assumption duplicates observation: "${a.slice(0, 40)}"`);
    }
    // unsupported certainty in any field
    const allText = [summary.balancedAssessment ?? "", summary.otherPerspective ?? "", ...(summary.possibleBiases ?? []).map((b) => b.description), summary.hedgedDisclaimer ?? ""].join(" ");
    if (containsFalseCertainty(allText)) errors.push("output contains false certainty (you have / diagnosis)");
    // missing evidence: bias flagged but evidenceFor thin
    for (const b of summary.possibleBiases ?? []) {
      if (!b.evidenceFor || b.evidenceFor.length === 0 || b.evidenceFor.every((s) => !s.trim() || s.length < 8)) {
        errors.push(`bias "${b.type}" missing substantive evidenceFor`);
      }
      if (!b.evidenceAgainst || b.evidenceAgainst.length === 0) errors.push(`bias "${b.type}" missing evidenceAgainst`);
    }
    // malformed provider response: confidence out of bounds
    for (const b of summary.possibleBiases ?? []) {
      if (typeof b.confidence !== "number" || b.confidence < 0 || b.confidence > 1) errors.push(`bias "${b.type}" confidence out of [0,1]`);
    }
    if (errors.length === 0) return { outcome: "accept", errors: [], summary };
    // retry for structure-ish errors, reject for certainty violations
    const hasCertainty = errors.some((e) => /false certainty/i.test(e));
    return { outcome: hasCertainty ? "reject" : "retry", errors, summary: null };
  }
  return { outcome: "reject", errors: ["response is neither a question nor a summary"], summary: null };
}

export function formatValidationErrors(errors: string[]): string {
  return `Reflection did not meet structured/hedged requirements: ${errors.join(" · ")}`;
}

// Retry helper: call provider up to N times until valid
export async function withValidationRetry<T>(
  attempt: () => Promise<T>,
  validate: (value: T) => ValidationResult,
  opts: { maxRetries?: number; onRetry?: (errors: string[], attempt: number) => void } = {}
): Promise<T> {
  const max = opts.maxRetries ?? 2;
  let lastErrors: string[] = [];
  for (let i = 0; i <= max; i++) {
    const value = await attempt();
    const result = validate(value);
    if (result.outcome === "accept") return value;
    lastErrors = result.errors;
    if (result.outcome === "reject") throw new Error(formatValidationErrors(lastErrors));
    if (i < max) opts.onRetry?.(lastErrors, i + 1);
    else throw new Error(formatValidationErrors(lastErrors));
  }
  throw new Error(formatValidationErrors(lastErrors));
}
