import { tokenise } from "./marking";
import type { Misconception } from "./types";

// Deterministic matching between a student's evidence and the misconception
// library. Pure: the caller supplies the entries, so the engine stays
// independent of authored content and works offline exactly like the rubric.

export interface MisconceptionMatch {
  entry: Misconception;
  /** 0–1 — how strongly the evidence carries this entry's tell-tale tokens. */
  score: number;
}

/** Fraction of the pattern's content tokens that appear in the evidence, 0–1. */
function coverage(pattern: string, evidence: string): number {
  const wanted = [...tokenise(pattern)];
  if (!wanted.length) return 0;
  const given = tokenise(evidence);
  const hits = wanted.filter((w) => given.has(w)).length;
  return hits / wanted.length;
}

/**
 * Match a missed mark-scheme point plus the student's answer against the
 * library. The `example` field carries the concrete wrong-answer symptom and
 * the `statement` carries the wrong belief, so the strongest of those four
 * comparisons is the score. Returns the best entry at or above 0.5, else null.
 */
export function matchMisconception(
  entries: readonly Misconception[],
  missedPoint: string,
  studentAnswer: string,
): MisconceptionMatch | null {
  let best: MisconceptionMatch | null = null;
  for (const entry of entries) {
    const score = Math.max(
      coverage(entry.example, missedPoint),
      coverage(entry.statement, missedPoint),
      coverage(entry.example, studentAnswer),
      coverage(entry.statement, studentAnswer),
    );
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 0.5 ? best : null;
}
