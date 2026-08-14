/**
 * Fact extraction — turns engine output into the numeric whitelist the guard
 * enforces. Kept separate from the guard so that adding a new surface (a new
 * report, a new answer type) means adding an extractor here, not loosening the
 * guard.
 */

import type { Finding } from "../discovery/finding.js";
import type { ExperimentResult } from "../experiments/analysis.js";
import type { NumericFact } from "./guard.js";

function fact(label: string, value: number, decimals = 2): NumericFact | null {
  if (!Number.isFinite(value)) return null;
  return { label, value: value.toFixed(decimals) };
}

export function factsFromFinding(finding: Finding): NumericFact[] {
  const facts: (NumericFact | null)[] = [
    { label: "sample size", value: String(finding.sampleSize) },
    fact("effect size", finding.effect.value),
    fact("confidence score", finding.confidence.score),
  ];

  if (finding.effect.ci) {
    facts.push(fact("effect interval lower bound", finding.effect.ci.low));
    facts.push(fact("effect interval upper bound", finding.effect.ci.high));
    facts.push({ label: "confidence level", value: String(Math.round(finding.effect.ci.level * 100)) });
  }
  if (finding.test) {
    facts.push(fact("p-value", finding.test.pValue, 4));
    if (finding.test.adjustedP !== undefined) facts.push(fact("adjusted p-value", finding.test.adjustedP, 4));
    if (finding.test.familySize !== undefined) {
      facts.push({ label: "comparisons tested", value: String(finding.test.familySize) });
    }
  }

  // Any number already present in the deterministic statement is by definition
  // engine-computed, so it belongs in the whitelist too.
  for (const token of finding.statement.matchAll(/-?\d+(?:\.\d+)?/g)) {
    facts.push({ label: "value quoted in the finding", value: token[0] });
  }

  return facts.filter((entry): entry is NumericFact => entry !== null);
}

export function factsFromExperiment(result: ExperimentResult): NumericFact[] {
  const facts: (NumericFact | null)[] = [
    { label: "sessions in condition A", value: String(result.adherence.conditionASessions) },
    { label: "sessions in condition B", value: String(result.adherence.conditionBSessions) },
    fact("observed effect", result.observedEffect),
    fact("predicted effect", result.predictedEffect),
    fact("achieved power", result.achievedPower),
    fact("adherence", result.adherence.adherence),
  ];

  if (result.differenceCi) {
    facts.push(fact("difference interval lower bound", result.differenceCi.low, 3));
    facts.push(fact("difference interval upper bound", result.differenceCi.high, 3));
  }
  if (result.comparison) facts.push(fact("p-value", result.comparison.pValue, 4));

  for (const token of result.summary.matchAll(/-?\d+(?:\.\d+)?/g)) {
    facts.push({ label: "value quoted in the summary", value: token[0] });
  }

  return facts.filter((entry): entry is NumericFact => entry !== null);
}

/** Merges fact sets, de-duplicating on the canonical value. */
export function mergeFacts(...sets: NumericFact[][]): NumericFact[] {
  const seen = new Map<string, NumericFact>();
  for (const set of sets) {
    for (const entry of set) if (!seen.has(entry.value)) seen.set(entry.value, entry);
  }
  return [...seen.values()];
}
